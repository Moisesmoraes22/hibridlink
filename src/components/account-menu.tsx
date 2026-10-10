"use client"

import { Bookmark, LogOut, User } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

import { useAuth } from "@/components/auth-provider"
import { useFavorites } from "@/lib/favorites-context"
import { useDismiss } from "@/lib/use-dismiss"
import { cn } from "@/lib/utils"

const item =
  "flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"

/** Desktop header: "Entrar" for visitors, a small avatar menu for signed-in users. */
export function AccountMenu({ className, tone = "default" }: { className?: string; tone?: "default" | "onBrand" }) {
  const { status, user, signOut } = useAuth()
  const { openFavorites } = useFavorites()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useDismiss(rootRef, open, () => setOpen(false))

  // Until the session is known, keep the space but show nothing, so a signed-in user
  // never sees "Entrar" flash and the header does not jump.
  if (status === "loading") return <span aria-hidden className={cn("h-11 w-[4.5rem]", className)} />

  if (status === "anonymous") {
    return (
      <Link
        href="/login"
        className={cn(
          "flex h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          tone === "onBrand"
            ? "text-white hover:bg-white/15 focus-visible:ring-white"
            : "text-foreground hover:bg-accent hover:text-brand",
          className,
        )}
      >
        Entrar
      </Link>
    )
  }

  const label = user.name || user.email || "Conta"
  const initial = label.trim().charAt(0).toUpperCase()

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Conta"
        title={label}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
            tone === "onBrand" ? "bg-white text-hero" : "bg-primary text-primary-foreground",
          )}
        >
          {initial || <User className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Conta"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl shadow-foreground/10"
        >
          <p className="truncate px-3 pb-1.5 pt-1 text-xs text-muted-foreground">{user.email}</p>
          <Link role="menuitem" href="/conta" onClick={() => setOpen(false)} className={item}>
            <User className="h-4 w-4 text-muted-foreground" aria-hidden />
            Minha conta
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              openFavorites()
            }}
            className={item}
          >
            <Bookmark className="h-4 w-4 text-muted-foreground" aria-hidden />
            Favoritos
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false)
              await signOut()
              router.push("/")
              router.refresh()
            }}
            className={item}
          >
            <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
