import type { Metadata } from "next"

import { CategoryTiles, type Tile } from "@/components/category-tiles"
import { FeaturedOffers } from "@/components/featured-offers"
import { HomeHero } from "@/components/home-hero"
import { HowToBuy } from "@/components/how-to-buy"
import { PriceChips } from "@/components/price-chips"
import { SiteFooter } from "@/components/site-footer"
import { StoreStrip } from "@/components/store-strip"
import { byFeatured, byRelevance, countByStoreId } from "@/lib/deals"
import { getCatalog } from "@/lib/offers"
import type { Product } from "@/lib/types"

export const revalidate = 300

export const metadata: Metadata = { alternates: { canonical: "/" } }

const FEATURED = 4

/** One door per line of the home's "Encontre o que combina com você". */
const DOORS = [
  { label: "Casa e cozinha", slug: "casa" },
  { label: "Tecnologia", slug: "eletronicos" },
  { label: "Ferramentas", slug: "ferramentas" },
]

/**
 * Four offers for the main shelf: the best-ranked among those with a recorded discount or a price
 * seen today, one per store first so no store takes the whole shelf, then the rest by rank.
 */
function pickFeatured(products: Product[]): Product[] {
  const ranked = byFeatured(products)
  const picked: Product[] = []
  const stores = new Set<string>()
  for (const p of ranked) {
    if (picked.length === FEATURED) break
    if (stores.has(p.store)) continue
    stores.add(p.store)
    picked.push(p)
  }
  for (const p of ranked) {
    if (picked.length === FEATURED) break
    if (!picked.includes(p)) picked.push(p)
  }
  return picked
}

export default async function Home() {
  const { products, live } = await getCatalog()
  const featured = live ? pickFeatured(products) : []

  // The best-ranked offer of a category lends its photo to the tile (a real product, never stock art).
  const imageOf = (slug: string) =>
    byRelevance(products.filter((p) => p.category === slug)).find((p) => p.image)?.image
  const tiles: Tile[] = [
    ...DOORS.map(({ label, slug }) => ({ label, href: `/categoria/${slug}`, image: imageOf(slug) })),
    { label: "Até R$ 100", href: "/busca?preco=0-50,50-100" },
  ]

  return (
    <main id="conteudo" className="bg-background">
      <HomeHero />
      <StoreStrip counts={countByStoreId(products)} />
      <FeaturedOffers offers={featured} />
      <CategoryTiles tiles={tiles} />
      <PriceChips />
      <HowToBuy />
      <SiteFooter />
    </main>
  )
}
