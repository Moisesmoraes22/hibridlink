"use client"

import { X } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { readRequests, writeRequests, type StoredRequest } from "@/lib/product-requests"

interface Answered extends StoredRequest {
  found: number
}

/**
 * "Seu pedido por X foi atendido": on a visit, asks the server about the requests this browser
 * made and shows the answered ones once. Nothing leaves the browser except the search terms the
 * visitor chose to request.
 */
export function RequestNotice() {
  const [answered, setAnswered] = useState<Answered[]>([])

  useEffect(() => {
    const requests = readRequests()
    if (requests.length === 0) return
    let cancelled = false
    fetch(`/api/request?terms=${encodeURIComponent(requests.map((r) => r.term).join(","))}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: { term: string; status: string; found: number }[]) => {
        if (cancelled) return
        const done = requests.flatMap((r) => {
          const row = rows.find((x) => x.term === r.term)
          return row && row.status === "fulfilled" && row.found > 0 ? [{ ...r, found: row.found }] : []
        })
        setAnswered(done)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (answered.length === 0) return null

  const dismiss = (term: string) => {
    writeRequests(readRequests().filter((r) => r.term !== term))
    setAnswered((list) => list.filter((r) => r.term !== term))
  }

  return (
    <div aria-live="polite" className="border-b border-border bg-accent">
      <ul className="page-container flex flex-col gap-1 py-2">
        {answered.map((r) => (
          <li key={r.term} className="flex items-center justify-between gap-3 text-sm text-accent-foreground">
            <span>
              Seu pedido por <strong>{r.display}</strong> foi atendido: {r.found} {r.found === 1 ? "oferta" : "ofertas"}.{" "}
              <Link
                href={`/busca?q=${encodeURIComponent(r.display)}`}
                onClick={() => dismiss(r.term)}
                className="font-semibold text-brand underline-offset-2 hover:underline"
              >
                Ver ofertas
              </Link>
            </span>
            <button
              type="button"
              aria-label={`Fechar aviso de ${r.display}`}
              onClick={() => dismiss(r.term)}
              className="-my-2 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
