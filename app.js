/* Central das Eleições 2026 — dados oficiais do TSE, sem dependências. */
// Na Netlify os dados passam pelo intermediário com cache (/api/tse); em outros lugares, direto do TSE.
const USE_PROXY = !/^(localhost|127\.0\.0\.1|\[::1\])$|github\.io$/.test(location.hostname) && location.protocol === "https:";
const BASE = USE_PROXY ? "/api/tse/oficial/ele2026" : "https://resultados.tse.jus.br/oficial/ele2026";
const ELE = { 1: "6257", 3: "6259", 5: "6259" };
const CARGO = { 1: "Presidente", 3: "Governador", 5: "Senador" };
const REFRESH = 30, MAP_REFRESH = 60;
const POLLS_CLOSE = 17 * 60;   // 17h de Brasília, em minutos
const UFS = [["ac","Acre"],["al","Alagoas"],["ap","Amapá"],["am","Amazonas"],["ba","Bahia"],["ce","Ceará"],["df","Distrito Federal"],["es","Espírito Santo"],["go","Goiás"],["ma","Maranhão"],["mt","Mato Grosso"],["ms","Mato Grosso do Sul"],["mg","Minas Gerais"],["pa","Pará"],["pb","Paraíba"],["pr","Paraná"],["pe","Pernambuco"],["pi","Piauí"],["rj","Rio de Janeiro"],["rn","Rio Grande do Norte"],["rs","Rio Grande do Sul"],["ro","Rondônia"],["rr","Roraima"],["sc","Santa Catarina"],["sp","São Paulo"],["se","Sergipe"],["to","Tocantins"]];
const UFNAME = Object.fromEntries(UFS);
const REGIOES = { "Norte": ["ac","am","ap","pa","ro","rr","to"], "Nordeste": ["al","ba","ce","ma","pb","pe","pi","rn","se"], "Centro-Oeste": ["df","go","ms","mt"], "Sudeste": ["es","mg","rj","sp"], "Sul": ["pr","rs","sc"] };
const BIG_UFS = ["sp","mg","rj","ba","pr","rs","pe"];
/* cor fixa por partido: o mesmo partido tem sempre a mesma cor em todo o site */
const PARTY_COLORS = {
  "PL": "#1d4ed8", "PT": "#b5121b", "UNIÃO": "#0096c7", "PP": "#4ea8de", "PSD": "#f4a300", "REPUBLICANOS": "#5a189a",
  "MDB": "#2b9348", "PSB": "#f77f00", "PDT": "#ad1457", "PODE": "#43aa8b", "PSDB": "#3a86ff", "PSOL": "#ffbe0b",
  "NOVO": "#fb5607", "AVANTE": "#06d6a0", "SOLIDARIEDADE": "#ff8fab", "PRD": "#8d99ae", "CIDADANIA": "#ff006e",
  "PCDOB": "#800f2f", "PC do B": "#800f2f", "PV": "#70e000", "REDE": "#2ec4b6", "MISSÃO": "#b5179e", "AGIR": "#6c757d",
  "DC": "#a47148", "PMB": "#c9184a", "PCO": "#6a040f", "PSTU": "#9d0208", "UP": "#dc2f02", "DEMOCRATA": "#577590",
  "PRTB": "#3d5a80", "MOBILIZA": "#bc6c25",
};
const partyColor = sg => PARTY_COLORS[sg] || PARTY_COLORS[String(sg).toUpperCase()] || `hsl(${[...String(sg)].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 360} 25% 55%)`;
const PALETTE = ["--c1","--c2","--c3","--c4","--c5","--c6","--c7","--c8","--c9","--c10"];
const TIGHT = 2;               // vantagem (p.p.) abaixo da qual é "disputa acirrada"
const CALLOUT = { rn:[985,250], pb:[985,284], pe:[985,318], al:[985,352], se:[985,386], es:[880,612], rj:[835,728], df:[690,470] };
const LABEL_FIX = { go:[570,545] };

