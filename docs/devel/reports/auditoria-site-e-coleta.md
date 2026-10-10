# Auditoria do site e da coleta

Feita em 10/10/2026 sobre a branch `redesign/visual`, o banco de produção (só leitura) e o site em
produção (`https://e-zoom.vercel.app`). Cada item diz o que foi medido, onde está no código e o
estado atual. Os estados são atualizados conforme o trabalho anda.

Estados: **aberto**, **em andamento**, **feito** (com o commit), **depende de você**.

## Números medidos em 10/10/2026

| Medida | Valor |
|---|---|
| Ofertas ativas, com link de afiliado e foto | 12.850 (Mercado Livre 6.740, Shopee 5.918, Amazon 192) |
| Ofertas inativas guardadas | 1.351 |
| Linhas no histórico de preço | 19.089, desde 03/10; 6.738 entraram só em 10/10 |
| Ofertas com 2 ou mais preços registrados | 2.361 (324 com 5 ou mais) |
| Ofertas ligadas ao mesmo produto em outra loja (`product_id`) | 0 |
| Ofertas com avaliação por estrelas | 1.448 |
| Ofertas com "preço anterior" | 5.859 (295 com mais de 50% e por isso sem selo) |
| Títulos repetidos entre ofertas ativas | 306 |
| Cliques em "Ver oferta" | 57 em 5 dias (36 em 06/10) |
| Cliques por origem | home 23, busca 17, produto 13, categoria 4 |
| Cliques por loja | Mercado Livre 31, Amazon 17, Shopee 9 |
| Favoritos salvos | 2 |
| Coletas em 10/10 (agendadas: 48 por fonte) | Mercado Livre 10, Shopee 5, Telegram 3 |
| Idade média do preço | Mercado Livre 9,1 h, Amazon 19,8 h, Shopee 38 h |
| Tamanho do banco | 32 MB |

A amostra de cliques é pequena e inclui testes nossos. Serve de indício, não de prova.

## A. Urgente: quebra sozinho

### A1. Teto do catálogo a 86%
- **Medido:** 12.850 ofertas ativas contra um teto de 15.000 (`MAX_OFFERS` em `src/lib/offers.ts`).
- **Efeito:** o corte descarta as ofertas vistas há mais tempo. A Amazon, que só vem do Telegram, some
  primeiro. Já aconteceu com o teto em 6.000.
- **Correção:** ler as páginas em paralelo a partir da contagem real, sem teto que esconda loja; avisar
  no log se o limite de segurança for atingido. A correção definitiva é o item B2.
- **Estado:** feito (ver "Registro do trabalho").

### A2. Histórico de preço estoura o limite de leitura
- **Medido:** 19.089 linhas, teto de 40.000 (`MAX_HISTORY_ROWS`), crescendo até 6.738 por dia. Cada
  atualização de página lê tudo em até 40 requisições em sequência.
- **Efeito:** em poucos dias as quedas de preço mais antigas deixam de ser lidas e a geração das
  páginas fica cada vez mais lenta.
- **Correção:** uma função no banco (`offer_recent_prices`) devolve, numa requisição, só os últimos 8
  preços das ofertas que têm 2 ou mais. O site usa a função e cai na leitura antiga se ela não existir.
- **Estado:** feito. Função criada no banco em 10/10 (devolve as 2.054 ofertas com histórico numa
  requisição). Além disso o catálogo ficou em memória por 5 minutos por processo, com uma leitura
  compartilhada: o build caiu de 68 s (com falhas e novas tentativas) para 18 s, sem falhas.

### A3. Falha do banco mostra o catálogo de exemplo
- **Medido:** `getCatalog` devolve os produtos de exemplo (`link "#"`) quando a consulta falha.
  `getOffer` ignora o erro e a página de produto vira 404, que fica em cache.
- **Correção:** com o banco configurado, um erro passa a interromper a geração. O Next mantém a última
  página boa. O catálogo de exemplo só aparece sem banco configurado (desenvolvimento).
- **Estado:** feito.

### A4. Coleta roda bem menos que o agendado
- **Medido:** agendada a cada 30 minutos no GitHub Actions; rodou 10, 5 e 3 vezes no dia.
- **Efeito:** preço da Amazon com 19,8 h em média; ofertas vencem em 48 h sem serem revistas.
- **Correção:** tirar o agendamento do GitHub (pg_cron do Supabase chamando o `workflow_dispatch`, ou
  Vercel Cron). Separar o Telegram num fluxo próprio, mais frequente.
