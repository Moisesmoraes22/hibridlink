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

  const showAverage = points.length >= 3
  // Newest change first: what actually moved the price, with the day it was seen.
  const changes = points
    .slice(1)
    .map((p, i) => ({ at: p.at, from: points[i].price, to: p.price }))
    .reverse()
    .slice(0, 4)

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
            <path d={`${d} V100 H0 Z`} className="fill-brand/10" />
            {showAverage && (
              <line
                x1="0"
                x2="100"
                y1={Y(stats.average)}
                y2={Y(stats.average)}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                className="text-muted-foreground"
              />
            )}
            <path
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="text-brand"
            />
          </svg>
          {points.map((p) => (
            <span
              key={p.at}
              aria-hidden
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-brand"
              style={{ left: `${X(new Date(p.at).getTime())}%`, top: `${Y(p.price)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between pl-16 text-[11px] text-muted-foreground">
        <span>{day(points[0].at)}</span>
        <span>hoje</span>
      </div>
      {showAverage && (
        <figcaption className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="h-0 w-4 border-t-2 border-dashed border-current" />
          Média do período: <span className="tabular-nums text-foreground">{formatCurrency(stats.average)}</span>
        </figcaption>
      )}
      <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
        {changes.map((c) => {
          const pct = Math.round(((c.to - c.from) / c.from) * 100)
          return (
            <li key={c.at} className="flex flex-wrap items-center justify-between gap-x-3">
              <span className="text-muted-foreground">{day(c.at)}</span>
              <span className="tabular-nums text-foreground">
                {formatCurrency(c.from)} → <strong>{formatCurrency(c.to)}</strong>
              </span>
              <span className={`w-14 text-right font-semibold tabular-nums ${pct < 0 ? "text-success" : "text-discount"}`}>
                {pct > 0 ? "+" : ""}
                {pct}%
              </span>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
