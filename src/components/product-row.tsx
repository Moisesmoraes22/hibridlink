"use client"

import Link from "next/link"

import { ProductCarousel } from "@/components/product-carousel"
import { SectionHeader } from "@/components/section-header"
import type { Product } from "@/lib/types"

/** A home section: title, then the offers in one row with arrows. */
export function ProductRow({
  title,
  products,
  href = "/busca",
  linkLabel,
  cardLabel,
  chips,
}: {
  title: string
  products: Product[]
  href?: string
  linkLabel?: string
  /** Tag shown on every card of this section. */
  cardLabel?: string
  /** Quick links above the row (e.g. sort orders of the full listing). */
  chips?: { label: string; href: string }[]
}) {
  return (
    <section className="page-container section-y">
      <SectionHeader title={title} href={href} linkLabel={linkLabel} />
      {chips && (
        <div className="mb-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="flex min-h-9 items-center rounded-full border border-border px-3.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}
      <ProductCarousel ariaLabel={title} items={products.map((product) => ({ product, label: cardLabel }))} />
    </section>
  )
}
