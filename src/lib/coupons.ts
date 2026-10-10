import { createClient } from "@supabase/supabase-js"

export interface Coupon {
  code: string
  discount_kind: "percent" | "amount"
  discount_value: number
  min_purchase: number | null
  max_discount: number | null
  category: string | null
  expires_at: string | null
  affiliate_url: string | null
}

/** Valid Mercado Livre coupons, newest first (the database only returns the ones still valid: row policy). */
export async function getCoupons(limit = 200): Promise<Coupon[]> {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return []
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  const { data } = await supabase
    .from("coupons")
    .select("code, discount_kind, discount_value, min_purchase, max_discount, category, expires_at, affiliate_url")
    .order("posted_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as Coupon[]
}
