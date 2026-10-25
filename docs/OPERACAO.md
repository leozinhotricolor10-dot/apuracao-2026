# Operação

## Contas e acesso
- GitHub: conta `leozinhotricolor10-dot`; `gh` logado no PC. Repositório público `leozinhotricolor10-dot/apuracao-2026`.
- Netlify: logada no **navegador do usuário**. O CLI da Netlify/Vercel **não** está logado.
- Nunca guardar tokens/senhas no repositório.

## Deploy
1. Editar arquivos.
2. **Aumentar o `?v=NN`** nas referências locais de `index.html` (`styles.css`, `br-map.js`, `projection.js`, `app.js`, `parties.js`, `candidate.js`, `region.js`, `analyst.js`, `deputies.js`, `runoff.js`, `summary.js`, `ticker.js`, `countdown.js`). Hoje: `30`.
3. Commit e push:
   ```
   git add -A && git -c user.name="leozinhotricolor10-dot" -c user.email="leozinho.tricolor10@gmail.com" commit -m "..." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push
   ```
4. A Netlify faz o build (sem build de front; só empacota as funções com esbuild, Node 22) e publica. Conferir o `index.html` publicado com o novo `?v=`. Se não aparecer em ~3 min, o build falhou: Netlify → Deploys → log.
5. O GitHub Pages foi desligado (o repositório continua público, mas o site só existe na Netlify).

## Cache e versões
- **HTML**: `Cache-Control: public, max-age=0, must-revalidate` (`netlify.toml`).
- **JS/CSS**: quebra de cache por `?v=NN`. Esquecer de aumentar faz visitantes verem a versão antiga.
- **Dados do TSE** (`/api/tse/*`): CDN durable da Netlify, 30 s (`TTL_DATA`), com `stale-while-revalidate` (4× o TTL) e `stale-if-error=600`; navegador revalida (`max-age=0`) e recebe 304 por ETag. Fotos: 1 dia (`TTL_PHOTO`).
- **`/api/hist` e `/api/resumo`**: CDN 60 s (`stale-while-revalidate=120`); resposta vazia 20 s.
- O front atualiza a cada `REFRESH = 30` s (mapa/estados a cada `MAP_REFRESH = 60` s; partidos a cada 120 s).

## Funções agendadas
- `snapshot.mjs`: `schedule: "*/2 * * * *"`.
  - 2º turno (`collectT2`): a cada execução. Brasil (arquivo nacional, ou soma dos 27 estados + `zz` se o nacional atrasar), Presidente por UF e Governador nos 6 estados. Só grava arquivos com `s.st > 0`; evita duplicar pelo `hg`; limite de 600 pontos.
  - 1º turno (`collectT1`): só quando `minuto UTC % 30 < 2` (i.e. em torno de :00 e :30); histórico de Presidente/Governador/Senador e resumo `resumo/dep6`.
- Cada turno roda em `Promise.allSettled`; falha ou 404 antes das 17h não impede o outro. O log da execução imprime duração e resumo.

### Pausar ou reduzir a coleta depois da eleição
Cada execução consome cota (execuções de função e leituras/escritas de Blobs). Hoje roda a cada 2 min, o dia todo.
- Reduzir: trocar `config.schedule` em `netlify/functions/snapshot.mjs` (ex.: `"0 * * * *"`) e publicar.
- Parar: remover o `schedule` (ou a função) e publicar. O histórico já gravado continua servido por `/api/hist`.
- Pelo painel da Netlify também é possível desativar funções agendadas (caminho exato no painel: a confirmar).
- Se a coleta for reduzida para `*/30`, `runT1` (minuto % 30 < 2) continua funcionando.
- Monitorar **Netlify → Usage & billing**.

## Teste local
```
python -m http.server 8765 --directory apuracao-2026
```
(a partir de `C:\Users\leona\OneDrive\Documents\Comfyui curso`; config `"apuracao"` em `.claude/launch.json`). Localmente `USE_PROXY` é falso: dados direto do TSE; `/api/*` não existe; histórico só no `localStorage`. Contagem de teste: `?countdownTest=10`. Para testar as funções localmente seria preciso o Netlify CLI (não está logado/configurado — a confirmar).

## Troubleshooting
| Sintoma | Causa provável / ação |
|---|---|
| Build da Netlify falhou | Ver Deploys → log. Caso conhecido: versão fixa `@netlify/blobs` 11.1.3 falhou; usar `^11.0.0` |
| Visitante vê versão antiga | Faltou aumentar o `?v=NN` no `index.html`; peça recarregar forte |
| Total do Brasil parado / aviso "arquivo nacional parado" | O arquivo `br` do TSE atrasa; o site soma 27 estados + `zz` automaticamente. Se os estados também pararam, é o TSE |
| `403` do TSE ao testar com `curl` | Enviar `User-Agent` de navegador (ex.: `Mozilla/5.0 ...`) |
| `404` nos arquivos `6258`/`6260` | Antes das 17h de 25/10, normal; o site mostra "Aguardando…" |
| `/api/hist/...` devolve `[]` | Chave válida sem dados (ainda sem coleta ou 2º turno não começou) |
| `/api/resumo/dep6` 404 | Resumo ainda não gerado (precisa dos 27 estados no 1º turno) |
| `502` em `/api/tse/*` | TSE fora do ar ou lento (timeout 8 s); o CDN serve a última cópia boa por até 600 s |
| Seções Analista/Partidos/Deputados vazias em teste automatizado | `IntersectionObserver` não dispara em aba em segundo plano; deixar a aba visível/rolar até a seção |
| Mapa/cores quebrados em iPhone antigo | Fallback de `color-mix` (`CM`, `mix`, `setFill`); conferir em aparelho real (pendente) |
| Histórico duplicado/estranho | Ver chaves `h26-*` no `localStorage`; o servidor mescla por `hg` |

## Pendente de decisão
Stash `"otimizacao de carregamento interrompida (nao testada) - 25/10"`: não aplicar às cegas; descartar ou refazer do zero. Veja `HANDOFF.md`.
