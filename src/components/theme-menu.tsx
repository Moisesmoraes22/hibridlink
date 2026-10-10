"use client"

import { Check, Monitor, Moon, Sun, SunMoon, type LucideIcon } from "lucide-react"
import { useRef, useState } from "react"

import { useTheme, type Theme } from "@/components/theme-provider"
import { useDismiss } from "@/lib/use-dismiss"
import { cn } from "@/lib/utils"

const OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
]

/** Header version of the theme picker: one small button that opens the three choices. */
export function ThemeMenu({ className, tone = "default" }: { className?: string; tone?: "default" | "onBrand" }) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useDismiss(rootRef, open, () => setOpen(false))

  const moveFocus = (event: React.KeyboardEvent) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
    if (!step) return
    event.preventDefault()
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitemradio]")]
    const at = items.indexOf(document.activeElement as HTMLElement)
    items[(at + step + items.length) % items.length]?.focus()
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Aparência"
        title="Aparência"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          tone === "onBrand"
            ? "text-white hover:bg-white/15 focus-visible:ring-white"
            : "text-foreground hover:bg-accent hover:text-brand",
        )}
      >
        <SunMoon className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Aparência"
          onKeyDown={moveFocus}
          className="absolute right-0 top-full z-50 mt-2 w-44 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl shadow-foreground/10"
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === value}
              autoFocus={theme === value}
              onClick={() => {
                setTheme(value)
                setOpen(false)
              }}
              className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="flex-1 text-left">{label}</span>
              {theme === value && <Check className="h-4 w-4 text-brand" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
