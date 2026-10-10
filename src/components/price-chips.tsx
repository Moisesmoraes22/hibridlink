import Link from "next/link"

/** "Quanto quer gastar?": cumulative limits, each opening the search already filtered. */
const LIMITS = [
  { label: "Até R$ 50", preco: "0-50" },
  { label: "Até R$ 100", preco: "0-50,50-100" },
  { label: "Até R$ 300", preco: "0-50,50-100,100-300" },
]

export function PriceChips() {
  return (
    <section className="bg-white pb-8 text-slate-900 dark:bg-card dark:text-foreground sm:pb-10" aria-labelledby="gastar">
      <div className="page-container flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 id="gastar" className="text-xl font-extrabold sm:text-2xl">
          Quanto quer gastar?
        </h2>
        <ul className="flex flex-wrap gap-3">
          {LIMITS.map(({ label, preco }) => (
            <li key={label}>
              <Link
                href={`/busca?preco=${preco}`}
                className="flex min-h-11 items-center rounded-lg border-2 border-hero px-5 text-sm font-bold text-hero transition-colors hover:bg-hero hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-primary dark:text-brand dark:hover:bg-primary dark:hover:text-white"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
