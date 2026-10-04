/* Visão de um candidato: ao clicar num candidato, o site mostra só os dados dele. */
let cmapBuilt = false, cvSort = "p";

/* comparação com o partido no 1º turno de 2022 (resumo de partidos-2022.json, dados abertos do TSE) */
let P22 = null;
fetch("partidos-2022.json").then(r => r.json()).then(d => { P22 = d; if (state.focus) renderCandView(); }).catch(() => {});
const SUCC = { PRD: ["PTB", "PATRIOTA"], SOLIDARIEDADE: ["SOLIDARIEDADE", "PROS"], PODE: ["PODE", "PSC"], MOBILIZA: ["PMN"], PCDOB: ["PC do B"], "PC do B": ["PC do B"] };
function share2022(cargo, uf, sg) {
  const t = P22 && P22[cargo] && P22[cargo][uf]; if (!t) return null;
  const keys = SUCC[sg] || [sg];
  const have = keys.filter(k => t[k] !== undefined);
  return have.length ? have.reduce((s, k) => s + t[k], 0) : null;
}
const deltaHtml = (now, then) => {
  if (then == null) return `<span class="dl eq" title="O partido não teve candidato a este cargo aqui em 2022">não concorreu</span>`;
  const d = now - then, cls = Math.abs(d) < 0.05 ? "eq" : d > 0 ? "up" : "down";
  return `<span class="dl ${cls} num">${cls === "up" ? "▲" : cls === "down" ? "▼" : "•"} ${d > 0 ? "+" : ""}${d.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.</span>`;
};

function openCand(sq) {
  if (state.cargo === 1 && state.uf !== "br") go(1, "br");
  state.focus = sq;
  document.body.classList.add("focus");
  history.replaceState(null, "", `#${state.cargo}/${state.uf}/${sq}`);
  scrollTo({ top: 0, behavior: "instant" });
  renderCandView();
}
function closeCand() {
  state.focus = null;
  document.body.classList.remove("focus");
  history.replaceState(null, "", `#${state.cargo}/${state.uf}`);
  $("tip").style.opacity = 0;
  document.title = "Central das Eleições 2026 · Apuração ao vivo";
}

function buildCandMap() {
  let shapes = "", labels = "", callouts = "";
  for (const [uf, d] of Object.entries(BR_MAP.paths)) shapes += `<path class="st" data-uf="${uf}" d="${d}" fill="var(--land)"/>`;
  for (const [uf, [x, y]] of Object.entries(BR_MAP.labels)) {
    if (CALLOUT[uf]) {
      const [tx, ty] = CALLOUT[uf];
      callouts += `<g class="co"><line x1="${x}" y1="${y}" x2="${tx - 6}" y2="${ty - 5}"/><circle cx="${x}" cy="${y}" r="2.5"/><text x="${tx}" y="${ty}" data-uf="${uf}">${uf.toUpperCase()} <tspan class="p" id="ccp-${uf}"></tspan></text></g>`;
    } else {
      const [lx, ly] = LABEL_FIX[uf] || [x, y];
      labels += `<g class="lb" id="clb-${uf}"><text x="${lx}" y="${ly}"><tspan class="u" x="${lx}">${uf.toUpperCase()}</tspan><tspan class="p" x="${lx}" dy="1.15em" id="clp-${uf}"></tspan></text></g>`;
    }
  }
  $("cmap").setAttribute("viewBox", "0 -6 1060 1002");
  $("cmap").innerHTML = `<g>${shapes}</g><g>${callouts}</g><g>${labels}</g>`;
  cmapBuilt = true;
}

function candByUf(sq) {
  const out = [];
  for (const [uf] of UFS) {
    const d = mapData[uf]; if (!d) continue;
    const list = candidatos(d), i = list.findIndex(c => c.sqcand === sq);
    if (i < 0) continue;
    out.push({ uf, d, c: list[i], rank: i + 1, p: num(list[i].pvapn), pst: num(d.s.pstn), leader: list[0] });
  }
  return out;
}

