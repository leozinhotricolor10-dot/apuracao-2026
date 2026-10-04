/* Meu analista: comentários gerados por regras a partir dos números do TSE.
   Cada frase vem de uma conta sobre os dados; nada é inventado.
   Base de comparação: base-2022.json e partidos-2022.json (TSE Dados Abertos, 1º turno de 2022). */
let B22 = null;
const an = { br: null, ufs: {}, stamp: 0, loading: false, filter: "all", visible: false };
fetch("base-2022.json").then(r => r.json()).then(d => { B22 = d; renderAnalyst(); }).catch(() => {});

const REV22 = {};   // sigla de 2022 -> sigla atual (fusões)
for (const [now, olds] of Object.entries(SUCC)) for (const o of olds) if (o !== now) REV22[o] = now;
REV22["PC do B"] = "PCDOB";
const now22 = sg => REV22[sg] || sg;
const pp = d => `${d > 0 ? "+" : ""}${d.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;
const p1 = x => pct(x, 1);
const shortName = c => title(c.nmu);
const seats22 = sg => (SUCC[sg] || [sg]).reduce((s, k) => s + (B22.camara[k] || 0), 0);

async function loadAnalyst(force) {
  if (an.loading || (!force && Date.now() - an.stamp < 60000)) return renderAnalyst();
  an.loading = true; an.stamp = Date.now();
  try {
    const jobs = [getJSON(fileFor(1, "br")).then(d => an.br = d)];
    for (const [uf] of UFS) {
      if (mapCargo === 1 && mapData[uf]) an.ufs[uf] = mapData[uf];
      else jobs.push(getJSON(fileFor(1, uf)).then(d => an.ufs[uf] = d).catch(() => {}));
    }
    jobs.push(getJSON(fileFor(1, "zz")).then(d => an.zz = d).catch(() => {}));
    await Promise.all(jobs);
    const agg = nationalFromStates(an.ufs, an.zz);
    if (agg && stamp(agg) > stamp(an.br)) an.br = agg;
  } catch {}
  an.loading = false;
  if (typeof loadParties === "function") loadParties().catch?.(() => {});
  renderAnalyst();
}

/* ---------- presidente ---------- */
function regionEst(sq, sg, name) {
  let w = 0, wn = 0, s22 = 0, used = 0;
  for (const uf of REGIOES[name]) {
    const d = an.ufs[uf], vv22 = B22.vv["1"][uf];
    if (!d || !vv22 || num(d.s.pstn) < 10) continue;
    const sh = share2022(1, uf, sg); if (sh == null) continue;
    const c = candidatos(d).find(x => x.sqcand === sq);
    wn += (c ? num(c.pvapn) : 0) * vv22; s22 += sh * vv22; w += vv22; used++;
  }
  return used >= Math.ceil(REGIOES[name].length / 2) ? { now: wn / w, then: s22 / w, used, total: REGIOES[name].length } : null;
}

function presInsights(out) {
  const d = an.br; if (!d) return;
  const list = candidatos(d), [a, b] = list, pst = num(d.s.pstn);
  if (!a || +a.vap === 0) return;
  const base = `com ${p1(pst)} das urnas apuradas`;

  // 1. placar + projeção
  let r = pj.res && state.cargo === 1 && state.uf === "br" ? pj.res : null;
  if (!r && Object.keys(an.ufs).length === 27) r = runProjection(Object.values(an.ufs).map(x => stratum(x)), list.slice(0, 10), { majority: true, vagas: 1, N: 1200 });
  const v = r ? verdict(r, list, "") : null;
  out.push({ cat: "pres", tag: "Presidente", score: 100, col: colorFor(a),
    title: v && v.lvl !== "wait" ? v.head : `${shortName(a)} lidera a corrida presidencial`,
    body: `${shortName(a)} tem ${p1(num(a.pvapn))} dos votos válidos, ${fmt(a.vap - b.vap)} votos à frente de ${shortName(b)} (${p1(num(b.pvapn))}), ${base}.` +
      (v && v.lvl !== "wait" ? ` A projeção do site estima ${shortName(a)} terminando em torno de ${r.out[0].c.sqcand === a.sqcand ? p1(r.out[0].mean) : p1((r.out.find(o => o.c.sqcand === a.sqcand) || {}).mean || 0)}.` : "") });

  if (!P22 || !B22) return;
  // 2. regiões x 2022, para os dois primeiros
  for (const c of [a, b]) {
    const rows = Object.keys(REGIOES).map(n => ({ n, e: regionEst(c.sqcand, c.partido, n) })).filter(x => x.e);
    if (!rows.length) continue;
    rows.forEach(x => x.dv = x.e.now - x.e.then);
    const worst = [...rows].sort((x, y) => x.dv - y.dv)[0], best = [...rows].sort((x, y) => y.dv - x.dv)[0];
    const nat22 = share2022(1, "br", c.partido);
    if (worst && worst.dv < -1) out.push({ cat: "pres", tag: "Comparação com 2022", score: 60 + Math.abs(worst.dv) * 2, col: colorFor(c),
      title: `${shortName(c)} perde força no ${worst.n} em relação ao ${c.partido} de 2022`,
      body: `No 1º turno de 2022, o ${c.partido} teve ${p1(worst.e.then)} dos válidos no ${worst.n}. Hoje ${shortName(c)} aparece com ${p1(worst.e.now)} na região (${pp(worst.dv)}), na estimativa com ${worst.e.used} de ${worst.e.total} estados com mais de 10% das urnas apuradas.` });
    if (best && best.dv > 1) out.push({ cat: "pres", tag: "Comparação com 2022", score: 58 + best.dv * 2, col: colorFor(c),
      title: `${shortName(c)} cresce no ${best.n} na comparação com 2022`,
      body: `O ${c.partido} fez ${p1(best.e.then)} no ${best.n} em 2022; agora ${shortName(c)} tem ${p1(best.e.now)} (${pp(best.dv)}).` });
    if (nat22 != null) {
      const dv = num(c.pvapn) - nat22;
      out.push({ cat: "pres", tag: "Comparação com 2022", score: 40 + Math.abs(dv), col: colorFor(c),
        title: `No Brasil, ${shortName(c)} está ${Math.abs(dv) < 0.5 ? "no mesmo patamar do" : dv > 0 ? "acima do" : "abaixo do"} ${c.partido} de 2022`,
        body: `O ${c.partido} teve ${p1(nat22)} dos válidos no 1º turno de 2022; ${shortName(c)} tem ${p1(num(c.pvapn))} agora (${pp(dv)}), ${base}. A comparação ainda muda: os estados não estão sendo apurados no mesmo ritmo.` });
    }
  }
  // 3. viradas de estado (partido vencedor em 2022 x líder agora)
  const flips = [];
  for (const [uf] of UFS) {
    const x = an.ufs[uf]; if (!x || num(x.s.pstn) < 20) continue;
    const t = P22["1"][uf]; if (!t) continue;
    const w22 = now22(Object.entries(t).sort((p, q) => q[1] - p[1])[0][0]);
    const lead = candidatos(x)[0]; if (!lead || +lead.vap === 0) continue;
    if (lead.partido !== w22) flips.push({ uf, w22, t22: t[Object.keys(t).find(k => now22(k) === w22)], lead, pst: num(x.s.pstn), ap: B22.turnout[uf] ? B22.turnout[uf].aptos : 0 });
  }
  if (flips.length) {
    flips.sort((p, q) => q.ap - p.ap);
    const f = flips[0];
    out.push({ cat: "pres", tag: "Virada", score: 80 + flips.length, col: colorFor(f.lead),
      title: flips.length === 1 ? `${UFNAME[f.uf]} muda de lado em relação a 2022` : `${flips.length} estados mudam de lado em relação a 2022`,
      body: flips.slice(0, 4).map(x => `${UFNAME[x.uf]}: o ${x.w22} venceu em 2022 (${p1(x.t22)}); agora ${shortName(x.lead)} (${x.lead.partido}) lidera com ${p1(num(x.lead.pvapn))}, com ${p1(x.pst)} apurado`).join(". ") + "." });
  }
  // 4. maior oscilação estadual
  const swings = [];
  for (const c of [a, b]) for (const [uf] of UFS) {
    const x = an.ufs[uf]; if (!x || num(x.s.pstn) < 30) continue;
    const sh = share2022(1, uf, c.partido); if (sh == null) continue;
    const cc = candidatos(x).find(y => y.sqcand === c.sqcand); if (!cc) continue;
    swings.push({ c, uf, dv: num(cc.pvapn) - sh, now: num(cc.pvapn), then: sh });
  }
  const sw = swings.sort((p, q) => Math.abs(q.dv) - Math.abs(p.dv))[0];
  if (sw && Math.abs(sw.dv) >= 3) out.push({ cat: "pres", tag: "Estado em destaque", score: 55 + Math.abs(sw.dv), col: colorFor(sw.c),
    title: `${UFNAME[sw.uf]} tem a maior oscilação: ${shortName(sw.c)} ${pp(sw.dv)} sobre o ${sw.c.partido} de 2022`,
    body: `${shortName(sw.c)} tem ${p1(sw.now)} em ${UFNAME[sw.uf]}, contra ${p1(sw.then)} do ${sw.c.partido} no 1º turno de 2022.` });
  // 5. fora da polarização
  const others = list.slice(2).reduce((s, c) => s + num(c.pvapn), 0);
  const t22 = P22["1"].br, top22 = Object.values(t22).sort((p, q) => q - p);
  const others22 = top22.slice(2).reduce((s, v) => s + v, 0);
  out.push({ cat: "pres", tag: "Polarização", score: 35 + Math.abs(others - others22), col: "var(--c10)",
    title: others > others22 + 0.5 ? "Candidatos fora da polarização ganham espaço" : others < others22 - 0.5 ? "Polarização se aprofunda" : "Polarização no mesmo nível de 2022",
    body: `Os candidatos fora dos dois primeiros somam ${p1(others)} dos válidos; em 2022 foram ${p1(others22)}. Entre eles, o mais votado é ${list[2] ? `${shortName(list[2])} (${list[2].partido}), com ${p1(num(list[2].pvapn))}` : "—"}.` });
}

/* ---------- comparecimento ---------- */
function turnoutInsights(out) {
  const d = an.br; if (!d || !B22) return;
  const pc = num(d.e.pcn), pc22 = B22.turnout.br.pc, dv = pc - pc22;
  const regs = Object.entries(REGIOES).map(([n, ufs]) => {
    let c = 0, est = 0, comp22 = 0, ap22 = 0;
    for (const uf of ufs) { const x = an.ufs[uf]; if (x) { c += +x.e.c; est += +x.e.est; } const t = B22.turnout[uf]; if (t) { comp22 += t.comp; ap22 += t.aptos; } }
    return { n, now: est ? c / est * 100 : null, then: ap22 ? comp22 / ap22 * 100 : null };
  }).filter(r => r.now != null);
  regs.forEach(r => r.dv = r.now - r.then);
  const hi = [...regs].sort((p, q) => q.now - p.now)[0], lo = [...regs].sort((p, q) => p.now - q.now)[0];
  const mv = [...regs].sort((p, q) => Math.abs(q.dv) - Math.abs(p.dv))[0];
  out.push({ cat: "comp", tag: "Comparecimento", score: 30 + Math.abs(dv) * 4, col: "var(--c3)",
    title: Math.abs(dv) < 0.5 ? `Comparecimento estável: ${p1(pc)}, perto dos ${p1(pc22)} de 2022` : `Comparecimento ${dv > 0 ? "sobe" : "cai"} para ${p1(pc)} (${pp(dv)} sobre 2022)`,
    body: `Nas seções já apuradas, ${p1(pc)} dos eleitores votaram (abstenção de ${p1(num(d.e.pan))}). ${hi ? `O ${hi.n} tem o maior comparecimento (${p1(hi.now)}) e o ${lo.n}, o menor (${p1(lo.now)}).` : ""}${mv && Math.abs(mv.dv) >= 1 ? ` A maior mudança em relação a 2022 é no ${mv.n}: ${pp(mv.dv)}` : ""}` });
}

/* ---------- Câmara ---------- */
function camaraInsights(out) {
  if (!B22 || typeof pt === "undefined" || !pt.agg || !pt.agg.seatsKnown) return;
  const rows = pt.agg.rows.map(x => ({ sg: x.sg, now: x.cam, then: seats22(x.sg) }));
  for (const sg of Object.keys(B22.camara)) { const k = now22(sg); if (!rows.find(r => r.sg === k)) rows.push({ sg: k, now: 0, then: seats22(k) }); }
  rows.forEach(r => r.dv = r.now - r.then);
  const top = [...rows].sort((p, q) => q.now - p.now)[0];
  const up = rows.filter(r => r.dv > 0).sort((p, q) => q.dv - p.dv), down = rows.filter(r => r.dv < 0).sort((p, q) => p.dv - q.dv);
  const pstC = pt.agg.pst;
  out.push({ cat: "camara", tag: "Câmara", score: 70, col: partyColor(top.sg),
    title: `${top.sg} ${top.then && top.now >= top.then ? "amplia" : "tem"} a maior bancada: ${top.now} cadeiras${top.then ? ` (${top.dv >= 0 ? "+" : ""}${top.dv} sobre 2022)` : ""}`,
    body: `Na distribuição atual calculada pelo TSE, com ${p1(pstC)} das urnas apuradas em média, o ${top.sg} fica com ${top.now} das 513 cadeiras; em 2022 elegeu ${top.then}.` });
  if (up.length || down.length) out.push({ cat: "camara", tag: "Câmara", score: 66 + (up[0] ? up[0].dv : 0) / 2, col: up[0] ? partyColor(up[0].sg) : "var(--c10)",
    title: down[0] && up[0] ? `${up[0].sg} é quem mais cresce na Câmara; ${down[0].sg}, quem mais encolhe` : up[0] ? `${up[0].sg} é quem mais cresce na Câmara` : `${down[0].sg} é quem mais encolhe na Câmara`,
    body: `${up.length ? `Crescem: ${up.slice(0, 4).map(r => `${r.sg} ${r.then}→${r.now} (+${r.dv})`).join(", ")}. ` : ""}${down.length ? `Encolhem: ${down.slice(0, 4).map(r => `${r.sg} ${r.then}→${r.now} (${r.dv})`).join(", ")}.` : ""} Comparação com os eleitos em 2022; partidos fundidos somam os antecessores.` });
}

/* ---------- governos e Senado ---------- */
function stateRaces(cargo) {
  const data = typeof pt !== "undefined" ? pt.data[cargo] : {};
  return Object.entries(data || {}).map(([uf, d]) => {
    const list = candidatos(d), nv = cargo === 5 ? +d.carg[0].nv || 1 : 1;
    if (!list[0] || +list[0].vap === 0) return null;
    const r = runProjection([stratum(d)], list.slice(0, 6), { vagas: nv, majority: cargo === 3, N: 150, seed: 3 });
    return { uf, d, list, nv, r, pst: num(d.s.pstn) };
  }).filter(Boolean);
}
function govInsights(out) {
  if (!B22) return;
  const races = stateRaces(3); if (races.length < 5) return;
  const cnt = {};
  races.forEach(x => { const sg = x.list[0].partido; cnt[sg] = (cnt[sg] || 0) + 1; });
  const won = races.filter(x => x.r.g.winner || x.list.some(c => c.e === "s"));
  const top = Object.entries(cnt).sort((p, q) => q[1] - p[1]);
  const gov22 = sg => Object.values(B22.gov).filter(s => now22(s) === sg).length;
  out.push({ cat: "gov", tag: "Governos", score: 62, col: partyColor(top[0][0]),
    title: `${top[0][0]} está à frente em ${top[0][1]} disputas por governo; em 2022 elegeu ${gov22(top[0][0])}`,
    body: `Partidos à frente agora: ${top.slice(0, 5).map(([sg, n]) => `${sg} ${n}`).join(", ")}. ${won.length ? `Já definidos no 1º turno: ${won.map(x => `${x.uf.toUpperCase()} (${shortName(x.list[0])}, ${x.list[0].partido})`).join(", ")}.` : "Nenhum estado tem governador definido ainda."}` });
  const change = races.filter(x => B22.gov[x.uf] && now22(B22.gov[x.uf]) !== x.list[0].partido && x.pst >= 20);
  if (change.length) out.push({ cat: "gov", tag: "Governos", score: 54 + change.length, col: "var(--c4)",
    title: `Partido no comando pode mudar em ${change.length} ${change.length > 1 ? "estados" : "estado"}`,
    body: change.slice(0, 5).map(x => `${UFNAME[x.uf]}: governado pelo ${B22.gov[x.uf]} eleito em 2022, tem ${shortName(x.list[0])} (${x.list[0].partido}) à frente com ${p1(num(x.list[0].pvapn))}`).join("; ") + "." });
  const tight = races.filter(x => x.list[1] && x.pst >= 10).map(x => ({ ...x, m: num(x.list[0].pvapn) - num(x.list[1].pvapn) })).sort((p, q) => p.m - q.m)[0];
  if (tight && tight.m < 5) out.push({ cat: "gov", tag: "Disputa apertada", score: 64 - tight.m * 2, col: "var(--c4)",
    title: `${UFNAME[tight.uf]} tem a disputa mais apertada por governo`,
    body: `${shortName(tight.list[0])} (${tight.list[0].partido}) tem ${p1(num(tight.list[0].pvapn))} e ${shortName(tight.list[1])} (${tight.list[1].partido}), ${p1(num(tight.list[1].pvapn))}: diferença de ${pp(tight.m).replace("+", "")}, com ${p1(tight.pst)} das urnas apuradas.` });
}
function senInsights(out) {
  if (!B22) return;
  const races = stateRaces(5); if (races.length < 5) return;
  const cnt = {}; let seats = 0;
  races.forEach(x => x.list.slice(0, x.nv).forEach(c => { cnt[c.partido] = (cnt[c.partido] || 0) + 1; seats++; }));
  const top = Object.entries(cnt).sort((p, q) => q[1] - p[1]);
  const sen22 = sg => Object.values(B22.sen).filter(s => now22(s) === sg).length;
  out.push({ cat: "sen", tag: "Senado", score: 58, col: partyColor(top[0][0]),
    title: `${top[0][0]} está à frente em ${top[0][1]} das ${seats} vagas do Senado em disputa`,
    body: `Em 2026 cada estado elege 2 senadores. Partidos à frente: ${top.slice(0, 5).map(([sg, n]) => `${sg} ${n}`).join(", ")}. Em 2022, com 1 vaga por estado, o ${top[0][0]} elegeu ${sen22(top[0][0])}.` });
  const tight = races.filter(x => x.list[x.nv] && x.pst >= 10).map(x => ({ ...x, m: num(x.list[x.nv - 1].pvapn) - num(x.list[x.nv].pvapn) })).sort((p, q) => p.m - q.m)[0];
  if (tight && tight.m < 3) out.push({ cat: "sen", tag: "Disputa apertada", score: 60 - tight.m * 2, col: "var(--c4)",
    title: `Briga pela 2ª vaga no Senado: ${UFNAME[tight.uf]}`,
    body: `${shortName(tight.list[tight.nv - 1])} (${tight.list[tight.nv - 1].partido}) tem ${p1(num(tight.list[tight.nv - 1].pvapn))} e ${shortName(tight.list[tight.nv])} (${tight.list[tight.nv].partido}), ${p1(num(tight.list[tight.nv].pvapn))}: só ${pp(tight.m).replace("+", "")} separam a vaga, com ${p1(tight.pst)} apurado.` });
}

/* ---------- interface ---------- */
const CATS = { all: "Tudo", pres: "Presidente", camara: "Câmara", gov: "Governos", sen: "Senado", comp: "Comparecimento" };
function renderAnalyst() {
  const box = $("anList"); if (!box) return;
  const out = [];
  try { presInsights(out); } catch (e) { console.warn(e); }
  try { turnoutInsights(out); } catch (e) { console.warn(e); }
  try { camaraInsights(out); } catch (e) { console.warn(e); }
  try { govInsights(out); } catch (e) { console.warn(e); }
  try { senInsights(out); } catch (e) { console.warn(e); }
  out.sort((p, q) => q.score - p.score);
  an.out = out;
  const shown = an.filter === "all" ? out : out.filter(x => x.cat === an.filter);
  $("anMeta").textContent = an.br ? `Com os números do TSE das ${an.br.hg.slice(0, 5)} · ${p1(num(an.br.s.pstn))} das urnas apuradas para Presidente` : "Lendo os números…";
  $("anChips").innerHTML = Object.entries(CATS).map(([k, t]) => `<button data-k="${k}" aria-pressed="${an.filter === k}">${t}${k !== "all" ? ` <b>${out.filter(x => x.cat === k).length}</b>` : ""}</button>`).join("");
  if (!shown.length) { box.innerHTML = `<p class="an-empty">${an.br ? "Ainda sem comentários para este tema; aguardando mais dados." : "O analista está lendo os números…"}</p>`; return; }
  const [lead, ...rest] = shown;
  const card = (x, big) => `<article class="an-card ${big ? "lead" : ""}" style="--ac:${x.col}"><span class="an-tag">${esc(x.tag)}</span><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p></article>`;
  box.innerHTML = card(lead, true) + `<div class="an-grid">${rest.map(x => card(x)).join("")}</div>`;
}

$("anChips").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { an.filter = b.dataset.k; renderAnalyst(); } });
new IntersectionObserver(es => { an.visible = es[0].isIntersecting; if (an.visible) loadAnalyst(); }, { rootMargin: "300px" }).observe($("analista"));
setInterval(() => { if (an.visible && state.auto && !document.hidden) loadAnalyst(); }, 15000);
setTimeout(() => loadAnalyst(), 4000);
