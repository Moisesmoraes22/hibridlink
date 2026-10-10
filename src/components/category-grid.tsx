"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { createElement } from "react"

import { SectionHeader } from "@/components/section-header"
import { categoryIcon } from "@/lib/category-icons"
import { cardImage } from "@/lib/image-url"
import type { CategoryCount } from "@/lib/deals"

export function CategoryGrid({
  categories,
  showCounts,
  withHeader = true,
  title = "Categorias populares",
  gridClassName = "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8",
}: {
  categories: CategoryCount[]
  showCounts: boolean
  /** Off on /categorias, where the page has its own h1. */
  withHeader?: boolean
  title?: string
  gridClassName?: string
}) {
  return (
    <section className="page-container section-y">
      {withHeader && (
        <SectionHeader
          title={title}
          href="/categorias"
          linkLabel="Ver todas as categorias"
        />
      )}
      <div className={`grid gap-4 ${gridClassName}`}>
        {categories.map((category, index) => (
          <motion.div
            key={category.slug}
            className="h-full"
            // First row ships visible; animating from opacity 0 would hide it until hydration.
            initial={index < 4 ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.35,
              delay: index * 0.05,
              ease: "easeOut",
            }}
          >
            <Link
              href={`/categoria/${category.slug}`}
              className="group flex h-full flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
            >
              <CategoryCover covers={category.covers} slug={category.slug} name={category.name} />
              <span className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground sm:text-sm">
                  {category.name}
                </span>
                {showCounts && (
                  <span className="text-[11px] text-muted-foreground">
                    {category.count} {category.count === 1 ? "oferta" : "ofertas"}
                  </span>
                )}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/**
 * A category's cover: its four best-ranked offers in a 2x2 board on white, all in the same style
 * (never stock art), or the category icon while there are not enough photos.
 */
function CategoryCover({ covers = [], slug, name }: { covers?: string[]; slug: string; name: string }) {
  return (
    <div
      role="img"
      aria-label={name}
      className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted p-1.5 sm:h-28 sm:w-28 ring-2 ring-transparent transition-all duration-300 group-hover:ring-primary/50"
    >
      {covers.length >= 4 ? (
        <div className="grid h-full w-full grid-cols-2 gap-1.5">
          {covers.slice(0, 4).map((src) => (
            <span key={src} className="overflow-hidden rounded-lg bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cardImage(src)}
                alt=""
                width={48}
                height={48}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain p-0.5 transition-transform duration-500 motion-safe:group-hover:scale-110"
              />
            </span>
          ))}
        </div>
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-lg bg-white">
          {createElement(categoryIcon(slug), { className: "h-8 w-8 text-brand", "aria-hidden": true })}
        </span>
      )}
    </div>
  )
}
