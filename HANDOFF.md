# HANDOFF — Central das Eleições 2026

> Documento para retomar o projeto numa **nova sessão** sem acesso à conversa anterior.
> Escrito em 25/10/2026 (dia do 2º turno). Leia este arquivo primeiro; os detalhes estão em `docs/`.

## Resumo em 10 linhas
1. Site público de **apuração das Eleições 2026 em tempo real**, com dados oficiais do TSE.
2. **JavaScript puro**, sem frameworks e **sem build** (HTML + CSS + vários `.js` carregados por `<script>`).
3. Publicado na **Netlify**; deploy automático a cada `git push` na branch `main`.
4. Funções da Netlify (`netlify/functions/`): proxy com cache do TSE (`/api/tse/*`), coleta agendada a cada 2 min (histórico em Netlify Blobs) e entrega do histórico/resumo (`/api/hist/*`, `/api/resumo/*`).
5. Recursos: mapa por estado, KPIs, resultados, feed de atualizações, projeção Monte Carlo + "Já ganhou", "Meu analista" (comentários por regras), simulador do 2º turno, visão por região/partido, hemiciclo da Câmara, aba Deputados, perfil de candidato, banner de resumo, contagem regressiva e faixa de notícias.
6. Modo padrão hoje: **2º turno** (25/10/2026): Presidente (Flávio Bolsonaro/PL × Lula/PT) e Governador em AC, AM, DF, ES, RN, TO.
7. Linguagem sempre neutra; projeções são rotuladas como estimativa, nunca como resultado oficial.
8. Uso entre amigos; o dono **não vai divulgar amplamente**.
9. O GitHub Pages foi desligado; só a Netlify serve o site.
10. Último commit de código publicado: `0bc32ef` (contagem regressiva). Depois dele há um commit local de documentação (este conjunto), **sem push**.

## Links e contas
| O quê | Onde |
|---|---|
| Site | https://apuracao2026br1.netlify.app |
| Repositório (público) | https://github.com/leozinhotricolor10-dot/apuracao-2026 (branch `main`) |
| Painel Netlify | https://app.netlify.com (logado no **navegador do usuário**; o CLI da Netlify/Vercel **não** está logado) |
| GitHub | conta `leozinhotricolor10-dot`; `gh` logado no PC |
| Pasta local | `C:\Users\leona\OneDrive\Documents\Comfyui curso\apuracao-2026\` (o repositório git é esta própria pasta) |

Nunca registre tokens ou senhas em arquivos do projeto.

## Estado atual (25/10/2026)
- Site em **modo 2º turno por padrão**, aguardando a apuração das **17h (Brasília)**. Antes disso o arquivo do TSE não existe (404) ou vem "zerado"; o site mostra aviso + contagem regressiva (`countdown.js`).
- **A lógica do 2º turno com dados reais ainda não foi validada**: só foi testada com simulação em memória. É o principal risco.
- `index.html` está em `?v=30`.
- Existe um `git stash` chamado **"otimizacao de carregamento interrompida (nao testada) - 25/10"** (`git stash list`). Toca em `analyst.js`, `app.js`, `index.html`, `netlify.toml`, `netlify/functions/tse.mjs`, `parties.js`, `runoff.js`, `summary.js` (lazy-load de seções, compressão/cache). Está **incompleto e não testado**.

## O que fazer primeiro na próxima sessão (checklist)
1. **Depois das 17h (Brasília), conferir o 2º turno com dados reais** no site publicado:
   - [ ] O aviso "Aguardando…" some e aparecem placar, KPIs, mapa e % apurado do Presidente (`#t2/1/br`).
   - [ ] O selo "AO VIVO" aparece e, quando o TSE marcar totalização final (`tf: "s"`), vira "FINAL".
   - [ ] Comparar o total Brasil do site com https://resultados.tse.jus.br (se aparecer o aviso "arquivo nacional parado", conferir a soma dos 27 estados + exterior).
   - [ ] Governador nos 6 estados (`#t2/3/ac`, `am`, `df`, `es`, `rn`, `to`) e a "região" "Estados com 2º turno" (`r-t2`).
   - [ ] "Já ganhou" / projeção do 2º turno (`projection.js`, `t2: true`); resumo do topo (`summary.js`, `tilesT2`); analista (`t2PresInsights`, `t2GovInsights`, `t2TurnoutInsights`); simulador × resultado real (`roReal` em `runoff.js`).
   - [ ] Histórico no servidor: `/api/hist/t2-1-br` deve começar a devolver pontos (antes disso devolve `[]`).
   - [ ] Console do navegador sem erros.
   - Se algo quebrar, corrigir, aumentar o `?v=` (ver "Como publicar") e publicar.
