import Link from "next/link"

import { CookiePreferencesButton } from "@/components/cookie-consent"

/**
 * Footer: the legal text (affiliate disclosure, kept in full) and, closing the page, the dark bar
 * that repeats the one promise of the site: the purchase is finished in the store.
 */
export function SiteFooter() {
  return (
    <footer id="sobre">
      <div className="border-t border-border bg-surface">
        <div className="page-container space-y-2 py-6 text-xs leading-relaxed text-muted-foreground">
          <p>
            E-Zoom é um hub de ofertas. Os produtos são vendidos e entregues pelas lojas parceiras — ao clicar em
            &quot;Ver na loja&quot;, você é redirecionado para finalizar a compra por lá.
          </p>
          <p>
            Como Associado da Amazon, o E-Zoom ganha com compras qualificadas. Também participamos do programa de
            afiliados do Mercado Livre e da Shopee e podemos receber comissão pelas compras feitas pelos nossos
            links, sem custo extra para você. Preços e disponibilidade podem mudar a qualquer momento.
          </p>
          <p>
            © {new Date().getFullYear()} E-Zoom. Todos os direitos reservados. ·{" "}
            <Link href="/termos" className="underline-offset-2 hover:underline">
              Termos de Uso
            </Link>{" "}
            ·{" "}
            <CookiePreferencesButton className="cursor-pointer underline-offset-2 hover:underline" />
          </p>
        </div>
      </div>

      <div className="bg-footer-bar text-white">
        <div className="page-container flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
          <p className="text-sm font-semibold sm:text-base">
            Você encontra no E-Zoom. A compra é finalizada na loja.
          </p>
          <nav aria-label="Rodapé" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <Link
              href="/como-funciona"
              className="-my-2 rounded-md py-2 text-white/90 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Sobre
            </Link>
            <a
              href="mailto:aflservicos2026@gmail.com"
              className="-my-2 rounded-md py-2 text-white/90 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Contato
            </a>
            <Link
              href="/privacidade"
              className="-my-2 rounded-md py-2 text-white/90 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Privacidade
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