const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString("pt-BR");
const num = s => parseFloat(String(s).replace(",", "."));
const pct = (p, d = 2) => Number(p).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const title = s => String(s).toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, w => w.toLowerCase());
const initials = s => String(s).split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("");
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const mins = hg => { const [h, m] = String(hg).split(":").map(Number); return h * 60 + m; };
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const big = n => n >= 1e6 ? (n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " milhões" : n >= 1e3 ? Math.round(n / 1e3).toLocaleString("pt-BR") + " mil" : fmt(n);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let state = { cargo: 1, uf: "br", showAll: false, auto: true, view: "map", zoom: 1, center: null };
let colorOf = {};
let last = null, natList = null, prevVotes = {}, countdown = REFRESH, loading = false;
let mapData = {}, mapStamp = 0, mapCargo = null;

/* ================= dados ================= */
async function getJSON(path) {
  // com o intermediário, o navegador confere com o CDN e recebe 304 (sem baixar nada) quando o arquivo não mudou
  const r = USE_PROXY ? await fetch(`${BASE}/${path}`, { cache: "no-cache" })
                      : await fetch(`${BASE}/${path}?t=${Math.floor(Date.now() / 10000)}`);
  if (!r.ok) throw new Error(r.status === 404 ? "O TSE ainda não publicou dados para esta seleção." : `O TSE respondeu ${r.status}.`);
  return r.json();
}
const fileFor = (cargo, uf) => `${ELE[cargo]}/dados/${uf}/${uf}-c${String(cargo).padStart(4,"0")}-e${ELE[cargo].padStart(6,"0")}-u.json`;
const photo = (cargo, uf, sq) => `${BASE}/${ELE[cargo]}/fotos/${cargo === 1 ? "br" : uf}/${sq}.jpeg`;

function candidatos(d) {
  const out = [];
  for (const a of d.carg[0].agr || []) for (const p of a.par || []) for (const x of p.cand || [])
    out.push({ ...x, partido: p.sg, colig: a.tp === "c" ? a.nm : "", vice: (x.vs || []).find(v => v.tp === "v") });
  return out.sort((a, b) => b.vap - a.vap);
}
function colorVar(c) {
  const k = c.partido;
  if (!colorOf[k]) {
    const v = "--pc-" + String(k).normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    document.documentElement.style.setProperty(v, partyColor(k));
    const defs = document.querySelector("#map defs");
    if (defs && !document.getElementById("t" + v)) defs.insertAdjacentHTML("beforeend", stripe(v));
    colorOf[k] = v;
  }
  return colorOf[k];
}
/* compatibilidade: navegadores sem color-mix (ex.: iPhone com iOS < 16.2) usam opacidade */
const CM = !!(window.CSS && CSS.supports && CSS.supports("color", "color-mix(in srgb, red 50%, blue)"));
const mix = (color, p) => CM ? `color-mix(in srgb, ${color} ${p}%, var(--land))` : color;
function setFill(el, fill, p = 100) {
  if (p >= 100 || CM) { el.style.fill = p >= 100 ? fill : `color-mix(in srgb, ${fill} ${Math.round(p)}%, var(--land))`; el.style.fillOpacity = ""; }
  else { el.style.fill = fill; el.style.fillOpacity = (0.2 + 0.8 * p / 100).toFixed(2); }
}
const stripe = v => `<pattern id="t${v}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" ${CM ? `fill="color-mix(in srgb, var(${v}) 35%, var(--land))"` : `fill="var(${v})" fill-opacity=".35"`}/><rect width="4" height="9" fill="var(${v})"/></pattern>`;
const colorFor = c => `var(${colorVar(c)})`;
const place = () => state.uf === "br" ? "Brasil" : REGKEY[state.uf] || UFNAME[state.uf];

/* ================= histórico local (variação e evolução) ================= */
const histKey = () => `h26-${state.cargo}-${state.uf}`;
/* histórico guardado no servidor (igual para todos os visitantes), mesclado com o local */
const histSynced = {};
async function syncHist() {
  const key = `${state.cargo}-${state.uf}`;
  if (!USE_PROXY || !/^[135]-(br|[a-z]{2})$/.test(key) || Date.now() - (histSynced[key] || 0) < 60000) return;
  histSynced[key] = Date.now();
  try {
    const r = await fetch(`/api/hist/${key}`, { cache: "no-cache" });
    if (!r.ok) return;
    const server = await r.json(), local = store.get(histKey(), []);
    const byHg = new Map([...server, ...local].map(p => [p.hg, p]));
    const merged = [...byHg.values()].sort((a, b) => a.m - b.m || (a.hg < b.hg ? -1 : 1));
    while (merged.length > 600) merged.shift();
    store.set(histKey(), merged);
  } catch {}
}
function pushHist(d, list) {
  const h = store.get(histKey(), []);
  if (h.length && h[h.length - 1].hg === d.hg) return h;
  h.push({ hg: d.hg, m: mins(d.hg), pst: num(d.s.pstn), c: Object.fromEntries(list.slice(0, 12).map(c => [c.sqcand, num(c.pvapn)])) });
  while (h.length > 400) h.shift();
  store.set(histKey(), h);
  return h;
}
function baseline(h) {
  if (h.length < 2) return null;
  const now = h[h.length - 1].m;
  let b = null;
  for (const s of h) { if (s.m <= now - 15) b = s; }
  return b || h[0];
}

/* ================= KPIs ================= */
function renderKPIs(d) {
  const s = d.s, e = d.e, v = d.v;
  const set = (id, val, w, sub) => { $(id).textContent = val; $(id + "b").style.width = w + "%"; $(id + "s").textContent = sub; };
  set("k1", pct(num(s.pstn)), num(s.pstn), `${fmt(s.st)} de ${fmt(s.ts)} seções`);
  set("k2", pct(num(e.pcn)), num(e.pcn), `${fmt(e.c)} de ${fmt(e.est)} eleitores`);
  set("k3", pct(num(v.pvvcn)), num(v.pvvcn), `${fmt(v.vv)} votos`);
  set("k4", pct(num(e.pan)), num(e.pan), `${fmt(e.a)} eleitores`);
  $("hg").textContent = d.hg.slice(0, 5);
  $("eyebrow").textContent = `Eleições 2026 · 1º turno · ${place()}`;
}

/* ================= resultado ================= */
function renderResults(d, list) {
  const cargo = state.cargo, vagas = +d.carg[0].nv || 1;
  $("resTitle").textContent = state.uf === "br" ? "Resultado nacional" : `Resultado · ${place()}`;
  const hist = pushHist(d, list), base = baseline(hist);
  const limit = state.showAll ? list.length : 5;
  const html = list.slice(0, limit).map((c, i) => {
    const p = num(c.pvapn);
    let tag = "";
    if (c.e === "s") tag = `<span class="tag win">Eleito</span>`;
    else if (c.st) tag = `<span class="tag lead">${esc(c.st)}</span>`;
    else if (i < vagas && +c.vap > 0) tag = `<span class="tag lead">${vagas > 1 ? "Na vaga" : "Lidera"}</span>`;
    if (c.dvt && c.dvt !== "Válido") tag += `<span class="tag sj">${esc(c.dvt)}</span>`;
    let dl = "";
    if (base && base.c[c.sqcand] !== undefined) {
      const dd = p - base.c[c.sqcand];
      const cls = Math.abs(dd) < 0.05 ? "eq" : dd > 0 ? "up" : "down";
      const arrow = cls === "up" ? "▲" : cls === "down" ? "▼" : "•";
      dl = `<div class="dl ${cls} num" title="Variação desde ${base.hg.slice(0,5)}">${arrow} ${dd > 0 ? "+" : ""}${dd.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})} p.p.</div>`;
    }
    const changed = prevVotes[c.sqcand] !== undefined && prevVotes[c.sqcand] !== c.vap;
    const meta = [c.partido, c.colig && title(c.colig), c.vice && `vice ${title(c.vice.nmu)}`].filter(Boolean).map(esc).join(" · ");
    return `<div class="cand ${changed ? "flash" : ""}" data-sq="${c.sqcand}" style="--col:${colorFor(c)}">
      <div class="photo">${esc(initials(c.nmu))}<img src="${photo(cargo, state.uf, c.sqcand)}" alt="" loading="lazy" onerror="this.remove()"></div>
      <div style="min-width:0"><div class="nm">${esc(title(c.nmu))} ${tag}</div><div class="meta">${c.n} · ${meta}</div></div>
      <div><div class="p num">${pct(p)}</div><div class="v num">${fmt(c.vap)} votos</div></div>
      <div class="bar"><div style="width:${p}%"></div>${cargo !== 5 ? '<span class="half" title="50%"></span>' : ""}</div>
      ${dl || "<div></div>"}
    </div>`;
  }).join("");
  const more = list.length > 5 ? `<button class="more" id="more">${state.showAll ? "Mostrar menos" : `Ver todos os ${list.length} candidatos`}</button>` : "";
  $("cands").innerHTML = html + more;
  if (more) $("more").onclick = () => { state.showAll = !state.showAll; renderResults(d, list); };
  prevVotes = Object.fromEntries(list.map(c => [c.sqcand, c.vap]));
  renderEvolution(hist);
}

/* ================= evolução (gráfico de linha) ================= */
function renderEvolution(hist) {
  const W = 360, H = 190, L = 36, R = 12, T = 30, B = 24;
  const pts = [{ m: POLLS_CLOSE, pst: 0 }, ...hist.filter(h => h.m >= POLLS_CLOSE)];
  const lastM = pts[pts.length - 1].m;
  const x0 = POLLS_CLOSE, x1 = Math.max(x0 + 300, Math.ceil((lastM + 30) / 60) * 60);
  const X = m => L + (m - x0) / (x1 - x0) * (W - L - R);
  const Y = p => T + (1 - p / 100) * (H - T - B);
  let g = `<defs><linearGradient id="evoG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".3"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><g class="grid">`;
  for (const p of [0, 25, 50, 75, 100]) g += `<line x1="${L}" x2="${W - R}" y1="${Y(p)}" y2="${Y(p)}"/><text x="${L - 6}" y="${Y(p) + 4}" text-anchor="end">${p}%</text>`;
  for (let m = x0; m <= x1; m += 60) g += `<text x="${X(m)}" y="${H - 6}" text-anchor="middle">${m / 60}h</text>`;
  g += `</g>`;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(p.m).toFixed(1)},${Y(p.pst).toFixed(1)}`).join("");
  g += `<path d="${line}L${X(lastM)},${Y(0)}L${X(x0)},${Y(0)}Z" fill="url(#evoG)"/>`;
  g += `<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`;
  const step = Math.max(1, Math.floor(pts.length / 8));
  pts.forEach((p, i) => { if (i % step === 0 || i === pts.length - 1) g += `<circle cx="${X(p.m)}" cy="${Y(p.pst)}" r="3.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.5"/>`; });
  const lp = pts[pts.length - 1];
  if (lp.pst > 0) {
    const tx = Math.min(Math.max(X(lp.m), L + 34), W - R - 34), ty = Math.max(Y(lp.pst) - 34, 2);
    g += `<g><rect x="${tx - 34}" y="${ty}" width="68" height="26" rx="6" fill="var(--navy)"/><text x="${tx}" y="${ty + 12}" text-anchor="middle" style="fill:#fff;font-weight:700;font-size:11.5px">${pct(lp.pst)}</text><text x="${tx}" y="${ty + 22}" text-anchor="middle" style="fill:#b8c4dc;font-size:9px">às ${hhmm(lp.m)}</text></g>`;
  }
  $("evo").innerHTML = g;
}

/* ================= donut ================= */
function renderDonut(d, list) {
  const top = list.slice(0, 5), vv = +d.v.vv || 1;
  const rest = list.slice(5).reduce((s, c) => s + +c.vap, 0);
  const segs = top.map(c => ({ n: c.isParty ? c.nmu : title(c.nmu), v: +c.vap, col: colorFor(c), p: num(c.pvapn) }));
  if (rest > 0) segs.push({ n: "Outros", v: rest, col: "var(--c10)", p: rest / vv * 100 });
  const R = 52, C = 2 * Math.PI * R;
  let off = 0, arcs = "";
  for (const s of segs) {
    const len = s.v / vv * C;
    arcs += `<circle cx="75" cy="75" r="${R}" fill="none" stroke="${s.col}" stroke-width="22" stroke-dasharray="${Math.max(0, len - 1.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 75 75)"/>`;
    off += len;
  }
  const [n, unit] = big(+d.v.vv).split(" ");
  $("donut").innerHTML = `<svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="22"/>${arcs}
      <text x="75" y="74" text-anchor="middle" style="font:700 22px 'Space Grotesk',sans-serif;fill:var(--text)">${n}</text>
      <text x="75" y="90" text-anchor="middle" style="font:500 10px Inter,sans-serif;fill:var(--muted)">${unit ? unit + " de votos" : "votos"}</text></svg>
    <div class="dleg">${segs.map(s => `<span><i style="background:${s.col}"></i><em>${esc(s.n)}</em><b class="num">${pct(s.p)}</b></span>`).join("")}</div>`;
}

/* ================= mapa (malha IBGE) ================= */
function buildMap() {
  const svg = $("map");
  let defs = "", shapes = "", labels = "", callouts = "";
  for (const v of [...PALETTE, ...Object.values(colorOf)]) defs += stripe(v);
  for (const [uf, d] of Object.entries(BR_MAP.paths)) shapes += `<path class="st" data-uf="${uf}" d="${d}" fill="var(--land)"/>`;
  for (const [uf, [x, y]] of Object.entries(BR_MAP.labels)) {
    if (CALLOUT[uf]) {
      const [tx, ty] = CALLOUT[uf];
      callouts += `<g class="co"><line x1="${x}" y1="${y}" x2="${tx - 6}" y2="${ty - 5}"/><circle cx="${x}" cy="${y}" r="2.5"/><text x="${tx}" y="${ty}" data-uf="${uf}">${uf.toUpperCase()} <tspan class="p" id="cp-${uf}"></tspan></text></g>`;
    } else {
      const [lx, ly] = LABEL_FIX[uf] || [x, y];
      labels += `<g class="lb dark" id="lb-${uf}"><text x="${lx}" y="${ly}"><tspan class="u" x="${lx}">${uf.toUpperCase()}</tspan><tspan class="p" x="${lx}" dy="1.15em" id="lp-${uf}"></tspan></text></g>`;
    }
  }
  svg.innerHTML = `<defs>${defs}</defs><g id="shapes">${shapes}</g><g>${callouts}</g><g>${labels}</g>`;
  applyZoom();
}

const FULL = { x: 0, y: -6, w: 1060, h: 1002 };
function applyZoom() {
  const z = state.zoom, w = FULL.w / z, h = FULL.h / z;
  let [cx, cy] = state.center || [FULL.w / 2, FULL.h / 2 - 6];
  const x = Math.min(Math.max(cx - w / 2, FULL.x), FULL.x + FULL.w - w);
  const y = Math.min(Math.max(cy - h / 2, FULL.y), FULL.y + FULL.h - h);
  state.center = [x + w / 2, y + h / 2];
  $("map").setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  $("map").style.setProperty("--z", z);
}
function zoomBy(f) {
  const nz = Math.min(4, Math.max(1, state.zoom * f));
  if (nz > state.zoom && state.zoom === 1 && state.uf !== "br") state.center = BR_MAP.labels[state.uf].slice(0, 2);
  state.zoom = nz;
  if (nz === 1) state.center = null;
  applyZoom();
}

async function loadStates(force) {
  const cargo = state.cargo;
  if (mapCargo !== cargo) { mapData = {}; mapCargo = cargo; force = true; paintStates(); }
  if (!force && Date.now() - mapStamp < MAP_REFRESH * 1000) return paintStates();
  mapStamp = Date.now();
  const res = await Promise.allSettled(UFS.map(([uf]) => getJSON(fileFor(cargo, uf)).then(d => [uf, d])));
  if (cargo !== state.cargo) return;
  const prev = { ...mapData };
  res.forEach(r => { if (r.status === "fulfilled") mapData[r.value[0]] = r.value[1]; });
  if (cargo === 1) { try { zzData = await getJSON(fileFor(1, "zz")); } catch {} }
  feedFromStates(prev, mapData);
  paintStates();
  updateProjection();
  if (state.focus) renderCandView();
  // se os estados já estão mais novos que o arquivo nacional, refaz o placar com a soma
  if (cargo === 1 && state.uf === "br" && last && !last.synthetic) {
    const agg = nationalFromStates(mapData, zzData);
    if (agg && stamp(agg) > stamp(last)) load();
  }
}

function stateInfo(uf) {
  const d = mapData[uf];
  if (!d) return null;
  const list = candidatos(d), top = list[0], second = list[1];
  const has = top && +top.vap > 0;
  return { d, list, top, second, has, p: has ? num(top.pvapn) : 0, margin: has ? num(top.pvapn) - (second ? num(second.pvapn) : 0) : 0, pst: num(d.s.pstn) };
}

function paintStates() {
  const lead = {};
  let tight = 0, none = 0;
  for (const [uf] of UFS) {
    const path = document.querySelector(`#map path[data-uf="${uf}"]`);
    const s = stateInfo(uf);
    let fill = "var(--land)", fillP = 100, txt = "";
    const inScope = !isRegion(state.uf) || regionUfs(state.uf).includes(uf);
    if (s && s.has && inScope) {
      const v = colorVar(s.top);
      if (s.margin < TIGHT && s.second) { fill = `url(#t${v})`; tight++; }
      else { fill = `var(${v})`; fillP = Math.min(100, 45 + s.margin * 2.2); }
      txt = Math.round(s.p) + "%";
      const k = s.top.partido;
      lead[k] = lead[k] || { n: 0, nome: state.cargo === 1 ? title(s.top.nmu) : k, col: colorFor(s.top) };
      lead[k].n++;
    } else if (inScope) { none++; if (s) txt = "0%"; }
    setFill(path, fill, fillP); path.classList.toggle("dim", isRegion(state.uf) && !regionUfs(state.uf).includes(uf));
    path.classList.toggle("sel", state.uf === uf);
    const lp = $("lp-" + uf), cp = $("cp-" + uf), lb = $("lb-" + uf);
    if (lp) lp.textContent = txt;
    if (cp) cp.textContent = txt;
    if (lb) lb.classList.toggle("dark", !(s && s.has));
  }
  const sel = document.querySelector("#map path.sel");
  if (sel) sel.parentNode.appendChild(sel);
  const items = Object.values(lead).sort((a, b) => b.n - a.n);
  $("legTitle").textContent = state.cargo === 1 ? "Quem lidera em cada estado" : "Partido à frente";
  $("legend").innerHTML = items.map(x => `<span><i style="background:${x.col}"></i>${esc(x.nome)}<em>${x.n}</em></span>`).join("") +
    `<span><i class="tight"></i>Disputa acirrada<em>${tight}</em></span>` +
    `<span><i style="background:var(--land)"></i>Sem resultado<em>${none}</em></span>`;
  renderRegions();
  renderStateTable();
  if (mapMode === "proj") paintProjection();
  updateWonBtn();
  if (state.decidedOnly) paintDecided();
  if (typeof renderRegionCards === "function") renderRegionCards();
}

