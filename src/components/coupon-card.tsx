import { ExternalLink, Ticket } from "lucide-react"

import { CopyCodeButton } from "@/components/copy-code-button"
import type { Coupon } from "@/lib/coupons"
import { formatCurrency, formatDay } from "@/lib/utils"

/** One coupon: the discount, the code to copy, the rules, and a link to the products it covers. */
export function CouponCard({ coupon }: { coupon: Coupon }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-extrabold leading-none text-brand">
            {coupon.discount_kind === "percent" ? `${coupon.discount_value}% OFF` : `${formatCurrency(coupon.discount_value)} OFF`}
          </p>
          {coupon.category && <p className="mt-1 text-xs text-muted-foreground">em {coupon.category}</p>}
        </div>
        <Ticket className="h-6 w-6 shrink-0 text-brand" aria-hidden />
      </div>

      <p className="rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-center font-mono text-lg font-bold tracking-wider text-foreground">
        {coupon.code}
      </p>

      <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
        {coupon.min_purchase != null && <li>Compra mínima: {formatCurrency(coupon.min_purchase)}</li>}
        {coupon.max_discount != null && <li>Desconto máximo: {formatCurrency(coupon.max_discount)}</li>}
        <li>{coupon.expires_at ? `Válido até ${formatDay(coupon.expires_at)}` : "Validade não informada"}</li>
      </ul>

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <CopyCodeButton code={coupon.code} />
        {coupon.affiliate_url && (
          <a
            href={coupon.affiliate_url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:opacity-90"
          >
            Ver produtos
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>
    </div>
  )
}
