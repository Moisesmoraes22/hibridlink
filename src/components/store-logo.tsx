import type { StoreSource } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Each store's own logo on its own background tile (the logos have dark text, so they would
 * vanish on the dark theme without the tile). Decorative: the store name is always next to it.
 */
const LOGOS: Partial<Record<StoreSource, { src: string; bg: string }>> = {
  mercado_livre: { src: "/lojas/mercado-livre.svg", bg: "#FFE600" },
  shopee: { src: "/lojas/shopee.svg", bg: "#FFFFFF" },
  // Amazon on purpose without a logo until the Associates programme rules are checked.
}

export function StoreLogo({ store, className }: { store: StoreSource; className?: string }) {
  const logo = LOGOS[store]
  if (!logo) return null
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-lg border border-black/10 p-1", className)}
      style={{ backgroundColor: logo.bg }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.src} alt="" className="h-full w-full object-contain" loading="lazy" decoding="async" />
    </span>
  )
}
