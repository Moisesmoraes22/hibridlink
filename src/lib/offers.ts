import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { cache } from "react"

import { byDiscount, categoryCounts, countByStoreId, sameCategory, withVariants, type CategoryCount } from "@/lib/deals"
import { ALL_PRODUCTS, CATEGORIES } from "@/lib/mock-data"
import { isCredibleDrop, OFFER_COLUMNS, rowToProduct, type OfferRow } from "@/lib/offer-row"
import type { PriceStats, Product } from "@/lib/types"

/**
 * Safety limit only: the catalogue is read whole, from its real size, so no store is ever cut out
 * (a 6,000 ceiling once hid the whole Amazon store, the least recently seen). If this is ever hit
 * it is logged; the real fix by then is server-side search (pages must not carry the catalogue).
 */
const MAX_OFFERS = 40_000
/** Rows read per request (PostgREST caps a request at 1000) and requests in flight at once. */
const PAGE = 1000
const PARALLEL = 6
/** Old path only (before the `offer_recent_prices` function exists in the database). */
const MAX_HISTORY_ROWS = 40_000

type Supabase = SupabaseClient

/** One retry: a single dropped connection must not fail a whole page build. */
async function twice<T extends { error: unknown }>(run: () => PromiseLike<T>): Promise<T> {
  const first = await run()
  return first.error ? run() : first
}

/**
 * Live offers from Supabase (public read via RLS). Only offers with OUR affiliate link and an
 * image are shown. The sample catalogue is used only when the database is not configured or is
 * still empty; a failed query THROWS instead, so Next keeps serving the last good page rather
 * than sample products. Memoised per request, so the layout and the page share one query.
 */
type Catalog = { products: Product[]; live: boolean }
/**
 * The catalogue is kept per server process for a few minutes, with one read shared by everything
 * asking at the same time. Without it each page regeneration (and each of the build's parallel
 * workers) read ~13 pages of rows from the database on its own: timeouts at build, load at runtime.
 */
const CATALOG_TTL_MS = 5 * 60_000
let catalogMemo: { at: number; value: Promise<Catalog> } | null = null

export const getCatalog = cache((): Promise<Catalog> => {
  if (!catalogMemo || Date.now() - catalogMemo.at > CATALOG_TTL_MS) {
    const entry = { at: Date.now(), value: readCatalog() }
    catalogMemo = entry
    // A failed read must not be remembered: the next request tries again.
    entry.value.catch(() => {
      if (catalogMemo === entry) catalogMemo = null
    })
  }
  return catalogMemo.value
})

async function readCatalog(): Promise<Catalog> {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return mockCatalog()

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  })
  const counted = await twice(() => visible(supabase.from("offers").select("id", { count: "exact", head: true })))
  if (counted.error) throw new Error(`catalogue count failed: ${counted.error.message}`)
  const total = counted.count ?? 0
  if (total === 0) return mockCatalog()
  if (total > MAX_OFFERS) console.error(`[catalogue] ${total} offers, only ${MAX_OFFERS} read: move search to the server`)

  // Pages are read a few at a time; rows can move between pages while a collection runs, so ids are deduped.
  const starts = Array.from({ length: Math.ceil(Math.min(total, MAX_OFFERS) / PAGE) }, (_, i) => i * PAGE)
  const byId = new Map<string, OfferRow>()
  for (let i = 0; i < starts.length; i += PARALLEL) {
    const pages = await Promise.all(
      starts.slice(i, i + PARALLEL).map((from) =>
        twice(() =>
          visible(supabase.from("offers").select(OFFER_COLUMNS))
            .order("last_seen_at", { ascending: false })
            .order("id")
            .range(from, from + PAGE - 1),
        ),
      ),
    )
    for (const page of pages) {
      if (page.error) throw new Error(`catalogue read failed: ${page.error.message}`)
      for (const row of page.data as unknown as OfferRow[]) byId.set(row.id, row)
    }
  }

  const { pricesByOffer, dropAtByOffer } = await recentPrices(supabase)

  // Click totals (counts only) feed the ranking; if the call fails the site just ranks without them.
  const { data: clickRows } = await supabase.rpc("offer_click_counts", { days: 14 })
  const clicksByOffer = new Map<string, number>(
    ((clickRows ?? []) as { offer_id: string; clicks: number }[]).map((r) => [r.offer_id, r.clicks]),
  )

  const products = [...byId.values()].map((row) => ({
    ...rowToProduct(row, pricesByOffer.get(row.id)),
    clicks: clicksByOffer.get(row.id),
    dropAt: dropAtByOffer.get(row.id),
  }))
  // Unset fields are dropped, not sent as "$undefined": ~80k of them were ~25% of the /busca payload.
  return { products: withVariants(products).map(withoutUndefined), live: true }
}

