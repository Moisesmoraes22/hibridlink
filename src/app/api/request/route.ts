import { createClient } from "@supabase/supabase-js"

import { searchMercadoLivre } from "../../../../engine/lib/ml-search.ts"
import { normalizeTerm } from "@/lib/product-requests"

// "Peça este produto": registers a search that found nothing and, when Mercado Livre credentials
// are configured, answers at once with what the Mercado Livre catalogue has for the term.
// The result is NOT written to the database from here (the site holds no write key): the
// collector brings it in on its next run, from the request this route records.

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 8
const hits = new Map<string, { count: number; reset: number }>()

// Per server instance (as in /api/click): a script can spread across instances, which only costs
// a few extra Mercado Livre calls, each cached below.
function allowed(ip: string, now = Date.now()) {
  if (hits.size > 5000) hits.clear()
  const bucket = hits.get(ip)
  if (!bucket || bucket.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS })
    return true
  }
  return ++bucket.count <= MAX_PER_WINDOW
}

const CACHE_MS = 10 * 60_000
const cache = new Map<string, { at: number; offers: LiveOffer[] }>()

export interface LiveOffer {
  title: string
  image: string
  price: number
  originalPrice: number | null
  url: string
  freeShipping: boolean
}

async function live(term: string): Promise<LiveOffer[]> {
  const hit = cache.get(term)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.offers
  const found = await searchMercadoLivre(term, process.env, 8).catch(() => [])
  const offers = found
    .filter((o) => o.affiliate_url && o.image)
    .map((o) => ({
      title: o.title,
      image: o.image as string,
      price: o.price,
      originalPrice: o.original_price,
      url: o.affiliate_url as string,
      freeShipping: o.is_free_shipping,
    }))
  if (cache.size > 300) cache.clear()
  cache.set(term, { at: Date.now(), offers })
  return offers
}

function client() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
}

const ip = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

export async function POST(request: Request) {
  if (!allowed(ip(request))) return Response.json({ ok: false, reason: "slow-down" }, { status: 429 })
  const body = (await request.json().catch(() => null)) as { term?: unknown } | null
  const display = typeof body?.term === "string" ? body.term.trim().slice(0, 80) : ""
  const term = normalizeTerm(display)
  if (!term) return Response.json({ ok: false, reason: "invalid" }, { status: 400 })

  const supabase = client()
  if (supabase) {
    const { data } = await supabase.rpc("request_product", { p_term: term, p_display: display })
    if ((data as { ok?: boolean } | null)?.ok === false) return Response.json({ ok: false, reason: "invalid" }, { status: 400 })
  }
  return Response.json({ ok: true, term, offers: await live(term) })
}

/** Status of the visitor's own earlier requests (the terms come from their browser). */
export async function GET(request: Request) {
  const terms = (new URL(request.url).searchParams.get("terms") ?? "")
    .split(",")
    .map((t) => normalizeTerm(t))
    .filter((t): t is string => !!t)
    .slice(0, 10)
  const supabase = client()
  if (!supabase || terms.length === 0) return Response.json([])
  const { data } = await supabase.rpc("request_status", { p_terms: terms })
  return Response.json(data ?? [])
}
