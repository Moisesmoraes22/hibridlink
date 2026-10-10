import { createClient } from "@supabase/supabase-js"
import { cache } from "react"

import { byDiscount, categoryCounts, countByStoreId, sameCategory, withVariants, type CategoryCount } from "@/lib/deals"
import { ALL_PRODUCTS, CATEGORIES } from "@/lib/mock-data"
import { isCredibleDrop, OFFER_COLUMNS, rowToProduct, type OfferRow } from "@/lib/offer-row"
import type { PriceStats, Product } from "@/lib/types"

/**
 * Safety ceiling for the public catalog. The cut drops the offers seen LEAST recently (the
 * Amazon ones, which only come from Telegram), so it must stay well above the live count
 * (9,7k today): at 6,000 the site silently hid the whole Amazon store.
 */
const MAX_OFFERS = 15_000
/** Same idea for price_history (14k rows today, growing with every price change). */
const MAX_HISTORY_ROWS = 40_000

/**
 * Live offers from Supabase (public read via RLS). Only offers with OUR
 * affiliate link and an image are shown. Falls back to the mock catalog
 * while the database is empty or unreachable, so the site never goes blank.
 * Memoised per request, so the layout and the page share one query.
 */
export const getCatalog = cache(async (): Promise<{ products: Product[]; live: boolean }> => {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return mockCatalog()

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  })
  // PostgREST returns at most 1000 rows per request: read pages until the end.
  const data: unknown[] = []
  for (let from = 0; from < MAX_OFFERS; from += 1000) {
    const { data: page, error } = await supabase
      .from("offers")
      .select(OFFER_COLUMNS)
      .eq("is_active", true)
      .not("affiliate_url", "is", null)
      .not("image", "is", null)
      .order("last_seen_at", { ascending: false })
      .order("id")
      .range(from, from + 999)
    if (error) return mockCatalog()
    data.push(...page)
    if (page.length < 1000) break
  }

  if (!data.length) return mockCatalog()

  // The DB trigger only records a row when the price changes (plus one first row per
  // offer). Read it all, page by page (PostgREST caps a request at 1000 rows), so the
  // drops are not hidden behind thousands of first-price rows. Oldest-first per offer below.
  const history: { offer_id: string; price: number; recorded_at: string }[] = []
  for (let from = 0; from < MAX_HISTORY_ROWS; from += 1000) {
    const { data: page } = await supabase
      .from("price_history")
      .select("offer_id, price, recorded_at")
      .order("recorded_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + 999)
    history.push(...(page ?? []))
    if ((page?.length ?? 0) < 1000) break
  }
  const pricesByOffer = new Map<string, number[]>()
  const dropAtByOffer = new Map<string, string>() // when the latest change was a drop (>= 3%)
  for (const row of history.reverse()) {
    const list = pricesByOffer.get(row.offer_id) ?? []
    const price = Number(row.price)
    if (list.length > 0 && isCredibleDrop(list.at(-1)!, price)) dropAtByOffer.set(row.offer_id, row.recorded_at)
    else if (list.length > 0) dropAtByOffer.delete(row.offer_id) // a later rise or flat change ends the drop
    list.push(price)
    pricesByOffer.set(row.offer_id, list)
  }

  // Click totals (counts only) feed the ranking; if the call fails the site just ranks without them.
  const { data: clickRows } = await supabase.rpc("offer_click_counts", { days: 14 })
  const clicksByOffer = new Map<string, number>(
    ((clickRows ?? []) as { offer_id: string; clicks: number }[]).map((r) => [r.offer_id, r.clicks]),
  )

  const products = (data as OfferRow[]).map((row) => ({
    ...rowToProduct(row, pricesByOffer.get(row.id)),
    clicks: clicksByOffer.get(row.id),
    dropAt: dropAtByOffer.get(row.id),
  }))
  // Unset fields are dropped, not sent as "$undefined": ~80k of them were ~25% of the /busca payload.
  return { products: withVariants(products).map(withoutUndefined), live: true }
})

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
  const { data: row } = await visible(supabase.from("offers").select(OFFER_COLUMNS)).eq("id", id).maybeSingle()
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