/**
 * Last recorded prices per offer (oldest first) and, when the latest change was a real drop, when
 * it happened. One request to the `offer_recent_prices` database function (only offers with two or
 * more prices come back). Until that function exists, falls back to reading the table page by page.
 * History is a bonus: if it cannot be read the catalogue still loads, just without price markers.
 */
async function recentPrices(supabase: Supabase) {
  const pricesByOffer = new Map<string, number[]>()
  const dropAtByOffer = new Map<string, string>()

  const { data, error } = await supabase.rpc("offer_recent_prices")
  if (!error && Array.isArray(data)) {
    for (const row of data as { offer_id: string; prices: number[]; last_at: string }[]) {
      const prices = row.prices.map(Number)
      pricesByOffer.set(row.offer_id, prices)
      if (prices.length >= 2 && isCredibleDrop(prices.at(-2)!, prices.at(-1)!)) dropAtByOffer.set(row.offer_id, row.last_at)
    }
    return { pricesByOffer, dropAtByOffer }
  }

  // The DB trigger only records a row when the price changes (plus one first row per offer).
  const history: { offer_id: string; price: number; recorded_at: string }[] = []
  for (let from = 0; from < MAX_HISTORY_ROWS; from += PAGE) {
    const { data: page } = await supabase
      .from("price_history")
      .select("offer_id, price, recorded_at")
      .order("recorded_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1)
    history.push(...((page ?? []) as typeof history))
    if ((page?.length ?? 0) < PAGE) break
  }
  for (const row of history.reverse()) {
    const list = pricesByOffer.get(row.offer_id) ?? []
    const price = Number(row.price)
    if (list.length > 0 && isCredibleDrop(list.at(-1)!, price)) dropAtByOffer.set(row.offer_id, row.recorded_at)
    else if (list.length > 0) dropAtByOffer.delete(row.offer_id) // a later rise or flat change ends the drop
    list.push(price)
    pricesByOffer.set(row.offer_id, list)
  }
  return { pricesByOffer, dropAtByOffer }
}

const withoutUndefined = <T extends object>(item: T): T =>
  Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)) as T

function mockCatalog() {
  return { products: ALL_PRODUCTS, live: false }
}

/**
 * Full recorded price history of one offer (product page only; the catalog just
 * carries the last few prices). Null when nothing was recorded yet.
 */
export const getPriceStats = cache(async (offerId: string): Promise<PriceStats | null> => {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  })
  const { data } = await supabase
    .from("price_history")
    .select("price, recorded_at")
    .eq("offer_id", offerId)
    .order("recorded_at", { ascending: true })
    .limit(1000)
  if (!data?.length) return null

  const points = data.map((row) => ({ price: Number(row.price), at: row.recorded_at as string }))
  const now = Date.now()
  let weighted = 0
  let span = 0
  points.forEach((point, i) => {
    const end = i + 1 < points.length ? new Date(points[i + 1].at).getTime() : now
    const duration = Math.max(0, end - new Date(point.at).getTime())
    weighted += point.price * duration
    span += duration
  })
  const prices = points.map((p) => p.price)
  return {
    points,
    min: Math.min(...prices),
    max: Math.max(...prices),
    average: span > 0 ? weighted / span : prices.reduce((a, b) => a + b, 0) / prices.length,
    since: points[0].at,
  }
})

