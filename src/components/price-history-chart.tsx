"use client"

import { useMemo, useState } from "react"

import { cn, formatCurrency } from "@/lib/utils"

export interface PriceSeries {
  id: string
  label: string
  color: string
  /** Every recorded change, oldest first (the DB records a price only when it changes). */
  points: { price: number; at: string }[]
}

const DAY = 86_400_000
const PERIODS = [
  { id: "7", label: "7 D", days: 7 },
  { id: "30", label: "30 D", days: 30 },
  { id: "90", label: "3 M", days: 90 },
  { id: "max", label: "Máx", days: Infinity },
] as const

const dayStart = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const fmtDay = (t: number) => new Date(t).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })

/**
 * Price history as a daily line chart (like a stock chart): a price holds until it changes, so
 * each day carries the last recorded price. One line per store when there is history for more
 * than one; period chips; hover shows the day and every price. Only recorded prices are drawn.
 */
export function PriceHistoryChart({ series, now }: { series: PriceSeries[]; now: number }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("max")
  const [hover, setHover] = useState<number | null>(null)

  const model = useMemo(() => {
    const today = dayStart(now)
    const first = Math.min(...series.map((s) => dayStart(new Date(s.points[0].at).getTime())))
    const totalDays = Math.round((today - first) / DAY)
    const days = PERIODS.find((p) => p.id === period)!.days
    const from = Number.isFinite(days) ? Math.max(first, today - days * DAY) : first
    const n = Math.round((today - from) / DAY) + 1
    const times = Array.from({ length: n }, (_, i) => from + i * DAY)
    const lines = series.map((s) => {
      const pts = s.points.map((p) => ({ price: p.price, t: new Date(p.at).getTime() }))
      const values = times.map((t) => {
        let v: number | null = null
        for (const p of pts) if (p.t < t + DAY) v = p.price
        return v
      })
      return { ...s, values }
    })
    const all = lines.flatMap((l) => l.values).filter((v): v is number => v !== null)
    const min = Math.min(...all)
    const max = Math.max(...all)
    const pad = (max - min || max * 0.05) * 0.15
    return { times, lines, totalDays, lo: min - pad, hi: max + pad, n }
  }, [series, now, period])

  const { times, lines, lo, hi, n } = model
  const X = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100)
  const Y = (v: number) => (1 - (v - lo) / (hi - lo)) * 100
  const single = lines.length === 1
  const ticks = [0, 1, 2, 3].map((k) => hi - ((hi - lo) * k) / 3)
  const xLabels = [...new Set(n < 2 ? [0] : [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1])]

  const first = single ? lines[0].values.find((v) => v !== null) : null
  const last = single ? lines[0].values[n - 1] : null
  const singleColor = first != null && last != null && last > first ? "var(--discount)" : "var(--cta)"

  const visiblePeriods = PERIODS.filter((p) => p.id === "max" || model.totalDays > p.days)

  return (
    <figure aria-label="Gráfico do histórico de preço">
      {visiblePeriods.length > 1 && (
        <div role="group" aria-label="Período" className="mt-3 flex flex-wrap gap-1.5">
          {visiblePeriods.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                period === p.id ? "bg-accent text-brand" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative mt-4 h-48 pl-16">
        {ticks.map((v, k) => (
          <span
            key={k}
            className="absolute left-0 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
            style={{ top: `${(k / 3) * 100}%` }}
          >
            {formatCurrency(v)}
          </span>
        ))}

        <div
          className="relative h-full touch-pan-y"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const ratio = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1)
            setHover(n === 1 ? 0 : Math.round(ratio * (n - 1)))
          }}
          onPointerLeave={() => setHover(null)}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="h-full w-full overflow-visible">
            {ticks.map((v, k) => (
              <line
                key={k}
                x1="0"
                x2="100"
                y1={(k / 3) * 100}
                y2={(k / 3) * 100}
                stroke="var(--border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {lines.map((l) => {
              const color = single ? singleColor : l.color
              const idx = l.values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0)
              if (!idx.length) return null
              const path = idx.map((i, k) => `${k ? "L" : "M"}${X(i)},${Y(l.values[i]!)}`).join(" ")
              return (
                <g key={l.id}>
                  {single && (
                    <path
                      d={`${path} L${X(idx[idx.length - 1])},100 L${X(idx[0])},100 Z`}
                      fill={color}
                      opacity="0.12"
                    />
                  )}
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )
            })}
            {hover !== null && (
              <line
                x1={X(hover)}
                x2={X(hover)}
                y1="0"
                y2="100"
                stroke="var(--muted-foreground)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {lines.map((l) => {
            const i = hover ?? n - 1
            const v = l.values[i]
            if (v === null || v === undefined) return null
            return (
              <span
                key={l.id}
                aria-hidden
                className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
                style={{ left: `${X(i)}%`, top: `${Y(v)}%`, background: single ? singleColor : l.color }}
              />
            )
          })}

          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-md"
              style={{ left: `${Math.min(Math.max(X(hover), 14), 86)}%` }}
            >
              <p className="font-semibold text-foreground">{fmtDay(times[hover])}</p>
              {lines.map((l) => {
                const v = l.values[hover]
                if (v === null) return null
                return (
                  <p key={l.id} className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
                    {!single && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: l.color }} />}
                    {!single && `${l.label}: `}
                    <span className="font-semibold text-foreground">{formatCurrency(v)}</span>
                  </p>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-2 h-4 pl-16 text-[11px] text-muted-foreground">
        <div className="relative h-full">
          {xLabels.map((i, k) => (
            <span
              key={i}
              className={cn(
                "absolute whitespace-nowrap",
                k === 0 ? "" : k === xLabels.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${X(i)}%` }}
            >
              {fmtDay(times[i])}
            </span>
          ))}
        </div>
      </div>

      {!single && (
        <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground">
          {lines.map((l) => (
            <span key={l.id} className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 rounded" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  )
}
