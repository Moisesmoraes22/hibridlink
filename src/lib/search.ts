import { djTypeOf } from "@/lib/dj-types"
import { SUPPLEMENT_TYPES, supplementTypeOf } from "@/lib/supplement-types"
import { unitPrice } from "@/lib/unit-price"
import { byRelevance } from "@/lib/deals"
import type { Product, SortOption, StoreSource } from "@/lib/types"
import { calculateDiscountPercent } from "@/lib/utils"

/**
 * Lowercase without accents, so "relogio" finds "Relógio". NFKD (not NFD) also folds full-width
 * letters ("ＦＯＮＥ") and ligatures ("ﬁlme") into plain ones.
 */
export const normalizeText = (text: string) =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()

/** Words people use for the same thing; searching one finds the others (both ways). */
export const SYNONYMS = [
  ["celular", "smartphone"],
  ["fone", "headset", "headphone", "earbuds"],
  ["tv", "televisao"],
  ["notebook", "laptop"],
  ["geladeira", "refrigerador"],
  ["airfryer", "air fryer", "fritadeira"],
  ["ps5", "playstation 5", "playstation5"],
  ["ps4", "playstation 4", "playstation4"],
  ["tenis", "sapatilha"],
  ["pretreino", "pre treino"],
]

/**
 * One-way expansions: the general word also finds the specific things ("celular" finds an
 * iPhone), but not the other way round ("iphone" must not bring a Galaxy, "smartwatch" must
 * not bring a plain watch, "whey" must not bring shampoo with protein).
 */
export const NARROWER: Record<string, string[]> = {
  celular: ["iphone", "galaxy"],
  smartphone: ["iphone", "galaxy"],
  relogio: ["smartwatch"],
  proteina: ["whey"],
  playstation: ["ps5", "ps4", "playstation 5", "playstation 4"],
}

/** Words that clearly mean one category: results from it come first ("proteína" -> supplements, not hair care). */
const CATEGORY_HINTS: Record<string, string> = Object.fromEntries(
  ["whey", "proteina", "creatina", "bcaa", "suplemento", "colageno", "multivitaminico", "termogenico", "pretreino", "hipercalorico", "albumina"].map((w) => [w, "suplementos"]),
)

/** Synonym terms made of several words ("air fryer"), longest first, so a typed phrase is matched as one unit. */
const PHRASES = SYNONYMS.flatMap((group) =>
  group.filter((term) => term.includes(" ")).map((term) => ({ words: term.split(" "), group })),
).sort((x, y) => y.words.length - x.words.length)

/** Units that may be glued to a number or typed apart: "500g" = "500 g". */
const UNITS = new Set(["g", "kg", "mg", "ml", "l", "gb", "tb", "mb", "w", "v", "cm", "mm", "m", "un"])

/** The word as typed plus its likely singular forms: "celulares" -> celular, "botoes" -> botao, "jornais" -> jornal, "luzes" -> luz. */
function singularForms(word: string): string[] {
  const forms = [word]
  if (word.length > 3 && word.endsWith("s")) forms.push(word.slice(0, -1))
  if (word.length === 3 && /[^aeiou]s$/.test(word)) forms.push(word.slice(0, -1)) // tvs, pcs, hds
  if (word.length > 4 && /(oes|aes)$/.test(word)) forms.push(`${word.slice(0, -3)}ao`)
  if (word.length > 4 && /(res|zes)$/.test(word)) forms.push(word.slice(0, -2)) // celulares, mulheres, luzes
  if (word.length > 5 && word.endsWith("ais")) forms.push(`${word.slice(0, -3)}al`)
  return forms
}

/** "cadeira" <-> "cadeirinha": the diminutive swaps the last vowel for -inha/-zinha (and back). */
function diminutiveForms(word: string): string[] {
  const forms: string[] = []
  if (word.length >= 4 && /[ao]$/.test(word)) {
    const stem = word.slice(0, -1)
    const vowel = word.slice(-1)
    forms.push(`${stem}inh${vowel}`, `${stem}zinh${vowel}`)
  }
  const back = word.match(/^(.{3,}?)z?inh([ao])$/)
  if (back) forms.push(back[1] + back[2])
  return forms
}

