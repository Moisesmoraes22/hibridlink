import { CouponCard } from "@/components/coupon-card"
import { SectionHeader } from "@/components/section-header"
import type { Coupon } from "@/lib/coupons"

/** The newest valid coupons on the home page. Nothing is shown when there are none. */
export function CouponsSection({ coupons }: { coupons: Coupon[] }) {
  if (coupons.length === 0) return null
  return (
    <section className="page-container section-y" aria-label="Cupons do Mercado Livre">
      <SectionHeader title="Cupons do Mercado Livre" href="/cupons" linkLabel="Ver todos os cupons" />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((coupon) => (
          <li key={coupon.code}>
            <CouponCard coupon={coupon} />
          </li>
        ))}
      </ul>
    </section>
  )
}