function renderCandView() {
  if (!state.focus) return;
  const v = $("candView");
  const back = `<div class="cv-top"><button class="cv-back" id="cvBack">← Todos os candidatos</button><button class="btn" id="cvCopy">Copiar link deste candidato</button></div>`;
  if (!last) { v.innerHTML = back + `<div class="skel" style="height:180px"></div>`; bindCv(); return; }
  const list = candidatos(last), i = list.findIndex(c => c.sqcand === state.focus);
  if (i < 0) { v.innerHTML = back + `<div class="card panel"><p>Este candidato não aparece nesta seleção.</p></div>`; bindCv(); return; }
  const c = list[i], col = colorFor(c), p = num(c.pvapn), vagas = +last.carg[0].nv || 1, cargo = state.cargo;
  const prev = list[i - 1], next = list[i + 1], name = title(c.nmu);
  const r = pj.res, o = r && r.out.find(x => x.c.sqcand === c.sqcand);
  document.title = `${name} ${c.pvap}% · ${CARGO[cargo]} · Central das Eleições 2026`;

  // status e chips
  const chips = [];
  if (c.e === "s") chips.push(`<span class="tag win">Eleito</span>`);
  else if (c.st) chips.push(`<span class="tag lead">${esc(c.st)}</span>`);
  if (r && r.g.winner === c.sqcand) chips.push(`<span class="tag win">Já ganhou · garantido</span>`);
  else if (r && !r.majority && r.g.safe.has(c.sqcand) && i < vagas) chips.push(`<span class="tag win">${vagas > 1 ? "Vaga garantida" : "Já ganhou · garantido"}</span>`);
  if (r && r.g.out.has(c.sqcand)) chips.push(`<span class="tag sj">Sem chance matemática</span>`);
  if (c.dvt && c.dvt !== "Válido") chips.push(`<span class="tag sj">${esc(c.dvt)}</span>`);

  const gap = i === 0
    ? (next ? `<b class="num">${fmt(c.vap - next.vap)}</b> votos à frente de ${esc(title(next.nmu))}` : "Candidato único")
    : `<b class="num">${fmt(prev.vap - c.vap)}</b> votos atrás de ${esc(title(prev.nmu))}`;
  let chance = "–", chanceL = "chance";
  if (o) {
    if (r.majority) {
      chance = r.g.winner === c.sqcand ? "✓" : pctP(o.pWin1); chanceL = "de vencer no 1º turno";
      if (o.pWin1 < 0.5 && !r.g.winner) { chance = r.g.out.has(c.sqcand) ? "0%" : pctP(o.p2 + o.pWin1); chanceL = "de vencer no 1º turno ou ir ao 2º turno"; }
    } else { chance = pctP(o.pTop); chanceL = vagas > 1 ? "de ficar com uma das vagas" : "de vencer"; }
  }
  const meta = [c.partido, c.colig && title(c.colig), c.vice && `vice ${title(c.vice.nmu)}`].filter(Boolean).map(esc).join(" · ");
  const isPres = cargo === 1;
  const ufs = isPres ? candByUf(c.sqcand) : [];

  v.innerHTML = back + `
  <section class="card cv-hero" style="--col:${col}">
    <div class="cv-photo">${esc(initials(c.nmu))}<img src="${photo(cargo, state.uf, c.sqcand)}" alt="" onerror="this.remove()"></div>
    <div class="cv-id">
      <div class="cv-k">${CARGO[cargo]} · ${place()} · nº ${esc(c.n)}</div>
      <h1>${esc(name)}</h1>
      <div class="cv-meta">${meta}</div>
      <div class="cv-chips">${chips.join("")}</div>
    </div>
    <div class="cv-num"><b class="num">${pct(p)}</b><span>dos votos válidos</span><em class="num">${fmt(c.vap)} votos</em></div>
    <div class="cv-bar"><div style="width:${p}%"></div>${cargo !== 5 ? '<span class="half"></span>' : ""}${o ? `<span class="band" style="left:${o.lo}%;width:${Math.max(.6, o.hi - o.lo)}%"></span><span class="pm" style="left:${o.mean}%"></span>` : ""}</div>
  </section>

  <section class="cv-stats">
    <div class="card cvs"><div class="l">Posição</div><div class="n num">${i + 1}º lugar</div><div class="s">de ${list.length} candidatos</div></div>
    <div class="card cvs"><div class="l">Diferença</div><div class="n2">${gap}</div></div>
    <div class="card cvs"><div class="l">Projeção final</div><div class="n num">${o ? pct(o.mean, 1) : "–"}</div><div class="s">${o ? `entre ${pct(o.lo, 1)} e ${pct(o.hi, 1)}` : "aguardando dados"}</div></div>
    <div class="card cvs" style="--k:${col}"><div class="l">Chance</div><div class="n num" style="color:${col}">${chance}</div><div class="s">${chanceL}</div></div>
  </section>

  <section class="cv-grid ${isPres ? "" : "one"}">
    ${isPres ? `<div class="card panel">
      <h2 class="cv-h">Desempenho por estado</h2>
      <p class="cv-hint">Quanto mais forte a cor, maior o percentual de ${esc(name)} no estado.</p>
      <div class="mapbox"><svg id="cmap" role="img" aria-label="Mapa do desempenho do candidato por estado"></svg></div>
      <div class="cv-scale"><span class="num" id="cvMin"></span><i style="background:linear-gradient(90deg,color-mix(in srgb,${col} 15%,var(--land)),${col})"></i><span class="num" id="cvMax"></span></div>
    </div>` : ""}
    <div class="cv-col">
      ${isPres ? `<div class="card panel"><h2 class="cv-h">Onde vai melhor e pior</h2><div class="cv-bw" id="cvBest"></div></div>` : ""}
      <div class="card panel"><h2 class="cv-h">Evolução de ${esc(name)} na apuração</h2><svg id="cvEvo" viewBox="0 0 400 180"></svg></div>
      ${isPres ? `<div class="card panel"><h2 class="cv-h">Por região</h2><div class="cv-reg" id="cvReg"></div></div>` : ""}
    </div>
    ${isPres ? "" : (() => { const t = share2022(cargo, state.uf, c.partido); return `<div class="card panel cv-past"><h2 class="cv-h">${esc(c.partido)} em ${esc(place())}: 2022 × agora</h2>
      ${!P22 ? `<p class="cv-hint">Carregando comparação com 2022…</p>` : t == null ? `<p class="cv-hint">O ${esc(c.partido)} não teve candidato a ${CARGO[cargo]} em ${esc(place())} em 2022.</p>`
      : `<div class="cv-pp"><div><span>2022 (1º turno)</span><b class="num">${pct(t, 1)}</b></div><div class="arrow">→</div><div><span>2026 (agora)</span><b class="num" style="color:${col}">${pct(p, 1)}</b></div><div>${deltaHtml(p, t)}</div></div>
        ${cargo === 5 ? `<p class="cv-hint" style="margin:8px 0 0">Em 2022 o Senado tinha 1 vaga por estado; em 2026 são 2, então cada eleitor deu 2 votos. Compare com cautela.</p>` : ""}`}</div>`; })()}
    ${isPres ? "" : `<div class="card panel"><h2 class="cv-h">Na disputa</h2><p class="cv-hint">${pct(num(last.s.pstn), 1)} das urnas apuradas em ${esc(place())}. Toque em outro candidato para ver os dados dele.</p>
      <div class="cv-race">${list.slice(0, 8).map((x, k) => `<button class="${x.sqcand === c.sqcand ? "me" : ""}" data-sq="${x.sqcand}" style="--col:${colorFor(x)}"><span>${k + 1}º ${esc(title(x.nmu))}</span><b class="num">${pct(num(x.pvapn), 1)}</b><i><em style="width:${num(x.pvapn)}%"></em></i></button>`).join("")}</div></div>`}
  </section>
  ${isPres ? `<section class="card panel" style="margin-top:14px"><h2 class="cv-h">Todos os estados</h2><p class="cv-cmp" id="cvCmp"></p><div class="stwrap" id="cvTable"></div><p class="cv-hint" style="margin:10px 0 0">2022: percentual do partido no 1º turno, sobre os votos válidos (resultado final). 2026: apuração em andamento. Partidos que se fundiram somam os antecessores (PRD = PTB + Patriota; Solidariedade inclui o PROS; Podemos inclui o PSC).</p></section>` : ""}`;

  bindCv();
  renderCandEvolution(c, col);
  if (isPres) renderCandStates(c, col, ufs);
}

