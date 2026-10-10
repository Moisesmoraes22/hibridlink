import type { Metadata } from "next"

import { CategoryGrid } from "@/components/category-grid"
import { CouponsSection } from "@/components/coupons-section"
import { FeaturedOffers } from "@/components/featured-offers"
import { HomeHero } from "@/components/home-hero"
import { HowToBuy } from "@/components/how-to-buy"
import { InterestsSection } from "@/components/interests-section"
import { PriceChips } from "@/components/price-chips"
import { ProductRow } from "@/components/product-row"
import { SiteFooter } from "@/components/site-footer"
import { StoreStrip } from "@/components/store-strip"
import { StoresSection } from "@/components/stores-section"
import { getCoupons } from "@/lib/coupons"
import { byClicks, byFeatured, byRelevance, categoryCounts, countByStoreId } from "@/lib/deals"
import { getCatalog } from "@/lib/offers"
import type { Product } from "@/lib/types"

export const revalidate = 300

export const metadata: Metadata = { alternates: { canonical: "/" } }

const FEATURED = 4
const SHELF = 4
const ROW_SIZE = 12
/** A shelf this short looks abandoned: it shows from this many offers on, else not at all. */
const SHELF_MIN = 3
const DROP_WINDOW_H = 48

const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
const TOOL_KIT = /furadeira|parafusadeira|esmerilhadeira|serra|martelete|lixadeira|kit|maleta|jogo de/
const NOT_TOY = /cesto|organizador|caixa organizadora|armario|prateleira|nicho/
const isKidsDay = (now: Date) => now.getMonth() === 9 && now.getDate() <= 13

interface Shelf {
  slug: string
  title: string
  linkLabel: string
  chips: { label: string; q: string }[]
  /** Titles matching this come first (the higher-ticket kind of the category). */
  first?: RegExp
  /** Titles matching this are never shown on the shelf. */
  not?: RegExp
}

/**
 * The shelves, in the order of what people buy most online (electronics, fashion, food and drink,
 * DIY and tools, furniture, media, beauty, toys). Only categories the site really has appear, and
 * each one only when it has offers. Cellphones and supplements follow, as asked.
 */
const SHELVES: Shelf[] = [
  {
    slug: "eletronicos",
    title: "Eletrônicos",
    linkLabel: "Ver todos os eletrônicos",
    chips: [
      { label: "Fone de ouvido", q: "fone" },
      { label: "Smart TV", q: "smart tv" },
      { label: "Caixa de som", q: "caixa de som" },
      { label: "Carregador", q: "carregador" },
    ],
  },
  {
    slug: "moda",
    title: "Moda e vestuário",
    linkLabel: "Ver toda a moda",
    chips: [
      { label: "Tênis", q: "tenis" },
      { label: "Camiseta", q: "camiseta" },
      { label: "Mochila", q: "mochila" },
      { label: "Jaqueta", q: "jaqueta" },
    ],
  },
  {
    slug: "alimentos-bebidas",
    title: "Alimentos e bebidas",
    linkLabel: "Ver alimentos e bebidas",
    chips: [
      { label: "Café", q: "cafe" },
      { label: "Chocolate", q: "chocolate" },
      { label: "Azeite", q: "azeite" },
    ],
  },
  {
    slug: "ferramentas",
    title: "Ferramentas",
    linkLabel: "Ver todas as ferramentas",
    first: TOOL_KIT,
    chips: [
      { label: "Furadeira", q: "furadeira" },
      { label: "Parafusadeira", q: "parafusadeira" },
      { label: "Kit de ferramentas", q: "kit ferramentas" },
      { label: "Esmerilhadeira", q: "esmerilhadeira" },
    ],
  },
  {
    slug: "casa",
    title: "Casa, móveis e decoração",
    linkLabel: "Ver tudo para a casa",
    chips: [
      { label: "Sofá", q: "sofa" },
      { label: "Cadeira", q: "cadeira" },
      { label: "Colchão", q: "colchao" },
      { label: "Mesa", q: "mesa" },
    ],
  },
  {
    slug: "livros",
    title: "Livros",
    linkLabel: "Ver todos os livros",
    chips: [],
  },
  {
    slug: "beleza",
    title: "Beleza e cuidados pessoais",
    linkLabel: "Ver toda a beleza",
    chips: [
      { label: "Perfume", q: "perfume" },
      { label: "Shampoo", q: "shampoo" },
      { label: "Maquiagem", q: "maquiagem" },
      { label: "Barbeador", q: "barbeador" },
    ],
  },
  {
    slug: "brinquedos",
    title: "Brinquedos e hobbies",
    linkLabel: "Ver todos os brinquedos",
    not: NOT_TOY,
    chips: [
      { label: "Bonecas", q: "boneca" },
      { label: "Lego", q: "lego" },
      { label: "Hot Wheels", q: "hot wheels" },
      { label: "Quebra-cabeça", q: "quebra-cabeca" },
    ],
  },
  {
    slug: "celulares",
    title: "Celulares",
    linkLabel: "Ver todos os celulares",
    chips: [
      { label: "Samsung", q: "samsung" },
      { label: "Motorola", q: "motorola" },
      { label: "Xiaomi", q: "xiaomi" },
      { label: "iPhone", q: "iphone" },
    ],
  },
  {
    slug: "suplementos",
    title: "Suplementos",
    linkLabel: "Ver todos os suplementos",
    chips: [
      { label: "Whey protein", q: "whey" },
      { label: "Creatina", q: "creatina" },
      { label: "Pré-treino", q: "pre treino" },
      { label: "Vitaminas", q: "vitamina" },
    ],
  },
]

