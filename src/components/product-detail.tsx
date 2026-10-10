"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  LineChart,
  MessageSquareText,
  Star,
  TrendingDown,
  Truck,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef } from "react"

import { OfferLink } from "@/components/offer-link"
import { PriceHistoryChart, type PriceSeries } from "@/components/price-history-chart"
import { ProductGallery } from "@/components/product-gallery"
import { ShareButton } from "@/components/share-button"
import { StoreBadge } from "@/components/store-badge"
import { StoreLogo } from "@/components/store-logo"
import { TimeAgo } from "@/components/time-ago"
import { Button } from "@/components/ui/button"
import { discountOf, savingsOf } from "@/lib/deals"
import { useFavorites } from "@/lib/favorites-context"
import { recordProduct } from "@/lib/interest-profile"
import { SELLER_LEADER_LABEL } from "@/lib/seller-leader"
import { CATEGORIES, STORES } from "@/lib/mock-data"
import type { PriceStats, Product, ProductOffer } from "@/lib/types"
import {
  calculateDiscountPercent,
  cn,
  formatCurrency,
  formatDay,
  formatReviewCount,
  formatSeenAt,
} from "@/lib/utils"

/** "no Mercado Livre", "na Shopee", "na Amazon": the preposition follows the store's gender. */
const IN_STORE: Partial<Record<Product["store"], string>> = { mercado_livre: "no", shopee: "na", amazon: "na" }
/** "ao Mercado Livre", "à Shopee", "à Amazon". */
const TO_STORE: Partial<Record<Product["store"], string>> = { mercado_livre: "ao", shopee: "à", amazon: "à" }

const panel = "rounded-2xl border border-border bg-card"