2. **Decidir o stash**: recomendação é **descartar ou refazer do zero**, não aplicar às cegas (`git stash show -p stash@{0}` para ler; `git stash drop` só com decisão explícita do dono). Só vale a pena otimizar se o site for divulgado amplamente.
3. **Pausar/reduzir a coleta agendada depois da eleição**: `snapshot.mjs` roda a cada 2 min (`schedule: "*/2 * * * *"`) e consome a cota da Netlify. Depois que o 2º turno estiver com `tf: "s"`, reduzir (ex.: `"0 * * * *"`) ou remover o `schedule` e publicar; ver `docs/OPERACAO.md`.
4. Conferir **Netlify → Usage & billing** (execuções de função, Blobs, banda).
5. Dar `git push` da documentação (o commit local ainda não foi enviado) quando não houver risco de atrapalhar o dia da eleição.

## Como rodar localmente
A partir de `C:\Users\leona\OneDrive\Documents\Comfyui curso`:
```
python -m http.server 8765 --directory apuracao-2026
```
Abrir http://localhost:8765. Existe a config `"apuracao"` em `.claude/launch.json` (na pasta `Comfyui curso`, fora do repositório; a confirmar o conteúdo) para o `preview_start`.
Localmente `USE_PROXY` é falso: os dados vêm **direto do TSE** (CORS liberado), e `/api/hist` e `/api/resumo` não existem (o histórico fica só no `localStorage`). Para testar a contagem regressiva: `?countdownTest=10` (alvo daqui a 10 s; aceita 1 a 3600).

## Como testar
Não há suíte de testes automatizados (nenhum arquivo de teste no repositório). A verificação é manual:
- abrir o site local e conferir o console;
- celular a 375 px sem rolagem horizontal (já testado);
- navegador sem `color-mix` usa o fallback (`CM`, `mix()`, `setFill()` em `app.js`);
- em aba em segundo plano (ou navegador automatizado oculto) o `IntersectionObserver` não dispara: as seções Analista, Partidos e Deputados não carregam até ficarem visíveis.

## Como publicar
```
git add -A && git -c user.name="leozinhotricolor10-dot" -c user.email="leozinho.tricolor10@gmail.com" commit -m "..." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push
```
1. **Aumentar o `?v=NN`** em todos os `<link>`/`<script>` locais do `index.html` (hoje `30`).
2. Depois do push, conferir o `index.html` publicado com o novo `?v=`. Se não aparecer em ~3 min, o build falhou: Netlify → Deploys → log.
3. `git add -A` inclui tudo da pasta: confira `git status` antes.

