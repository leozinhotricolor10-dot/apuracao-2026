/* Projeção estatística da apuração.
   - "Já ganhou": garantia matemática (mesmo que todos os eleitores das seções
     ainda não apuradas votassem contra, o resultado não muda).
   - Chances: simulação Monte Carlo dos votos que faltam, por estado.
     Em cada estado, os votos restantes seguem o padrão já apurado ali, com
     incerteza que diminui conforme a apuração avança, mais um desvio nacional
     comum a todos os estados. É uma estimativa, não resultado oficial. */
const PJ_N_NAT = 2000, PJ_N_UF = 600, PJ_MIN_PST = 1;
const PJ_SIG_STATE = 0.22, PJ_SIG_NAT = 0.10, PJ_SIG_EMPTY = 0.40, PJ_SIG_TURNOUT = 0.04;
let pj = { res: null, list: null, scope: "" }, mapMode = "now", ufProj = {}, zzData = null;

function rng(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function makeRandn(r) { return () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }; }
const pctP = p => p >= 0.995 ? ">99%" : p <= 0.005 ? "<1%" : Math.round(p * 100) + "%";

function stratum(d, fallbackShares) {
  const list = candidatos(d);
  const c = +d.e.c, est = +d.e.est, esnt = +d.e.esnt, vv = +d.v.vv;
  const turnout = est ? c / est : 0.79, vrate = c ? vv / c : 0.94;
  const shares = {};
  if (vv > 0) list.forEach(x => shares[x.sqcand] = +x.vap / vv);
  else Object.assign(shares, fallbackShares || {});
  return { counted: Object.fromEntries(list.map(x => [x.sqcand, +x.vap])), vv, esnt, est, R: esnt * turnout * vrate, pst: num(d.s.pstn) / 100, shares, hasData: vv > 0 };
}

