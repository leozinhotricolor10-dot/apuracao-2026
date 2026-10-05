/* Deputados: federal, estadual e distrital.
   Vagas por partido/federação: distribuição atual calculada pelo TSE ("vag" no arquivo).
   Quem ocupa as vagas: enquanto o TSE não oficializa, os mais votados de cada partido/federação
   que tenham ao menos 10% do quociente eleitoral; depois, a situação oficial ("Eleito por QP/média"). */
const DEP_CARGO = { 6: "Deputado Federal", 7: "Deputado Estadual", 8: "Deputado Distrital" };
const dep = { cargo: 6, uf: "sp", q: "", view: "uf", data: {}, stamp: {}, visible: false, showAll: false };
const depFile = (cargo, uf) => `6259/dados/${uf}/${uf}-c${String(cargo).padStart(4, "0")}-e006259-u.json`;
const depPhoto = (uf, sq) => `${BASE}/6259/fotos/${uf}/${sq}.jpeg`;

function depResult(d, uf) {
  const c = d.carg[0], nv = +c.nv || 0, qe = +c.qe || 0;
  const all = [];
  for (const a of c.agr || []) for (const p of a.par || []) for (const x of p.cand || [])
    all.push({ ...x, partido: p.sg, lista: a.com || p.sg, fed: a.tp === "f", vag: +a.vag || 0, agrId: a.n, uf, vapN: +x.vap });
  const official = all.some(x => x.e === "s");
  const byAgr = {};
  all.forEach(x => (byAgr[x.agrId] = byAgr[x.agrId] || []).push(x));
  const seats = {}, next = [];
  for (const list of Object.values(byAgr)) {
    list.sort((p, q) => q.vapN - p.vapN);
    list.forEach((x, i) => x.posLista = i + 1);
    const valid = list.filter(x => !x.dvt || x.dvt.startsWith("Válido"));
    const vag = list[0].vag;
    const inn = new Set(valid.filter(x => x.vapN >= 0.1 * qe).slice(0, vag).map(x => x.sqcand));
    for (const x of list) {
      x.inside = official ? x.e === "s" : inn.has(x.sqcand);
      if (x.inside) seats[x.partido] = (seats[x.partido] || 0) + 1;
    }
    if (vag > 0) { const n1 = valid.find(x => !x.inside); if (n1) next.push(n1); }
  }
  all.sort((p, q) => q.vapN - p.vapN);
  all.forEach((x, i) => x.posUf = i + 1);
  const vv = +d.v.vv || 1;
  all.forEach(x => x.pct = x.vapN / vv * 100);
  const inside = all.filter(x => x.inside);
  return { d, nv, qe, official, all, inside, next: next.sort((p, q) => q.vapN - p.vapN), seats, pst: num(d.s.pstn), uf };
}

async function loadDep(force) {
  const key = `${dep.cargo}-${dep.uf}`;
  if (!force && dep.data[key] && Date.now() - (dep.stamp[key] || 0) < 60000) return renderDep();
  $("depBody").classList.add("loading");
  try { dep.data[key] = await getJSON(depFile(dep.cargo, dep.uf)); dep.stamp[key] = Date.now(); }
  catch (e) { $("depList").innerHTML = `<p class="cv-hint">${esc(e.message)}</p>`; }
  $("depBody").classList.remove("loading");
  renderDep();
}

function depControls() {
  const isDF = dep.uf === "df";
  if (isDF && dep.cargo === 7) dep.cargo = 8;
  if (!isDF && dep.cargo === 8) dep.cargo = 7;
  $("depTabs").innerHTML = [[6, "Federal"], [isDF ? 8 : 7, isDF ? "Distrital" : "Estadual"]]
    .map(([c, t]) => `<button data-c="${c}" aria-selected="${dep.cargo === c && dep.view === "uf"}">${t}</button>`).join("") +
    `<button data-c="br" aria-selected="${dep.view === "br"}">Mais votados do Brasil</button>`;
  $("depUf").innerHTML = UFS.map(([v, n]) => `<option value="${v}">${n}</option>`).join("");
  $("depUf").value = dep.uf;
  $("depUf").disabled = dep.view === "br";
}