/**
 * Every photo of one offer (cover first), for the product page. Read apart from the catalog so the
 * lists do not carry several URLs per offer. Falls back to the cover alone while the offer has no
 * extra photos (or the column is not there yet).
 */
export const getOfferImages = cache(async (offerId: string, cover: string): Promise<string[]> => {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return [cover]

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  const { data } = await supabase.from("offers").select("images").eq("id", offerId).maybeSingle()
  const extra = Array.isArray(data?.images) ? (data.images as unknown[]).filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u)) : []
  return [...new Set([cover, ...extra])].slice(0, 8)
})

// ---------------------------------------------------------------------------
// Light queries: pages that need one offer (or only counts) must not read the whole catalogue.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STORE_IDS = ["mercado_livre", "shopee", "amazon"] as const
/** A category with fewer offers than this is hidden (same rule as `categoryCounts`). */
const MIN_CATEGORY_OFFERS = 8

function lightClient() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
}

/** The same visibility rule as the catalogue: active, with OUR affiliate link and an image. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const visible = <T extends { eq: any; not: any }>(q: T): T =>
  q.eq("is_active", true).not("affiliate_url", "is", null).not("image", "is", null)

/**
 * Categories (with enough offers) and store totals for the header and footer, from ~30 count
 * queries run in parallel instead of the whole catalogue. Falls back to the catalogue only
 * when the database is not configured (sample data).
 */
type SiteSummary = { categories: CategoryCount[]; stores: Record<string, number>; live: boolean }
/** Kept per server process for 5 minutes: the header and footer ask on every page, and counts move slowly. */
let summaryMemo: { at: number; value: SiteSummary } | null = null
const SUMMARY_TTL_MS = 5 * 60_000

export const getSiteSummary = cache(async (): Promise<SiteSummary> => {
  if (summaryMemo && Date.now() - summaryMemo.at < SUMMARY_TTL_MS) return summaryMemo.value
  const value = await computeSiteSummary()
  if (value.live) summaryMemo = { at: Date.now(), value }
  return value
})

async function computeSiteSummary(): Promise<SiteSummary> {
  {
    const supabase = lightClient()
    if (supabase) {
      const count = (column: string, value: string) =>
        visible(supabase.from("offers").select("id", { count: "exact", head: true })).eq(column, value)
      const slugs = CATEGORIES.map((c) => c.slug)
      const results = await Promise.all([
        ...slugs.map((slug) => count("category_slug", slug)),
        ...STORE_IDS.map((id) => count("store_id", id)),
      ])
      if (results.every((r) => !r.error)) {
        const total = (i: number) => results[i].count ?? 0
        const categories = CATEGORIES.map((c, i) => ({ slug: c.slug, name: c.name, count: total(i) }))
          .filter((c) => c.count >= MIN_CATEGORY_OFFERS)
          .sort((a, b) => b.count - a.count)
        const stores = Object.fromEntries(STORE_IDS.map((id, i) => [id, total(slugs.length + i)]))
        if (Object.values(stores).some((n) => n > 0)) return { categories, stores, live: true }
      }
    }
    const { products, live } = await getCatalog()
    return { categories: categoryCounts(products), stores: countByStoreId(products), live }
  }
}

/**
 * One offer by id, with its recent prices (for the "price dropped" marker). Null when it does
 * not exist, is inactive, or the database is not configured (the page then tries the samples).
 */
