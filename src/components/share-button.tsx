"use client"

import { Check, Link2, Share2 } from "lucide-react"
import { useState } from "react"

import { cn, formatCurrency } from "@/lib/utils"

interface Props {
  id: string
  title: string
  price: number
  storeName: string
  /** Layout of the row (the product page puts it in a two-column grid). */
  className?: string
  /** A button rendered first, in the same row (the page's "Salvar oferta"). */
  leading?: React.ReactNode
}

const buttonClass =
  "flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/**
 * Shares the E-Zoom page of the offer (never the affiliate link, so the preview shows our page and
 * the visitor still goes through "Ver oferta"). Phones get the system share sheet; desktops open
 * WhatsApp with the message ready, and "Copiar link" is always there.
 */
export function ShareButton({ id, title, price, storeName, className, leading }: Props) {
  const [copied, setCopied] = useState(false)
  const url = () => `${window.location.origin}/produto/${id}?utm_source=compartilhar`
  const short = title.length > 90 ? `${title.slice(0, 87)}…` : title
  const text = `${short} por ${formatCurrency(price)} no ${storeName}. Veja no E-Zoom:`

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: short, text, url: url() })
      } catch {
        // Closed without sharing: nothing to do.
      }
      return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url()}`)}`, "_blank", "noopener,noreferrer")
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the address bar still has the link.
    }
  }

  return (
    <div className={cn("mt-2 flex flex-wrap gap-2", className)}>
      {leading}
      <button type="button" onClick={share} className={buttonClass}>
        <Share2 className="h-4 w-4" aria-hidden />
        Compartilhar
      </button>
      <button type="button" onClick={copy} className={buttonClass}>
        {copied ? <Check className="h-4 w-4 text-brand" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        <span aria-live="polite">{copied ? "Link copiado!" : "Copiar link"}</span>
      </button>
    </div>
  )
}