- **Estado:** aberto.

## B. Google e velocidade

### B1. Busca e categoria chegam vazias no HTML
- **Medido:** `/categoria/ferramentas` em produção não tem `<h1>` nem link de produto; o HTML traz o
  marcador `BAILOUT_TO_CLIENT_SIDE_RENDERING`. A causa é `useSearchParams` em `SearchResults` dentro de
  um `Suspense` sem conteúdo.
- **Correção:** a lista de busca/categoria vira o `fallback` do `Suspense`, então o HTML estático já
  traz o título e as 24 primeiras ofertas com links. Medido no build: `/categoria/ferramentas` e
  `/busca` com `<h1>` e 24 links de produto (antes: zero).
- **Estado:** feito. Filtros e busca por URL continuam no navegador depois da hidratação.

### B2. Busca e categoria carregam o catálogo inteiro
- **Medido:** 12.850 ofertas em cada visita, 1,39 MB comprimido. `/api/search-index` soma 773 KB.
- **Correção:** busca, filtros e paginação no servidor. O banco já tem o índice
  `offers_title_search_idx` (texto em português) sem uso.
- **Estado:** aberto. O HTML dessas páginas ainda tem ~7,9 MB sem compressão. A outra sessão tem
  trabalho não commitado nessa área (`src/app/api/cards`, `src/lib/use-cards.ts`, `SearchItem` em
  `types.ts`) que leva só os campos de busca por oferta e busca os cartões da página sob demanda.
  É a direção certa e deve ser commitada lá primeiro; esta branch então é atualizada em cima dela
  (as duas mexem em `search-results.tsx`, `busca/page.tsx` e `categoria/[slug]/page.tsx`).

### B3. Oferta vencida vira 404
- **Medido:** o sitemap lista 12.884 páginas de produto; elas expiram em 48 h e respondem 404.
- **Correção:** mostrar "oferta encerrada" com ofertas parecidas e tirar do sitemap as inativas.
- **Obstáculo:** a regra de leitura do banco só libera ofertas ativas. Resolvido com a função
  `closed_offer(id)`, que devolve só o que já era público (sem o link de afiliado).
- **Estado:** feito. A página mostra "Oferta encerrada", o último preço visto, botões para a
  categoria e a busca, e fica fora do índice (`noindex`). O sitemap já lista só ofertas ativas.

### B4. Dados estruturados incompletos
- `Product` e `Offer` existem; faltam `BreadcrumbList` e `ItemList` nas categorias.
  `availability` é sempre `InStock`.
- **Estado:** aberto (Fase 4).

### B5. Peso das fotos na página de produto
- As miniaturas de 56 px carregavam a foto em tamanho original (até 8 por produto).
- **Correção:** miniaturas usam a cópia pequena da loja (500 px no Mercado Livre, 320 px na Shopee).
  Medido num produto com 7 fotos: só a foto principal vem em tamanho cheio (198 KB); as miniaturas
  ficam entre 47 e 66 KB cada.
- **Estado:** feito.

### B6. Contagens do cabeçalho em 32 consultas
- `getSiteSummary` faz uma contagem por categoria e por loja. Uma função agrupada resolve em uma.
- **Estado:** aberto (baixo impacto: fica 5 minutos em memória).

## C. Produto e negócio

### C1. O site não compara lojas
- **Medido:** nenhuma oferta tem `product_id`. O hero promete "não precisa procurar loja por loja".
- **Correção:** casar ofertas pelo código do produto (GTIN/EAN quando a loja informa) e, na falta,
  por marca e modelo extraídos do título, com revisão dos casos duvidosos.
- **Estado:** aberto.

### C2. Sem mecanismo de retorno
- 2 favoritos, nenhum alerta de preço, nenhum canal ou e-mail.
- **Correção:** alerta de queda de preço nos favoritos (e-mail) e um canal alimentado pelas quedas reais.
- **Estado:** aberto.