function showTip(uf, x, y) {
  const s = stateInfo(uf), tip = $("tip");
  if (!s) { tip.style.opacity = 0; return; }
  tip.innerHTML = `<h4>${esc(UFNAME[uf])}</h4><div class="s">${pct(s.pst)} das urnas apuradas${s.has && s.margin < TIGHT && s.second ? " · disputa acirrada" : ""}</div>` +
    s.list.slice(0, 3).map(c => `<div class="r" style="--col:${colorFor(c)}"><span>${esc(title(c.nmu))}</span><b class="num">${c.pvap}%</b><div class="b"><div style="width:${num(c.pvapn)}%"></div></div></div>`).join("");
  tip.style.opacity = 1;
  tip.style.left = Math.min(x + 16, innerWidth - 266) + "px";
  tip.style.top = Math.min(y + 16, innerHeight - tip.offsetHeight - 10) + "px";
}

/* ================= regiões ================= */
function renderRegions() {
  const rows = Object.entries(REGIOES).map(([nome, ufs]) => {
    let c = 0, est = 0;
    for (const uf of ufs) { const d = mapData[uf]; if (d) { c += +d.e.c; est += +d.e.est; } }
    return { nome, p: est ? c / est * 100 : null };
  });
  const max = Math.max(...rows.map(r => r.p || 0));
  $("regions").innerHTML = rows.map((r, i) => `<div class="rg" style="--k:var(${PALETTE[[0, 1, 6, 2, 3][i]]})">
      <b class="num">${r.p == null ? "–" : pct(r.p, 1)}</b>
      <div style="height:${r.p == null ? 4 : Math.max(8, (r.p - 50) / 50 * 100)}%"${r.p === max ? ' title="Maior comparecimento"' : ""}></div>
      <span>${r.nome.replace('-', '-<wbr>')}</span></div>`).join("");
}

