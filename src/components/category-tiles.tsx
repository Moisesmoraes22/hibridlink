import { ArrowRight, Tag } from "lucide-react"
import Link from "next/link"

import { cardImage } from "@/lib/image-url"

export interface Tile {
  label: string
  href: string
  /** Photo of a real, well-ranked offer in that category (none: the tile shows an icon). */
  image?: string
}

/** "Encontre o que combina com você": a few doors into the catalogue, each with a real product photo. */
export function CategoryTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <section className="bg-white py-8 text-slate-900 dark:bg-card dark:text-foreground sm:py-10" aria-labelledby="combina">
      <div className="page-container">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h2 id="combina" className="text-2xl font-extrabold sm:text-3xl">
            Encontre o que combina com você
          </h2>
          <Link
            href="/categorias"
            className="-my-2.5 flex shrink-0 items-center gap-1 rounded-md py-2.5 text-sm font-semibold text-hero hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-brand"
          >
            Todas as categorias
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.label}>
              <Link
                href={tile.href}
                className="group flex h-28 items-center justify-between gap-3 overflow-hidden rounded-xl border border-border bg-background px-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex flex-col gap-2 text-lg font-bold leading-tight">
                  {tile.label}
                  <ArrowRight className="h-5 w-5 text-hero transition-transform group-hover:translate-x-1 dark:text-brand" aria-hidden />
                </span>
                {tile.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cardImage(tile.image)}
                    alt=""
                    width={112}
                    height={80}
                    loading="lazy"
                    decoding="async"
                    className="h-20 w-28 shrink-0 object-contain"
                  />
                ) : (
                  <Tag className="h-14 w-14 shrink-0 text-hero dark:text-brand" aria-hidden />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
