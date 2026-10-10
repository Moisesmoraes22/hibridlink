import type { OfferRow } from "../types.ts"

const API = "https://api.mercadolibre.com"

interface MlItem {
  price: number
  original_price: number | null
  condition?: string
  shipping?: { free_shipping?: boolean }
}

interface MlProduct {
  name?: string
  pictures?: { url: string }[]
}

async function token(clientId: string, clientSecret: string) {
  const response = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`ML auth failed: ${response.status}`)
  return ((await response.json()) as { access_token: string }).access_token
}

/**
 * Offers for one search term, straight from the Mercado Livre catalogue: each catalogue product
 * becomes one offer at its cheapest NEW listing. Used by the site (to answer a search that found
 * nothing, at once) and by the collector (to bring a requested product into the database).
 * Same rules as the main collector: a listing far below the next one is not trusted, and a
 * product with no listing or no photo is skipped. The seller badge is left out on purpose (it
 * costs one more call per seller and the visitor is waiting).
 */
export async function searchMercadoLivre(
  term: string,
  env: Record<string, string | undefined>,
  limit = 12,
): Promise<OfferRow[]> {
  const { ML_CLIENT_ID, ML_CLIENT_SECRET, ML_AFFILIATE_URL_TEMPLATE } = env
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) return []
  const bearer = await token(ML_CLIENT_ID, ML_CLIENT_SECRET)
  const get = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`ML ${path} failed: ${response.status}`)
    return (await response.json()) as T
  }

  const { results = [] } = await get<{ results: { id: string }[] }>(
    `/products/search?status=active&site_id=MLB&limit=${Math.min(limit * 3, 50)}&q=${encodeURIComponent(term)}`,
  ).catch(() => ({ results: [] }))

  const offers: OfferRow[] = []
  const ids = results.map((r) => r.id)
  // Small batches keep us under the API rate limit; stop once there are enough offers.
  for (let i = 0; i < ids.length && offers.length < limit; i += 6) {
    const built = await Promise.allSettled(
      ids.slice(i, i + 6).map(async (id): Promise<OfferRow | null> => {
        const [{ results: items }, product] = await Promise.all([
          get<{ results: MlItem[] }>(`/products/${id}/items?limit=10`),
          get<MlProduct>(`/products/${id}`),
        ])
        const image = product.pictures?.[0]?.url
        const sellers = items.filter((item) => item.condition === "new" && item.price > 0).sort((a, b) => a.price - b.price)
        const best = sellers[1] && sellers[0].price < sellers[1].price * 0.5 ? sellers[1] : sellers[0]
        if (!best || !image || !product.name) return null
        const url = `https://www.mercadolivre.com.br/p/${id}`
        return {
          store_id: "mercado_livre",
          external_id: id,
          title: product.name,
          image: image.replace(/^http:/, "https:"),
          // No category known for a free search: null (the site shows it as "outros"; the database has no such slug).
          category_slug: null,
          price: best.price,
          original_price: best.original_price && best.original_price > best.price ? best.original_price : null,
          url,
          affiliate_url: ML_AFFILIATE_URL_TEMPLATE ? ML_AFFILIATE_URL_TEMPLATE.replace("{url}", url) : null,
          is_free_shipping: best.shipping?.free_shipping ?? false,
          images: (product.pictures ?? []).map((p) => p.url.replace(/^http:/, "https:")).slice(0, 8),
          source: "api",
        }
      }),
    )
    for (const result of built) {
      if (result.status === "fulfilled" && result.value && offers.length < limit) offers.push(result.value)
    }
  }
  return offers
}