/** Children's Day (1 to 13 October): the toys shelf takes this name and chips, then goes back by itself. */
const KIDS_SHELF = {
  title: "Dia das Crianças",
  chips: [
    { label: "Bonecas", q: "boneca" },
    { label: "Lego", q: "lego" },
    { label: "Hot Wheels", q: "hot wheels" },
    { label: "Quebra-cabeça", q: "quebra-cabeca" },
    { label: "Pelúcias", q: "pelucia" },
  ],
}

/** The categories highlighted at the top, in the same order as the shelves. */
const HIGHLIGHT = ["eletronicos", "moda", "alimentos-bebidas", "ferramentas", "casa", "livros", "beleza", "brinquedos"]

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

/** Real price drops (recorded) seen in the last two days, biggest drop first. */
function pickDrops(products: Product[], skip: Set<string>, now = Date.now()): Product[] {
  const drop = (p: Product) => (p.priceHistory ? 1 - p.price / p.priceHistory.at(-2)! : 0)
  return products
    .filter((p) => !skip.has(p.id) && p.isPriceDrop && p.dropAt && now - Date.parse(p.dropAt) < DROP_WINDOW_H * 3_600_000)
    .sort((a, b) => drop(b) - drop(a))
    .slice(0, SHELF)
}

/** A category's best offers (stores mixed), skipping what is already on a shelf. */
function pickShelf(products: Product[], shelf: Shelf, skip: Set<string>): Product[] {
  const ranked = byRelevance(
    products.filter((p) => p.category === shelf.slug && !skip.has(p.id) && !(shelf.not && shelf.not.test(plain(p.title)))),
  )
  const { first } = shelf
  if (first) ranked.sort((a, b) => Number(first.test(plain(b.title))) - Number(first.test(plain(a.title))))
  return ranked.slice(0, ROW_SIZE)
}

export default async function Home() {
  const { products, live } = await getCatalog()
  const featured = live ? pickFeatured(products) : []
  const shown = new Set(featured.map((p) => p.id))
  const drops = live ? pickDrops(products, shown) : []
  drops.forEach((p) => shown.add(p.id))
  // Only what visitors really opened (3+ clicks); with little traffic the shelf simply does not appear.
  const popular = live ? byClicks(products.filter((p) => !shown.has(p.id))).slice(0, SHELF) : []
  popular.forEach((p) => shown.add(p.id))

  const kidsSeason = isKidsDay(new Date())
  const rows = live
    ? SHELVES.map((shelf) => {
        const items = pickShelf(products, shelf, shown)
        items.forEach((p) => shown.add(p.id))
        const seasonal = kidsSeason && shelf.slug === "brinquedos"
        return {
          ...shelf,
          title: seasonal ? KIDS_SHELF.title : shelf.title,
          chips: seasonal ? KIDS_SHELF.chips : shelf.chips,
          items,
        }
      }).filter((row) => row.items.length >= SHELF_MIN)
    : []

  const highlighted = categoryCounts(products, true)
    .filter((c) => HIGHLIGHT.includes(c.slug))
    .sort((a, b) => HIGHLIGHT.indexOf(a.slug) - HIGHLIGHT.indexOf(b.slug))
  const coupons = await getCoupons(3)
  const storeCounts = countByStoreId(products)

  return (
    <main id="conteudo" className="bg-background">
      <HomeHero />
      <StoreStrip counts={storeCounts} />
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
      {highlighted.length >= 4 && (
        <CategoryGrid categories={highlighted} showCounts={live} title="Categorias em destaque" />
      )}
      {rows.map((row) => (
        <ProductRow
          key={row.slug}
          title={row.title}
          products={row.items}
          href={`/categoria/${row.slug}`}
          linkLabel={row.linkLabel}
          chips={row.chips.length === 0 ? undefined : row.chips.map((c) => ({ label: c.label, href: `/busca?q=${encodeURIComponent(c.q)}` }))}
        />
      ))}
      <InterestsSection products={products} />
      <CouponsSection coupons={coupons} />
      <PriceChips />
      <StoresSection counts={storeCounts} />
      <HowToBuy />
      <SiteFooter />
    </main>
  )
}