/** Every acceptable spelling of one typed word: plural, diminutive, two-way synonyms and one-way expansions. */
function expand(word: string): string[] {
  const forms = singularForms(word)
  const base = [...new Set(forms.flatMap((f) => [f, ...diminutiveForms(f)]))]
  const alts = new Set(base)
  for (const group of SYNONYMS) if (forms.some((f) => group.includes(f))) group.forEach((g) => alts.add(g))
  for (const f of forms) if (Object.hasOwn(NARROWER, f)) NARROWER[f].forEach((g) => alts.add(g)) // not "constructor", "toString"...
  return [...alts]
}

/**
 * One list of acceptable spellings per typed word, accents removed. A synonym of several
 * words ("air fryer", "playstation 5") is matched when those words are typed next to each
 * other, and becomes one entry. A letter-digit hyphen ("ps-5") and a number with its unit
 * ("500g" / "500 g") match both spellings.
 */
export function queryGroups(query: string): string[][] {
  const text = normalizeText(query)
    .replace(/([a-z])-(\d)/g, "$1§$2") // keeps the hyphen of "ps-5" apart from ordinary separators
    .replace(/(\d)-([a-z])/g, "$1§$2")
    .replace(/[^a-z0-9 §]+/g, " ")
  const words = text.split(/\s+/).filter(Boolean)
  const groups: string[][] = []
  for (let i = 0; i < words.length; ) {
    const word = words[i]
    if (word.includes("§")) {
      const [a, b] = word.split("§")
      groups.push([...new Set([...expand(a + b), `${a} ${b}`])])
      i += 1
      continue
    }
    const glued = word.match(/^(\d+)([a-z]{1,2})$/)
    if (glued && UNITS.has(glued[2])) {
      groups.push([word, `${glued[1]} ${glued[2]}`])
      i += 1
      continue
    }
    if (/^\d+$/.test(word) && UNITS.has(words[i + 1] ?? "")) {
      groups.push([`${word} ${words[i + 1]}`, `${word}${words[i + 1]}`])
      i += 2
      continue
    }
    const phrase = PHRASES.find(({ words: parts }) => {
      if (i + parts.length > words.length) return false
      const typed = words.slice(i, i + parts.length)
      const last = typed.length - 1
      return parts.every((part, k) => (k === last ? singularForms(typed[k]).includes(part) : typed[k] === part))
    })
    if (phrase) {
      groups.push([...new Set([words.slice(i, i + phrase.words.length).join(" "), ...phrase.group])])
      i += phrase.words.length
      continue
    }
    groups.push(expand(word))
    i += 1
  }
  return groups
}

/**
 * 0 = the title does not match every typed word; 1 = every word starts a word of the title
 * ("cadeira" finds "cadeiras" and "cadeirinha", but NOT "brincadeira": a word is never
 * matched from its middle); 2 = every word appears as a whole word; 3 = same, and the
 * title starts with the first word.
 */
export function matchTier(title: string, groups: string[][]): number {
  if (groups.length === 0) return 1
  const padded = ` ${normalizeText(title).replace(/[^a-z0-9]+/g, " ")} `
  if (!groups.every((alts) => alts.some((a) => padded.includes(` ${a}`)))) return 0
  const whole = groups.every((alts) => alts.some((a) => padded.includes(` ${a} `)))
  if (!whole) return 1
  // "Apple iPhone 15" and "Celular iPhone 15" start with the thing searched, as "iPhone 15" does.
  const head = padded.replace(/^ (apple|celular|smartphone|novo) /, " ")
  return groups[0].some((a) => head.startsWith(` ${a} `)) ? 3 : 2
}

/** Price buckets shared by the filter panel, the filter chips and the home section. */
export const PRICE_RANGES = [
  { value: "0-50", label: "Até R$ 50", min: 0, max: 50 },
  { value: "50-100", label: "R$ 50 a R$ 100", min: 50, max: 100 },
  { value: "100-300", label: "R$ 100 a R$ 300", min: 100, max: 300 },
  { value: "300-1000", label: "R$ 300 a R$ 1.000", min: 300, max: 1000 },
  { value: "1000+", label: "Acima de R$ 1.000", min: 1000, max: Infinity },
] as const

export type PriceRange = (typeof PRICE_RANGES)[number]["value"]

export const isPriceRange = (value: string): value is PriceRange =>
  PRICE_RANGES.some((range) => range.value === value)