function depTag(x) {
  if (x.e === "s") return `<span class="dtag ok">${esc(x.st || "Eleito")}</span>`;
  if (x.inside) return `<span class="dtag in">Entrando</span>`;
  if (x.st) return `<span class="dtag">${esc(x.st)}</span>`;                      // situação oficial (Suplente / Não eleito)
  if (x.dvt && !x.dvt.startsWith("Válido")) return `<span class="dtag sj">${esc(x.dvt)}</span>`;
  return x.vag > 0 ? `<span class="dtag">${x.posLista - x.vag}º suplente</span>` : `<span class="dtag">Fora</span>`;
}
function depCard(x, extra = "", rank = "") {
  return `<button class="dcard" data-sq="${x.sqcand}" data-uf="${x.uf}"${rank ? ` data-rank="${rank}"` : ""} style="--pc:${partyColor(x.partido)}">
    <span class="dph">${esc(initials(x.nmu))}<img src="${depPhoto(x.uf, x.sqcand)}" alt="" loading="lazy" onerror="this.remove()"></span>
    <span class="dnm"><b>${esc(title(x.nmu))}</b><em><i></i>${esc(x.partido)}${extra}</em></span>
    <span class="dvt"><b class="num">${fmt(x.vapN)}</b><em class="num">${pct(x.pct, 2)}</em>${depTag(x)}</span>
  </button>`;
}

/* filtros da lista: situação, partido, busca; paginação para listas grandes */
const DEP_SHOW = { in: "Entrando / eleitos", out: "Suplentes e não eleitos", all: "Todos os candidatos" };
const DEP_PAGE = 60;
Object.assign(dep, { show: "in", party: "", page: 1 });
function depFilter(list) {
  const q = norm(dep.q), qn = dep.q.trim();
  return list.filter(x =>
    (dep.show === "all" || (dep.show === "in" ? x.inside : !x.inside)) &&
    (!dep.party || x.partido === dep.party) &&
    (!q || norm(x.nmu).includes(q) || norm(x.nm).includes(q) || norm(x.partido).includes(q) || x.n === qn));
}
function depListBlock(all, titleTxt, extraFor) {
  const parties = [...new Set(all.map(x => x.partido))].sort((a, b) => a.localeCompare(b));
  if (dep.party && !parties.includes(dep.party)) dep.party = "";
  const list = depFilter(all), shown = list.slice(0, dep.page * DEP_PAGE);
  return `<div class="dfil">
      <div class="seg" id="depShow">${Object.entries(DEP_SHOW).map(([k, t]) => `<button data-s="${k}" aria-selected="${dep.show === k}">${t}</button>`).join("")}</div>
      <div class="sel"><select id="depParty" aria-label="Partido"><option value="">Todos os partidos</option>${parties.map(sg => `<option value="${esc(sg)}"${dep.party === sg ? " selected" : ""}>${esc(sg)}</option>`).join("")}</select></div>
    </div>
    <h3 class="pt-h">${titleTxt} <span class="cv-hint">(${fmt(list.length)})</span></h3>
    <div class="dgrid ${dep.view === "br" ? "rank" : ""}">${shown.map(x => depCard(x, extraFor ? extraFor(x) : "", x.rankBr ? `${x.rankBr}º` : "")).join("") || `<p class="cv-hint">Nenhum candidato com esses filtros.</p>`}</div>
    ${list.length > shown.length ? `<button class="more" id="depMore">Carregar mais (${fmt(list.length - shown.length)} restantes)</button>` : ""}`;
}

const dep_isOfficial = x => x.e === "s";

