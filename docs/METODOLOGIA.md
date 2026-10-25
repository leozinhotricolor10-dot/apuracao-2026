# Metodologia

Versão técnica da página pública `sobre.html`. O que está aqui vale também para o texto público; se mudar uma regra, atualize os dois.

## Princípios
- **Fonte oficial**: arquivos públicos de Divulgação de Resultados do TSE; comparações com 2022 vêm de Dados Abertos do TSE; mapa da malha territorial do IBGE.
- **Independência e neutralidade**: o site não tem vínculo com TSE, partidos ou campanhas. Comentários do analista são gerados por regras sobre os números; nada é escrito à mão sobre candidatos.
- Cada partido tem **cor fixa** em todo o site (`PARTY_COLORS`, `app.js`); no hemiciclo os partidos são ordenados pelo **tamanho da bancada**, não por posição política.
- Projeções são **estimativas**, sempre rotuladas; o resultado oficial é o do TSE.
- A projeção só usa a apuração oficial (depois do fechamento das urnas); não usa pesquisas.

## "Já ganhou" (garantia matemática)
Aparece quando (a) o TSE oficializa o eleito (`e === "s"`) ou (b) o resultado é garantido no pior caso. Implementação: objeto `g` em `runProjection` (`projection.js`), com `M` = eleitores das seções ainda não apuradas (`esnt`).
- **Presidente/Governador, 1º turno** (`majority`): ganha se `votos do líder > (válidos + M) / 2`. 2º turno garantido se `líder + M <= (válidos + M)/2`.
- **2º turno** (dois candidatos): vence quem tiver mais da metade dos votos válidos; garantido quando o líder tem mais votos do que o adversário somado a `M` (mesmo que todos os eleitores das seções não apuradas votassem no adversário).
- **Senado/vagas múltiplas**: candidato "safe" se menos de `vagas` concorrentes conseguem alcançá-lo somando `M`; fora ("out") se `vagas` ou mais já estão acima dele mesmo recebendo `M`.
- No mapa, o filtro "Já ganhou" (`decidedInfo`) mostra estados com eleito oficial ou garantia.

## Projeção (Monte Carlo)
`runProjection` em `projection.js`.
- Por estado (estrato), os votos restantes `R = esnt × comparecimento × válidos/comparecimento` seguem os percentuais já apurados no estado, com ruído lognormal.
- Incerteza do estado: `PJ_SIG_STATE (0,22) × √(1 − pst)` (encolhe com a apuração); estado sem dados: `PJ_SIG_EMPTY (0,40)`.
- Desvio nacional comum a todos os estados: `PJ_SIG_NAT (0,10) × √(1 − apurado)`.
- Ruído de comparecimento: `PJ_SIG_TURNOUT (0,04)`.
- Simulações: `PJ_N_NAT = 2000` (Brasil/regiões) e `PJ_N_UF = 600` (por estado); semente fixa (7). Mínimo de `PJ_MIN_PST = 1%` apurado para projetar.
- A chance é a fração dos cenários; a faixa mostrada cobre 90% (percentis 5 e 95).
- Rótulos (`TIERS`): **Praticamente certo** ≥ 99%; **Muito provável** ≥ 90%; **Provável** ≥ 70%; **Indefinido** abaixo disso.
- Para o Brasil, usa os 27 estados (e `zz`) como estratos quando todos estão carregados.
- Limitação conhecida: dentro de um estado, se uma região (ex.: capital) for apurada antes, a estimativa pode pender para um lado no começo da noite.

## Total do Brasil
Se o arquivo nacional do TSE está parado em relação aos estados, o site soma os 27 estados + exterior e avisa na tela (`nationalFromStates`). A soma é conferida com o total de seções/eleitores do TSE. Não se soma quando o arquivo é final (`tf === "s"`).

## Deputados
(`depResult` em `deputies.js`; cópia no servidor em `netlify/lib/tse.mjs`.)
- Vagas de cada partido/federação: distribuição oficial do TSE (`agr[].vag`), calculada com quociente eleitoral e sobras na apuração do momento.
- Dentro de cada lista, entram os **mais votados com pelo menos 10% do quociente eleitoral** (`qe`), até o limite de vagas, considerando só candidaturas válidas (`dvt` começando com "Válido").
- Quando o TSE oficializa, o site usa a situação oficial (`e === "s"`: "Eleito por QP/média").
- Validação (sessão anterior): **100% contra o resultado oficial do DF** (24/24 distritais e 8/8 federais).
- Bancadas (Câmara, 513 cadeiras) comparadas com os **eleitos em 2022** (PL 98, PT 69, União 57…, em `base-2022.json` → `camara`), não com o tamanho atual dos partidos.

## Comparações com 2022
- Por **partido**: o candidato de 2026 é comparado ao desempenho do seu partido no 1º turno de 2022, no mesmo cargo e lugar (`share2022`, `partidos-2022.json`).
- Fusões e sucessões (`SUCC` em `candidate.js`): PRD = PTB + Patriota; Solidariedade inclui PROS; Podemos (PODE) inclui PSC; PMN → Mobiliza; "PC do B" → PCDOB.
- Por região: só estados com mais de 10% das urnas apuradas, ponderados pelo eleitorado (`regionEst` em `analyst.js`).
- Em 2022 o Senado tinha 1 vaga por estado; em 2026 são 2.

## 2º turno
- Fontes: eleições `6258` (Presidente) e `6260` (Governador); 6 estados com 2º turno de Governador. Nos demais, o site mostra o resultado do 1º turno com aviso. Senado, Câmara e Assembleias já foram definidos no 1º turno.
- O analista compara, estado por estado, o % de cada finalista com o 1º turno (resultado final), estados que mudaram de lado, comparecimento, e com o 2º turno de 2022 por partido (PT e PL). Votos absolutos só são comparáveis no fim.

## Simulador do 2º turno (`runoff.js`)
- Aritmética a partir do 1º turno, estado por estado (incluindo exterior): cada finalista mantém seus votos e recebe uma fração dos votos dos demais candidatos. **Não é pesquisa nem previsão.**
- Cenários: "Como em 2022" (`rate22`: fração do saldo dos demais que foi ao PT em 2022, por estado, de `base-2022.json` → `t2`; nacional: 29,5% foi ao PT), "Meio a meio" (50%) e "Meu cenário" (controles do usuário, por candidato).
- **Ponto de virada** aritmético: `beB = (50 − B1)/O` — fração dos votos dos demais de que o segundo precisa para chegar a 50% (`beA` para o primeiro).
- Ponderação nacional pelos votos válidos estimados no fim da apuração (`vv / pst`).
- Quando o 2º turno é apurado, `roReal` compara o resultado real com os cenários, usando só os estados já apurados e o peso dos votos já contados.

## Linguagem
Sempre neutra; sem adjetivos sobre candidatos; projeção ≠ resultado oficial.
