import { createHash } from "node:crypto"

import { isTool, refineCategory } from "../lib/categories.ts"
import { shopeeShopBadge } from "../lib/seller.ts"
import type { Connector, OfferRow } from "../types.ts"

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql"
const PER_KEYWORD = 50
const MAX_OFFERS = 4500 // every category (about 3.5k after the quality filter); a low cap stops the last ones empty

/** Best sellers per search term, filed under the site's own category slugs. */
const KEYWORDS: Record<string, string[]> = {
  eletronicos: ["fone bluetooth", "carregador turbo", "smartwatch", "caixa de som bluetooth", "cabo usb c"],
  celulares: ["smartphone", "iphone", "samsung galaxy", "redmi", "xiaomi", "motorola moto", "realme", "google pixel", "capa celular", "pelicula celular", "carregador portatil"],
  informatica: ["mouse sem fio", "teclado", "webcam", "hd externo", "pen drive", "roteador wifi"],
  eletrodomesticos: ["liquidificador", "cafeteira", "aspirador de po", "ferro de passar", "ventilador", "forno eletrico", "batedeira", "chaleira eletrica", "sanduicheira", "panela eletrica"],
  casa: ["air fryer", "organizador casa", "luminaria led", "panela antiaderente", "estante", "sapateira", "rack tv", "escrivaninha", "guarda roupa", "cadeira escritorio"],
  moda: ["camiseta masculina", "mochila", "bolsa feminina", "tenis masculino", "chinelo", "sandalia feminina", "mochila infantil"],
  beleza: ["skincare", "perfume", "secador de cabelo"],
  esporte: ["whey protein", "garrafa termica", "tapete yoga", "vara de pesca", "molinete", "kit pesca", "isca artificial", "anzol", "carretilha"],
  games: ["controle gamer", "headset gamer", "mouse gamer"],
  ferramentas: ["furadeira", "parafusadeira", "jogo de ferramentas", "trena", "alicate", "esmerilhadeira", "multimetro", "jogo de chaves", "maleta de ferramentas", "martelete", "ferro de solda", "serra tico tico", "lixadeira", "chave de impacto", "nivel a laser", "compressor de ar", "jogo de brocas", "estacao de solda"],
  cameras: ["camera ip wifi", "camera de seguranca", "kit cftv", "dvr", "camera externa", "videoporteiro"],
  brinquedos: ["brinquedo infantil", "boneca", "lego", "hot wheels", "quebra cabeca", "massinha de modelar", "pelucia", "patinete infantil", "nerf"],
  "acessorios-veiculos": ["som automotivo", "capa de banco carro", "tapete automotivo", "suporte celular carro", "aspirador automotivo", "camera de re", "carregador veicular"],
  bebes: ["fralda", "mamadeira"],
}

interface Node {
  itemId: string
  shopId: string
  productName: string
  priceMin: string
  priceDiscountRate?: number | null
  imageUrl?: string | null
  offerLink?: string | null
  ratingStar?: string | null
  sales?: number | null
  shopType?: number[] | null
}

/** Signature = sha256(appId + timestamp + body + secret), sent as the Authorization header. */
async function query<T>(env: NodeJS.ProcessEnv, graphql: string): Promise<T> {
  const appId = env.SHOPEE_APP_ID as string
  const secret = env.SHOPEE_APP_SECRET as string
  const body = JSON.stringify({ query: graphql })
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHash("sha256").update(`${appId}${timestamp}${body}${secret}`).digest("hex")

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(20_000),
  })
  const json = (await response.json()) as { data?: T; errors?: { message: string }[] }
  if (!response.ok || json.errors?.length) {
    throw new Error(`Shopee API ${response.status}: ${json.errors?.map((e) => e.message).join("; ") ?? "sem detalhes"}`)
  }
  return json.data as T
}

export function createShopeeConnector(env: NodeJS.ProcessEnv): Connector {
  return {
    name: "shopee",
    async fetchOffers() {
      if (!env.SHOPEE_APP_ID || !env.SHOPEE_APP_SECRET) {
        throw new Error("Missing SHOPEE_APP_ID / SHOPEE_APP_SECRET")
      }
      const offers = new Map<string, OfferRow>()

      for (const [category, keywords] of Object.entries(KEYWORDS)) {
        for (const keyword of keywords) {
          if (offers.size >= MAX_OFFERS) break
          // sortType 2 = most sold. Keyword is ours (no user input), so inline is safe.
          const { productOfferV2 } = await query<{ productOfferV2: { nodes: Node[] } }>(
            env,
            `{ productOfferV2(keyword: "${keyword}", sortType: 2, page: 1, limit: ${PER_KEYWORD}) {
              nodes { itemId shopId productName priceMin priceDiscountRate imageUrl offerLink ratingStar sales shopType }
            } }`,
          )
          for (const node of productOfferV2.nodes) {
            const price = Number(node.priceMin)
            // Quality floor: real photo, our affiliate link, sane price, proven seller.
            if (!node.imageUrl || !node.offerLink || !(price >= 5)) continue
            if (Number(node.ratingStar) < 4.3 || (node.sales ?? 0) < 50) continue
            // A search for "multimetro" also brings cables and meters: the tools shelf keeps only named tools.
            if (category === "ferramentas" && !isTool(node.productName)) continue

            const externalId = `${node.shopId}.${node.itemId}`
            if (offers.has(externalId)) continue

            const rate = node.priceDiscountRate ?? 0
            offers.set(externalId, {
              store_id: "shopee",
              external_id: externalId,
              title: node.productName.slice(0, 160),
              image: node.imageUrl,
              category_slug: refineCategory(node.productName, category),
              price,
              // Only a real discount from the store; never invented.
              original_price: rate >= 5 && rate <= 50 ? Math.round((price / (1 - rate / 100)) * 100) / 100 : null,
              url: `https://shopee.com.br/product/${node.shopId}/${node.itemId}`,
              affiliate_url: node.offerLink,
              is_free_shipping: false,
              popularity: node.sales ?? null,
              seller_leader: shopeeShopBadge(node.shopType),
              source: "api",
            })
          }
          console.log(`[shopee] ${category}/${keyword}: ${offers.size} ofertas até agora`)
        }
      }
      return [...offers.values()]
    },
  }
}