function renderDep() {
  depControls();
  if (dep.view === "br") return renderDepBrasil();
  const raw = dep.data[`${dep.cargo}-${dep.uf}`];
  if (!raw) { $("depList").innerHTML = `<div class="skel"></div><div class="skel"></div>`; return; }
  const R = depResult(raw, dep.uf);
  dep.last = R;
  const parties = Object.entries(R.seats).sort((a, b) => b[1] - a[1]);
  $("depKpis").innerHTML =
    `<div class="pk"><div class="l">Vagas</div><div class="v"><b class="num">${R.nv}</b></div><div class="s">${DEP_CARGO[dep.cargo]} · ${esc(UFNAME[dep.uf])}</div></div>` +
    `<div class="pk"><div class="l">Urnas apuradas</div><div class="v"><b class="num">${p1(R.pst)}</b></div><div class="s">${R.official ? "resultado oficial do TSE" : "distribuição parcial de vagas"}</div></div>` +
    `<div class="pk"><div class="l">Quociente eleitoral</div><div class="v"><b class="num">${R.qe ? fmt(R.qe) : "–"}</b></div><div class="s">votos válidos ÷ vagas</div></div>` +
    `<div class="pk" style="--pc:${parties[0] ? partyColor(parties[0][0]) : "var(--line)"}"><div class="l">Maior bancada</div><div class="v">${parties[0] ? `<i></i>${esc(parties[0][0])} <b class="num">${parties[0][1]}</b>` : "–"}</div><div class="s">${parties.length} partidos com cadeiras · ${fmt(R.all.length)} candidatos</div></div>`;
  const H = hemicycle(R.nv || 1, Math.max(2, Math.round(Math.sqrt(R.nv) * 0.58)));
  const cols = []; parties.forEach(([sg, n]) => { for (let i = 0; i < n; i++) cols.push(sg); });
  const S = 200;
  $("depHemi").innerHTML = H.pts.map((p, i) => `<circle cx="${(S + p.x * S).toFixed(1)}" cy="${(S - p.y * S + 6).toFixed(1)}" r="${(H.dot * S).toFixed(2)}" fill="${cols[i] ? partyColor(cols[i]) : "var(--land)"}"/>`).join("") +
    `<text x="${S}" y="${S - 10}" text-anchor="middle" style="font:700 34px 'Space Grotesk',sans-serif;fill:var(--text)">${R.inside.length}</text><text x="${S}" y="${S + 6}" text-anchor="middle" style="font:500 11px Inter,sans-serif;fill:var(--muted)">de ${R.nv} cadeiras</text>`;
  $("depLeg").innerHTML = parties.map(([sg, n]) => `<button class="pchip ${dep.party === sg ? "on" : ""}" data-p="${esc(sg)}"><i style="background:${partyColor(sg)}"></i>${esc(sg)} <b class="num">${n}</b></button>`).join("");
  const titleTxt = dep.show === "in" ? (R.official ? "Eleitos" : "Quem está entrando agora") : dep.show === "out" ? "Suplentes e não eleitos" : "Todos os candidatos";
  const lastIn = [...R.inside].sort((a, b) => a.vapN - b.vapN).slice(0, 3);
  const edge = dep.show === "in" && !dep.q && !dep.party && R.inside.length;
  $("depList").innerHTML = depListBlock(R.all, titleTxt, x => !x.inside && x.vag > 0 ? ` · ${x.posLista}º da lista` : "") +
    (edge ? `<div class="dedge">
      <div><h4>Na beirada: últimos a entrar</h4>${lastIn.map(x => depCard(x)).join("")}</div>
      <div><h4>Primeiros da fila (suplentes)</h4>${R.next.slice(0, 3).map(x => depCard(x, ` · ${x.posLista}º da lista`)).join("") || `<p class="cv-hint">—</p>`}</div>
    </div>` : "") +
    `<p class="feednote">${R.official ? "Situação oficial do TSE." : `Vagas por partido/federação: distribuição atual calculada pelo TSE. Dentro de cada lista, entram os mais votados com pelo menos 10% do quociente eleitoral (${fmt(Math.ceil(R.qe * 0.1))} votos). Muda até o fim da apuração.`}</p>`;
}

