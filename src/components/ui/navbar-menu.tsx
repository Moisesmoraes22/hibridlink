"use client";
import React, { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Link, { type LinkProps } from "next/link";

import { cn } from "@/lib/utils";

/**
 * Desktop nav with dropdown panels. Hover opens (mouse), click/tap opens
 * (touch), Enter/Space toggles (keyboard); Esc, outside click and leaving the
 * nav with the keyboard all close it.
 */
export const Menu = ({
  active,
  setActive,
  children,
  className,
}: {
  active: string | null;
  setActive: (item: string | null) => void;
  children: React.ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActive(null);
      ref.current?.querySelector<HTMLElement>("[aria-expanded='true']")?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setActive(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [active, setActive]);

  return (
    <nav
      ref={ref}
      aria-label="Principal"
      onMouseLeave={() => setActive(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setActive(null);
      }}
      className={cn("relative flex items-center gap-7", className)}
    >
      {children}
    </nav>
  );
};

export const MenuItem = ({
  setActive,
  active,
  item,
  children,
  onBrand = false,
}: {
  setActive: (item: string | null) => void;
  active: string | null;
  item: string;
  children?: React.ReactNode;
  /** White trigger text, for the blue header. */
  onBrand?: boolean;
}) => {
  const open = active === item;
  const panelId = useId();

  return (
    <div onMouseEnter={() => setActive(item)} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={(event) => {
          // detail === 0 is a keyboard activation: toggle. A mouse click on an
          // already hover-opened menu should keep it open instead of closing it.
          if (event.detail === 0) setActive(open ? null : item);
          else setActive(item);
        }}
        className={cn(
          "flex h-10 cursor-pointer items-center gap-1 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open ? "text-brand" : "text-foreground hover:text-brand",
          onBrand && (open ? "text-white underline underline-offset-4" : "text-white hover:text-white/85"),
        )}
      >
        {item}
        <ChevronDown
          aria-hidden
          className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <AnimatePresence>
        {open && (
          <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3">
            <motion.div
              id={panelId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={(event) => {
                // Close after picking a link: the header stays mounted across pages.
                if ((event.target as HTMLElement).closest("a")) setActive(null);
              }}
              className="w-max rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl shadow-foreground/10"
            >
              {children}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const MenuLink = ({
  className,
  children,
  ...rest
}: LinkProps & { className?: string; children?: React.ReactNode }) => (
  <Link
    {...rest}
    className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      className,
    )}
  >
    {children}
  </Link>
);
