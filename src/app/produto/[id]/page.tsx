import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ClosedOffer } from "@/components/closed-offer"
import { DealsCarousel } from "@/components/deals-carousel"
import { ProductComments } from "@/components/product-comments"
import { ProductDetail } from "@/components/product-detail"
import type { PriceSeries } from "@/components/price-history-chart"
import { SiteFooter } from "@/components/site-footer"
import { ALL_PRODUCTS, CATEGORIES, getProductOffers, STORES } from "@/lib/mock-data"
import type { Product } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { getClosedOffer, getOffer, getOfferImages, getPriceStats, getRelated, getSiblings, getTopDiscountIds } from "@/lib/offers"
import { breadcrumbJsonLd, productJsonLd, serializeJsonLd } from "@/lib/structured-data"

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://e-zoom.vercel.app"

export const revalidate = 300

/**
 * Only the best deals are built ahead of time. Every product page loads the whole
 * catalog while building, so pre-building all of them (3,000+) ran the Vercel build
 * out of memory (again at 200 once the catalog passed 10k). The rest are generated on the
 * first visit and cached (revalidate).
 */
const PREBUILT_PAGES = 60

export async function generateStaticParams() {
  const ids = await getTopDiscountIds(PREBUILT_PAGES)
  return ids.map((id) => ({ id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const product = (await getOffer(id)) ?? ALL_PRODUCTS.find((p) => p.id === id)
  if (!product) {
    // An ended offer keeps its page (it says so and offers alternatives) but stays out of the index.
    const closed = await getClosedOffer(id)
    return closed
      ? { title: `Oferta encerrada: ${closed.title}`, robots: { index: false, follow: true } }
      : { title: "Oferta não encontrada" }
  }
  return {
    title: product.title,
    description: `${product.title} por ${formatCurrency(product.price)} em ${STORES[product.store].name}. Veja o histórico de preço e vá direto para a loja.`,
    alternates: { canonical: `/produto/${product.id}` },
    // What WhatsApp, Telegram and Facebook show when the page is shared.
    openGraph: {
      type: "website",
      siteName: "E-Zoom",
      locale: "pt_BR",
      url: `/produto/${product.id}`,
      title: product.title,
      description: `${formatCurrency(product.price)} em ${STORES[product.store].name}. Veja o histórico de preço no E-Zoom.`,
      images: [product.image],
    },
    twitter: { card: "summary_large_image" },
  }
}

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // One row, not the whole catalogue (a cold page used to take 14 s). The header's mega menu
  // still links to mock products, so keep those pages alive.
  const liveOffer = await getOffer(id)
  const product = liveOffer ?? ALL_PRODUCTS.find((p) => p.id === id)
  if (!product) {
    const closed = await getClosedOffer(id)
    if (!closed) notFound()
    const category = CATEGORIES.find((c) => c.slug === closed.category)
    return (
      <main id="conteudo" className="min-h-screen bg-background">
        <ClosedOffer offer={closed} categoryName={category?.name} categorySlug={category?.slug} />
        <SiteFooter />
      </main>
    )
  }

  const isLive = liveOffer !== null
  const stats = isLive ? await getPriceStats(product.id) : null
  const images = isLive ? await getOfferImages(product.id, product.image) : [product.image]
  const toOffer = (p: Product) => ({
    store: p.store,
    price: p.price,
    originalPrice: p.originalPrice,
    affiliateUrl: p.affiliateUrl,
    isFreeShipping: p.isFreeShipping,
  })
  // Other stores' offers count only when the database says it is the SAME product
  // (a shared product_id). Similar titles are never enough. Today nothing shares
  // an id, so live pages show one offer; the "Onde comprar" table appears by itself
  // once the collectors fill product_id.
  const siblings =
    isLive && product.productId
      ? (await getSiblings(product.productId, product.store)).sort((a, b) => a.price - b.price)
      : []
  const offers = isLive ? [product, ...siblings].map(toOffer) : getProductOffers(product)

  // One line per store when the same product has recorded history in more than one store.
  const COLORS: Record<string, string> = { mercado_livre: "#2d3277", shopee: "#ee4d2d", amazon: "#ff9900" }
  const history: PriceSeries[] = []
  if (stats) history.push({ id: product.id, label: STORES[product.store].name, color: COLORS[product.store] ?? "#2563eb", points: stats.points })
  for (const o of siblings) {
    const st = await getPriceStats(o.id)
    if (st) history.push({ id: o.id, label: STORES[o.store].name, color: COLORS[o.store] ?? "#2563eb", points: st.points })
  }

  // Suggestions use real offers only (never the sample data) and hide below 3 cards.
  const { similar, more } = isLive ? await getRelated(product) : { similar: [], more: [] }

  return (
    <main id="conteudo" className="min-h-screen bg-background">
      {/* Structured data only for real offers, never for the sample catalogue. */}
      {isLive && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd(product, SITE)) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd(
                breadcrumbJsonLd(
                  [
                    ["Início", "/"],
                    ...(CATEGORIES.find((c) => c.slug === product.category)
                      ? [[CATEGORIES.find((c) => c.slug === product.category)!.name, `/categoria/${product.category}`] as [string, string]]
                      : []),
                    [product.title, `/produto/${product.id}`] as [string, string],
                  ],
                  SITE,
                ),
              ),
            }}
          />
        </>
      )}
      <ProductDetail product={product} offers={offers} stats={stats} history={history} images={images} />
      {/* Comments need a real offer row (a uuid in the database); the sample catalogue has none. */}
      {isLive && (
        <section className="page-container pb-8">
          <ProductComments offerId={product.id} />
        </section>
      )}
      {similar.length >= 3 && (
        <DealsCarousel
          products={similar}
          title="Ofertas parecidas"
        />
      )}
      {more.length >= 3 && (
        <DealsCarousel
          products={more}
          title="Mais ofertas com desconto"
        />
      )}
      <SiteFooter />
    </main>
  )
}
