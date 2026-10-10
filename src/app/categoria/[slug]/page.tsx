import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { SearchResults } from "@/components/search-results"
import { SiteFooter } from "@/components/site-footer"
import { CATEGORIES } from "@/lib/mock-data"
import { categoryCounts } from "@/lib/deals"
import { getCatalog } from "@/lib/offers"

export const revalidate = 300

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ slug: category.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const category = CATEGORIES.find((c) => c.slug === slug)
  if (!category) return { title: "Categoria não encontrada" }
  const { products, live } = await getCatalog()
  const count = products.filter((p) => p.category === slug).length
  return {
    title: `Ofertas de ${category.name}`,
    description:
      live && count > 0
        ? `${count} ${count === 1 ? "oferta" : "ofertas"} de ${category.name} do Mercado Livre, da Shopee e da Amazon, com preço, desconto e histórico.`
        : `Ofertas de ${category.name} nas lojas parceiras do E-Zoom.`,
  }
}

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const category = CATEGORIES.find((c) => c.slug === slug)
  if (!category) notFound()
  const { products } = await getCatalog()

  return (
    <main id="conteudo" className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <SearchResults
          categories={categoryCounts(products)}
          products={products}
          categorySlug={category.slug}
          categoryName={category.name}
        />
      </Suspense>
      <SiteFooter />
    </main>
  )
}
