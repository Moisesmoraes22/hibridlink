import type { StoreSource } from "@/lib/types"

/**
 * "Encontre ofertas de ...": the stores that really have offers right now, each with its own logo
 * (as in the visual references). Always on white, because the logos have dark text.
 */
export function StoreStrip({ counts }: { counts: Record<string, number> }) {
  const has = (id: StoreSource) => (counts[id] ?? 0) > 0
  return (
    <section aria-label="Lojas com ofertas" className="border-b border-slate-200 bg-white text-slate-700">
      <div className="page-container flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-4 text-sm">
        <span className="font-medium">Encontre ofertas de</span>
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {has("amazon") && (
            <li>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lojas/amazon.svg" alt="Amazon" className="h-8 w-auto" width={106} height={32} />
            </li>
          )}
          {has("mercado_livre") && (
            <li className="flex items-center gap-2 border-l border-slate-200 pl-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lojas/mercado-livre.svg" alt="Mercado Livre" className="h-9 w-auto" width={92} height={36} />
            </li>
          )}
          {has("shopee") && (
            <li className="border-l border-slate-200 pl-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lojas/shopee-horizontal.svg" alt="Shopee" className="h-9 w-auto" width={80} height={36} />
            </li>
          )}
        </ul>
        <span className="text-slate-500">Você compra direto na loja</span>
      </div>
    </section>
  )
}