export const getOffer = cache(async (id: string): Promise<Product | null> => {
  const supabase = lightClient()
  if (!supabase || !UUID.test(id)) return null
  // An error is not "offer missing": throwing keeps the cached page instead of caching a 404.
  const { data: row, error } = await twice(() =>
    visible(supabase.from("offers").select(OFFER_COLUMNS)).eq("id", id).maybeSingle(),
  )
  if (error) throw new Error(`offer read failed: ${error.message}`)
  if (!row) return null
  const { data: history } = await supabase
    .from("price_history")
    .select("price, recorded_at")
    .eq("offer_id", id)
    .order("recorded_at", { ascending: true })
    .limit(60)
  const prices = (history ?? []).map((h) => Number(h.price))
  let dropAt: string | undefined
  ;(history ?? []).forEach((h, i) => {
    if (i === 0) return
    if (isCredibleDrop(prices[i - 1], prices[i])) dropAt = h.recorded_at as string
    else dropAt = undefined
  })
  return withoutUndefined({ ...rowToProduct(row as unknown as OfferRow, prices), dropAt })
})

/**
 * An offer that is no longer active (the public read policy hides it), through the narrow
 * `closed_offer` function: only what was public while it was live, never its affiliate link.
 * Used for the "oferta encerrada" page, so an expired link does not end in a bare 404.
 */
export const getClosedOffer = cache(
  async (id: string): Promise<{ id: string; title: string; image: string; price: number; store: Product["store"]; category: string } | null> => {
    const supabase = lightClient()
    if (!supabase || !UUID.test(id)) return null
    const { data } = await supabase.rpc("closed_offer", { offer_id: id })
    const row = (data as { id: string; store_id: Product["store"]; title: string; image: string | null; category_slug: string | null; price: number }[] | null)?.[0]
    if (!row) return null
    return { id: row.id, title: row.title, image: row.image ?? "", price: Number(row.price), store: row.store_id, category: row.category_slug ?? "outros" }
  },
)

/** Offers sharing the same catalogue product in OTHER stores (empty without a shared product id). */
export const getSiblings = cache(async (productId: string, store: string): Promise<Product[]> => {
  const supabase = lightClient()
  if (!supabase) return []
  const { data } = await visible(supabase.from("offers").select(OFFER_COLUMNS))
    .eq("product_id", productId)
    .neq("store_id", store)
    .limit(10)
  return ((data ?? []) as unknown as OfferRow[]).map((r) => withoutUndefined(rowToProduct(r)))
})

/** "Similar offers" (same category, closest price) and "more discounted offers", from two small queries. */
export const getRelated = cache(
  async (product: Product): Promise<{ similar: Product[]; more: Product[] }> => {
    const supabase = lightClient()
    if (!supabase) return { similar: [], more: [] }
    const [sameRows, discountRows] = await Promise.all([
      visible(supabase.from("offers").select(OFFER_COLUMNS))
        .eq("category_slug", product.category)
        .neq("id", product.id)
        .order("last_seen_at", { ascending: false })
        .limit(80),
      visible(supabase.from("offers").select(OFFER_COLUMNS))
        .not("original_price", "is", null)
        .neq("id", product.id)
        .order("last_seen_at", { ascending: false })
        .limit(400),
    ])
    const toProducts = (rows: unknown) =>
      ((rows ?? []) as OfferRow[]).map((r) => withoutUndefined(rowToProduct(r)))
    const similar = sameCategory(product, toProducts(sameRows.data))
    const shown = new Set(similar.map((p) => p.id))
    const more = byDiscount(toProducts(discountRows.data).filter((p) => !shown.has(p.id))).slice(0, 8)
    return { similar, more }
  },
)

/** Ids of the best-discounted offers, to pre-build their pages (a small query, not the catalogue). */
export async function getTopDiscountIds(limit: number): Promise<string[]> {
  const supabase = lightClient()
  if (!supabase) return []
  const { data } = await visible(supabase.from("offers").select(OFFER_COLUMNS))
    .not("original_price", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(600)
  const rows = ((data ?? []) as unknown as OfferRow[]).map((r) => rowToProduct(r))
  return byDiscount(rows).slice(0, limit).map((p) => p.id)
}