/* ================= tabela de estados ================= */
function renderStateTable() {
  if (state.decidedOnly) return renderDecidedTable();
  const isPres = state.cargo === 1;
  const A = isPres && natList ? natList[0] : null, B = isPres && natList ? natList[1] : null;
  const short = c => title(c.nmu).split(" ")[0];
  const pctOf = (s, c) => { const x = c && s.list.find(y => y.sqcand === c.sqcand); return x ? num(x.pvapn) : null; };
  const rowsFor = ufs => ufs.map(uf => {
    const s = stateInfo(uf);
    if (!s) return `<tr data-uf="${uf}"><td>${uf.toUpperCase()}</td><td class="n" colspan="4">–</td></tr>`;
    if (A && B) {
      const pa = pctOf(s, A), pb = pctOf(s, B);
      const w = !s.has ? "" : s.top.sqcand === A.sqcand ? "A" : s.top.sqcand === B.sqcand ? "B" : initials(s.top.nmu);
      const wc = !s.has ? "" : `color:${colorFor(s.top)}`;
      return `<tr data-uf="${uf}"><td><b>${uf.toUpperCase()}</b></td><td class="n num">${pct(s.pst, 1)}</td>
        <td class="n num" style="${w === "A" ? `color:${colorFor(A)};font-weight:700` : ""}">${pa == null ? "–" : pct(pa, 1).replace("%", "")}</td>
        <td class="n num" style="${w === "B" ? `color:${colorFor(B)};font-weight:700` : ""}">${pb == null ? "–" : pct(pb, 1).replace("%", "")}</td>
        <td class="w" style="${wc}">${w}</td></tr>`;
    }
    return `<tr data-uf="${uf}"><td><b>${uf.toUpperCase()}</b></td><td class="n num">${pct(s.pst, 1)}</td>
      <td style="color:${s.has ? colorFor(s.top) : "inherit"};font-weight:700;overflow:hidden;text-overflow:ellipsis;max-width:130px">${s.has ? esc(title(s.top.nmu)) : "–"}</td>
      <td class="n num">${s.has ? pct(s.p, 1) : "–"}</td><td>${s.has ? esc(s.top.partido) : ""}</td></tr>`;
  }).join("");
  const head = A && B
    ? `<tr><th>Estado</th><th class="n">Urnas</th><th class="n" title="${esc(title(A.nmu))}">${esc(short(A))} %</th><th class="n" title="${esc(title(B.nmu))}">${esc(short(B))} %</th><th>Líder</th></tr>`
    : `<tr><th>Estado</th><th class="n">Urnas</th><th>Líder</th><th class="n">%</th><th>Partido</th></tr>`;
  $("stTable").innerHTML = `<table class="st"><thead>${head}</thead><tbody>${rowsFor(BIG_UFS)}</tbody></table>` +
    (A && B ? `<div class="feednote">A = ${esc(title(A.nmu))} · B = ${esc(title(B.nmu))}</div>` : "");
  const all = [...UFS].sort((a, b) => a[1].localeCompare(b[1])).map(([uf]) => uf);
  $("listView").innerHTML = `<table class="st"><thead>${head}</thead><tbody>${rowsFor(all)}</tbody></table>`;
}