### C3. Home com poucas ofertas
- A home gerou 23 dos 57 cliques e o redesign a deixou com 4 ofertas.
- **Correção:** recolocar prateleiras com dado real ("Baixou de preço hoje", "Mais clicadas").
- **Estado:** feito. Prateleiras "Baixou de preço" (quedas registradas nas últimas 48 h) e "Mais
  clicadas" (3 ou mais cliques); cada uma só aparece com 3 ofertas ou mais. O card mostra "Caiu de
  R$ X" quando a queda vem do nosso histórico.

### C4. Oferta e procura desalinhadas
- Eletrônicos, celulares e games: 25 dos 57 cliques. Catálogo: ferramentas 1.762, casa 1.160.
  Amazon: 1,5% do catálogo e 30% dos cliques.
- **Estado:** aberto (decisão de coleta).

### C5. Comissão sem origem
- Os links usam identificador fixo (`matt_word`, `sub_id=ezoom`, `tag`). Não dá para ligar a comissão
  à página que a gerou.
- **Estado:** aberto.

### C6. Programa de afiliados da Amazon
- Preços da Amazon vêm de postagens do Telegram. As regras do Associates, pelo que se conhece, pedem
  preço vindo da API oficial e uma frase de divulgação própria. A posse da tag `rafaellimadas-20` não
  foi confirmada.
- **Estado:** depende de você (conferir contrato e tag).

### C7. Contador de cliques aceita inserção direta
- A política `offer_clicks_insert` libera `INSERT` para `anon`. O limite por visitante fica só na rota
  `/api/click`, e quem chamar o banco direto passa por fora.
- **Correção:** a rota grava com a chave secreta e a política de `anon` é removida.
- **Estado:** aberto (precisa de variável de ambiente na Vercel e de migração).

### C8. Avisos do Supabase
- `offer_click_counts` é `SECURITY DEFINER` e pode ser chamada por `anon` (intencional: devolve só
  contagens). Proteção contra senha vazada desligada (exige plano Pro).
- **Estado:** aceito por enquanto.

## D. Acabamento do redesign

| Item | Onde | Estado |
|---|---|---|
| Botão "Ver na Mercado Livre" (o certo é "no") | `product-card.tsx` | feito |
| "Oferta encerrada" fala "da Mercado Livre" | `closed-offer.tsx` | feito (do/da por loja) |
| Descrições citam só "Mercado Livre e Amazon" | `busca/page.tsx`, `categoria/[slug]/page.tsx` | feito |
| Busca e categoria no visual antigo | `search-results.tsx`, `filter-panel.tsx` | aberto (Fase 4) |
| Estrelas em só 11% das ofertas | coleta | aberto |
| 306 títulos repetidos | coleta, `withVariants` | aberto |
| Branch `redesign/visual` sem publicar; conflito com a outra sessão em `search-results.tsx` | git | depende de você |
| Logos das lojas: conferir as regras de uso de marca de cada programa | `public/lojas/` | depende de você |

## E. O que está bom
- Página de produto lê uma oferta, não o catálogo (antes levava 14 s a frio).
- Links de afiliado reconstruídos do zero: a tag de terceiros é descartada (`engine/lib/links.ts`).
- Descontos acima de 50% e quedas fora de 3% a 50% não são exibidos (`offer-row.ts`).
- Ordenação mistura lojas por posição, então uma loja grande não enterra as outras (`deals.ts`).
- Coleta vazia não desativa o catálogo; ofertas bloqueadas saem do ar (`engine/run.ts`).
- Cabeçalhos de segurança, contraste AA no botão e no selo, canonical na home.
- Clarity só carrega depois do consentimento de cookies.
- 17 arquivos de teste cobrem a coleta e a busca.

## Ordem de trabalho
1. A1, A2, A3 e os textos da seção D.
2. B1, B2, B3 e B4 junto com a Fase 4 (depois de combinar com a outra sessão).
3. A4.
4. C3 e publicar a pré-visualização.
5. C1, C2 e C5.

## Registro do trabalho
- 10/10/2026 (2º bloco): migrações `offer_recent_prices` e `closed_offer` aplicadas no banco. B1, B3 e
  C3 feitos; catálogo em memória (build 68 s para 18 s).
- 10/10/2026: auditoria criada. A1, A3, B5 e os dois textos da seção D corrigidos; código do A2
  pronto, aguardando a migração no banco. Página de erro criada (`src/app/error.tsx`). Teste novo:
  `engine/tests/catalog-failure.test.ts` (264 testes passando).