function renderDepBrasil() {
  const data = typeof pt !== "undefined" ? pt.data[6] : {};
  const ufs = Object.keys(data || {});
  $("depKpis").innerHTML = "";
  $("depHemi").innerHTML = ""; $("depLeg").innerHTML = "";
  if (ufs.length < 27 && pt.res6 && pt.res6.top && !pt.full) {
    // resumo do servidor: todos os que estão entrando + os 600 mais votados
    const all = pt.res6.top.map(x => ({ ...x }));
    const partial = dep.show !== "in";
    $("depList").innerHTML = depListBlock(all, dep.show === "in" ? "Deputados federais entrando, por votos" : dep.show === "out" ? "Suplentes e não eleitos mais votados do Brasil" : "Candidatos a deputado federal mais votados do Brasil", x => ` · ${x.uf.toUpperCase()}`) +
      (partial ? `<p class="feednote">Mostrando os 600 mais votados do Brasil (de ${fmt(pt.res6.total)} candidatos). <button class="linkbtn" id="depFull">Carregar a lista completa</button> (baixa os 27 estados, ~6 MB).</p>` : "") +
      `<p class="feednote">Ranking nacional por votos nominais, com a apuração atual de cada estado.</p>`;
    if ($("depFull")) $("depFull").onclick = () => { pt.full = true; pt.stamp = 0; dep.brWait = false; renderDep(); };
    return;
  }
  if (ufs.length < 27) {
    $("depList").innerHTML = `<p class="cv-hint">Carregando os 27 estados…</p>`;
    // sem encadear renderDep direto (evita ciclo enquanto outra carga está em andamento): tenta de novo em 1,5 s
    if (!dep.brWait) {
      dep.brWait = true;
      if (typeof loadParties === "function" && !pt.loading) loadParties(true);
      setTimeout(() => { dep.brWait = false; if (dep.view === "br") renderDep(); }, 1500);
    }
    return;
  }
  const all = ufs.flatMap(uf => depResult(data[uf], uf).all);
  all.sort((a, b) => b.vapN - a.vapN);
  all.forEach((x, i) => x.rankBr = i + 1);
  const titleTxt = dep.show === "in" ? "Deputados federais entrando, por votos" : dep.show === "out" ? "Suplentes e não eleitos mais votados do Brasil" : "Todos os candidatos a deputado federal do Brasil";
  $("depList").innerHTML = depListBlock(all, titleTxt, x => ` · ${x.uf.toUpperCase()}`) +
    `<p class="feednote">Ranking nacional por votos nominais, com a apuração atual de cada estado. O número à esquerda é a posição entre todos os ${fmt(all.length)} candidatos.</p>`;
}

/* perfil rápido do deputado */
function openDep(sq, uf) {
  let x = null, R = null;
  if (dep.view === "br") {
    if (!pt.data[6][uf]) { getJSON(depFile(6, uf)).then(d => { pt.data[6][uf] = d; openDep(sq, uf); }).catch(() => {}); return; }
    R = depResult(pt.data[6][uf], uf); x = R.all.find(y => y.sqcand === sq);
  }
  else { R = dep.last; x = R && R.all.find(y => y.sqcand === sq); }
  if (!x) return;
  const lastIn = [...R.inside].sort((a, b) => a.vapN - b.vapN)[0];
  const sameList = R.all.filter(y => y.agrId === x.agrId);
  const status = x.e === "s" ? `✓ ${x.st || "Eleito"} (oficial)` : x.inside ? "Entrando com a apuração atual" : x.st ? x.st : "Fora das vagas no momento";
  $("depModal").innerHTML = `<div class="dm-card" style="--pc:${partyColor(x.partido)}">
    <button class="dm-x" aria-label="Fechar">×</button>
    <div class="dm-top"><span class="dm-ph">${esc(initials(x.nmu))}<img src="${depPhoto(uf, x.sqcand)}" alt="" onerror="this.remove()"></span>
      <div><div class="cv-k">${DEP_CARGO[R.d.carg[0].cd] || "Deputado"} · ${esc(UFNAME[uf])} · nº ${esc(x.n)}</div><h3>${esc(title(x.nmu))}</h3><div class="cv-meta">${esc(title(x.nm))}</div>
      <div class="cv-meta"><b style="color:var(--pc)">${esc(x.partido)}</b>${x.fed ? ` · federação ${esc(x.lista)}` : ""}</div></div></div>
    <div class="dm-num"><b class="num">${fmt(x.vapN)}</b> votos · <span class="num">${pct(x.pct, 2)}</span> dos válidos</div>
    <div class="dm-st ${x.inside ? "in" : ""}">${esc(status)}</div>
    <div class="dm-grid">
      <div><span>Posição no estado</span><b class="num">${x.posUf}º</b></div>
      <div><span>Posição na lista</span><b class="num">${x.posLista}º de ${sameList.length}</b></div>
      <div><span>Vagas da lista</span><b class="num">${x.vag}</b></div>
      <div><span>${x.inside ? "Folga sobre o último a entrar" : "Último a entrar teve"}</span><b class="num">${lastIn ? (x.inside ? fmt(x.vapN - lastIn.vapN) : fmt(lastIn.vapN)) : "–"}</b></div>
    </div>
    <p class="feednote">${pct(R.pst, 1)} das urnas apuradas em ${esc(UFNAME[uf])}.</p>
  </div>`;
  $("depModal").hidden = false;
  $("depModal").querySelector(".dm-x").onclick = () => $("depModal").hidden = true;
}