function bindCv() {
  document.querySelectorAll(".cv-race button").forEach(b => b.onclick = () => openCand(b.dataset.sq));
  $("cvBack").onclick = closeCand;
  $("cvCopy").onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast("Link copiado"); } catch { toast(location.href); } };
}

function renderCandStates(c, col, ufs) {
  cmapBuilt = false; buildCandMap();
  const vals = ufs.map(x => x.p), min = Math.min(...vals), max = Math.max(...vals);
  $("cvMin").textContent = ufs.length ? pct(min, 0) : "";
  $("cvMax").textContent = ufs.length ? pct(max, 0) : "";
  const byUf = Object.fromEntries(ufs.map(x => [x.uf, x]));
  for (const [uf] of UFS) {
    const path = document.querySelector(`#cmap path[data-uf="${uf}"]`), x = byUf[uf];
    const k = x && max > min ? (x.p - min) / (max - min) : x ? 1 : 0;
    path.style.fill = x ? `color-mix(in srgb, ${col} ${(15 + k * 85).toFixed(0)}%, var(--land))` : "var(--land)";
    const txt = x ? Math.round(x.p) + "%" : "";
    const lp = $("clp-" + uf), cp = $("ccp-" + uf), lb = $("clb-" + uf);
    if (lp) lp.textContent = txt;
    if (cp) cp.textContent = txt;
    if (lb) lb.classList.toggle("dark", k < 0.35);
  }
  // tooltip
  const map = $("cmap");
  map.onpointermove = e => {
    const t = e.target.closest("[data-uf]"), x = t && byUf[t.dataset.uf], tip = $("tip");
    if (!x || e.pointerType !== "mouse") { tip.style.opacity = 0; return; }
    tip.innerHTML = `<h4>${esc(UFNAME[x.uf])}</h4><div class="s">${pct(x.pst, 1)} das urnas apuradas</div>
      <div class="r" style="--col:${col}"><span>${esc(title(c.nmu))} · ${x.rank}º</span><b class="num">${pct(x.p)}</b><div class="b"><div style="width:${x.p}%"></div></div></div>
      <div class="s" style="margin:8px 0 0">${fmt(x.c.vap)} votos${x.rank > 1 ? ` · líder: ${esc(title(x.leader.nmu))} (${x.leader.pvap}%)` : ""}</div>`;
    tip.style.opacity = 1; tip.style.left = Math.min(e.clientX + 16, innerWidth - 266) + "px"; tip.style.top = Math.min(e.clientY + 16, innerHeight - tip.offsetHeight - 10) + "px";
  };
  map.onmouseleave = () => $("tip").style.opacity = 0;

  // melhores e piores
  const sorted = [...ufs].sort((a, b) => b.p - a.p);
  const item = x => `<div class="bw"><b>${esc(UFNAME[x.uf])}</b><span class="num">${pct(x.p, 1)}</span><div class="b"><div style="width:${x.p}%;background:${col}"></div></div></div>`;
  $("cvBest").innerHTML = sorted.length
    ? `<div><h4>Melhores estados</h4>${sorted.slice(0, 3).map(item).join("")}</div><div><h4>Piores estados</h4>${sorted.slice(-3).reverse().map(item).join("")}</div>`
    : `<p class="cv-hint">Carregando os estados…</p>`;

  // regiões
  $("cvReg").innerHTML = Object.entries(REGIOES).map(([nome, us]) => {
    let v = 0, vv = 0;
    for (const uf of us) { const x = byUf[uf]; if (x) { v += +x.c.vap; vv += +x.d.v.vv; } }
    const p = vv ? v / vv * 100 : 0;
    return `<div class="rr"><span>${nome}</span><div class="b"><div style="width:${p}%;background:${col}"></div></div><b class="num">${vv ? pct(p, 1) : "–"}</b></div>`;
  }).join("");

  // tabela com comparação ao partido em 2022
  const sg = c.partido;
  ufs.forEach(x => { x.p22 = share2022(1, x.uf, sg); x.dv = x.p22 == null ? null : x.p - x.p22; });
  const nat22 = share2022(1, "br", sg), withPast = ufs.filter(x => x.dv != null);
  const up = withPast.filter(x => x.dv > 0.05).length, down = withPast.filter(x => x.dv < -0.05).length;
  const rows = [...ufs].sort(cvSort === "dv" ? (a, b) => (b.dv ?? -999) - (a.dv ?? -999) : cvSort === "dva" ? (a, b) => (a.dv ?? 999) - (b.dv ?? 999) : (a, b) => b.p - a.p);
  const nm1 = esc(title(c.nmu).split(" ")[0]);
  $("cvCmp").innerHTML = !P22 ? "Carregando comparação com 2022…"
    : nat22 == null ? `O ${esc(sg)} não teve candidato a Presidente em 2022, então não há base de comparação por estado.`
    : `Comparado ao <b>${esc(sg)} no 1º turno de 2022</b> (${pct(nat22, 1)} no Brasil): ${nm1} está <b class="up-t">acima em ${up}</b> e <b class="down-t">abaixo em ${down}</b> ${up + down === 1 ? "estado" : "estados"}. No Brasil: ${deltaHtml(num(c.pvapn), nat22)}`;
  const thS = (k, t) => `<th class="n sortable ${cvSort === k || (k === "dv" && cvSort === "dva") ? "on" : ""}" data-s="${k}">${t}</th>`;
  $("cvTable").innerHTML = `<table class="st"><thead><tr><th>Estado</th><th class="n">Urnas</th>${thS("p", `${nm1} % ${cvSort === "p" ? "▾" : ""}`)}<th class="n">${esc(sg)} em 2022</th>${thS(cvSort === "dv" ? "dva" : "dv", `Variação ${cvSort === "dv" ? "▾" : cvSort === "dva" ? "▴" : ""}`)}<th class="n">Votos</th><th class="n">Posição</th><th>Líder no estado</th></tr></thead><tbody>
    ${rows.map(x => `<tr data-uf="${x.uf}"><td><b>${esc(UFNAME[x.uf])}</b></td><td class="n num">${pct(x.pst, 1)}</td><td class="n num" style="color:${col};font-weight:700">${pct(x.p, 1)}</td>
      <td class="n num">${x.p22 == null ? "–" : pct(x.p22, 1)}</td><td class="n">${deltaHtml(x.p, x.p22)}</td>
      <td class="n num">${fmt(x.c.vap)}</td><td class="n num">${x.rank}º</td><td>${x.rank === 1 ? `<b style="color:${col}">ele mesmo</b>` : esc(title(x.leader.nmu))}</td></tr>`).join("")}
    </tbody></table>`;
  $("cvTable").querySelectorAll("th[data-s]").forEach(th => th.onclick = () => { cvSort = th.dataset.s; renderCandStates(c, col, ufs); });
}