/* ================= feed de atualizações (gerado dos dados) ================= */
const feedKey = () => `f26-${state.cargo}`;
let feedOpen = false;
function addEvents(evts) {
  if (!evts.length) return;
  const f = store.get(feedKey(), []);
  const ids = new Set(f.map(e => e.id));
  for (const e of evts) if (!ids.has(e.id)) { f.push({ ...e, at: Date.now() }); ids.add(e.id); }
  f.sort((a, b) => b.m - a.m || b.at - a.at);
  store.set(feedKey(), f.slice(0, 80));
  renderFeed(true);
}
function feedFromStates(prev, cur) {
  const ev = [];
  const firstRun = !Object.keys(prev).length;
  for (const [uf, d] of Object.entries(cur)) {
    const s = stateInfo(uf); if (!s || !s.has) continue;
    const nm = UFNAME[uf], m = mins(d.ht || d.hg), lider = `${title(s.top.nmu)} tem ${s.top.pvap}%`;
    for (const t of [50, 80, 100]) {
      const was = prev[uf] ? num(prev[uf].s.pstn) : 0;
      if (s.pst >= t && (firstRun ? t === 100 || (t === 80 && s.pst < 100) : was < t)) {
        ev.push(t === 100
          ? { id: `${uf}-100`, m, k: "--c2", t: `${nm} conclui a apuração`, b: `${title(s.top.nmu)} termina à frente com ${s.top.pvap}% dos votos válidos.` }
          : { id: `${uf}-${t}`, m, k: "--c1", t: `${uf.toUpperCase()} passa de ${t}% das urnas apuradas`, b: `${lider}.` });
      }
    }
    const p = prev[uf] && candidatos(prev[uf])[0];
    if (p && +p.vap > 0 && p.sqcand !== s.top.sqcand)
      ev.push({ id: `${uf}-v-${s.top.sqcand}-${d.hg}`, m, k: "--c4", t: `Virada em ${nm}`, b: `${title(s.top.nmu)} passa ${title(p.nmu)}: ${s.top.pvap}% a ${s.second ? s.second.pvap : "?"}%.` });
  }
  addEvents(ev);
}
function feedFromMain(prevD, d, list) {
  if (state.uf !== "br" || !list[0] || +list[0].vap === 0) return;
  const ev = [], m = mins(d.hg), p = num(d.s.pstn), was = prevD ? num(prevD.s.pstn) : null;
  const step = Math.floor(p / 10) * 10;
  if (step >= 10 && (was === null || Math.floor(was / 10) * 10 < step))
    ev.push({ id: `br-${step}`, m, k: "--c3", t: `Apuração nacional chega a ${step}%`, b: `${title(list[0].nmu)} lidera com ${list[0].pvap}% dos votos válidos.` });
  if (prevD) {
    const pl = candidatos(prevD)[0];
    if (pl && pl.sqcand !== list[0].sqcand && +pl.vap > 0)
      ev.push({ id: `br-v-${list[0].sqcand}-${d.hg}`, m, k: "--c4", t: "Mudança na liderança nacional", b: `${title(list[0].nmu)} passa à frente com ${list[0].pvap}%.` });
  }
  if (d.md === "s") ev.push({ id: "br-md", m, k: "--c3", t: "Resultado matematicamente definido", b: `${title(list[0].nmu)} não pode mais ser alcançado.` });
  addEvents(ev);
}
function renderFeed(fresh) {
  const f = store.get(feedKey(), []);
  const show = feedOpen ? f : f.slice(0, 5);
  $("feedList").innerHTML = show.length
    ? show.map(e => `<li class="${fresh && Date.now() - e.at < 5000 ? "new" : ""}" style="--k:var(${e.k})"><span class="dot"></span><time class="num">${hhmm(e.m)}</time><div><b>${esc(e.t)}</b><p>${esc(e.b)}</p></div></li>`).join("")
    : `<li><span class="empty">As atualizações aparecem aqui conforme a apuração avança.</span></li>`;
  $("feedMore").hidden = f.length <= 5;
  $("feedMore").textContent = feedOpen ? "Mostrar menos" : `Ver todas as atualizações (${f.length}) →`;
}

