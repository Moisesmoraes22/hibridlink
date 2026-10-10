import type { StoreSource } from "@/lib/types"

/**
 * "Encontre ofertas de ...": the stores that really have offers right now. Always on white
 * (the logos have dark text). Amazon is plain text until the Associates logo rules are checked.
 */
export function StoreStrip({ counts }: { counts: Record<string, number> }) {
  const has = (id: StoreSource) => (counts[id] ?? 0) > 0
  return (
    <section aria-label="Lojas com ofertas" className="border-b border-slate-200 bg-white text-slate-700">
      <div className="page-container flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-4 text-sm">
        <span className="font-medium">Encontre ofertas de</span>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {has("amazon") && (
            <li className="text-xl font-extrabold text-slate-900">Amazon</li>
          )}
          {has("mercado_livre") && (
            <li>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lojas/mercado-livre.svg" alt="Mercado Livre" className="h-9 w-auto" width={98} height={39} />
            </li>
          )}
          {has("shopee") && (
            <li>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lojas/shopee.svg" alt="Shopee" className="h-10 w-auto" width={28} height={40} />
            </li>
          )}
        </ul>
        <span className="text-slate-500">Você compra direto na loja</span>
      </div>
    </section>
  )
}
