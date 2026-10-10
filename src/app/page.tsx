import type { Metadata } from "next"

import { CategoryGrid } from "@/components/category-grid"
import { DealsCarousel } from "@/components/deals-carousel"
import { ProductRow } from "@/components/product-row"
import { SiteFooter } from "@/components/site-footer"
import { InterestsSection } from "@/components/interests-section"
import { RecommendedSection } from "@/components/recommended-section"
import { PriceRangesSection } from "@/components/price-ranges-section"
import { StoresSection } from "@/components/stores-section"
import { CommerceHero } from "@/components/ui/commerce-hero"
import { FeaturedDeal } from "@/components/ui/hero-card"
import { discountOf, byClicks, byFeatured, dropsInLast, byFinds, byRelevance, capPerCategory, byPriceDrop, byRecent, categoryCounts, countByStoreId } from "@/lib/deals"
import { STORES } from "@/lib/mock-data"
import { toHeroOffer } from "@/lib/hero"
import { selectHeroOffers } from "@/lib/hero-select"
import { getCatalog, getPriceStats } from "@/lib/offers"
import type { Product } from "@/lib/types"

export const revalidate = 300

export const metadata: Metadata = { alternates: { canonical: "/" } }

const SECTION_SIZE = 9
const SHELVES = 2
const SHOWCASE_SIZE = 6
const LENS_SIZE = 10
const ALL_SIZE = 12
const POOL_PER_CATEGORY = 24
/** A section with fewer cards than this looks broken, so it is left out. */
const MIN_SECTION = 3
/** Security cameras, DVRs and CFTV kits: the highest-ticket, best-paying corner of the catalog. */
const SECURITY = /cftv|\bdvr\b|\bnvr\b|intelbras|gravador de video|c[aâ]mera.*(seguranca|\bip\b|monitoramento|vigilancia|externa|dome)|alarme|videoporteiro|speed dome/
/** Children's Day (12 Oct) shelf: shown from 1 to 13 October, then it disappears by itself. */
/** Fishing gear lives inside "esporte" (as at Mercado Livre): picked by title. */
const FISHING = /pesca|pescar|pescaria|anzol|\bisca\b|\biscas\b|vara.*(carretilha|molinete)|(carretilha|molinete).*(vara|linha|drag|libras)/
const NOT_FISHING = /pet|cachorro|gato|roupa|camisa|boneco|brinquedo|anemometro|sorvete|poco|polia|roldana|colher|inox/
const NOT_TOY = /cesto|organizador|caixa organizadora|armario|prateleira|nicho/
const isKidsDay = (now: Date) => now.getMonth() === 9 && now.getDate() <= 13
const KIT = /kit|cftv|\bdvr\b|\bnvr\b|gravador/
const securityScore = (title: string) => {
  const t = plain(title)
  return Number(KIT.test(t)) - Number(SECURITY_PART.test(t))
}
const TOOL_KIT =/furadeira|parafusadeira|esmerilhadeira|serra|martelete|lixadeira|kit|maleta|jogo de/
const NOT_SECURITY = /gopro|sport|acao|filmadora|instantanea|fotografica|webcam|dash ?cam|automotiv|uber|veicular/
/** Cables, power supplies and connectors belong to the shelf, but never lead it. */
const SECURITY_PART = /\bcabo\b|conector|fonte|balun|suporte/
const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

