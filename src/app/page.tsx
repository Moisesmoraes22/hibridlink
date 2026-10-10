import type { Metadata } from "next"

import { CategoryTiles, type Tile } from "@/components/category-tiles"
import { FeaturedOffers } from "@/components/featured-offers"
import { HomeHero } from "@/components/home-hero"
import { HowToBuy } from "@/components/how-to-buy"
import { PriceChips } from "@/components/price-chips"
import { SiteFooter } from "@/components/site-footer"
import { StoreStrip } from "@/components/store-strip"
import { byClicks, byFeatured, byRelevance, countByStoreId } from "@/lib/deals"
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

const SHELF = 4
/** A shelf this short looks abandoned: it shows from this many offers on, else not at all. */
const SHELF_MIN = 3
const DROP_WINDOW_H = 48

/** Real price drops (recorded) seen in the last two days, biggest drop first, never repeating a featured offer. */
function pickDrops(products: Product[], skip: Set<string>, now = Date.now()): Product[] {
  const drop = (p: Product) => (p.priceHistory ? 1 - p.price / p.priceHistory.at(-2)! : 0)
  return products
    .filter((p) => !skip.has(p.id) && p.isPriceDrop && p.dropAt && now - Date.parse(p.dropAt) < DROP_WINDOW_H * 3_600_000)
    .sort((a, b) => drop(b) - drop(a))
    .slice(0, SHELF)
}

export default async function Home() {
  const { products, live } = await getCatalog()
  const featured = live ? pickFeatured(products) : []
  const shown = new Set(featured.map((p) => p.id))
  const drops = live ? pickDrops(products, shown) : []
  drops.forEach((p) => shown.add(p.id))
  // Only what visitors really opened (3+ clicks); with little traffic the shelf simply does not appear.
  const popular = live ? byClicks(products.filter((p) => !shown.has(p.id))).slice(0, SHELF) : []

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
      {drops.length >= SHELF_MIN && (
        <FeaturedOffers
          offers={drops}
          id="baixou"
          title="Baixou de preço"
          note="Quedas que registramos nas últimas 48 horas, da maior para a menor."
          href="/busca?ordenacao=desconto"
          linkLabel="Ver ofertas com desconto"
        />
      )}
      {popular.length >= SHELF_MIN && (
        <FeaturedOffers
          offers={popular}
          id="mais-clicadas"
          title="Mais clicadas"
          note="As ofertas mais abertas pelos visitantes do E-Zoom nos últimos dias."
          href="/busca?ordenacao=relevancia"
          linkLabel="Ver todas as ofertas"
        />
      )}
      <CategoryTiles tiles={tiles} />
      <PriceChips />
      <HowToBuy />
      <SiteFooter />
    </main>
  )
}
