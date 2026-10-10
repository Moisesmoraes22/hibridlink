"use client"

import { ArrowUpRight, Loader2, PackageSearch } from "lucide-react"
import { useState } from "react"

import type { LiveOffer } from "@/app/api/request/route"
import { normalizeTerm, readRequests, writeRequests } from "@/lib/product-requests"
import { formatCurrency } from "@/lib/utils"

type State =
  | { step: "idle" }
  | { step: "sending" }
  | { step: "done"; offers: LiveOffer[] }
  | { step: "error"; message: string }

/**
 * Shown when a search finds nothing. One click records the search as a request: the collector
 * brings the product into the catalogue, and what Mercado Livre already has for it is shown at
 * once. The browser remembers the request, so the next visit can say it was answered.
 */
export function RequestProduct({ query }: { query: string }) {
  const [state, setState] = useState<State>({ step: "idle" })
  const term = normalizeTerm(query)
  if (!term) return null

  const send = async () => {
    setState({ step: "sending" })
    try {
      const response = await fetch("/api/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ term: query }),
      })
      if (response.status === 429) {
        setState({ step: "error", message: "Muitos pedidos seguidos. Tente de novo em um minuto." })
        return
      }
      if (!response.ok) {
        setState({ step: "error", message: "Não conseguimos registrar este pedido. Tente outro termo." })
        return
      }
      const { offers } = (await response.json()) as { offers: LiveOffer[] }
      const others = readRequests().filter((r) => r.term !== term)
      writeRequests([...others, { term, display: query.trim(), at: Date.now() }])
      setState({ step: "done", offers })
    } catch {
      setState({ step: "error", message: "Sem conexão agora. Tente de novo em instantes." })
    }
  }

  return (
    <div className="mt-2 w-full max-w-3xl text-left">
      {state.step !== "done" ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            Não temos “{query.trim()}” ainda. Peça este produto: procuramos nas lojas e trazemos para o E-Zoom.
          </p>
          <button
            type="button"
            onClick={send}
            disabled={state.step === "sending"}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-cta px-5 text-sm font-bold text-cta-foreground transition-colors hover:bg-cta-hover disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {state.step === "sending" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <PackageSearch className="h-4 w-4" aria-hidden />
            )}
            {state.step === "sending" ? "Procurando nas lojas..." : "Pedir este produto"}
          </button>
          {state.step === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
        </div>
      ) : (
        <div role="status" aria-live="polite">
          <p className="text-center text-sm font-semibold text-foreground">
            Pedido registrado. Vamos trazer “{query.trim()}” para o catálogo e avisar você aqui neste aparelho.
          </p>
          {state.offers.length > 0 ? (
            <>
              <p className="mt-4 text-sm text-muted-foreground">
                Enquanto isso, o que o Mercado Livre tem agora para esta busca:
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {state.offers.map((offer) => (
                  <li key={offer.url}>
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-3 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={offer.image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                      </span>
                      <span className="line-clamp-2 text-xs font-medium text-foreground">{offer.title}</span>
                      <span className="mt-auto text-base font-extrabold tabular-nums text-price">
                        {formatCurrency(offer.price)}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-brand">
                        Ver no Mercado Livre
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Ainda não achamos ofertas para este termo. Se encontrarmos, avisamos aqui.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
