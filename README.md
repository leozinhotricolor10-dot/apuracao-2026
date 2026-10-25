# Central das Eleições 2026

Site público de apuração das Eleições 2026 em tempo real, com dados oficiais do TSE. Independente (sem vínculo com o TSE, partidos ou campanhas).

- Site: https://apuracao2026br1.netlify.app
- Repositório: https://github.com/leozinhotricolor10-dot/apuracao-2026 (branch `main`)
- Para retomar o trabalho: leia [`HANDOFF.md`](HANDOFF.md).

## O que o site faz
- **Resultados** de Presidente, Governador e Senador, por Brasil, região ou estado, com KPIs, percentual apurado, gráfico de evolução e donut.
- **Dois turnos**: seletor 1º/2º turno (2º turno em 25/10/2026: Presidente e Governador em AC, AM, DF, ES, RN e TO).
- **Mapa** dos estados (malha IBGE), modos "Agora" e "Projeção", zoom, filtro "Já ganhou" e tabela de estados.
- **Projeção** Monte Carlo e selo **"Já ganhou"** (garantia matemática ou situação oficial do TSE).
- **Feed** de atualizações gerado dos dados e histórico (local + coleta no servidor).
- **Meu analista**: comentários gerados por regras, com comparações com 2022 e com o 1º turno.
- **Simulador do 2º turno** (migração de votos) e comparação com o resultado real.
- **Regiões**, **Partidos** (bancada da Câmara em hemiciclo, governos, Senado) e **Deputados** (federal, estadual, distrital).
- **Perfil do candidato** (por estado, comparação com o partido em 2022).
- Banner de **resumo** do 1º/2º turno, **contagem regressiva** até as 17h do 2º turno, **faixa de notícias** no rodapé, tema claro/escuro, página de metodologia (`sobre.html`) e `manifest.webmanifest`.

## Stack
- Front: HTML + CSS + JavaScript puro, sem framework e sem build.
- Servidor: Netlify Functions (Node 22, ESM `.mjs`) + Netlify Blobs (`@netlify/blobs`).
- Dados: TSE (Divulgação de Resultados 2026; Dados Abertos 2022) e IBGE (malha dos estados).

## Estrutura de pastas
```
apuracao-2026/
├── index.html            página única; scripts/CSS com ?v=NN
├── styles.css
├── app.js                núcleo (estado, turno, mapa, KPIs, resultados, feed, histórico)
├── projection.js         projeção Monte Carlo, "Já ganhou"
├── parties.js            partidos e hemiciclo
├── candidate.js          perfil do candidato
├── region.js             visão por região
├── analyst.js            "Meu analista"
├── deputies.js           aba Deputados
├── runoff.js             simulador do 2º turno
├── summary.js            banner de resumo
├── countdown.js          contagem até as 17h do 2º turno
├── ticker.js             faixa de notícias
├── br-map.js             malha IBGE em SVG (gerado)
├── sobre.html            metodologia pública
├── base-2022.json, partidos-2022.json   base de 2022 (TSE Dados Abertos)
├── manifest.webmanifest, og.png, favicon.png, icon-*.png, apple-touch-icon.png
├── netlify.toml, package.json
├── netlify/
│   ├── functions/        tse.mjs (proxy), snapshot.mjs (coleta agendada), dados.mjs (/api/hist, /api/resumo)
│   └── lib/tse.mjs       lógica compartilhada
├── docs/                 documentação técnica
└── HANDOFF.md
```

## Como rodar
A partir da pasta pai (`Comfyui curso`):
```
python -m http.server 8765 --directory apuracao-2026
```
Abrir http://localhost:8765. Localmente os dados vêm direto do TSE (sem proxy).

## Como publicar
Commit + `git push` na `main` (a Netlify faz o deploy). Antes, aumentar o `?v=NN` no `index.html`. Detalhes em [`docs/OPERACAO.md`](docs/OPERACAO.md).

## Documentação
- [`HANDOFF.md`](HANDOFF.md) — estado atual, checklist e pendências
- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)
- [`docs/DADOS-TSE.md`](docs/DADOS-TSE.md)
- [`docs/METODOLOGIA.md`](docs/METODOLOGIA.md)
- [`docs/OPERACAO.md`](docs/OPERACAO.md)

O resultado oficial é sempre o do TSE; este site pode ter atrasos ou erros.
