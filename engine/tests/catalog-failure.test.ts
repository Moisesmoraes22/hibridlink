import assert from "node:assert/strict"
import { test } from "node:test"

test("a database that does not answer throws instead of serving the sample catalogue", async () => {
  process.env.SUPABASE_URL = "http://database.invalid"
  process.env.SUPABASE_PUBLISHABLE_KEY = "x"
  // Every request answers 500, like a database that is down (no network involved).
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "down" }), { status: 500 })
  const { getCatalog, getOffer } = await import("@/lib/offers")
  await assert.rejects(() => getCatalog(), /catalogue count failed/)
  await assert.rejects(() => getOffer("1605fbf9-3ade-4a3b-a52d-3d96f46107c7"), /offer read failed/)
})

test("without a configured database the sample catalogue is used", async () => {
  delete process.env.SUPABASE_URL
  const { getCatalog } = await import("@/lib/offers")
  const { live, products } = await getCatalog()
  assert.equal(live, false)
  assert.ok(products.length > 0)
})