export function ProductDetail({
  product,
  offers,
  stats,
  history,
  images,
}: {
  product: Product
  offers: ProductOffer[]
  /** Full recorded price history (live products only). */
  stats: PriceStats | null
  /** One series per store with recorded history (the chart draws one line each). */
  history: PriceSeries[]
  /** All photos of the product, cover first. */
  images: string[]
}) {
  const { toggleFavorite, isFavorite, launchFlight } = useFavorites()
  const favorited = isFavorite(product.id)
  useEffect(() => recordProduct("view", product), [product])
  const buttonRef = useRef<HTMLButtonElement>(null)
  const bestOffer = offers[0]
  const store = STORES[bestOffer.store]
  const category = CATEGORIES.find((c) => c.slug === product.category)
  const discount = discountOf(product)
  const savings = savingsOf(product)
  const into = IN_STORE[bestOffer.store] ?? "em"
  const toward = TO_STORE[bestOffer.store] ?? "à"

  const handleToggle = () => {
    if (!favorited && buttonRef.current) {
      launchFlight(buttonRef.current, product.image)
    }
    toggleFavorite(product)
  }

  // Claims below only appear when the recorded history actually supports them.
  const tracked = stats && stats.points.length >= 2 && stats.max > stats.min ? stats : null
  const isLowest = !!tracked && product.price <= tracked.min
  const belowAverage =
    tracked && tracked.points.length >= 3 && product.price < tracked.average * 0.98
      ? calculateDiscountPercent(product.price, tracked.average)
      : null

  const facts: string[] = [
    `Vendido ${into} ${store.name}`,
    ...(bestOffer.isFreeShipping ? ["Frete grátis"] : []),
    ...(product.sellerLeader ? [SELLER_LEADER_LABEL[product.sellerLeader]] : []),
    ...(product.sellerState
      ? [`Vendedor em ${product.sellerCity ? `${product.sellerCity}, ${product.sellerState}` : product.sellerState}`]
      : []),
    ...(category ? [`Categoria: ${category.name}`] : []),
    ...(product.createdAt ? [`Encontrada em ${formatSeenAt(product.createdAt)}`] : []),
  ]

  return (
    <div className="page-container max-w-6xl py-6 sm:py-8">
      <nav aria-label="Você está em" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Link
          href={category ? `/categoria/${category.slug}` : "/busca"}
          className="-my-2 flex items-center gap-1.5 rounded-md py-2 font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar às ofertas
        </Link>
        <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground hover:underline">
              Início
            </Link>
          </li>
          {category && (
            <>
              <li aria-hidden>
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                <Link href={`/categoria/${category.slug}`} className="hover:text-foreground hover:underline">
                  {category.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-8">
        <div className={cn(panel, "self-start p-3 sm:p-4 md:col-start-1 md:row-start-1")}>
          <ProductGallery
            images={images}
            alt={product.title}
            badge={
              discount ? (
                <span className="rounded-md bg-discount px-2 py-1 text-xs font-bold text-discount-foreground">
                  -{discount}%
                </span>
              ) : undefined
            }
          />
        </div>

        <div className="flex flex-col gap-5 md:col-start-2 md:row-span-2 md:row-start-1">
          <div>
            {category && (
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{category.name}</p>
            )}
            <h1 className="mt-1 text-xl font-extrabold leading-snug text-foreground sm:text-2xl">{product.title}</h1>
            {product.rating && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-primary text-primary" aria-hidden />
                <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
                {product.reviewsCount && <span>{formatReviewCount(product.reviewsCount)} avaliações</span>}
              </div>
            )}
          </div>

          <section aria-label="Preço e compra" className={cn(panel, "p-5")}>
            <div className="flex items-center gap-3">
              <StoreLogo store={bestOffer.store} size="md" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{store.name}</span>
                <span className="mx-2 text-border" aria-hidden>
                  |
                </span>
                Oferta encontrada {into} {store.name}
              </p>
            </div>

            <p className="mt-4 text-4xl font-extrabold tabular-nums text-price sm:text-5xl">
              {formatCurrency(bestOffer.price)}
            </p>

            {(discount || isLowest) && (
              <div className="mt-2 flex flex-col gap-1.5 text-sm">
                {product.originalPrice && discount && (
                  <p className="text-muted-foreground">
                    Antes <span className="tabular-nums line-through">{formatCurrency(product.originalPrice)}</span>
                  </p>
                )}
                {savings && (
                  <p className="flex items-center gap-1.5 font-semibold text-brand">
                    <TrendingDown className="h-4 w-4" aria-hidden />
                    Economize {formatCurrency(savings)} ({discount}%)
                  </p>
                )}
                {isLowest && (
                  <p className="flex items-center gap-1.5 font-semibold text-brand">
                    <Award className="h-4 w-4" aria-hidden />
                    Menor preço que registramos
                  </p>
                )}
              </div>
            )}

            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-foreground">
              <li className="flex items-center gap-2.5">
                <Truck className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                {bestOffer.isFreeShipping ? (
                  <span>
                    <span className="font-semibold text-success">Frete grátis.</span> Prazo: consulte {into} {store.name}
                  </span>
                ) : (
                  <span>
                    Frete e prazo: consulte {into} {store.name}
                  </span>
                )}
              </li>
              {product.seenAt && (
                <li className="flex items-center gap-2.5">
                  <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    Última verificação: <TimeAgo iso={product.seenAt} relativeOnly />
                  </span>
                </li>
              )}
            </ul>

            <Button
              asChild
              size="lg"
              className="mt-6 h-14 w-full gap-2 rounded-xl bg-cta text-lg font-extrabold text-cta-foreground shadow-lg shadow-cta/30 ring-offset-2 hover:bg-cta-hover"
            >
              <OfferLink product={product} store={bestOffer.store} affiliateUrl={bestOffer.affiliateUrl}>
                Ver oferta {into} {store.name}
                <ArrowUpRight className="h-5 w-5" aria-hidden />
              </OfferLink>
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Você será direcionado {toward} {store.name} para finalizar a compra.
            </p>
            <p className="mt-1 text-center text-[11px] text-muted-foreground">
              Link de afiliado: o E-Zoom pode receber comissão, sem custo extra para você.
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-4 md:col-start-1 md:row-start-2">
        <ShareButton
          id={product.id}
          title={product.title}
          price={product.price}
          storeName={store.name}
          className="grid grid-cols-2 [&>*:nth-child(3)]:col-span-2"
          leading={
            <motion.button
              ref={buttonRef}
              type="button"
              aria-pressed={favorited}
              onClick={handleToggle}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                favorited
                  ? "border-primary bg-primary/10 text-brand"
                  : "border-border text-foreground hover:border-primary/50 hover:text-brand",
              )}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={favorited ? "on" : "off"}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Bookmark className={cn("h-4 w-4", favorited && "fill-current")} aria-hidden />
                </motion.span>
              </AnimatePresence>
              {favorited ? "Oferta salva" : "Salvar oferta"}
            </motion.button>
          }
        />

        <p className="text-sm">
          <OfferLink
            product={product}
            store={bestOffer.store}
            affiliateUrl={bestOffer.affiliateUrl}
            className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
          >
            <MessageSquareText className="h-4 w-4" aria-hidden />
            Ver avaliações de compradores {into} {store.name}
          </OfferLink>
        </p>

        <div className="flex gap-3 rounded-xl bg-accent p-4 text-accent-foreground">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
          <div className="text-sm">
            <p className="font-bold">Confira antes de comprar</p>
            <p className="mt-0.5 text-muted-foreground">
              Confirme o modelo, o preço e o frete na página da loja. Preços e disponibilidade podem mudar.
            </p>
          </div>
        </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="sobre" className={cn(panel, "p-5 sm:p-6")}>
          <h2 id="sobre" className="text-xl font-extrabold text-foreground">
            Sobre o produto
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-foreground">
            {facts.map((fact) => (
              <li key={fact} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-hero dark:text-brand" aria-hidden />
                {fact}
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-3">
            <OfferLink
              product={product}
              store={bestOffer.store}
              affiliateUrl={bestOffer.affiliateUrl}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
            >
              Ver descrição completa {into} {store.name}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </OfferLink>
          </div>
        </section>

        <section aria-labelledby="historico" className={cn(panel, "p-5 sm:p-6")}>
          <h2 id="historico" className="flex items-center gap-2 text-xl font-extrabold text-foreground">
            <LineChart className="h-5 w-5 text-brand" aria-hidden />
            Histórico de preço
          </h2>

          {tracked ? (
            <>
              <PriceHistoryChart
                series={history}
                now={Math.max(
                  new Date(product.seenAt ?? 0).getTime(),
                  ...history.map((h) => new Date(h.points[h.points.length - 1].at).getTime()),
                )}
              />
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Atual</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{formatCurrency(product.price)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Menor registrado</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{formatCurrency(tracked.min)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Maior registrado</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{formatCurrency(tracked.max)}</dd>
                </div>
              </dl>
              {belowAverage && (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand">
                  <TrendingDown className="h-4 w-4" aria-hidden />
                  {belowAverage}% abaixo da média do período ({formatCurrency(tracked.average)})
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Acompanhamos este preço desde {formatDay(tracked.since)} · {tracked.points.length} registros. Só
                aparecem preços que o E-Zoom viu; não há dados de antes disso.
              </p>
            </>
          ) : (
            <div className="mt-4 flex items-start gap-3 text-sm text-muted-foreground">
              <Clock className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground/60" aria-hidden />
              <p>
                {stats
                  ? `Acompanhamos este preço desde ${formatDay(stats.since)} e ele ainda não mudou. `
                  : "Ainda estamos reunindo dados deste produto. "}
                Quando houver histórico suficiente, ele aparecerá aqui.
              </p>
            </div>
          )}
        </section>
      </div>

      {offers.length > 1 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-extrabold text-foreground">Onde comprar</h2>
          <div className="overflow-hidden rounded-2xl border border-border">
            {offers.map((offer, index) => {
              const offerDiscount = calculateDiscountPercent(offer.price, offer.originalPrice)
              return (
                <div
                  key={offer.store}
                  className={cn(
                    "flex flex-col gap-3 bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
                    index !== offers.length - 1 && "border-b border-border",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <StoreBadge store={offer.store} />
                    {offer.isFreeShipping && (
                      <span className="flex items-center gap-1 text-xs font-medium text-success">
                        <Truck className="h-3.5 w-3.5" aria-hidden />
                        Frete grátis
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {offer.originalPrice && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatCurrency(offer.originalPrice)}
                        </p>
                      )}
                      <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(offer.price)}</p>
                      {offerDiscount && <p className="text-xs font-semibold text-brand">-{offerDiscount}%</p>}
                    </div>
                    <Button asChild variant="outline" className="rounded-lg">
                      <OfferLink product={product} store={offer.store} affiliateUrl={offer.affiliateUrl}>
                        Ver oferta
                      </OfferLink>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
        <Info className="h-5 w-5 shrink-0 text-brand" aria-hidden />
        <p className="font-semibold">A compra é feita na loja. O E-Zoom reúne e apresenta as ofertas.</p>
        <Link
          href="/como-funciona"
          className="flex items-center gap-1 font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Como funciona
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
