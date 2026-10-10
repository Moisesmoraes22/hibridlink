"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import {
  ArrowRight,
  Clock,
  Flame,
  Bookmark,
  Menu as MenuIcon,
  Search,
  Tag,
  Ticket,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";

import { AccountMenu } from "@/components/account-menu";
import { useAuth } from "@/components/auth-provider";
import { SearchBar } from "@/components/search-bar";
import { ThemeMenu } from "@/components/theme-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuLink } from "@/components/ui/navbar-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { categoryIcon } from "@/lib/category-icons";
import type { CategoryCount } from "@/lib/deals";
import { useFavorites } from "@/lib/favorites-context";
import { cn } from "@/lib/utils";

/**
 * "Ofertas" entries are sorted views of /busca (`?ordenacao=`). Each one can
 * become its own page later without changing the menu.
 */
/** The menus show the biggest categories only; "Ver todas as categorias" has the rest. */
const MENU_CATEGORIES = 12;

const OFFER_VIEWS: { label: string; href: string; icon: LucideIcon; hint: string }[] = [
  { label: "Melhores ofertas", href: "/busca?ordenacao=relevancia", icon: Flame, hint: "Com desconto real primeiro" },
  { label: "Maiores descontos", href: "/busca?ordenacao=desconto", icon: TrendingDown, hint: "Ordenadas pelo desconto" },
  { label: "Menor preço", href: "/busca?ordenacao=preco", icon: Tag, hint: "Do mais barato ao mais caro" },
  { label: "Recém-encontradas", href: "/busca?ordenacao=recente", icon: Clock, hint: "Encontradas há pouco" },
  { label: "Cupons", href: "/cupons", icon: Ticket, hint: "Cupons do Mercado Livre" },
];

