import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { ProductCard } from "@/components/product-card"
import type { Product } from "@/lib/types"

/** The home's main shelf: four offers and, in one line, how they were chosen. */
export function FeaturedOffers({
  offers,
  id = "destaques",
  title = "Ofertas em destaque",
  note = "Com desconto registrado ou preço visto hoje, de lojas diferentes, por desconto, avaliação e procura.",
  href = "/busca?ordenacao=relevancia",
  linkLabel = "Ver todas as ofertas",
}: {
  offers: Product[]
  id?: string
  title?: string
  note?: string
  href?: string
  linkLabel?: string
}) {
  if (offers.length === 0) return null
  return (
    <section className="page-container section-y" aria-labelledby={id}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id={id} className="text-2xl font-extrabold text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{note}</p>
        </div>
        <Link
          href={href}
          className="-my-2.5 flex shrink-0 items-center gap-1 rounded-md py-2.5 text-sm font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {linkLabel}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {offers.map((product, i) => (
          <li key={product.id}>
            <ProductCard product={product} priority={i < 2} />
          </li>
        ))}
      </ul>
    </section>
  )
}
