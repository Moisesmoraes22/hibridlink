import { Suspense } from "react"

import { SearchResults } from "@/components/search-results"
import { SiteFooter } from "@/components/site-footer"
import { categoryCounts } from "@/lib/deals"
import { getCatalog } from "@/lib/offers"

export const metadata = {
  title: "Buscar ofertas",
  description:
    "Pesquise ofertas do Mercado Livre, da Shopee e da Amazon, filtre por categoria, loja, preço e desconto.",
}

export const revalidate = 300

export default async function BuscaPage() {
  const { products } = await getCatalog()
  return (
    <main id="conteudo" className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <SearchResults products={products} categories={categoryCounts(products)} />
      </Suspense>
      <SiteFooter />
    </main>
  )
}
