import Link from "next/link"

import { BrandMark } from "@/components/brand-mark"
import { CookiePreferencesButton } from "@/components/cookie-consent"

import { STORES } from "@/lib/mock-data"
import { getSiteSummary } from "@/lib/offers"

export async function SiteFooter() {
  // Same real data as the menus: categories with offers, stores with offers.
  const summary = await getSiteSummary()
  const categories = summary.categories.slice(0, 5)
  const storeCounts = summary.stores
  const stores = Object.values(STORES).filter(
    (store) => store.id !== "telegram" && storeCounts[store.id] > 0,
  )

  return (
    <footer id="sobre" className="border-t border-border bg-surface">
      <div className="page-container py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <span className="flex items-center gap-2">
              <BrandMark className="h-6 w-auto text-primary" />
              <span className="text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                E-Zoom
              </span>
            </span>
            <p className="mt-2 text-sm text-muted-foreground">
              Um hub que reúne ofertas do Mercado Livre, Shopee e Amazon para
              você comparar e escolher onde comprar.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Categorias
            </h3>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/categoria/${category.slug}`}
                    className="transition-colors hover:text-brand"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/categorias"
                  className="font-medium text-brand transition-colors hover:underline"
                >
                  Todas as categorias
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Lojas parceiras
            </h3>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {stores.map((store) => (
                <li key={store.id}>{store.name}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Sobre
            </h3>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/como-funciona"
                  className="transition-colors hover:text-brand"
                >
                  Como funciona
                </Link>
              </li>
              <li>
                <Link
                  href="/perguntas-frequentes"
                  className="transition-colors hover:text-brand"
                >
                  Perguntas frequentes
                </Link>
              </li>
              <li>
                <a
                  href="mailto:aflservicos2026@gmail.com"
                  className="transition-colors hover:text-brand"
                >
                  Contato
                </a>
              </li>
              <li>
                <Link
                  href="/privacidade"
                  className="transition-colors hover:text-brand"
                >
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="/termos"
                  className="transition-colors hover:text-brand"
                >
                  Termos de Uso
                </Link>
              </li>
              <li>
                <CookiePreferencesButton className="cursor-pointer text-left transition-colors hover:text-brand" />
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          <p>
            E-Zoom é um hub de ofertas. Os produtos são vendidos e
            entregues pelas lojas parceiras — ao clicar em &quot;Ver
            oferta&quot;, você é redirecionado para finalizar a compra por lá.
          </p>
          <p className="mt-2">
            Como Associado da Amazon, o E-Zoom ganha com compras
            qualificadas. Também participamos do programa de afiliados do
            Mercado Livre e podemos receber comissão pelas compras feitas
            pelos nossos links, sem custo extra para você. Preços e
            disponibilidade podem mudar a qualquer momento.
          </p>
          <p className="mt-2">
            © {new Date().getFullYear()} E-Zoom. Todos os direitos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