## Onde mexer para…
| Quero… | Arquivo / símbolo |
|---|---|
| Mudar a cor de um partido | `PARTY_COLORS` em `app.js` (PT `#b5121b`, PL `#1d4ed8`); `partyColor()` gera cor por hash para siglas ausentes |
| Trocar os códigos da eleição no TSE | `ELE_T` (e `ELE`) em `app.js` **e** `ELE`/`ELE2` em `netlify/lib/tse.mjs`; `depFile` em `deputies.js` e as URLs `6259/...` em `parties.js` (fixas em 6259) |
| Mudar os estados com 2º turno de Governador | `T2_GOV` em `app.js` e em `netlify/lib/tse.mjs` |
| Mudar a data/hora do 2º turno | `T2_DAY`, `POLLS_CLOSE` em `app.js`; alvo `Date.parse("2026-10-25T20:00:00Z")` em `countdown.js`; textos em `waitMsg()` |
| Ajustar a projeção | constantes `PJ_*` no topo de `projection.js`; `runProjection`; rótulos em `TIERS`; textos em `verdict` |
| Mudar o critério "Já ganhou" | objeto `g` (garantias) em `runProjection` e `decidedInfo` (`projection.js`) |
| Textos / regras do "Meu analista" | `analyst.js`: `presInsights`, `turnoutInsights`, `camaraInsights`, `govInsights`, `senInsights`, `t2PresInsights`, `t2TurnoutInsights`, `t2GovInsights`, `renderAnalyst` |
| Regra de deputados (10% do QE) | `depResult` em `deputies.js` **e** a cópia em `netlify/lib/tse.mjs` (manter iguais) |
| Fusões de partidos em 2022 | `SUCC` em `candidate.js` (usado também por `analyst.js`) |
| Simulador do 2º turno | `runoff.js` (`roSimulate`, `rate22`, `roReal`); dados em `base-2022.json` → `t2` |
| Intervalo de atualização | `REFRESH`, `MAP_REFRESH` (`app.js`); `PT_REFRESH` (`parties.js`) |
| Cache/proxy do TSE | `netlify/functions/tse.mjs` (`ALLOWED`, `TTL_DATA`, `TTL_PHOTO`) |
| Frequência da coleta | `config.schedule` em `netlify/functions/snapshot.mjs`; `runT1` (1º turno a cada 30 min) |
| Mapa dos estados | `br-map.js` (malha IBGE pré-projetada; não editar à mão) e `CALLOUT`/`LABEL_FIX` em `app.js` |
| Texto público de metodologia | `sobre.html` (espelhado em `docs/METODOLOGIA.md`) |
| Notícias do rodapé | `ticker.js` (`tickerItems`) |
| Contagem regressiva | `countdown.js` |

## Armadilhas conhecidas
- **Cache do navegador**: sem aumentar `?v=NN`, visitantes podem ver a versão antiga.
- **`@netlify/blobs` fixado em 11.1.3 falhou no build** da Netlify; manter `^11.0.0` em `package.json`.
- **403 do TSE** em `curl` sem `User-Agent` de navegador (visto em `comum/config/ele-c.json`).
- **Arquivo nacional `br` do TSE atrasa** em relação aos estados: o site soma 27 estados + `zz` (exterior) e avisa na tela. Com `tf === "s"` o `br` é o final e não se soma.
- **Finalistas do 1º turno** vêm com `e:"s"` e `st` "2º turno" no arquivo final — não são eleitos (tratado em `candidatos()`).
- **Senado não tem 2º turno**; Deputados/Senado e governadores fora dos 6 estados continuam com dados do 1º turno (`6259`).
- **`IntersectionObserver` em aba oculta** não dispara: seções lazy não carregam em teste automatizado com a aba em segundo plano.
- **`depResult` duplicada** (cliente em `deputies.js`, servidor em `netlify/lib/tse.mjs`): alterar uma exige alterar a outra.
- **Constantes duplicadas** entre cliente e servidor (`ELE_T`/`ELE`, `T2_GOV`, `UFS`).
- 2º turno antes das 17h: arquivos `6258`/`6260` podem dar 404 ou vir zerados (`s.st = 0`); o código trata como "aguardando" (`waiting`, `waitMsg`).
- O stash de otimização **não é confiável**.

## Pendências priorizadas
1. **Validar o 2º turno com dados reais** (checklist acima).
2. **Pausar/reduzir a coleta agendada** após a eleição; monitorar Netlify → Usage & billing.
3. **Decidir o stash** (descartar ou refazer do zero).
4. Dar `git push` da documentação.
5. Ideias não feitas: "Como votou a sua cidade" (dados por município); perfil dos eleitos (gênero, raça, idade, reeleitos — depende dos dados de candidatos 2026 do TSE); pesquisas × urna; notificações; otimização de carregamento (só se divulgar amplamente); conferência num iPhone antigo real; domínio próprio.

## Mapa da documentação
- `README.md` — visão geral.
- `docs/ARQUITETURA.md` — fluxo de dados, arquivos, estado global, chaves, ordem de scripts.
- `docs/DADOS-TSE.md` — códigos, URLs, campos, peculiaridades.
- `docs/METODOLOGIA.md` — regras de "Já ganhou", projeção, deputados, 2022, simulador.
- `docs/OPERACAO.md` — deploy, cache, funções agendadas, cota, troubleshooting.
