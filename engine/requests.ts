import { createClient } from "@supabase/supabase-js"

import { withoutBlocked } from "./lib/blocklist.ts"
import { searchMercadoLivre } from "./lib/ml-search.ts"

// Brings into the catalogue the products visitors searched for and did not find (table
// `product_requests`, filled by the site's "Pedir este produto" button). Most requested first,
// a few per run, Mercado Livre catalogue search. A request with no result is marked "empty"
// (tried again after a week by the database) so the same term is not searched every run.
const PER_RUN = 10
const OFFERS_PER_TERM = 25

const { SUPABASE_URL } = process.env
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY")
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } })

const { data: pending, error } = await supabase
  .from("product_requests")
  .select("id, term, display_term, requests")
  .eq("status", "pending")
  .order("requests", { ascending: false })
  .order("last_requested_at", { ascending: false })
  .limit(PER_RUN)
if (error) throw error
if (!pending?.length) {
  console.log("[pedidos] nenhum pedido pendente")
  process.exit(0)
}

const { data: blockedRows } = await supabase.from("blocked_offers").select("store_id, external_id")
const blocked = blockedRows ?? []

for (const request of pending) {
  try {
    const found = withoutBlocked(await searchMercadoLivre(request.term, process.env, OFFERS_PER_TERM), blocked)
    const now = new Date().toISOString()
    if (found.length > 0) {
      const rows = found.map(({ seen_at, ...offer }) => ({ ...offer, is_active: true, last_seen_at: seen_at ?? now }))
      const { error: upsertError } = await supabase.from("offers").upsert(rows, { onConflict: "store_id,external_id" })
      if (upsertError) throw upsertError
    }
    await supabase
      .from("product_requests")
      .update({ status: found.length > 0 ? "fulfilled" : "empty", found: found.length, fulfilled_at: now })
      .eq("id", request.id)
    console.log(`[pedidos] "${request.term}" (${request.requests} pedidos): ${found.length} ofertas`)
  } catch (failure) {
    // Left pending: the next run tries again.
    console.error(`[pedidos] "${request.term}" falhou:`, failure instanceof Error ? failure.message : failure)
  }
}
process.exit(0)
