import type { Metadata } from "next"

import { CouponCard } from "@/components/coupon-card"
import { SiteFooter } from "@/components/site-footer"
import { getCoupons } from "@/lib/coupons"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Cupons do Mercado Livre",
  description: "Cupons de desconto do Mercado Livre ainda válidos, com valor mínimo de compra, desconto máximo e validade.",
}

export default async function CuponsPage() {
  const coupons = await getCoupons()

  return (
    <main id="conteudo" className="min-h-screen bg-background">
      <div className="page-container pt-10">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Cupons do Mercado Livre</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Copie o código e use no carrinho. Cada cupom vale só em produtos elegíveis e enquanto durarem os estoques.
        </p>
      </div>

      {coupons.length > 0 ? (
        <ul className="page-container grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <li key={coupon.code}>
              <CouponCard coupon={coupon} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="page-container py-12 text-muted-foreground">Nenhum cupom válido agora. Volte em instantes.</p>
      )}

      <p className="page-container pb-10 text-xs text-muted-foreground">
        Podemos receber comissão pelas compras feitas pelos links, sem custo extra para você. Confira as regras de cada cupom no Mercado Livre.
      </p>
      <SiteFooter />
    </main>
  )
}