/* ================= regiões ================= */
const REGKEY = { "r-n": "Norte", "r-ne": "Nordeste", "r-co": "Centro-Oeste", "r-se": "Sudeste", "r-s": "Sul" };
const isRegion = uf => String(uf).startsWith("r-");
const regionUfs = key => REGIOES[REGKEY[key]] || [];
const REG_BBOX = (() => {
  const box = {};
  for (const [key, name] of Object.entries(REGKEY)) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const uf of REGIOES[name]) {
      const n = BR_MAP.paths[uf].match(/-?\d+(\.\d+)?/g).map(Number);
      for (let i = 0; i < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
    }
    box[key] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  return box;
})();
function zoomToRegion(key) {
  const b = REG_BBOX[key]; if (!b) return;
  state.zoom = Math.min(3.2, 0.88 * Math.min(FULL.w / b.w, FULL.h / b.h));
  state.center = [b.x + b.w / 2 + (key === "r-ne" ? 30 : 0), b.y + b.h / 2];
  applyZoom();
}
function aggregateRegion(cargo, key) {
  const ds = regionUfs(key).map(uf => mapCargo === cargo && mapData[uf]).filter(Boolean);
  if (ds.length < regionUfs(key).length) return null;
  return aggregateDs(cargo, ds, key);
}
/* soma do Brasil a partir dos estados (+ exterior), usada quando o arquivo nacional do TSE atrasa */
const stamp = d => d ? `${String(d.dg).split("/").reverse().join("")} ${d.hg}` : "";
function nationalFromStates(ufData, zz) {
  const ds = UFS.map(([uf]) => ufData[uf]).filter(Boolean);
  if (ds.length < 27) return null;
  if (zz) ds.push(zz);
  const d = aggregateDs(1, ds, "br");
  d.region = null; d.cdabr = "br"; d.synthetic = true;
  return d;
}
function aggregateDs(cargo, ds, key) {
  const sum = (f) => ds.reduce((s, d) => s + (+f(d) || 0), 0);
  const s = { ts: sum(d => d.s.ts), st: sum(d => d.s.st) };
  s.pstn = String(s.ts ? s.st / s.ts * 100 : 0); s.pst = pct(+s.pstn).replace("%", "");
  const e = { te: sum(d => d.e.te), est: sum(d => d.e.est), esnt: sum(d => d.e.esnt), c: sum(d => d.e.c), a: sum(d => d.e.a) };
  e.pcn = String(e.est ? e.c / e.est * 100 : 0); e.pan = String(e.est ? e.a / e.est * 100 : 0);
  const v = { tv: sum(d => d.v.tv), vv: sum(d => d.v.vv), vb: sum(d => d.v.vb), tvn: sum(d => d.v.tvn) };
  v.pvvcn = String(v.tv ? v.vv / v.tv * 100 : 0);
  const multi = cargo !== 1, byKey = {};
  for (const d of ds) for (const c of candidatos(d)) {
    const k = multi ? "p-" + c.partido : c.sqcand;
    if (!byKey[k]) byKey[k] = multi ? { sqcand: k, nmu: c.partido, nm: c.partido, n: "", partido: c.partido, isParty: true, vap: 0, e: "n", st: "" } : { ...c, vap: 0, e: "n", st: "" };
    byKey[k].vap += +c.vap;
  }
  const byParty = {};
  for (const c of Object.values(byKey)) {
    c.pvapn = String(v.vv ? c.vap / v.vv * 100 : 0); c.pvap = pct(+c.pvapn).replace("%", ""); c.vap = String(c.vap);
    (byParty[c.partido] = byParty[c.partido] || []).push(c);
  }
  const hg = ds.map(d => d.hg).sort().pop();
  return { ele: ds[0].ele, cdabr: key, multi, hg, dg: ds[0].dg, tf: ds.every(d => d.tf === "s") ? "s" : "n", md: "n", s, e, v, region: key,
    carg: [{ cd: String(cargo), nv: multi ? "0" : "1", agr: Object.entries(byParty).map(([sg, cand]) => ({ tp: "i", par: [{ sg, cand }] })) }] };
}
async function regionData() {
  if (mapCargo !== state.cargo || regionUfs(state.uf).some(uf => !mapData[uf])) await loadStates(true);
  const d = aggregateRegion(state.cargo, state.uf);
  if (!d) throw new Error("Carregando os estados da região…");
  return d;
}

