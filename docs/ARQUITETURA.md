# Arquitetura

## Visão geral
Site estático (sem build) + 3 Netlify Functions. O navegador faz o trabalho pesado (renderização, projeção, analista); o servidor só intermedeia o TSE com cache e guarda histórico.

## Fluxo de dados
```
                      ┌──────────────── resultados.tse.jus.br (TSE) ────────────────┐
                      │                                                             │
   navegador ──(USE_PROXY)──► /api/tse/*  (tse.mjs, CDN durable 30 s) ───────────────┤
   navegador ──(local)────────────────────────────────── direto (CORS aberto) ───────┤
                                                                                     │
   snapshot.mjs (agendada, */2 min) ◄────────── busca direta, sem CDN ───────────────┘
        │ grava
        ▼
   Netlify Blobs (store "apuracao")  hist/*  resumo/dep6
        │ lê
        ▼
   dados.mjs  ──►  /api/hist/:chave   /api/resumo/dep6  ──► navegador (syncHist, parties.js)
```
- `USE_PROXY` (em `app.js`) é verdadeiro quando a página está em `https:` e o host **não** é `localhost`/`127.0.0.1`/`[::1]` nem `*.github.io`. Com proxy, `BASE = /api/tse/oficial/ele2026` e o `fetch` usa `cache: "no-cache"` (o navegador revalida e recebe 304 por ETag). Sem proxy, `BASE` é a URL do TSE e acrescenta `?t=` (janela de 10 s) para furar cache.
- Só `syncHist` e o resumo de deputados dependem de `/api/*`; sem proxy esses recursos caem para o histórico local e para o download dos arquivos completos.

## Ordem de carregamento dos scripts (`index.html`, todos com `?v=NN`)
`br-map.js` → `projection.js` → `app.js` → `parties.js` → `candidate.js` → `region.js` → `analyst.js` → `deputies.js` → `runoff.js` → `summary.js` → `ticker.js` → `countdown.js`.
São scripts clássicos (não módulos) que compartilham escopo global; a ordem importa. Ex.: `projection.js` vem antes de `app.js` e declara `pj`, `mapMode`, `ufProj`, `zzData`; `app.js` já chama `go()` no final (inicialização) e usa `typeof renderAnalyst === "function"` para tolerar módulos ainda não carregados. `analyst.js` e `candidate.js` buscam `base-2022.json`/`partidos-2022.json` com `fetch`.

## Arquivos do front
| Arquivo | Papel |
|---|---|
| `index.html` | Estrutura (seções `#resumo`, `#top`, `#proj`, `#mapa`, `#resultado`, `#feed`, `#analista`, `#segundo`, `#regioes`, `#partidos`, `#deputados`, `#estados`, `#ticker`) |
| `styles.css` | Estilos, tema claro/escuro, fallbacks sem `color-mix` |
| `br-map.js` | Malha IBGE dos estados pré-projetada em SVG (uma linha longa) |
| `app.js` | Núcleo. `getJSON`, `fileFor`, `candidatos`, cores (`PARTY_COLORS`, `partyColor`, `colorVar`, `CM`/`mix`/`setFill`), histórico (`histId`, `histKey`, `syncHist`, `pushHist`), `renderKPIs`, `renderResults`, `renderEvolution`, `renderDonut`, mapa (`buildMap`, `applyZoom`, `loadStates`, `paintStates`, `stateInfo`), tabela (`renderStateTable`), feed (`addEvents`, `feedFromStates`, `feedFromMain`, `renderFeed`), regiões (`aggregateRegion`, `aggregateDs`, `regionData`), `nationalFromStates`, ciclo (`load`, `tick`, `go`), eventos e hash da URL |
| `projection.js` | `runProjection` (Monte Carlo + garantias), `verdict`, `updateProjection`, `computeUfProj`, `renderProjection`, `paintProjection`, filtro "Já ganhou" (`decidedInfo`, `decidedUfs`, `paintDecided`, `renderDecidedTable`) |
| `parties.js` | `loadParties`, `aggregateParties`, `hemicycle`/`HEMI` (513 cadeiras), `renderParties`; usa `/api/resumo/dep6` quando há proxy |
| `candidate.js` | Perfil do candidato (`openCand`, `closeCand`, `renderCandView`, `buildCandMap`), comparação com 2022 (`share2022`, `SUCC`, `P22`) |
| `region.js` | Visão por região (`regionLeaders`, `renderRegionRaces`, `renderRegionCards`) |
| `analyst.js` | "Meu analista": carga de dados (`loadAnalyst`), regras por assunto (ver HANDOFF), `renderAnalyst` |
| `deputies.js` | Aba Deputados (`depResult`, `loadDep`, `renderDep`, `renderDepBrasil`, `openDep`, `depInsights`) |
| `runoff.js` | Simulador do 2º turno (`roFinalists`, `rate22`, `roSimulate`, `roReal`, `renderRunoff`, `runoffInsights`) |
| `summary.js` | Banner de resumo (`summaryData`, `summaryT2`, `tilesT1`, `tilesT2`, `renderSummary`) |
| `countdown.js` | Contagem até 25/10/2026 20:00 UTC (17h de Brasília) |
| `ticker.js` | Faixa de notícias (`tickerItems`, `renderTicker`) |
| `sobre.html` | Metodologia pública (página independente, com CSS próprio) |
| `base-2022.json` | `camara`, `gov`, `sen`, `turnout`, `vv`, `t2`, `fonte` (2022) |
| `partidos-2022.json` | Percentual por partido no 1º turno de 2022, indexado por cargo (`1`, `3`, `5`) e UF |

