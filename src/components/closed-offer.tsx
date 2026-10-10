import Link from "next/link"

import { STORES } from "@/lib/mock-data"
import type { Product } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

/** "do Mercado Livre", "da Shopee", "da Amazon". */
const FROM_STORE: Partial<Record<Product["store"], string>> = { mercado_livre: "do", shopee: "da", amazon: "da" }

/**
 * "Esta oferta acabou": shown for an offer that left the stores' lists (they last 48 h without
 * being seen). The last price is shown as a record, never as a price to buy at, and there is no
 * button to the store: the link may no longer lead to this price.
 */
export function ClosedOffer({
  offer,
  categoryName,
  categorySlug,
}: {
  offer: { title: string; image: string; price: number; store: Product["store"] }
  categoryName?: string
  categorySlug?: string
}) {
  return (
    <div className="page-container max-w-3xl py-10">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-6 text-center sm:flex-row sm:text-left">
        {offer.image && (
          <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={offer.image} alt="" className="h-full w-full object-contain p-2 opacity-70 grayscale" />
          </div>
        )}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Oferta encerrada</p>
          <h1 className="mt-1 text-lg font-bold leading-snug text-foreground sm:text-xl">{offer.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta oferta saiu {FROM_STORE[offer.store] ?? "de"} {STORES[offer.store].name} e não aparece mais no E-Zoom. O último preço que vimos
            foi {formatCurrency(offer.price)}; ele pode já não valer.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
            {categorySlug && (
              <Link
                href={`/categoria/${categorySlug}`}
                className="flex h-11 items-center rounded-lg bg-cta px-5 text-sm font-bold text-cta-foreground hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Ver ofertas de {categoryName ?? "esta categoria"}
              </Link>
            )}
            <Link
              href="/busca"
              className="flex h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Buscar outras ofertas
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