/* ================= ciclo principal ================= */
async function load() {
  if (loading) return;
  loading = true;
  try {
    if (state.cargo === 1) {
      if (state.uf !== "br") { try { natList = candidatos(await getJSON(fileFor(1, "br"))); natList.forEach(colorVar); } catch {} }
    }
    let d = isRegion(state.uf) ? await regionData() : await getJSON(fileFor(state.cargo, state.uf));
    let lagNote = "";
    if (state.cargo === 1 && state.uf === "br" && mapCargo === 1) {
      const agg = nationalFromStates(mapData, zzData);
      if (agg && stamp(agg) > stamp(d)) { lagNote = `O arquivo nacional do TSE está parado desde as ${d.hg.slice(0, 5)}. Mostrando o total do Brasil somado a partir dos 27 estados e do exterior, que estão mais atualizados.`; d = agg; }
    }
    const list = candidatos(d);
    list.forEach(colorVar);
    if (state.cargo === 1 && state.uf === "br") natList = list;
    const prevD = last && last.cdabr === d.cdabr && last.ele === d.ele ? last : null;
    last = d;
    renderKPIs(d);
    await Promise.race([syncHist(), new Promise(r => setTimeout(r, 2000))]);
    if (d.multi) renderRegionRaces(d); else renderResults(d, list);
    renderDonut(d, list);
    feedFromMain(prevD, d, list);
    updateProjection();
    if (state.focus) renderCandView();
    $("err").style.display = lagNote ? "block" : "none";
    $("err").classList.toggle("info", !!lagNote);
    if (lagNote) $("err").textContent = lagNote;
    const fin = d.tf === "s";
    $("live").classList.toggle("off", fin);
    $("liveTxt").textContent = fin ? "FINAL" : "AO VIVO";
    if (!state.focus) document.title = d.multi ? `${CARGO[state.cargo]} · ${place()} · Central das Eleições 2026` : `${list[0] && +list[0].vap ? `${title(list[0].nmu)} ${list[0].pvap}% · ` : ""}Central das Eleições 2026`;
    $("qlist").innerHTML = UFS.map(([, n]) => `<option value="${n}">`).join("") + list.map(c => `<option value="${esc(title(c.nmu))}">`).join("");
  } catch (e) {
    $("err").textContent = e.message + " Tentando de novo automaticamente.";
    $("err").style.display = "block";
    if (!last) $("cands").innerHTML = `<p style="color:var(--muted)">Sem dados ainda.</p>`;
  } finally { loading = false; }
  loadStates().catch(() => {});
}

function tick() {
  if (!state.auto) { $("next").textContent = "pausado"; return; }
  countdown--;
  if (countdown <= 0) { countdown = REFRESH; load(); }
  $("next").textContent = `próxima em ${countdown}s`;
  $("ring").style.strokeDashoffset = (56.55 * (1 - countdown / REFRESH)).toFixed(2);
}