## Funções do servidor (`netlify/functions/`) e biblioteca
| Arquivo | Rota / gatilho | Papel |
|---|---|---|
| `tse.mjs` | `/api/tse/*` | Proxy só para arquivos da eleição 2026 (lista `ALLOWED`), `Netlify-CDN-Cache-Control` durable: 30 s para dados (`stale-while-revalidate` 4×, `stale-if-error=600`) e 1 dia para fotos; ETag SHA-1 → 304; `Access-Control-Allow-Origin: *`; timeout de 8 s |
| `snapshot.mjs` | agendada `*/2 * * * *` | `collectT2` (a cada execução) e `collectT1` (quando `minuto % 30 < 2`); grava histórico e resumo em Blobs; cada turno em `Promise.allSettled` |
| `dados.mjs` | `/api/hist/*`, `/api/resumo/*` | Lê o Blob; chaves válidas sem dado devolvem `[]` (hist, 200) ou `{}` (resumo, 404); cache CDN 60 s (20 s se vazio) |
| `netlify/lib/tse.mjs` | (importado) | `ORIGIN`, `UFS`, `ELE`, `ELE2`, `T2_GOV`, `fileUrl`, `getJSON`, `candidatos`, `point`, `pointFromFile`, `nationalPoint`, `depResult` |

`netlify.toml`: `publish = "."`, `NODE_VERSION = "22"`, funções em `netlify/functions` com `esbuild`, cabeçalho `Cache-Control: max-age=0, must-revalidate` para `/*.html` e `Content-Type` do manifest. `package.json`: `type: module`, dependência `@netlify/blobs ^11.0.0`.

## Estado global principal (front)
| Variável | Onde | Conteúdo |
|---|---|---|
| `state` | `app.js` | `{cargo, uf, turno, dt, showAll, auto, view, zoom, center, focus, decidedOnly, wasRegion}`; `turno` = turno selecionado, `dt` = turno do dado exibido |
| `last` | `app.js` | Último arquivo (ou agregado) exibido; `last.synthetic` = soma de estados |
| `natList` | `app.js` | Candidatos nacionais (para cores quando se vê um estado) |
| `colorOf` | `app.js` | Cache partido → variável CSS `--pc-*` |
| `mapData`, `mapStamp`, `mapCargo`, `mapTurno` | `app.js` | Arquivos por UF do cargo/turno do mapa; `zzData` (exterior, em `projection.js`) |
| `prevVotes`, `countdown`, `loading` | `app.js` | Variação, contador de atualização (`REFRESH` = 30 s), trava |
| `pj` | `projection.js` | `{res, list, scope}` — resultado da projeção atual; `ufProj` por UF; `mapMode` ("now"/"proj") |
| `an`, `an2` | `analyst.js` | Dados do analista: `an` = 1º turno (`br`, `ufs`, `zz`…); `an2` = 2º turno (`br`, `ufs`, `zz`, `gov`, `gov1`) |
| `pt` | `parties.js` | Dados de partidos (`data[3|5|6]`, `res6`, `stamp`, `visible`) |
| `dep` | `deputies.js` | `{cargo, uf, q, view, data, stamp, visible}` |
| `ro` | `runoff.js` | `{mode, x, over, adv}` do simulador |
| `sm` | `summary.js` | `{view}` do banner ("t1"/"t2") |
| `tk` | `ticker.js` | Estado da faixa |
| `CD` | `countdown.js` | Alvo da contagem |
| `B22`, `P22` | `analyst.js`, `candidate.js` | Bases de 2022 carregadas por `fetch` |

Hash da URL: `#t{turno}/{cargo}/{uf}[/{sqcand}]` (ex.: `#t2/1/br`); links antigos sem prefixo de turno (`#1/br`) continuam válidos. Regiões usam `r-n`, `r-ne`, `r-co`, `r-se`, `r-s` e `r-t2` ("Estados com 2º turno").

## Armazenamento
### localStorage (navegador)
| Chave | Conteúdo |
|---|---|
| `h26-{histId}` | Histórico de pontos da apuração (ex.: `h26-1-br`, `h26-t2-1-br`, `h26-3-sp`); até 400 ao gravar, 600 ao mesclar com o servidor |
| `f26-{t2-}{cargo}` | Feed de atualizações (até 80 eventos) |
| `theme` | `"light"` ou `"dark"` |
| `ticker-off` | `"1"` quando a faixa de notícias foi fechada |

Todos os acessos têm try/catch (`store` em `app.js`).

### Netlify Blobs (store `apuracao`)
| Chave | Conteúdo | Escrita |
|---|---|---|
| `hist/t2-1-br` | Histórico do Brasil, 2º turno, Presidente | `collectT2` |
| `hist/t2-1-{uf}` | Presidente por UF no 2º turno (27 UFs) | `collectT2` |
| `hist/t2-3-{uf}` | Governador no 2º turno (`T2_GOV`) | `collectT2` |
| `hist/1-br` | Brasil, 1º turno | `collectT1` |
| `hist/{cargo}-{uf}` | 1º turno: cargos 1, 3, 5 por UF | `collectT1` |
| `resumo/dep6` | Resumo de deputados federais (partidos, ranking top ~600 + eleitos) | `collectT1` |

Cada ponto de histórico: `{hg, m, pst, c: {sqcand: pct}}` (até 12 candidatos; máx. 600 pontos). Chave aceita por `/api/hist/`: regex `^(t2-)?[135]-(br|[a-z]{2})$`.