export interface ProductFilters {
  query?: string
  category?: string
  stores: StoreSource[]
  priceRanges: PriceRange[]
  minDiscount: number | null
  freeShippingOnly: boolean
}

export const EMPTY_FILTERS: ProductFilters = {
  category: undefined,
  stores: [],
  priceRanges: [],
  minDiscount: null,
  freeShippingOnly: false,
}

function matchesPriceRange(price: number, value: PriceRange) {
  const range = PRICE_RANGES.find((r) => r.value === value)!
  // The lowest bucket includes R$ 0, so a free item is not left out of every price filter.
  return (price > range.min || (range.min === 0 && price >= 0)) && price <= range.max
}

export function filterProducts(
  products: Product[],
  filters: ProductFilters,
): Product[] {
  const groups = queryGroups(filters.query ?? "")
  // Something was typed but nothing in it is searchable ("日本語", "!!!"): no results, not the whole catalogue.
  if (groups.length === 0 && (filters.query ?? "").trim() !== "") return []

  return products.filter((product) => {
    if (groups.length && matchTier(product.title, groups) === 0) return false
    if (filters.category && product.category !== filters.category)
      return false
    if (filters.stores.length && !filters.stores.includes(product.store))
      return false
    if (
      filters.priceRanges.length &&
      !filters.priceRanges.some((range) =>
        matchesPriceRange(product.price, range),
      )
    )
      return false
    if (filters.minDiscount) {
      const discount = calculateDiscountPercent(
        product.price,
        product.originalPrice,
      )
      if (!discount || discount < filters.minDiscount) return false
    }
    if (filters.freeShippingOnly && !product.isFreeShipping) return false
    return true
  })
}

/** Real discount only: products without a recorded previous price count as 0. */
const discountOf = (p: Product) =>
  calculateDiscountPercent(p.price, p.originalPrice) ?? 0

/** On a DJ-only list the centre of the niche (controllers, CDJs, mixers) comes first; the usual order is kept inside each group. */
function djFirst(ranked: Product[]) {
  if (ranked.length === 0 || !ranked.every((p) => p.category === "dj")) return ranked
  const core = (p: Product) => djTypeOf(p.title) === "controladoras"
  return [...ranked.filter(core), ...ranked.filter((p) => !core(p))]
}

/** Words of things sold FOR another product (matched on normalised, accent-free text). */
const ACCESSORY =
  /\b(capa|capas|capinha|capinhas|case|cases|pelicula|peliculas|carregador|carregadores|cabo|cabos|suporte|suportes|adaptador|bateria|protetor|pulseira|power ?bank|microfone|lapela|gamepad|compativel|refil|kit)\b/

export function sortProducts(products: Product[], sort: SortOption, query = "") {
  const sorted = [...products]
  switch (sort) {
    case "price_asc":
      return sorted.sort((a, b) => a.price - b.price)
    case "discount_desc":
      return sorted.sort((a, b) => discountOf(b) - discountOf(a))
    case "recent":
      // Newest in the catalog first; items without a date keep their order.
      return sorted.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    case "unit_price": {
      // Per kind of supplement (price per kg is only comparable inside the same kind),
      // cheapest first; per kg before per 100 capsules; unclear sizes go last.
      const rank = (p: Product) => {
        const u = unitPrice(p.title, p.price)
        if (!u) return Infinity
        const found = SUPPLEMENT_TYPES.findIndex((t) => t.value === supplementTypeOf(p.title))
        const kind = found < 0 ? SUPPLEMENT_TYPES.length : found // untyped supplements after the kinds
        return kind * 1e8 + (u.unit === "kg" ? 0 : 1e6) + u.value
      }
      return sorted.sort((a, b) => rank(a) - rank(b))
    }
    case "relevance":
    default: {
      const ranked = byRelevance(sorted)
      const groups = queryGroups(query)
      if (groups.length === 0) return djFirst(ranked)
      // With a search, how well the title matches comes first; the usual ranking breaks ties.
      const hinted = groups.flat().map((w) => CATEGORY_HINTS[w]).find(Boolean)
      // Searching a thing ("iphone", "furadeira") must not bury it under what is made for it (cases, films,
      // chargers, holders): those come after the real products, unless the search itself asks for them.
      const asksForAccessory = groups.flat().some((w) => ACCESSORY.test(w))
      const demote = (title: string) => (!asksForAccessory && ACCESSORY.test(normalizeText(title)) ? 0 : 20)
      return ranked
        .map((p, i) => ({ p, i, tier: matchTier(p.title, groups) + (hinted && p.category === hinted ? 10 : 0) + demote(p.title) }))
        .sort((a, b) => b.tier - a.tier || a.i - b.i)
        .map((e) => e.p)
    }
  }
}

