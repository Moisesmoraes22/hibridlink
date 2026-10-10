import { ArrowRight } from "lucide-react"
import Link from "next/link"

const STEPS = ["Escolha a oferta", "Confira as condições na loja", "Finalize a compra por lá"]

/** "Gostou de uma oferta? Veja como comprar." The site never sells: it points to the store. */
export function HowToBuy() {
  return (
    <section className="bg-slate-100 py-8 text-slate-900 dark:bg-surface dark:text-foreground sm:py-10" aria-labelledby="como-comprar">
      <div className="page-container">
        <h2 id="como-comprar" className="text-2xl font-extrabold sm:text-3xl">
          Gostou de uma oferta? Veja como comprar.
        </h2>
        <ol className="mt-6 grid gap-5 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-4">
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-hero text-lg font-extrabold text-white"
              >
                {i + 1}
              </span>
              <span className="text-base font-semibold">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-muted-foreground">
          <p>O E-Zoom reúne as ofertas. A loja é responsável pela venda e entrega.</p>
          <Link
            href="/como-funciona"
            className="-my-2.5 flex items-center gap-1 rounded-md py-2.5 font-semibold text-hero hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-brand"
          >
            Como selecionamos as ofertas
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
