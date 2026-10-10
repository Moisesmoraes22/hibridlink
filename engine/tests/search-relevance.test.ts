// Phase 1 of the search tests: query matching and relevance ordering.
import assert from "node:assert/strict"
import { test } from "node:test"

import { EMPTY_FILTERS, filterProducts, matchTier, queryGroups, sortProducts } from "../../src/lib/search.ts"
import type { Product } from "../../src/lib/types.ts"

let n = 0
const product = (title: string, category = "eletronicos", extra: Partial<Product> = {}): Product => ({
  id: `p${++n}`,
  title,
  image: "https://example.test/a.jpg",
  price: 100,
  store: "mercado_livre",
  category,
  affiliateUrl: "https://example.test/o",
  ...extra,
})

const titlesFor = (products: Product[], query: string) =>
  filterProducts(products, { ...EMPTY_FILTERS, query }).map((p) => p.title)

const tier = (title: string, query: string) => matchTier(title, queryGroups(query))

test("matchTier: 0 sem correspondência, 1 prefixo, 2 palavra inteira, 3 título começa com a palavra", () => {
  assert.equal(tier("Monitor Gamer 27 polegadas", "teclado"), 0)
  assert.equal(tier("Notebooks Gamer Potentes", "notebook"), 1)
  assert.equal(tier("Suporte para Monitor Gamer", "monitor"), 2)
  assert.equal(tier("Monitor Gamer 27 polegadas", "monitor"), 3)
})

test("diminutivos: 'cadeira' acha 'cadeirinha'", () => {
  assert.notEqual(tier("Cadeirinha de Bebê para Carro", "cadeira"), 0)
  assert.notEqual(tier("Carrinho de Bebê", "carro"), 0)
  assert.notEqual(tier("Bolsinha Feminina", "bolsa"), 0)
})

test("diminutivos: 'cadeirinha' também acha 'cadeira'", () => {
  assert.notEqual(tier("Cadeira Gamer Preta", "cadeirinha"), 0)
  assert.notEqual(tier("Casa de Boneca", "casinha"), 0)
})

test("diminutivo não cria resultado sem sentido", () => {
  assert.equal(tier("Monitor Gamer", "cadeira"), 0)
  assert.equal(tier("Linha de Costura", "lima"), 0)
})

test("uma palavra nunca casa pelo meio de outra", () => {
  assert.equal(tier("Jogo de Brincadeira Infantil", "cadeira"), 0)
  assert.equal(tier("Fonte para Notebook", "book"), 0)
  assert.equal(tier("Camiseta Preta", "eta"), 0)
})

test("plural e singular se encontram", () => {
  assert.notEqual(tier("Cadeira Gamer", "cadeiras"), 0)
  assert.notEqual(tier("Cadeiras Gamer", "cadeira"), 0)
  assert.notEqual(tier("Fones Bluetooth", "fones"), 0)
})

test("todas as palavras digitadas são exigidas (E), em qualquer ordem", () => {
  const catalog = [
    product("Monitor Gamer 27 Curvo"),
    product("Monitor Office 24"),
    product("Cadeira Gamer Ergonômica"),
  ]
  assert.deepEqual(titlesFor(catalog, "monitor gamer"), ["Monitor Gamer 27 Curvo"])
  assert.deepEqual(titlesFor(catalog, "gamer monitor"), ["Monitor Gamer 27 Curvo"])
  assert.deepEqual(titlesFor(catalog, "monitor gamer cadeira"), [])
})

test("busca vazia ou só de espaços não filtra nada", () => {
  const catalog = [product("A Um"), product("B Dois")]
  assert.equal(titlesFor(catalog, "").length, 2)
  assert.equal(titlesFor(catalog, "   ").length, 2)
})

test("filtros combinam com a busca: categoria, loja, preço, frete e desconto", () => {
  const catalog = [
    product("Fone Bluetooth Barato", "eletronicos", { price: 40, store: "shopee", isFreeShipping: true }),
    product("Fone Bluetooth Caro", "eletronicos", { price: 400, store: "amazon" }),
    product("Fone de Mergulho", "esporte", { price: 80, store: "shopee" }),
    product("Fone com Desconto", "eletronicos", { price: 50, originalPrice: 100, store: "shopee" }),
  ]
  const run = (filters: Partial<typeof EMPTY_FILTERS>) =>
    filterProducts(catalog, { ...EMPTY_FILTERS, query: "fone", ...filters }).map((p) => p.title)

  assert.equal(run({}).length, 4)
  assert.deepEqual(run({ category: "esporte" }), ["Fone de Mergulho"])
  assert.equal(run({ stores: ["shopee"] }).length, 3)
  assert.deepEqual(run({ priceRanges: ["0-50"] }), ["Fone Bluetooth Barato", "Fone com Desconto"])
  assert.deepEqual(run({ freeShippingOnly: true }), ["Fone Bluetooth Barato"])
  assert.deepEqual(run({ minDiscount: 40 }), ["Fone com Desconto"])
})

