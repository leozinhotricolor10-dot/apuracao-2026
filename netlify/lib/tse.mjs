// Lógica compartilhada pelas funções do servidor (coleta, histórico e resumo).
export const ORIGIN = "https://resultados.tse.jus.br/oficial/ele2026";
export const UFS = ["ac","al","ap","am","ba","ce","df","es","go","ma","mt","ms","mg","pa","pb","pr","pe","pi","rj","rn","rs","ro","rr","sc","sp","se","to"];
export const ELE = { 1: "6257", 3: "6259", 5: "6259", 6: "6259" };
const UA = { "User-Agent": "Mozilla/5.0 (compatible; CentralEleicoes/1.0)" };

export const fileUrl = (cargo, uf) => `${ORIGIN}/${ELE[cargo]}/dados/${uf}/${uf}-c${String(cargo).padStart(4, "0")}-e${ELE[cargo].padStart(6, "0")}-u.json`;
export async function getJSON(url) {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
export const num = s => parseFloat(String(s).replace(",", "."));
export const mins = hg => { const [h, m] = String(hg).split(":").map(Number); return h * 60 + m; };
export const stamp = d => d ? `${String(d.dg).split("/").reverse().join("")} ${d.hg}` : "";

export function candidatos(d) {
  const out = [];
  for (const a of d.carg[0].agr || []) for (const p of a.par || []) for (const x of p.cand || [])
    out.push({ ...x, partido: p.sg });
  return out.sort((a, b) => b.vap - a.vap);
}

/* ponto de histórico no mesmo formato usado pelo navegador */
export function point(hg, pst, shares) {
  return { hg, m: mins(hg), pst: +pst.toFixed(4), c: shares };
}
export function pointFromFile(d) {
  const list = candidatos(d).slice(0, 12);
  return point(d.hg, num(d.s.pstn), Object.fromEntries(list.map(c => [c.sqcand, +num(c.pvapn).toFixed(4)])));
}
/* Brasil somando estados + exterior (quando o arquivo nacional atrasa) */
export function nationalPoint(states, zz) {
  const ds = [...states, zz].filter(Boolean);
  let ts = 0, st = 0, vv = 0; const votes = {}; let hg = "", dg = "";
  for (const d of ds) {
    ts += +d.s.ts; st += +d.s.st; vv += +d.v.vv;
    if (stamp(d) > `${dg} ${hg}`) { hg = d.hg; dg = String(d.dg).split("/").reverse().join(""); }
    for (const c of candidatos(d)) votes[c.sqcand] = (votes[c.sqcand] || 0) + +c.vap;
  }
  const top = Object.entries(votes).sort((a, b) => b[1] - a[1]).slice(0, 12);
  return { stamp: `${dg} ${hg}`, p: point(hg, ts ? st / ts * 100 : 0, Object.fromEntries(top.map(([sq, v]) => [sq, +(vv ? v / vv * 100 : 0).toFixed(4)]))) };
}

/* deputados: mesma regra do site (vagas do TSE; dentro da lista, os mais votados com >= 10% do QE) */
export function depResult(d, uf) {
  const c = d.carg[0], qe = +c.qe || 0, vv = +d.v.vv || 1;
  const all = [];
  for (const a of c.agr || []) for (const p of a.par || []) for (const x of p.cand || [])
    all.push({ sqcand: x.sqcand, nmu: x.nmu, nm: x.nm, n: x.n, e: x.e, st: x.st, dvt: x.dvt, partido: p.sg, lista: a.com || p.sg, fed: a.tp === "f", vag: +a.vag || 0, agrId: a.n, uf, vapN: +x.vap });
  const official = all.some(x => x.e === "s");
  const byAgr = {};
  all.forEach(x => (byAgr[x.agrId] = byAgr[x.agrId] || []).push(x));
  for (const list of Object.values(byAgr)) {
    list.sort((p, q) => q.vapN - p.vapN);
    list.forEach((x, i) => x.posLista = i + 1);
    const valid = list.filter(x => !x.dvt || x.dvt.startsWith("Válido"));
    const inn = new Set(valid.filter(x => x.vapN >= 0.1 * qe).slice(0, list[0].vag).map(x => x.sqcand));
    for (const x of list) x.inside = official ? x.e === "s" : inn.has(x.sqcand);
  }
  all.forEach(x => x.pct = +(x.vapN / vv * 100).toFixed(4));
  return all;
}
