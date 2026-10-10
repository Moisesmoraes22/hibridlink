import { createClient } from "@supabase/supabase-js"

const ORIGINS = new Set(["home", "busca", "categoria", "produto", "outro"])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BOT = /bot|crawl|spider|headless|preview|lighthouse/i

// Best-effort limiter, per server instance: at most 30 clicks a minute per visitor, and the same
// offer counts once every 30 s. It stops a script from inflating the ranking or filling the table;
// ponytail: instances do not share memory, so a determined attacker can spread across them. A shared
// store (Upstash/Supabase) is the upgrade if the click ranking ever feeds payouts.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30
const SAME_OFFER_MS = 30_000
const hits = new Map<string, { count: number; reset: number }>()
const recent = new Map<string, number>()

function allowed(ip: string, offerId: string, now = Date.now()) {
  if (hits.size > 5000) hits.clear()
  if (recent.size > 5000) recent.clear()
  const bucket = hits.get(ip)
  if (!bucket || bucket.reset < now) hits.set(ip, { count: 1, reset: now + WINDOW_MS })
  else if (++bucket.count > MAX_PER_WINDOW) return false
  const key = `${ip}|${offerId}`
  const last = recent.get(key)
  if (last && now - last < SAME_OFFER_MS) return false
  recent.set(key, now)
  return true
}

/**
 * Records a click on "Ver oferta" (offer id + site area + time; nothing about the visitor).
 * Always answers 204: the visitor is already leaving for the store, and a rejected
 * click must not reveal why. Bots are not counted.
 */
export async function POST(request: Request) {
  const done = new Response(null, { status: 204 })
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return done
  if (BOT.test(request.headers.get("user-agent") ?? "")) return done

  const body = (await request.json().catch(() => null)) as { offerId?: unknown; origin?: unknown } | null
  const { offerId, origin } = body ?? {}
  if (typeof offerId !== "string" || !UUID.test(offerId)) return done

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!allowed(ip, offerId)) return done

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  })
  await supabase.from("offer_clicks").insert({
    offer_id: offerId,
    origin: typeof origin === "string" && ORIGINS.has(origin) ? origin : "outro",
  })
  return done
}