export default async function Home() {
  const { products, live } = await getCatalog()

  // Each product appears in one section only. Nothing is padded: a section with
  // no real data behind it simply disappears.
  // The hero only showcases real offers: with sample data it stays text and search.
  const heroProducts = live ? selectHeroOffers(products) : []
  const heroStats = await Promise.all(heroProducts.map((p) => getPriceStats(p.id)))
  const hero = heroProducts.map((p, i) => toHeroOffer(p, heroStats[i]))
  // Every hero slide is reserved, so the sections below never repeat any of them.
  const used = new Set<string>(heroProducts.map((p) => p.id))
  // Biggest recorded discounts, as a strip inside the hero (first screen, phones included).
  const showcase = live
    ? products
        .filter((p) => !used.has(p.id) && discountOf(p))
        .sort((a, b) => (discountOf(b) ?? 0) - (discountOf(a) ?? 0))
        .slice(0, SHOWCASE_SIZE)
    : []
  showcase.forEach((p) => used.add(p.id))
  // The next best discounts slide under the hero's magnifying glass (desktop).
  const lens = live
    ? products
        .filter((p) => !used.has(p.id) && discountOf(p))
        .sort((a, b) => (discountOf(b) ?? 0) - (discountOf(a) ?? 0))
        .slice(0, LENS_SIZE)
    : []
  lens.forEach((p) => used.add(p.id))
  const take = (list: Product[], size = SECTION_SIZE) => {
    const picked = list.filter((p) => !used.has(p.id)).slice(0, size)
    if (picked.length < MIN_SECTION) return [] // not shown, so its products stay available
    picked.forEach((p) => used.add(p.id))
    return picked
  }
  // Seasonal shelf first, so it gets the best toys before any other section takes them.
  const kids = isKidsDay(new Date())
    ? take(byRelevance(products.filter((p) => p.category === "brinquedos" && !NOT_TOY.test(plain(p.title)))), ALL_SIZE)
    : []
  // First pick, so the featured security shelf gets its best offers before any other section.
  const security = take(
    // Kits and recorders first: they are the high-ticket items that pay the 12% commission.
    byRelevance(products.filter((p) => p.category === "cameras" && SECURITY.test(plain(p.title)) && !NOT_SECURITY.test(plain(p.title)))).sort(
      (a, b) => securityScore(b.title) - securityScore(a.title),
    ),
    ALL_SIZE,
  )
  // Tools: power tools and kits first (high ticket), then the rest by relevance.
  const tools = take(
    byRelevance(products.filter((p) => p.category === "ferramentas")).sort(
      (a, b) => Number(TOOL_KIT.test(plain(b.title))) - Number(TOOL_KIT.test(plain(a.title))),
    ),
    ALL_SIZE,
  )
  const fishing = take(
    byRelevance(
      products.filter((p) => p.category === "esporte" && FISHING.test(plain(p.title)) && !NOT_FISHING.test(plain(p.title))),
    ),
    ALL_SIZE,
  )
  const hot = take(byClicks(products))
  const featured = take(capPerCategory(byFeatured(products), 3))
  const priceDrops = take(byPriceDrop(products))
  const finds = take(byFinds(products))
  const recent = take(byRecent(products))
  // One shelf per busiest category, best offers first with the stores mixed.
  const shelves = categoryCounts(products)
    .slice(0, SHELVES)
    .map((c) => ({ ...c, items: take(byRelevance(products.filter((p) => p.category === c.slug))) }))
    .filter((c) => c.items.length > 0)
  const allOffers = take(byRelevance(products), ALL_SIZE)

  // Candidates for "Recomendado para você" (picked in the browser from the visitor's own
  // history): the best offers of every category, so any interest has something to match.
  const ranked = byRelevance(products)
  const perCategory = new Map<string, number>()
  const recommendPool = ranked.filter((p) => {
    const n = perCategory.get(p.category) ?? 0
    perCategory.set(p.category, n + 1)
    return n < POOL_PER_CATEGORY
  })

  const storeCounts = countByStoreId(products)
  const storeNames = (["mercado_livre", "shopee", "amazon"] as const)
    .filter((id) => storeCounts[id])
    .map((id) => STORES[id].name)

  return (
    <main id="conteudo" className="bg-background">
      <CommerceHero
        storeNames={storeNames}
        showcase={showcase}
        lens={lens}
        drops={dropsInLast(products, 24)}
        categories={categoryCounts(products).slice(0, 5)}
      />
      {hero.length > 0 && <FeaturedDeal offers={hero} />}
      <CategoryGrid categories={categoryCounts(products, true).slice(0, 8)} showCounts={live} />
      {kids.length > 0 && (
        <ProductRow
          title="Dia das Crianças"
          products={kids}
          href="/categoria/brinquedos"
          linkLabel="Ver todos os brinquedos"
          chips={[
            { label: "Bonecas", href: "/busca?q=boneca" },
            { label: "Lego", href: "/busca?q=lego" },
            { label: "Hot Wheels", href: "/busca?q=hot%20wheels" },
            { label: "Quebra-cabeça", href: "/busca?q=quebra-cabeca" },
            { label: "Pelúcias", href: "/busca?q=pelucia" },
          ]}
        />
      )}
      {security.length > 0 && (
        <ProductRow
          title="Câmeras e Segurança"
          products={security}
          href="/categoria/cameras"
          linkLabel="Ver todas as câmeras"
          chips={[
            { label: "Kit CFTV", href: "/busca?q=cftv" },
            { label: "Intelbras", href: "/busca?q=intelbras" },
            { label: "Câmera Wi-Fi", href: "/busca?q=camera%20wifi" },
            { label: "Alarmes", href: "/busca?q=alarme" },
          ]}
        />
      )}
      {tools.length > 0 && (
        <ProductRow
          title="Ferramentas"
          products={tools}
          href="/categoria/ferramentas"
          linkLabel="Ver todas as ferramentas"
          chips={[
            { label: "Furadeira", href: "/busca?q=furadeira" },
            { label: "Parafusadeira", href: "/busca?q=parafusadeira" },
            { label: "Kit de ferramentas", href: "/busca?q=kit%20ferramentas" },
            { label: "Esmerilhadeira", href: "/busca?q=esmerilhadeira" },
          ]}
        />
      )}
      {fishing.length > 0 && (
        <ProductRow
          title="Pesca"
          products={fishing}
          href="/busca?q=pesca"
          linkLabel="Ver todo o material de pesca"
          chips={[
            { label: "Vara de pesca", href: "/busca?q=vara%20de%20pesca" },
            { label: "Molinete", href: "/busca?q=molinete" },
            { label: "Carretilha", href: "/busca?q=carretilha" },
            { label: "Isca artificial", href: "/busca?q=isca%20artificial" },
            { label: "Kit pesca", href: "/busca?q=kit%20pesca" },
          ]}
        />
      )}
      {hot.length > 0 && (
        <ProductRow
          title="Bombando agora"
          products={hot}
          href="/busca"
        />
      )}
      {featured.length > 0 && (
        <ProductRow
          title="Ofertas que valem a pena hoje"
          products={featured}
          href="/busca?ordenacao=desconto"
          linkLabel="Ver todas as ofertas"
        />
      )}
      {priceDrops.length > 0 && (
        <ProductRow
          title="Preço caiu"
          products={priceDrops}
          href="/busca"
        />
      )}
      {finds.length > 0 && (
        <ProductRow
          title="Achados E-Zoom"
          products={finds}
          href="/busca?ordenacao=desconto"
          cardLabel="Achado E-Zoom"
        />
      )}
      {live && <RecommendedSection pool={recommendPool} />}
      <InterestsSection products={products} />
      <PriceRangesSection products={products} />
      {/* One navy band on the whole page (the first category); the other shelves stay on the light background. */}
      {shelves.map((c, i) => (
        <DealsCarousel
          key={c.slug}
          tone={i === 0 ? "navy" : "light"}
          products={c.items}
          title={`Ofertas em ${c.name}`}
          href={`/categoria/${c.slug}`}
        />
      ))}
      {recent.length > 0 && (
        <DealsCarousel products={recent} tone="light" />
      )}
      {allOffers.length > 0 && (
        <ProductRow
          title="Todas as ofertas"
          products={allOffers}
          href="/busca"
          linkLabel="Ver todas as ofertas"
          chips={[
            { label: "Menor preço", href: "/busca?ordenacao=preco" },
            { label: "Maior desconto", href: "/busca?ordenacao=desconto" },
            { label: "Mais recentes", href: "/busca?ordenacao=recente" },
          ]}
        />
      )}
      <StoresSection counts={storeCounts} />
      <SiteFooter />
    </main>
  )
}
