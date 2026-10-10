import type { StoreSource } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Each store's mark, small, next to its name (as in the visual references): the Amazon "a" with
 * its smile, the Shopee bag, and Mercado Livre's logo (handshake and name). Decorative: the
 * store name is always written next to it. In the dark theme the dark marks sit on a white chip.
 */
const MARKS: Partial<Record<StoreSource, { src: string; full?: boolean }>> = {
  // The official logo already carries the name ("mercado livre"), on white.
  mercado_livre: { src: "/lojas/mercado-livre-logo.png", full: true },
  shopee: { src: "/lojas/shopee-icon.svg" },
  amazon: { src: "/lojas/amazon-icon.svg" },
}

const HEIGHT = { sm: "h-6", md: "h-8" } as const

export function StoreLogo({
  store,
  className,
  size = "sm",
}: {
  store: StoreSource
  className?: string
  size?: keyof typeof HEIGHT
}) {
  const mark = MARKS[store]
  if (!mark) return null
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        HEIGHT[size],
        mark.full ? "rounded-md bg-white px-1" : "rounded-md px-0.5 dark:bg-white dark:px-1",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mark.src}
        alt=""
        className="h-full w-auto object-contain py-0.5"
        loading="lazy"
        decoding="async"
      />
    </span>
  )
}
