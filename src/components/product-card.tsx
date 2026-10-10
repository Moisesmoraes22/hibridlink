"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useRef } from "react"
import Link from "next/link"
import { ArrowUpRight, Bookmark, Star, Truck } from "lucide-react"

import { OfferLink } from "@/components/offer-link"
import { StoreLogo } from "@/components/store-logo"
import { discountOf } from "@/lib/deals"
import { useFavorites } from "@/lib/favorites-context"
import { cardImage } from "@/lib/image-url"
import { STORES } from "@/lib/mock-data"
import type { Product } from "@/lib/types"
import { cn, formatCurrency, formatReviewCount } from "@/lib/utils"

/**
 * Offer card v2: store on top, the whole photo on white, the title, one big price, and what is
 * really known about payment and shipping. A button that names the store goes straight to it.
 * Nothing is shown that the data does not have ("No Pix", "Sem cupom" need real fields).
 */
export function ProductCard({
  product,
  className,
  label,
  compact = false,
  priority = false,
}: {
  product: Product
  className?: string
  /** Tighter padding and type, for rows with 5-6 cards side by side. */
  compact?: boolean
  /** Above-the-fold card: load the photo right away with high priority (it can be the LCP). */
  priority?: boolean
  /** Small tag above the title, e.g. "Achado E-Zoom". */
  label?: string
}) {
  const { toggleFavorite, isFavorite, launchFlight } = useFavorites()
  const favorited = isFavorite(product.id)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const discount = discountOf(product)
  const store = STORES[product.store]

  const handleToggle = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!favorited && buttonRef.current) {
      launchFlight(buttonRef.current, product.image)
    }
    toggleFavorite(product)
  }

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className={cn("flex items-center gap-2 pr-14", compact ? "px-3 pt-3" : "px-4 pt-4")}>
        <StoreLogo store={product.store} />
        <span className="truncate text-xs font-semibold text-muted-foreground">{store.name}</span>
      </div>

      <Link
        href={`/produto/${product.id}`}
        className="flex flex-1 flex-col transition-transform duration-150 active:scale-[0.99]"
      >
        <div className="relative aspect-square w-full">
          {discount && (
            <span className="absolute left-3 top-1.5 z-10 rounded-md bg-discount px-1.5 py-0.5 text-[11px] font-bold text-discount-foreground">
              -{discount}%
            </span>
          )}
          <div
            className={cn(
              "absolute flex items-center justify-center overflow-hidden rounded-xl bg-white",
              compact ? "inset-3" : "inset-4",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardImage(product.image)}
              alt={product.title}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              decoding="async"
              onError={(e) => {
                if (e.currentTarget.src !== product.image) e.currentTarget.src = product.image
              }}
              className="h-full w-full object-contain p-1 transition-transform duration-500 motion-safe:group-hover:scale-105"
            />
          </div>
        </div>

        <div className={cn("flex flex-1 flex-col gap-1.5", compact ? "px-3 pb-2" : "px-4 pb-3")}>
          {label && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">{label}</span>
          )}
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground">
            {product.title}
          </h3>

          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-extrabold tabular-nums text-price">
              {formatCurrency(product.price)}
            </span>
            {product.originalPrice && discount && (
              <span className="text-xs tabular-nums text-muted-foreground line-through">
                {formatCurrency(product.originalPrice)}
              </span>
            )}
          </div>

          {/* A recorded drop without a store "previous price": say it plainly, from our own history. */}
          {!discount && product.isPriceDrop && product.priceHistory && product.priceHistory.length >= 2 && (
            <span className="text-xs font-semibold text-success">
              Caiu de {formatCurrency(product.priceHistory[product.priceHistory.length - 2])}
            </span>
          )}

          {product.installments && (
            <span className="text-sm text-foreground">
              em {product.installments.count}x de {formatCurrency(product.installments.value)}
            </span>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
            {product.isFreeShipping ? (
              <span className="flex items-center gap-1 font-semibold text-success">
                <Truck className="h-3.5 w-3.5" aria-hidden />
                Frete grátis
              </span>
            ) : (
              <span className="text-muted-foreground">Frete e condições na loja</span>
            )}
            {product.rating && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden />
                <span className="font-medium text-foreground">{product.rating.toFixed(1)}</span>
                {product.reviewsCount && <span>({formatReviewCount(product.reviewsCount)})</span>}
              </span>
            )}
          </div>
        </div>
      </Link>

      {product.variants && (
        <Link
          href={`/busca?q=${encodeURIComponent(product.variants.query)}`}
          className={cn(
            "mb-2 text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            compact ? "mx-3" : "mx-4",
          )}
        >
          +{product.variants.count}{" "}
          {product.variants.count === 1
            ? product.variants.noun.replace(/res$/, "r").replace("opções", "opção")
            : product.variants.noun}{" "}
          · ver todos
        </Link>
      )}

      <div className={compact ? "px-3 pb-3" : "px-4 pb-4"}>
        <OfferLink
          product={product}
          store={product.store}
          affiliateUrl={product.affiliateUrl}
          className="group/cta flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-cta py-2 text-sm font-bold text-cta-foreground transition-colors duration-200 hover:bg-cta-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Ver {product.store === "mercado_livre" ? "no" : "na"} {store.name}
          <ArrowUpRight
            className="h-4 w-4 transition-transform duration-200 group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5"
            aria-hidden
          />
        </OfferLink>
      </div>

      <motion.button
        ref={buttonRef}
        type="button"
        aria-pressed={favorited}
        aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        onClick={handleToggle}
        whileTap={{ scale: 0.82 }}
        animate={favorited ? { scale: [1, 1.25, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={cn(
          "absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300",
          favorited
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-primary hover:text-primary-foreground",
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={favorited ? "filled" : "outline"}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Bookmark className={cn("h-5 w-5", favorited && "fill-current")} aria-hidden />
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