function runProjection(strata, cands, { vagas = 1, majority = false, N = PJ_N_NAT, seed = 7 } = {}) {
  const randn = makeRandn(rng(seed));
  const ids = cands.map(c => c.sqcand), K = ids.length;
  const counted = ids.map(id => strata.reduce((s, st) => s + (st.counted[id] || 0), 0));
  const vv = strata.reduce((s, st) => s + st.vv, 0), M = strata.reduce((s, st) => s + st.esnt, 0);
  const done = strata.reduce((s, st) => s + st.est, 0), pstAll = done + M ? done / (done + M) : 0;
  const sigN = PJ_SIG_NAT * Math.sqrt(1 - pstAll);
  const samples = ids.map(() => new Float64Array(N));
  const pTop = new Array(K).fill(0), pWin1 = new Array(K).fill(0), pairs = {};
  const shift = new Float64Array(K), tot = new Float64Array(K), w = new Float64Array(K);
  let first = 0;
  for (let n = 0; n < N; n++) {
    for (let i = 0; i < K; i++) { shift[i] = randn() * sigN; tot[i] = counted[i]; }
    for (const st of strata) {
      if (st.R <= 0) continue;
      const sig = st.hasData ? PJ_SIG_STATE * Math.sqrt(1 - st.pst) : PJ_SIG_EMPTY;
      let sum = 0;
      for (let i = 0; i < K; i++) { w[i] = (st.shares[ids[i]] || 0) * Math.exp(shift[i] + randn() * sig); sum += w[i]; }
      if (sum <= 0) continue;
      const R = st.R * Math.exp(randn() * PJ_SIG_TURNOUT);
      for (let i = 0; i < K; i++) tot[i] += R * w[i] / sum;
    }
    let T = 0; for (let i = 0; i < K; i++) T += tot[i];
    if (T <= 0) continue;
    const order = [...Array(K).keys()].sort((a, b) => tot[b] - tot[a]);
    for (let i = 0; i < K; i++) samples[i][n] = tot[i] / T * 100;
    for (let k = 0; k < Math.min(vagas, K); k++) pTop[order[k]]++;
    if (majority) {
      if (tot[order[0]] / T > 0.5) { pWin1[order[0]]++; first++; }
      else if (K > 1) { const key = [ids[order[0]], ids[order[1]]].sort().join("|"); pairs[key] = (pairs[key] || 0) + 1; }
    }
  }
  const q = (arr, p) => { const s = Array.from(arr).sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
  const out = cands.map((c, i) => {
    const p2 = Object.entries(pairs).filter(([k]) => k.split("|").includes(c.sqcand)).reduce((s, [, v]) => s + v, 0) / N;
    return { c, mean: samples[i].reduce((a, b) => a + b, 0) / N, lo: q(samples[i], .05), hi: q(samples[i], .95), pTop: pTop[i] / N, pWin1: pWin1[i] / N, p2 };
  }).sort((a, b) => b.mean - a.mean);

  // garantias matemáticas (pior caso: todos os eleitores restantes votam contra)
  const g = { M, winner: null, runoff: false, safe: new Set(), out: new Set() };
  const L = counted.indexOf(Math.max(...counted));
  if (counted[L] > 0) {
    if (majority && counted[L] > (vv + M) / 2) g.winner = ids[L];
    if (majority && counted[L] + M <= (vv + M) / 2) g.runoff = true;
    const slots = majority ? 2 : vagas;
    ids.forEach((id, i) => {
      if (counted.filter((x, j) => j !== i && x + M >= counted[i]).length < slots) g.safe.add(id);
      if (counted.filter((x, j) => j !== i && x > counted[i] + M).length >= slots) g.out.add(id);
    });
  }
  const pairList = Object.entries(pairs).map(([k, v]) => ({ ids: k.split("|"), p: v / N })).sort((a, b) => b.p - a.p);
  return { out, pFirst: first / N, pairs: pairList, g, pst: pstAll, vagas, majority };
}

const TIERS = [[.99, "certain", "Praticamente certo"], [.9, "likely", "Muito provável"], [.7, "lean", "Provável"], [0, "toss", "Indefinido"]];
const tier = p => TIERS.find(t => p >= t[0]);

function verdict(r, list, scope) {
  const nm = id => title((list.find(c => c.sqcand === id) || {}).nmu || "");
  const join = a => a.length > 1 ? a.slice(0, -1).join(", ") + " e " + a[a.length - 1] : a[0];
  const eleitos = list.filter(c => c.e === "s");
  if (eleitos.length)
    return { lvl: "done", badge: "Resultado oficial", big: "✓", bigL: "confirmado pelo TSE", head: `${join(eleitos.map(c => title(c.nmu)))} ${eleitos.length > 1 ? "estão eleitos" : "está eleito"}${scope}`, sub: "Resultado confirmado pelo TSE." };
  if (r.pst * 100 < PJ_MIN_PST || !r.out[0] || r.out[0].mean <= 0)
    return { lvl: "wait", badge: "Projeção", big: "…", bigL: "aguardando dados", head: "Projeção disponível em instantes", sub: `Precisamos de pelo menos ${PJ_MIN_PST}% das urnas apuradas para projetar com segurança.` };
  const top = r.out[0], A = nm(top.c.sqcand), rng = x => `${pct(x.mean, 1)} (entre ${pct(x.lo, 1)} e ${pct(x.hi, 1)})`;
  if (r.majority) {
    if (r.g.winner)
      return { lvl: "done", badge: "Já ganhou", big: "✓", bigL: "garantido", head: `${nm(r.g.winner)} já ganhou${scope} no 1º turno`, sub: "Garantido matematicamente: mesmo que todos os votos que faltam fossem para os adversários, ninguém tira mais essa vitória." };
    const pair = r.pairs[0];
    if (r.g.runoff) {
      const safe = [...r.g.safe];
      const who = safe.length >= 2 ? `entre ${nm(safe[0])} e ${nm(safe[1])}` : pair ? `provavelmente entre ${nm(pair.ids[0])} e ${nm(pair.ids[1])} (${pctP(pair.p)})` : "";
      return { lvl: "done", badge: "2º turno garantido", big: "2º", bigL: "turno garantido", head: `Vai ter 2º turno${scope} ${who}`, sub: "Garantido matematicamente: ninguém consegue mais passar de 50% dos votos válidos." };
    }
    const p = r.pFirst;
    if (p >= 0.5) {
      const t = tier(p);
      return { lvl: t[1], badge: t[2], big: pctP(p), bigL: "de chance de vencer no 1º turno", head: t[1] === "toss" ? `Disputa indefinida${scope}: ${A} pode vencer no 1º turno` : `${A} deve vencer${scope} no 1º turno`, sub: `Projeção final de ${A}: ${rng(top)}.` };
    }
    const t = tier(1 - p);
    return { lvl: t[1], badge: t[2], big: pctP(1 - p), bigL: "de chance de 2º turno", head: t[1] === "toss" ? `Disputa indefinida${scope}` : `Projeção indica 2º turno${scope}${pair ? ` entre ${nm(pair.ids[0])} e ${nm(pair.ids[1])}` : ""}`, sub: `${A} projetado em ${rng(top)}${pair ? ` · Chance de ${nm(pair.ids[0])} × ${nm(pair.ids[1])}: ${pctP(pair.p)}` : ""}.` };
  }
  const winners = r.out.slice(0, r.vagas), names = join(winners.map(w => nm(w.c.sqcand)));
  if (winners.every(w => r.g.safe.has(w.c.sqcand)))
    return { lvl: "done", badge: "Já ganhou", big: "✓", bigL: "garantido", head: r.vagas > 1 ? `${names} já garantiram as vagas${scope}` : `${names} já ganhou${scope}`, sub: "Garantido matematicamente: mesmo que todos os votos que faltam fossem para os adversários, o resultado não muda." };
  const p = Math.min(...winners.map(w => w.pTop)), t = tier(p);
  return { lvl: t[1], badge: t[2], big: pctP(p), bigL: r.vagas > 1 ? "de chance de ficarem com as vagas" : "de chance de vitória", head: t[1] === "toss" ? `Disputa indefinida${scope}` : r.vagas > 1 ? `${names} devem ficar com as vagas${scope}` : `${names} deve vencer${scope}`, sub: winners.map(w => `${nm(w.c.sqcand)}: ${pctP(w.pTop)} de chance, projeção ${pct(w.mean, 1)}`).join(" · ") + "." };
}

/* ---------- cálculo ---------- */
function updateProjection() {
  if (!last) return;
  if (last.multi) { computeUfProj(); pj.res = null; $("proj").hidden = true; updateWonBtn(); if (state.decidedOnly) { paintDecided(); renderDecidedTable(); } if (typeof renderRegionCards === "function") renderRegionCards(); if (typeof renderRegionRaces === "function") renderRegionRaces(last); return; }
  const cargo = state.cargo, list = candidatos(last), cands = list.slice(0, 10);
  let strata = [stratum(last)], opts, scope = "";
  if (cargo === 1 && state.uf === "br") {
    const ufs = UFS.map(([uf]) => mapData[uf]).filter(Boolean);
    if (mapCargo === 1 && ufs.length === 27) {
      const fb = Object.fromEntries(list.map(c => [c.sqcand, +c.vap / (+last.v.vv || 1)]));
      strata = ufs.map(d => stratum(d, fb));
      if (zzData) strata.push(stratum(zzData, fb));
    }
    opts = { majority: true, vagas: 1 };
  } else if (cargo === 1 && isRegion(state.uf)) {
    const ds = regionUfs(state.uf).map(uf => mapData[uf]).filter(Boolean);
    if (mapCargo === 1 && ds.length) strata = ds.map(d => stratum(d));
    opts = { majority: false, vagas: 1 }; scope = ` no ${REGKEY[state.uf]}`;
  } else if (cargo === 1) { opts = { majority: false, vagas: 1 }; scope = ` em ${UFNAME[state.uf]}`; }
  else opts = { majority: cargo === 3, vagas: +last.carg[0].nv || 1 };
  pj.res = runProjection(strata, cands, opts);
  pj.list = list; pj.scope = scope;
  computeUfProj();
  renderProjection();
}

function computeUfProj() {
  ufProj = {};
  if (mapCargo !== state.cargo) return;   // dados dos estados ainda são do cargo anterior
  const ev = [];
  for (const [uf, d] of Object.entries(mapData)) {
    const list = candidatos(d);
    if (!list[0] || +list[0].vap === 0) continue;
    const vagas = state.cargo === 5 ? +d.carg[0].nv || 1 : 1;
    const r = runProjection([stratum(d)], list.slice(0, 8), { vagas, majority: state.cargo === 3, N: PJ_N_UF, seed: uf.charCodeAt(0) * 31 + uf.charCodeAt(1) });
    const lead = r.out[0];
    const guaranteed = state.cargo === 3 ? !!r.g.winner : r.out.slice(0, vagas).every(w => r.g.safe.has(w.c.sqcand));
    const p = state.cargo === 3 ? Math.max(r.pFirst, 1 - r.pFirst) : Math.min(...r.out.slice(0, vagas).map(w => w.pTop));
    ufProj[uf] = { r, lead, guaranteed, p, list };
    if (guaranteed) {
      const who = r.out.slice(0, vagas).map(w => title(w.c.nmu));
      ev.push({ id: `${uf}-g-${who.join("+")}`, m: mins(d.hg), k: "--ok", t: `${UFNAME[uf]}: ${who.join(" e ")} já ${vagas > 1 ? "garantiram as vagas" : state.cargo === 3 ? "ganhou no 1º turno" : "ganhou no estado"}`, b: "Garantido matematicamente pelos números da apuração." });
    }
  }
  const v = pj.res && pj.list ? verdict(pj.res, pj.list, pj.scope) : null;
  if (v && v.lvl === "done" && v.badge !== "Resultado oficial" && state.uf === "br")
    ev.push({ id: `br-g-${v.head}`, m: mins(last.hg), k: "--ok", t: v.head, b: "Garantido matematicamente pelos números da apuração." });
  addEvents(ev);
}

/* ---------- interface ---------- */
const LVL_COLOR = { done: "var(--ok)", certain: "var(--ok)", likely: "var(--c1)", lean: "var(--c4)", toss: "var(--c10)", wait: "var(--c10)" };

function renderProjection() {
  const r = pj.res; if (!r) return;
  const v = verdict(r, pj.list, pj.scope);
  const box = $("proj");
  box.hidden = false;
  box.style.setProperty("--lvl", LVL_COLOR[v.lvl]);
  $("pjBadge").textContent = v.badge;
  $("pjScope").textContent = `${CARGO[state.cargo]} · ${place()}`;
  $("pjHead").textContent = v.head;
  $("pjSub").textContent = v.sub;
  $("pjBig").textContent = v.big;
  $("pjBigL").textContent = v.bigL;
  renderProjDetail(r);
  decorateBars(r);
  if (mapMode === "proj") paintProjection();
  updateWonBtn();
  if (state.decidedOnly) { paintDecided(); renderDecidedTable(); }
  if (typeof renderRegionCards === "function") renderRegionCards();
}

function renderProjDetail(r) {
  const rows = r.out.slice(0, 6);
  const max = Math.max(55, ...rows.map(x => x.hi)) * 1.05;
  const head = r.majority ? "<th>Vence no 1º turno</th><th>Vai ao 2º turno</th>" : `<th>${r.vagas > 1 ? "Fica com vaga" : "Chance de vencer"}</th>`;
  $("projDetail").innerHTML = `
    <table class="pjt"><thead><tr><th>Candidato</th><th>Projeção final</th>${head}</tr></thead><tbody>
    ${rows.map(x => `<tr style="--col:${colorFor(x.c)}">
      <td><b>${esc(title(x.c.nmu))}</b>${r.g.safe.has(x.c.sqcand) && !r.majority ? ' <span class="tag win">Garantido</span>' : ""}</td>
      <td><div class="rg num">${pct(x.mean, 1)}</div><div class="rbar">${r.majority ? `<span class="half" style="left:${50 / max * 100}%"></span>` : ""}<span class="band" style="left:${x.lo / max * 100}%;width:${Math.max(1, (x.hi - x.lo) / max * 100)}%"></span><span class="pm" style="left:${x.mean / max * 100}%"></span></div><div class="rr num">${pct(x.lo, 1)} a ${pct(x.hi, 1)}</div></td>
      ${r.majority ? `<td class="num">${r.g.winner === x.c.sqcand ? "✓" : pctP(x.pWin1)}</td><td class="num">${r.g.out.has(x.c.sqcand) ? "–" : pctP(x.p2)}</td>` : `<td class="num">${pctP(x.pTop)}</td>`}
    </tr>`).join("")}
    </tbody></table>
    <details class="how"><summary>Como a projeção é calculada?</summary>
      <p><b>"Já ganhou"</b> só aparece quando é garantido matematicamente: consideramos que todos os ${fmt(r.g.M)} eleitores das seções ainda não apuradas votassem contra o líder, e mesmo assim o resultado não mudaria.</p>
      <p><b>As chances</b> vêm de ${r.majority && state.uf === "br" ? "2.000" : "milhares de"} simulações dos votos que faltam${state.cargo === 1 && state.uf === "br" ? ", estado por estado (e exterior)" : ""}: os votos restantes seguem o padrão já apurado, com uma margem de incerteza que diminui à medida que a apuração avança. Faixa mostrada: 90% dos cenários.</p>
      <p>É uma estimativa estatística deste site, <b>não é resultado oficial</b>. O resultado oficial é sempre o do TSE.</p>
    </details>`;
}

function decorateBars(r) {
  for (const x of r.out) {
    const row = document.querySelector(`.cand[data-sq="${x.c.sqcand}"]`);
    if (!row) continue;
    const bar = row.querySelector(".bar");
    bar.querySelectorAll(".band,.pm").forEach(e => e.remove());
    bar.insertAdjacentHTML("beforeend", `<span class="band" title="Projeção: ${pct(x.lo, 1)} a ${pct(x.hi, 1)}" style="left:${x.lo}%;width:${Math.max(.6, x.hi - x.lo)}%"></span><span class="pm" style="left:${x.mean}%"></span>`);
    const v = row.querySelector(".v");
    let pv = row.querySelector(".pv");
    if (!pv) { pv = document.createElement("div"); pv.className = "pv num"; v.after(pv); }
    pv.textContent = `projeção ${pct(x.mean, 1)}`;
  }
}

function paintProjection() {
  const counts = { done: 0, certain: 0, likely: 0, lean: 0, toss: 0 }, leaders = {};
  for (const [uf] of UFS) {
    const path = document.querySelector(`#map path[data-uf="${uf}"]`), P = ufProj[uf];
    const lp = $("lp-" + uf), cp = $("cp-" + uf), lb = $("lb-" + uf);
    if (!P) { path.style.fill = "var(--land)"; if (lp) lp.textContent = ""; if (cp) cp.textContent = ""; if (lb) lb.classList.add("dark"); continue; }
    const v = colorVar(P.lead.c), lvl = P.guaranteed ? "done" : tier(P.p)[1];
    counts[lvl]++;
    leaders[P.lead.c.partido] = leaders[P.lead.c.partido] || { nome: state.cargo === 1 ? title(P.lead.c.nmu) : P.lead.c.partido, col: colorFor(P.lead.c), n: 0 };
    leaders[P.lead.c.partido].n++;
    path.style.fill = lvl === "toss" ? `url(#t${v})` : `color-mix(in srgb, var(${v}) ${{ done: 100, certain: 88, likely: 68, lean: 48 }[lvl]}%, var(--land))`;
    const txt = (P.guaranteed ? "✓ " : "") + (lvl === "toss" ? "?" : Math.round(P.lead.mean) + "%");
    if (lp) lp.textContent = txt;
    if (cp) cp.textContent = txt;
    if (lb) lb.classList.remove("dark");
  }
  $("legTitle").textContent = "Projeção por estado";
  $("legend").innerHTML = Object.values(leaders).sort((a, b) => b.n - a.n).map(x => `<span><i style="background:${x.col}"></i>${esc(x.nome)}<em>${x.n}</em></span>`).join("") +
    `<span><i style="background:var(--text)"></i>✓ Já ganhou<em>${counts.done}</em></span>` +
    `<span><i style="background:color-mix(in srgb,var(--text) 55%,var(--land))"></i>Muito provável<em>${counts.certain + counts.likely}</em></span>` +
    `<span><i style="background:color-mix(in srgb,var(--text) 25%,var(--land))"></i>Provável<em>${counts.lean}</em></span>` +
    `<span><i class="tight"></i>Indefinido<em>${counts.toss}</em></span>`;
}

function showProjTip(uf, x, y) {
  const P = ufProj[uf], tip = $("tip");
  if (!P) return showTip(uf, x, y);
  const vagas = P.r.vagas;
  tip.innerHTML = `<h4>${esc(UFNAME[uf])} · projeção</h4><div class="s">${pct(P.r.pst * 100, 1)} das urnas · ${P.guaranteed ? "✓ já decidido" : tier(P.p)[2].toLowerCase()}</div>` +
    P.r.out.slice(0, 3).map(o => `<div class="r" style="--col:${colorFor(o.c)}"><span>${esc(title(o.c.nmu))}</span><b class="num">${pct(o.mean, 1)}</b><div class="b"><div style="width:${o.mean}%"></div></div></div>`).join("") +
    `<div class="s" style="margin:8px 0 0">${state.cargo === 3 ? `Chance de 1º turno decidido: ${pctP(P.r.pFirst)}` : `Chance de ${esc(title(P.lead.c.nmu))} ${vagas > 1 ? "ficar com vaga" : "vencer"}: ${pctP(P.lead.pTop)}`}</div>`;
  tip.style.opacity = 1;
  tip.style.left = Math.min(x + 16, innerWidth - 266) + "px";
  tip.style.top = Math.min(y + 16, innerHeight - tip.offsetHeight - 10) + "px";
}

/* ---------- filtro "Já ganhou": só estados com vencedor definido ---------- */
function decidedInfo(uf) {
  const d = mapCargo === state.cargo && mapData[uf]; if (!d) return null;
  const list = candidatos(d), vagas = state.cargo === 5 ? +d.carg[0].nv || 1 : 1;
  const eleitos = list.filter(c => c.e === "s");
  if (eleitos.length) return { how: "Oficial TSE", winners: eleitos, d };
  const P = ufProj[uf];
  if (!P || !P.guaranteed) return null;
  const sqs = state.cargo === 3 ? [P.r.g.winner] : P.r.out.slice(0, vagas).map(o => o.c.sqcand);
  return { how: "Garantido", winners: sqs.map(sq => list.find(c => c.sqcand === sq)).filter(Boolean), d };
}
function decidedUfs() { return UFS.map(([uf]) => [uf, decidedInfo(uf)]).filter(([, x]) => x); }

function updateWonBtn() {
  const n = decidedUfs().length;
  $("wonN").textContent = n;
  $("wonBtn").title = `${n} ${n === 1 ? "estado já tem" : "estados já têm"} vencedor definido para ${CARGO[state.cargo]}`;
}

function paintDecided() {
  const dec = Object.fromEntries(decidedUfs()), groups = {};
  for (const [uf] of UFS) {
    const path = document.querySelector(`#map path[data-uf="${uf}"]`), x = dec[uf];
    const lp = $("lp-" + uf), cp = $("cp-" + uf), lb = $("lb-" + uf);
    path.classList.toggle("dim", !x);
    if (!x) {
      path.style.fill = "var(--land)";
      if (lp) lp.textContent = ""; if (cp) cp.textContent = ""; if (lb) lb.classList.add("dark");
      continue;
    }
    const w = x.winners[0];
    path.style.fill = colorFor(w);
    if (lp) lp.textContent = "✓ " + Math.round(num(w.pvapn)) + "%";
    if (cp) cp.textContent = "✓";
    if (lb) lb.classList.remove("dark");
    for (const c of x.winners) {
      const k = state.cargo === 1 ? c.sqcand : c.partido;
      groups[k] = groups[k] || { nome: state.cargo === 1 ? title(c.nmu) : c.partido, col: colorFor(c), n: 0 };
      groups[k].n++;
    }
  }
  const n = Object.keys(dec).length;
  $("legTitle").textContent = n ? "Já ganhou no estado" : "Já ganhou";
  $("legend").innerHTML = n
    ? Object.values(groups).sort((a, b) => b.n - a.n).map(g => `<span><i style="background:${g.col}"></i>${esc(g.nome)}<em>${g.n}</em></span>`).join("") +
      `<span><i style="background:var(--land)"></i>Ainda indefinido<em>${27 - n}</em></span>`
    : `<span style="color:var(--muted)">Nenhum estado tem vencedor definido ainda para ${CARGO[state.cargo]}. Os estados aparecem aqui assim que o resultado ficar garantido.</span>`;
}

function renderDecidedTable() {
  const dec = decidedUfs().sort((a, b) => UFNAME[a[0]].localeCompare(UFNAME[b[0]]));
  const html = dec.length
    ? `<table class="st"><thead><tr><th>Estado</th><th>Vencedor</th><th class="n">%</th><th class="n">Urnas</th><th>Situação</th></tr></thead><tbody>
      ${dec.map(([uf, x]) => `<tr data-uf="${uf}"><td><b>${uf.toUpperCase()}</b></td>
        <td>${x.winners.map(c => `<b style="color:${colorFor(c)}">${esc(title(c.nmu))}</b>`).join("<br>")}</td>
        <td class="n num">${x.winners.map(c => pct(num(c.pvapn), 1)).join("<br>")}</td>
        <td class="n num">${pct(num(x.d.s.pstn), 1)}</td>
        <td><span class="won-how" title="${x.how === "Garantido" ? "Garantido matematicamente pelos números da apuração" : "Eleito oficialmente pelo TSE"}">✓ ${x.how}</span></td></tr>`).join("")}</tbody></table>`
    : `<p class="won-empty">Nenhum estado com vencedor definido ainda para ${CARGO[state.cargo]}.</p>`;
  $("stTable").innerHTML = html;
  $("listView").innerHTML = html;
}
