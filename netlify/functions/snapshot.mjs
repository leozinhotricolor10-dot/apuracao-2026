// Coleta automática a cada 2 minutos: guarda o histórico da apuração e um resumo leve
// (bancadas e ranking de deputados) para o site não precisar baixar os arquivos pesados.
// 2º turno (25/10): Presidente (Brasil, estados e exterior) e Governador nos estados com 2º turno,
// com chaves próprias (hist/t2-1-br, hist/t2-3-df…). O 1º turno, já encerrado, é coletado a cada 30 min.
import { getStore } from "@netlify/blobs";
import { UFS, T2_GOV, fileUrl, getJSON, num, stamp, pointFromFile, nationalPoint, depResult } from "../lib/tse.mjs";

const MAX_POINTS = 600;
const counted = d => !!d && +d.s.st > 0;   // arquivo "zerado" (antes da apuração) não vira ponto do histórico

async function appendHist(store, key, p) {
  if (!p || !p.hg) return;
  const h = (await store.get(`hist/${key}`, { type: "json" })) || [];
  if (h.length && h[h.length - 1].hg === p.hg) return;
  h.push(p);
  while (h.length > MAX_POINTS) h.shift();
  await store.setJSON(`hist/${key}`, h);
}

/* ---------- 2º turno ---------- */
async function collectT2(store) {
  const [br, zz, pres, gov] = await Promise.all([
    getJSON(fileUrl(1, "br", 2)), getJSON(fileUrl(1, "zz", 2)),
    Promise.all(UFS.map(uf => getJSON(fileUrl(1, uf, 2)).then(d => [uf, d]))),
    Promise.all(T2_GOV.map(uf => getJSON(fileUrl(3, uf, 2)).then(d => [uf, d]))),
  ]);
  const jobs = [];
  // Brasil: arquivo nacional ou, se ele atrasar, a soma dos 27 estados + exterior
  const states = pres.map(([, d]) => d).filter(Boolean);
  let natP = null;
  if (states.length === 27 && states.some(counted)) {
    const nat = nationalPoint(states, zz);
    if (!counted(br) || nat.stamp > stamp(br)) natP = nat.p;
  }
  if (natP && natP.pst > 0) jobs.push(appendHist(store, "t2-1-br", natP));
  else if (counted(br)) jobs.push(appendHist(store, "t2-1-br", pointFromFile(br)));
  for (const [uf, d] of pres) if (counted(d)) jobs.push(appendHist(store, `t2-1-${uf}`, pointFromFile(d)));
  for (const [uf, d] of gov) if (counted(d)) jobs.push(appendHist(store, `t2-3-${uf}`, pointFromFile(d)));
  await Promise.all(jobs);
  return `2º turno: ${states.length + gov.filter(([, d]) => d).length + (br ? 1 : 0)} arquivos, ${jobs.length} com votos`;
}

/* ---------- 1º turno (encerrado) ---------- */
async function collectT1(store) {
  const fetchAll = cargo => Promise.all(UFS.map(uf => getJSON(fileUrl(cargo, uf)).then(d => [uf, d])));
  const [br, zz, pres, gov, sen, dep] = await Promise.all([
    getJSON(fileUrl(1, "br")), getJSON(fileUrl(1, "zz")),
    fetchAll(1), fetchAll(3), fetchAll(5), fetchAll(6),
  ]);

  // histórico
  const jobs = [];
  const presStates = pres.map(([, d]) => d).filter(Boolean);
  if (presStates.length === 27) {
    const nat = nationalPoint(presStates, zz);
    const useNat = !br || nat.stamp > stamp(br);
    jobs.push(appendHist(store, "1-br", useNat ? nat.p : pointFromFile(br)));
  } else if (br) jobs.push(appendHist(store, "1-br", pointFromFile(br)));
  for (const [cargo, rows] of [[1, pres], [3, gov], [5, sen]])
    for (const [uf, d] of rows) if (d) jobs.push(appendHist(store, `${cargo}-${uf}`, pointFromFile(d)));

  // resumo dos deputados federais
  const depOk = dep.filter(([, d]) => d);
  if (depOk.length === 27) {
    const parties = {}; let vv = 0, pstSum = 0, seats = 0;
    const everyone = [];
    for (const [uf, d] of depOk) {
      vv += +d.v.vv || 0; pstSum += num(d.s.pstn);
      for (const a of d.carg[0].agr || []) for (const p of a.par || []) {
        parties[p.sg] = parties[p.sg] || { cam: 0, votos: 0 };
        parties[p.sg].votos += +p.tvan || 0;
      }
      for (const x of depResult(d, uf)) {
        if (x.inside) { parties[x.partido].cam++; seats++; }
        everyone.push(x);
      }
    }
    everyone.sort((a, b) => b.vapN - a.vapN);
    everyone.forEach((x, i) => x.rankBr = i + 1);
    const keep = everyone.filter((x, i) => i < 600 || x.inside)
      .map(({ sqcand, nmu, nm, n, e, st, dvt, partido, lista, fed, vag, uf, vapN, posLista, inside, pct, rankBr }) =>
        ({ sqcand, nmu, nm, n, e, st, dvt, partido, lista, fed, vag, uf, vapN, posLista, inside, pct, rankBr }));
    jobs.push(store.setJSON("resumo/dep6", {
      at: new Date().toISOString(),
      hg: depOk.map(([, d]) => `${String(d.dg).split("/").reverse().join("")} ${d.hg}`).sort().pop(),
      pst: pstSum / 27, seatsKnown: seats, vvCam: vv, total: everyone.length, parties, top: keep,
    }));
  }
  await Promise.all(jobs);
  return "1º turno atualizado";
}

export default async () => {
  const store = getStore("apuracao");
  const t0 = Date.now();
  const runT1 = new Date().getUTCMinutes() % 30 < 2;   // 1º turno encerrado: basta de meia em meia hora
  // cada turno é independente: uma falha (ou 404 antes das 17h) não impede o outro
  const res = await Promise.allSettled([collectT2(store), runT1 ? collectT1(store) : Promise.resolve("1º turno: pulado")]);
  console.log(`snapshot em ${Date.now() - t0} ms · ${res.map(r => r.status === "fulfilled" ? r.value : `erro: ${r.reason}`).join(" · ")}`);
};

export const config = { schedule: "*/2 * * * *" };