function renderCandEvolution(c, col) {
  const h = store.get(`h26-${state.cargo}-${state.uf}`, []).filter(s => s.c && s.c[c.sqcand] !== undefined);
  const svg = $("cvEvo");
  if (h.length < 2) {
    svg.innerHTML = `<text x="200" y="85" text-anchor="middle" style="font-size:13px;fill:var(--muted)">O gráfico se forma conforme a apuração avança.</text><text x="200" y="105" text-anchor="middle" style="font-size:11.5px;fill:var(--faint)">Atual: ${pct(num(c.pvapn))}</text>`;
    return;
  }
  const W = 400, H = 180, L = 42, R = 14, T = 16, B = 24;
  const ys = h.map(s => s.c[c.sqcand]);
  let y0 = Math.floor(Math.min(...ys) - 1.5), y1 = Math.ceil(Math.max(...ys) + 1.5);
  const x0 = h[0].m, x1 = Math.max(h[h.length - 1].m, x0 + 30);
  const X = m => L + (m - x0) / (x1 - x0) * (W - L - R), Y = p => T + (1 - (p - y0) / (y1 - y0)) * (H - T - B);
  let g = "";
  for (let k = 0; k <= 4; k++) { const p = y0 + (y1 - y0) * k / 4; g += `<line x1="${L}" x2="${W - R}" y1="${Y(p)}" y2="${Y(p)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(p) + 4}" text-anchor="end" style="font-size:11px;fill:var(--muted)">${p.toFixed(1).replace(".", ",")}%</text>`; }
  if (y0 < 50 && y1 > 50 && state.cargo !== 5) g += `<line x1="${L}" x2="${W - R}" y1="${Y(50)}" y2="${Y(50)}" stroke="var(--faint)" stroke-dasharray="4 4"/><text x="${W - R}" y="${Y(50) - 4}" text-anchor="end" style="font-size:10.5px;fill:var(--muted)">50%</text>`;
  g += `<text x="${L}" y="${H - 6}" style="font-size:11px;fill:var(--muted)">${hhmm(x0)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" style="font-size:11px;fill:var(--muted)">${hhmm(h[h.length - 1].m)}</text>`;
  const line = h.map((s, i) => `${i ? "L" : "M"}${X(s.m).toFixed(1)},${Y(s.c[c.sqcand]).toFixed(1)}`).join("");
  g += `<path d="${line}" fill="none" stroke="${col}" stroke-width="2.6" stroke-linejoin="round"/>`;
  const ls = h[h.length - 1];
  g += `<circle cx="${X(ls.m)}" cy="${Y(ls.c[c.sqcand])}" r="4.5" fill="${col}" stroke="var(--surface)" stroke-width="2"/>`;
  svg.innerHTML = g;
}

/* clique no candidato abre a visão dele */
$("cands").addEventListener("click", e => {
  const row = e.target.closest(".cand[data-sq]");
  if (row) openCand(row.dataset.sq);
});
$("candView").addEventListener("click", e => {
  const tr = e.target.closest("tr[data-uf]");
  if (tr) e.stopPropagation();
}, true);
if (window.INIT_FOCUS) openCand(window.INIT_FOCUS);