/* análises para o "Meu analista" (federal, todos os estados) */
function depInsights(out) {
  const data = typeof pt !== "undefined" ? pt.data[6] : null;
  let all;
  if (data && Object.keys(data).length === 27) all = Object.keys(data).flatMap(uf => depResult(data[uf], uf).all).sort((a, b) => b.vapN - a.vapN);
  else if (pt.res6 && pt.res6.top) all = pt.res6.top;
  else return;
  const t = all[0]; if (!t || !t.vapN) return;
  out.push({ cat: "camara", tag: "Deputados", score: 57, col: partyColor(t.partido),
    title: `${title(t.nmu)} (${t.partido}-${t.uf.toUpperCase()}) é o deputado federal mais votado do Brasil até agora`,
    body: `${title(t.nmu)} tem ${fmt(t.vapN)} votos (${pct(t.pct, 1)} dos válidos em ${UFNAME[t.uf]}). Em seguida: ${all.slice(1, 4).map(x => `${title(x.nmu)} (${x.partido}-${x.uf.toUpperCase()}, ${fmt(x.vapN)})`).join(", ")}.` });
}

/* eventos */
(function initDep() {
  if (UFNAME[state.uf]) dep.uf = state.uf;
  $("depTabs").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    dep.page = 1;
    if (b.dataset.c === "br") { dep.view = "br"; renderDep(); return; }
    dep.view = "uf"; dep.cargo = +b.dataset.c; loadDep();
  });
  $("depUf").onchange = e => { dep.uf = e.target.value; dep.page = 1; loadDep(); };
  $("depQ").addEventListener("input", e => { dep.q = e.target.value; dep.page = 1; renderDep(); });
  $("depList").addEventListener("click", e => {
    const c = e.target.closest(".dcard"); if (c) return openDep(c.dataset.sq, c.dataset.uf);
    const sb = e.target.closest("#depShow button"); if (sb) { dep.show = sb.dataset.s; dep.page = 1; return renderDep(); }
    if (e.target.closest("#depMore")) { dep.page++; renderDep(); }
  });
  $("depList").addEventListener("change", e => { if (e.target.id === "depParty") { dep.party = e.target.value; dep.page = 1; renderDep(); } });
  $("depLeg").addEventListener("click", e => { const b = e.target.closest(".pchip"); if (b) { dep.party = dep.party === b.dataset.p ? "" : b.dataset.p; dep.page = 1; dep.show = "in"; renderDep(); } });
  $("depModal").addEventListener("click", e => { if (e.target === $("depModal")) $("depModal").hidden = true; });
  addEventListener("keydown", e => { if (e.key === "Escape") $("depModal").hidden = true; });
  new IntersectionObserver(es => { dep.visible = es[0].isIntersecting; if (dep.visible) loadDep(); }, { rootMargin: "300px" }).observe($("deputados"));
  // reserva: confere pela rolagem (alguns navegadores não disparam o observador)
  const near = () => { const r = $("deputados").getBoundingClientRect(); return r.top < innerHeight + 300 && r.bottom > -300; };
  let t = null;
  addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(() => { if (near() && !dep.data[`${dep.cargo}-${dep.uf}`]) { dep.visible = true; loadDep(); } }, 150); }, { passive: true });
  dep.visible = near(); if (dep.visible) loadDep();
  setInterval(() => { if (dep.visible && state.auto && !document.hidden && dep.view === "uf") loadDep(); }, 30000);
  depControls();
})();