function go(cargo, uf) {
  state.focus = null; document.body.classList.remove("focus");
  if (cargo !== state.cargo) { colorOf = {}; natList = null; ufProj = {}; }
  pj.res = null; $("proj").hidden = true;
  state.cargo = cargo;
  state.uf = cargo !== 1 && uf === "br" ? "sp" : uf;
  state.showAll = false; prevVotes = {}; last = null;
  $("cargo").value = cargo;
  const sel = $("uf");
  sel.innerHTML = (cargo === 1 ? `<option value="br">Todos os estados</option>` : "") +
    `<optgroup label="Regiões">${Object.entries(REGKEY).map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</optgroup>` +
    `<optgroup label="Estados">${UFS.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</optgroup>`;
  sel.value = state.uf;
  history.replaceState(null, "", `#${cargo}/${state.uf}`);
  if (isRegion(state.uf)) zoomToRegion(state.uf);
  else if (state.zoom !== 1 && state.wasRegion) { state.zoom = 1; state.center = null; applyZoom(); }
  state.wasRegion = isRegion(state.uf);
  $("cands").innerHTML = `<div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div>`;
  renderFeed(false);
  paintStates();
  countdown = REFRESH; load();
}

function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("on"); setTimeout(() => el.classList.remove("on"), 1800); }

/* ================= eventos ================= */
$("cargo").onchange = e => go(+e.target.value, state.uf);
$("uf").onchange = e => go(state.cargo, e.target.value);
$("auto").onclick = () => {
  state.auto = !state.auto;
  $("auto").setAttribute("aria-pressed", state.auto);
  if (state.auto) { countdown = REFRESH; load(); }
};
$("mapTabs").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  state.view = b.dataset.v;
  $("mapTabs").querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === b));
  $("mapView").hidden = state.view !== "map";
  $("listView").hidden = state.view !== "list";
};
$("seeAll").onclick = () => { $("mapTabs").querySelector('[data-v="list"]').click(); $("mapa").scrollIntoView(); };
$("wonBtn").onclick = () => {
  state.decidedOnly = !state.decidedOnly;
  $("wonBtn").setAttribute("aria-pressed", state.decidedOnly);
  $("tip").style.opacity = 0;
  paintStates();
  if (state.decidedOnly) toast(+$("wonN").textContent ? `Mostrando só os estados com vencedor definido` : `Nenhum estado com vencedor definido ainda`);
};
$("mapMode").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  mapMode = b.dataset.m;
  $("mapMode").querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === b));
  paintStates();
};
function feedTab(v) {
  $("feedTabs").querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x.dataset.v === v));
  $("feedView").hidden = v !== "feed";
  $("projDetail").hidden = v !== "proj";
}
$("feedTabs").onclick = e => { const b = e.target.closest("button"); if (b) feedTab(b.dataset.v); };
$("pjMore").onclick = () => { feedTab("proj"); $("feed").scrollIntoView(); };
$("feedMore").onclick = () => { feedOpen = !feedOpen; renderFeed(false); };
document.addEventListener("click", e => {
  const tr = e.target.closest("table.st tr[data-uf]");
  if (tr) { go(state.cargo, tr.dataset.uf); $("resultado").scrollIntoView(); }
});
$("nav").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  $("nav").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
  $(b.dataset.go).scrollIntoView();
};

// mapa: clique, arrastar, tooltip
const map = $("map");
let drag = null;
map.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, c: [...(state.center || [530, 495])], moved: false }; });
addEventListener("pointermove", e => {
  if (!drag || state.zoom === 1) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 4) { drag.moved = true; map.classList.add("drag"); }
  if (!drag.moved) return;
  const k = FULL.w / state.zoom / map.clientWidth;
  state.center = [drag.c[0] - dx * k, drag.c[1] - dy * k];
  applyZoom();
});
addEventListener("pointerup", () => { setTimeout(() => { drag = null; map.classList.remove("drag"); }, 0); });
map.addEventListener("click", e => {
  if (drag && drag.moved) return;
  const t = e.target.closest("[data-uf]"); if (!t) return;
  const uf = t.dataset.uf;
  go(state.cargo, state.uf === uf && state.cargo === 1 ? "br" : uf);
});
map.addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse") return;
  const t = e.target.closest("[data-uf]");
  t && !(drag && drag.moved) ? (mapMode === "proj" ? showProjTip : showTip)(t.dataset.uf, e.clientX, e.clientY) : ($("tip").style.opacity = 0);
});
map.addEventListener("mouseleave", () => $("tip").style.opacity = 0);
addEventListener("scroll", () => $("tip").style.opacity = 0, { passive: true });
$("zin").onclick = () => zoomBy(1.6);
$("zout").onclick = () => zoomBy(1 / 1.6);

// busca
$("search").onsubmit = e => {
  e.preventDefault();
  const q = norm($("q").value); if (!q) return;
  const uf = UFS.find(([v, n]) => norm(n) === q || v === q) || UFS.find(([, n]) => norm(n).startsWith(q));
  if (uf) { go(state.cargo, uf[0]); $("q").value = ""; $("search").classList.remove("open"); $("resultado").scrollIntoView(); return; }
  const row = [...document.querySelectorAll(".cand")].find(r => norm(r.querySelector(".nm").textContent).includes(q));
  if (row) { $("q").value = ""; $("search").classList.remove("open"); openCand(row.dataset.sq); }
  else toast("Nenhum estado ou candidato encontrado");
};
$("searchBtn").onclick = () => { $("search").classList.toggle("open"); $("q").focus(); };

// tema
$("theme").onclick = () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  store.set("theme", root.dataset.theme);
};
{ const t = store.get("theme", null); if (t) document.documentElement.dataset.theme = t; }
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.auto) { countdown = REFRESH; load(); } });

buildMap();
const [hc, hu, hs] = location.hash.replace("#", "").split("/");
window.INIT_FOCUS = hs;
go([1, 3, 5].includes(+hc) ? +hc : 1, hu && (hu === "br" || UFNAME[hu] || REGKEY[hu]) ? hu : "br");
setInterval(tick, 1000);
