import type { PriceStats } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })

/**
 * Price history: the price line (a step line, since a price holds until it changes) with dots at
 * each recorded change, plus dashed lines for the lowest, average and highest recorded price.
 * Lines are SVG stretched to the box; dots and labels are HTML so they never get distorted.
 */
export function PriceHistoryChart({ stats, now }: { stats: PriceStats; now: number }) {
  const points = stats.points.slice(-60)
  const t0 = new Date(points[0].at).getTime()
  const span = Math.max(now - t0, 1)
  const pad = (stats.max - stats.min) * 0.12
  const lo = stats.min - pad
  const hi = stats.max + pad
  const X = (t: number) => Math.min(Math.max(((t - t0) / span) * 100, 0), 100)
  const Y = (v: number) => (1 - (v - lo) / (hi - lo)) * 100

  let d = `M${X(t0)},${Y(points[0].price)}`
  for (let i = 1; i < points.length; i++) {
    const x = X(new Date(points[i].at).getTime())
    d += ` H${x} V${Y(points[i].price)}`
  }
  d += ` H100`

  const refs = [
    { label: "Maior", value: stats.max, line: "text-muted-foreground", dash: true },
    { label: "Média", value: stats.average, line: "text-brand", dash: true },
    { label: "Menor", value: stats.min, line: "text-success", dash: true },
  ]

  return (
    <figure aria-label="Gráfico do histórico de preço">
      <div className="relative mt-4 h-44 pl-16">
        <span className="absolute left-0 top-0 text-[11px] tabular-nums text-muted-foreground">
          {formatCurrency(stats.max)}
        </span>
        <span className="absolute bottom-0 left-0 text-[11px] tabular-nums text-muted-foreground">
          {formatCurrency(stats.min)}
        </span>
        <div className="relative h-full border-b border-l border-border">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="h-full w-full overflow-visible">
            {refs.map((r) => (
              <line
                key={r.label}
                x1="0"
                x2="100"
                y1={Y(r.value)}
                y2={Y(r.value)}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                className={r.line}
              />
            ))}
            <path
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="text-foreground"
            />
          </svg>
          {points.map((p) => (
            <span
              key={p.at}
              aria-hidden
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
              style={{ left: `${X(new Date(p.at).getTime())}%`, top: `${Y(p.price)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between pl-16 text-[11px] text-muted-foreground">
        <span>{day(points[0].at)}</span>
        <span>hoje</span>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-foreground" />
          Preço
        </span>
        {refs
          .slice()
          .reverse()
          .map((r) => (
            <span key={r.label} className="flex items-center gap-1.5">
              <span aria-hidden className={`h-0 w-4 border-t-2 border-dashed border-current ${r.line}`} />
              <span className="text-foreground">
                {r.label} <span className="tabular-nums">{formatCurrency(r.value)}</span>
              </span>
            </span>
          ))}
      </figcaption>
    </figure>
  )
}
