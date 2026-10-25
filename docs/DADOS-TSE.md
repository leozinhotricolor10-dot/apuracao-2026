# Dados do TSE

## Códigos de eleição (2026)
| Turno | Data | Código | Cargos |
|---|---|---|---|
| 1º turno | 04/10/2026 | `6257` | Eleição federal: Presidente |
| 1º turno | 04/10/2026 | `6259` | Eleições estaduais: Governador, Senador, Deputados Federal/Estadual/Distrital |
| 2º turno | 25/10/2026 | `6258` | Federal: Presidente |
| 2º turno | 25/10/2026 | `6260` | Estadual: Governador |

Mapeamento no código: `ELE_T` (`app.js`), `ELE`/`ELE2` (`netlify/lib/tse.mjs`). Deputados e partidos usam `6259` fixo (`depFile` em `deputies.js`, `loadParties` em `parties.js`).

Cargos (`cargo`): 1 Presidente, 3 Governador, 5 Senador, 6 Deputado Federal, 7 Deputado Estadual, 8 Deputado Distrital.

2º turno de Governador: AC, AM, DF, ES, RN, TO (`T2_GOV`). Finalistas a Presidente: Flávio Bolsonaro (PL) × Lula (PT). Senado e Câmara/Assembleias não têm 2º turno.

## Padrões de URL
Base: `https://resultados.tse.jus.br/oficial/ele2026`
- Resultados: `{base}/{codigo}/dados/{uf}/{uf}-c{cargo 4 dígitos}-e{codigo 6 dígitos}-u.json`
  - Ex.: `.../6257/dados/br/br-c0001-e006257-u.json`
  - `{uf}` = sigla minúscula, `br` (nacional) ou `zz` (exterior).
- Fotos: `{base}/{codigo}/fotos/{uf|br}/{sqcand}.jpeg` — Presidente usa `br`; os demais cargos usam a UF. O site sempre usa o código do **1º turno** (`ELE_T[1]`) para fotos.
- Configuração da eleição: `{base}/{codigo}/config/...json` (via proxy permitido em `ALLOWED`).
- Lista de eleições: `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json`.

Com proxy (site publicado): `/api/tse/oficial/ele2026/...` (mesmo caminho).

O TSE responde CORS para qualquer origem. **`curl` sem `User-Agent` de navegador recebe 403** (visto no `ele-c.json`); as funções enviam `Mozilla/5.0 (compatible; CentralEleicoes/1.0)`.

## Campos usados
Raiz: `ele` (código), `t` (turno, string `"1"`/`"2"`), `cdabr` (abrangência), `tf` (`"s"` = totalização final), `md`, `hg` (hora, `HH:MM:SS`), `dg` (data, `DD/MM/AAAA`).
- `s` — seções: `pst` (% texto), `pstn` (% numérico), `st` (apuradas), `ts` (total).
- `e` — eleitorado: `te`, `est` (eleitores nas seções apuradas), `esnt` (eleitores das seções não apuradas), `c` (comparecimento), `a` (abstenção), `pcn`, `pan` (percentuais).
- `v` — votos: `vv` (válidos), `vb` (brancos), `tv`/`tvn` (totais), `pvvcn` (% de válidos sobre comparecimento).
- `carg[0]` — cargo: `nv` (vagas), `qe` (quociente eleitoral, deputados), `agr[]` (agrupamentos: coligação/federação/partido) com `tp` (`c` coligação, `f` federação, `i` isolado), `nm`, `com`, `n`, `vag` (vagas atuais da lista) e `par[]`.
- `par[]` — `sg` (sigla), `tvan` (votos do partido), `cand[]`.
- `cand[]` — `sqcand` (id sequencial), `nmu` (nome de urna), `nm`, `n` (número), `vap` (votos apurados), `pvap`/`pvapn` (percentual texto/numérico), `e` (`"s"` = eleito), `st` (situação), `dvt` (detalhe da situação; "Válido…"), `vs[]` (vice/suplentes; `tp === "v"` = vice).

## Peculiaridades
- Em 2026 os arquivos são `-u.json` em `/dados/` (não mais `dados-simplificados/-r.json`).
- **Finalistas do 1º turno** vêm no arquivo final com `e:"s"` e `st` "2º turno": não são eleitos (`candidatos()` em `app.js` converte para `e:"n"`).
- **Arquivo nacional `br` atrasa** em relação aos estados: o site soma os 27 estados + `zz` quando o arquivo não é final (`tf !== "s"`), comparando o carimbo `dg hg` (`stamp`). A soma bate com o total de seções/eleitores do TSE. Implementação: `nationalFromStates`/`aggregateDs` (front) e `nationalPoint` (servidor).
- **2º turno antes da apuração**: arquivo inexistente (404) ou publicado com `s.st = 0` (tratado como `waiting`).
- O campo `t` do arquivo indica o turno (`isT2d`).
- O TSE atualiza cada estado em intervalos próprios (em geral 10–20 min).
- Deputados: `carg[0].agr[].vag` traz as vagas atuais por lista; `e:"s"` só aparece quando o TSE oficializa.

## Como descobrir códigos de uma nova eleição
1. Abrir `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json` (enviar `User-Agent` de navegador). Ele lista as eleições com ano, turno, abrangência e código.
2. Identificar os códigos federal (Presidente) e estadual (demais cargos) de cada turno e preencher `ELE_T`/`ELE` e `ELE`/`ELE2` (`netlify/lib/tse.mjs`), além das referências fixas a `6259`.
3. Conferir uma URL de exemplo (`br-c0001-e00XXXX-u.json`) e a lista de estados do 2º turno (`T2_GOV`).
4. Atualizar o ano em `ORIGIN`/`BASE` (`ele2026`) e a expressão `ALLOWED` do proxy (`netlify/functions/tse.mjs`).

(O procedimento acima é derivado da estrutura do código; a forma exata do `ele-c.json` deve ser conferida na hora — a confirmar.)

## Dados de 2022 (base de comparação)
Gerados a partir do Portal de Dados Abertos do TSE (`votacao_partido_munzona`, `detalhe_votacao_munzona`, `consulta_cand`, e o 2º turno presidencial de 2022). Resultado em `base-2022.json` e `partidos-2022.json`. O script de geração não está no repositório (a confirmar onde ficou).
