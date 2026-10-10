"use client" // Error boundaries must be Client Components

import Link from "next/link"
import { useEffect } from "react"

/** Shown when a page cannot be built (for example, the offers database did not answer). */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main id="conteudo" className="page-container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-foreground">Não conseguimos carregar esta página</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        As ofertas não responderam agora. Tente de novo em instantes.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="h-11 cursor-pointer rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="flex h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ir para o início
        </Link>
      </div>
    </main>
  )
}
