import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizeTerm } from "../../src/lib/product-requests.ts"

test("normaliza: sem acento, minúsculo, espaços simples", () => {
  assert.equal(normalizeTerm("  Pré   Treino Max "), "pre treino max")
  assert.equal(normalizeTerm("Câmera IP"), "camera ip")
})

test("recusa o que não vale um pedido: curto, longo, link", () => {
  assert.equal(normalizeTerm("ab"), null)
  assert.equal(normalizeTerm("x".repeat(61)), null)
  assert.equal(normalizeTerm("https://loja.com/produto"), null)
  assert.equal(normalizeTerm("www.site.com"), null)
  assert.equal(normalizeTerm("!!!"), null)
})

test("mantém modelos e medidas", () => {
  assert.equal(normalizeTerm("iPhone 15 Pro Max 256GB"), "iphone 15 pro max 256gb")
  assert.equal(normalizeTerm("Cabo 2,5mm 100m"), "cabo 2 5mm 100m")
})