export function SiteHeader({
  categories,
  showCounts,
}: {
  categories: CategoryCount[];
  /** Counts are only real when the catalog comes from the database. */
  showCounts: boolean;
}) {
  const { count, openFavorites, favoritesIconRef, bumpSignal } = useFavorites();
  const { status, user, signOut } = useAuth();
  const favoritesControls = useAnimationControls();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // On the home the big search is in the hero; once it scrolls away, the header takes over.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (bumpSignal === 0) return;
    favoritesControls.start({
      scale: [1, 1.25, 0.95, 1.08, 1],
      transition: { duration: 0.5, ease: "easeOut" },
    });
  }, [bumpSignal, favoritesControls]);

  const homeActive = pathname === "/";
  const showSearch = !homeActive || scrolled;

  return (
    <header className="sticky top-0 z-40 w-full bg-hero py-2.5 text-white shadow-sm shadow-black/10">
      <div className="page-container flex items-center gap-3">
        <Link
          href="/"
          className="-my-2 flex items-center gap-2 rounded-md py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark className="h-7 w-auto text-white" />
          <span className="text-xl font-extrabold tracking-tight text-white">E-Zoom</span>
        </Link>

        <div className="ml-4 hidden items-center gap-6 lg:flex">
          <Link
            href="/busca?ordenacao=desconto"
            className="rounded-md text-sm font-semibold text-white transition-colors hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Ofertas do dia
          </Link>
          <Menu active={activeMenu} setActive={setActiveMenu}>
            <MenuItem setActive={setActiveMenu} active={activeMenu} item="Categorias" onBrand>
              <div className="grid w-[26rem] grid-cols-2 gap-1">
                {categories.slice(0, MENU_CATEGORIES).map((category) => {
                  const Icon = categoryIcon(category.slug);
                  return (
                    <MenuLink key={category.slug} href={`/categoria/${category.slug}`}>
                      <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                      <span className="flex flex-col leading-tight">
                        {category.name}
                        {showCounts && (
                          <span className="text-xs font-normal text-muted-foreground">
                            {category.count} {category.count === 1 ? "oferta" : "ofertas"}
                          </span>
                        )}
                      </span>
                    </MenuLink>
                  );
                })}
              </div>
              <div className="mt-2 border-t border-border pt-2">
                <MenuLink href="/categorias" className="text-brand">
                  Ver todas as categorias
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </MenuLink>
              </div>
            </MenuItem>
          </Menu>
        </div>

        {showSearch && (
          <div className="mx-2 hidden min-w-0 flex-1 sm:block lg:mx-6 lg:max-w-2xl">
            <SearchBar variant="header" size="sm" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/busca"
            aria-label="Buscar ofertas"
            className={cn(
              "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-90",
              showSearch && "sm:hidden",
            )}
          >
            <Search className="h-5 w-5" aria-hidden />
          </Link>

          <ThemeMenu className="hidden text-white lg:block" tone="onBrand" />
          <AccountMenu className="hidden lg:flex" tone="onBrand" />

          <motion.button
            ref={favoritesIconRef}
            type="button"
            onClick={openFavorites}
            aria-label={`Abrir favoritos${count > 0 ? ` (${count} ${count === 1 ? "item" : "itens"})` : ""}`}
            animate={favoritesControls}
            whileTap={{ scale: 0.9 }}
            className="relative flex h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-white transition-colors duration-300 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Bookmark className="h-5 w-5" aria-hidden />
            <span className="hidden text-sm font-semibold sm:inline">Favoritos</span>
            <AnimatePresence mode="popLayout" initial={false}>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.3, opacity: 0, y: -6 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.3, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-hero shadow-md ring-2 ring-hero"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Abrir menu"
                className="h-11 w-11 text-white transition-colors hover:bg-white/15 hover:text-white"
              >
                <MenuIcon className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[300px] flex-col gap-0 overflow-y-auto border-r border-border p-0 sm:w-[360px]"
            >
              <SheetHeader className="border-b border-border p-5 text-left">
                <SheetTitle className="flex items-center gap-2">
                  <BrandMark className="h-7 w-auto text-primary" />
                  <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-xl font-semibold text-transparent">
                    E-Zoom
                  </span>
                </SheetTitle>
              </SheetHeader>
              <div className="p-5 pb-0">
                <SearchBar size="sm" />
              </div>
              <nav
                aria-label="Menu"
                className="flex flex-col gap-5 p-5"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a")) setMobileOpen(false);
                }}
              >
                <MenuLink href="/" className="-mx-3 h-12 text-base">
                  Início
                </MenuLink>

                <section aria-labelledby="m-cat">
                  <h2 id="m-cat" className="mb-1 px-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Categorias
                  </h2>
                  <div className="-mx-3 grid grid-cols-2 gap-1">
                    {categories.slice(0, MENU_CATEGORIES).map((category) => {
                      const Icon = categoryIcon(category.slug);
                      return (
                        <MenuLink
                          key={category.slug}
                          href={`/categoria/${category.slug}`}
                          className="min-h-11 gap-2 px-3"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                          <span className="leading-tight">{category.name}</span>
                        </MenuLink>
                      );
                    })}
                  </div>
                </section>

                <section aria-labelledby="m-off">
                  <h2 id="m-off" className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ofertas
                  </h2>
                  <div className="-mx-3 flex flex-col gap-1">
                    {OFFER_VIEWS.map(({ label, href, icon: Icon }) => (
                      <MenuLink key={label} href={href} className="min-h-11">
                        <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                        {label}
                      </MenuLink>
                    ))}
                  </div>
                </section>

                <MenuLink href="/#sobre" className="-mx-3 min-h-11 text-muted-foreground">
                  Sobre
                </MenuLink>
              </nav>
              <div className="mt-auto border-t border-border p-5 pb-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Conta
                </p>
                {status === "authenticated" ? (
                  <div className="-mx-3 flex flex-col gap-1" onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a")) setMobileOpen(false);
                  }}>
                    <p className="truncate px-3 text-xs text-muted-foreground">{user.email}</p>
                    <MenuLink href="/conta" className="min-h-11">
                      Minha conta
                    </MenuLink>
                    <button
                      type="button"
                      onClick={async () => {
                        setMobileOpen(false);
                        await signOut();
                      }}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Sair
                    </button>
                  </div>
                ) : status === "anonymous" ? (
                  <div
                    className="-mx-3 flex flex-col gap-1"
                    onClick={() => setMobileOpen(false)}
                  >
                    <MenuLink href="/login" className="min-h-11">
                      Entrar
                    </MenuLink>
                    <MenuLink href="/cadastro" className="min-h-11">
                      Criar conta
                    </MenuLink>
                  </div>
                ) : null}
              </div>
              <div className="border-t border-border p-5 mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Aparência
                </p>
                <ThemeToggle showLabels className="flex w-full" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
