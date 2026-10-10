import { SearchBar } from "@/components/search-bar"

/** The home's promise and its search, on the brand blue (the header shares the colour). */
export function HomeHero() {
  return (
    <section className="bg-hero text-hero-foreground">
      <div className="page-container flex flex-col items-center py-10 text-center sm:py-14">
        <h1 className="max-w-3xl text-balance text-3xl font-extrabold leading-tight sm:text-5xl">
          Você não precisa procurar loja por loja.
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-base text-white/90 sm:text-lg">
          Ofertas de várias lojas. Uma busca para facilitar sua escolha.
        </p>
        <div className="mt-7 w-full max-w-3xl">
          <SearchBar variant="hero" />
        </div>
      </div>
    </section>
  )
}