/** URL values for `?ordenacao=` (Portuguese, stable, so they can become pages later). */
export const SORT_PARAMS: Record<string, SortOption> = {
  relevancia: "relevance",
  desconto: "discount_desc",
  preco: "price_asc",
  recente: "recent",
  "custo-beneficio": "unit_price",
}

export function countByStore(products: Product[]) {
  return products.reduce(
    (acc, product) => {
      acc[product.store] = (acc[product.store] ?? 0) + 1
      return acc
    },
    {} as Record<StoreSource, number>,
  )
}

/** How many offers fall in each price bucket (all of them, regardless of other filters). */
export function countByPriceRange(products: Product[]) {
  return PRICE_RANGES.map((range) => ({
    ...range,
    count: products.filter((p) => matchesPriceRange(p.price, range.value)).length,
  }))
}

/** Edit distance counting a swap of two neighbouring letters as one change ("wehy" -> "whey"). */
export function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/**
 * For a search that found nothing: the same words with typos replaced by the closest
 * (then most common) word that appears in the catalog's titles or in the synonym lists, or
 * null when no word needed fixing or none is close enough. Words under 4 letters are only
 * fixed to a common word ("nke" -> "nike"); a word that is really two run together
 * ("airfyer") is split ("air fryer").
 */
export function correctQuery(query: string, products: Product[]): string | null {
  const words = normalizeText(query).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)
  const freq = new Map<string, number>()
  for (const p of products) {
    for (const w of new Set(normalizeText(p.title).split(/[^a-z0-9]+/))) {
      if (w.length >= 3) freq.set(w, (freq.get(w) ?? 0) + 1)
    }
  }
  // Words people type that no title may use ("celular" when titles say "smartphone"): known,
  // but rarer than any word that really appears in a title.
  for (const term of [...SYNONYMS.flat(), ...Object.keys(NARROWER)]) {
    for (const w of term.split(" ")) if (w.length >= 3 && !freq.has(w)) freq.set(w, 0.5)
  }

  type Hit = { w: string; dist: number; n: number }
  const nearest = (word: string, limit: number, minCount = 0, minLength = 0): Hit | null => {
    let best: Hit | null = null
    for (const [w, n] of freq) {
      if (n < minCount || w.length < minLength || Math.abs(w.length - word.length) > limit) continue
      const dist = editDistance(word, w)
      if (dist <= limit && (!best || dist < best.dist || (dist === best.dist && n > best.n))) best = { w, dist, n }
    }
    return best
  }
  /** One typed word that is really two ("airfyer"): each half exact or one typo away, two changes at most. */
  const split = (word: string): string | null => {
    let best: { text: string; dist: number; n: number } | null = null
    for (let i = 3; i <= word.length - 3; i++) {
      const left = freq.has(word.slice(0, i)) ? { w: word.slice(0, i), dist: 0, n: freq.get(word.slice(0, i))! } : nearest(word.slice(0, i), 1)
      const right = freq.has(word.slice(i)) ? { w: word.slice(i), dist: 0, n: freq.get(word.slice(i))! } : nearest(word.slice(i), 1)
      if (!left || !right || left.dist + right.dist > 2) continue
      const dist = left.dist + right.dist
      const n = left.n + right.n
      if (!best || dist < best.dist || (dist === best.dist && n > best.n)) best = { text: `${left.w} ${right.w}`, dist, n }
    }
    return best?.text ?? null
  }

  let changed = false
  const fixed = words.map((word) => {
    if (word.length < 3 || /^\d+$/.test(word) || [...freq.keys()].some((k) => k.startsWith(word))) return word
    const hit =
      word.length === 3
        ? nearest(word, 1, 3, 4) // short words: only to a common, longer word
        : nearest(word, word.length >= 7 ? 2 : 1)
    const text = hit?.w ?? (word.length >= 6 ? split(word) : null)
    if (!text) return word
    changed = true
    return text
  })
  return changed ? fixed.join(" ") : null
}