test("relevância: título que começa com a palavra vem antes de acessório", () => {
  const catalog = [
    product("Suporte de Parede para Monitor"),
    product("Cabo HDMI para Monitor 2m"),
    product("Monitor Gamer 27 Curvo"),
    product("Monitor Office 24"),
  ]
  const found = filterProducts(catalog, { ...EMPTY_FILTERS, query: "monitor" })
  const ranked = sortProducts(found, "relevance", "monitor").map((p) => p.title)
  assert.deepEqual(new Set(ranked.slice(0, 2)), new Set(["Monitor Gamer 27 Curvo", "Monitor Office 24"]))
})

test("relevância: palavra inteira vem antes de prefixo", () => {
  const catalog = [product("Notebooks Gamer Potentes"), product("Notebook Gamer Slim")]
  const ranked = sortProducts(catalog, "relevance", "notebook").map((p) => p.title)
  assert.equal(ranked[0], "Notebook Gamer Slim")
})

test("dica de categoria: 'proteína' põe suplementos antes de cosméticos", () => {
  const catalog = [
    product("Shampoo com Proteína de Trigo", "beleza"),
    product("Whey Protein Isolado 900g", "suplementos"),
    product("Proteína Vegetal 500g", "suplementos"),
  ]
  const ranked = sortProducts(filterProducts(catalog, { ...EMPTY_FILTERS, query: "proteina" }), "relevance", "proteina")
  assert.equal(ranked.at(-1)?.category, "beleza")
})

test("ordenações simples: menor preço, maior desconto, mais recente", () => {
  const catalog = [
    product("A", "x", { price: 30, originalPrice: 40, createdAt: "2026-01-01" }),
    product("B", "x", { price: 10, originalPrice: 40, createdAt: "2026-03-01" }),
    product("C", "x", { price: 20, createdAt: "2026-02-01" }),
  ]
  assert.deepEqual(sortProducts(catalog, "price_asc").map((p) => p.title), ["B", "C", "A"])
  assert.equal(sortProducts(catalog, "discount_desc")[0].title, "B")
  assert.deepEqual(sortProducts(catalog, "recent").map((p) => p.title), ["B", "C", "A"])
})

test("a busca não altera a lista original (sem efeito colateral)", () => {
  const catalog = [product("Z"), product("A")]
  const copy = catalog.map((p) => p.title)
  sortProducts(catalog, "price_asc")
  sortProducts(catalog, "relevance", "a")
  assert.deepEqual(catalog.map((p) => p.title), copy)
})

test("buscar um aparelho põe os aparelhos antes dos acessórios feitos para ele", () => {
  const items = [
    product("Película de Vidro 3D para iPhone 13", "celulares"),
    product("Carregador Turbo USB-C para iPhone", "celulares"),
    product("Apple iPhone 15 128 GB Preto", "celulares"),
    product("Capa Silicone iPhone 12", "celulares"),
    product("iPhone 14 256 GB Azul", "celulares"),
  ]
  const titles = sortProducts(items, "relevance", "iphone").map((p) => p.title)
  assert.deepEqual(titles.slice(0, 2).sort(), ["Apple iPhone 15 128 GB Preto", "iPhone 14 256 GB Azul"])
})

test("se a busca pede o acessório, ele não é rebaixado", () => {
  const items = [product("Apple iPhone 15 128 GB Preto", "celulares"), product("Capa Silicone iPhone 12", "celulares")]
  assert.equal(sortProducts(items, "relevance", "capa iphone")[0].title, "Capa Silicone iPhone 12")
})

test("'Apple iPhone 15' conta como título que começa com iphone, igual a 'iPhone 15'", () => {
  assert.equal(tier("Apple iPhone 15 (128 GB) - Preto", "iphone"), 3)
  assert.equal(tier("Celular IPhone 17 Pro Max 256GB", "iphone"), 3)
  assert.equal(tier("Película para iPhone 13", "iphone"), 2)
})
