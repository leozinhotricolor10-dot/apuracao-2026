/* Banner do topo: resumo do 2º turno (Presidente, Governadores nos 6 estados, comparecimento)
   e, numa aba ao lado, o resumo do 1º turno (Presidente, Governadores, Senado, Câmara, comparecimento). */
const sm = { view: null };   // "t2" | "t1"; sem escolha do visitante: 2º turno a partir de 25/10
const smView = () => sm.view || (brDate() >= T2_DAY || state.turno === 2 ? "t2" : "t1");

function summaryData() {
  const S = {};
  // Presidente
  if (an.br) {
    const list = candidatos(an.br), [a, b] = list, pst = num(an.br.s.pstn);
    if (a && +a.vap) {
      const pa = num(a.pvapn);
      const r = pj.res && !pj.res.t2 && state.cargo === 1 && state.uf === "br" ? pj.res : null;
      const won = a.e === "s" || (r && r.g.winner === a.sqcand);
      const runoffSure = list.some(c => /2º turno/i.test(c.st || "")) || (r && r.g.runoff) || (pst >= 99.9 && pa <= 50);
      S.pres = { a, b, pa, pb: num(b.pvapn), pst, status: won ? "won" : runoffSure ? "runoff" : pa > 50 ? "leadwin" : "runoffLikely" };
    }
    S.turn = { pc: num(an.br.e.pcn), pa: num(an.br.e.pan), pst: num(an.br.s.pstn), final: an.br.tf === "s" };
  }
  // Governadores e Senado (estado por estado)
  if (typeof stateRaces === "function") {
    const gov = stateRaces(3);
    if (gov.length >= 20) {
      const el = [], ro = [];
      for (const x of gov) {
        const off = x.list.find(c => c.e === "s");
        const w = off || (x.r.g.winner && x.list.find(c => c.sqcand === x.r.g.winner));
        if (w) el.push({ uf: x.uf, c: w });
        else if (x.list.some(c => /2º turno/i.test(c.st || "")) || x.r.g.runoff || (x.pst >= 99.9 && num(x.list[0].pvapn) <= 50)) ro.push(x.uf);
      }
      S.gov = { el, ro, total: gov.length };
    }
    const sen = stateRaces(5);
    if (sen.length >= 20) {
      const el = [];
      for (const x of sen) {
        const off = x.list.filter(c => c.e === "s");
        const safe = off.length ? off : x.list.slice(0, x.nv).filter(c => x.r.g.safe.has(c.sqcand));
        safe.forEach(c => el.push({ uf: x.uf, c }));
      }
      S.sen = { el, total: sen.reduce((s, x) => s + x.nv, 0) };
    }
  }
  // Câmara
  if (typeof pt !== "undefined" && pt.agg && pt.agg.seatsKnown) S.cam = { rows: pt.agg.rows.filter(r => r.cam).sort((p, q) => q.cam - p.cam), seats: pt.agg.seatsKnown };
  return S;
}

/* garantia matemática no 2º turno: o líder vence mesmo que todos os eleitores das seções não apuradas votem no outro */
const t2Won = (d, a, b) => !!a && (a.e === "s" || (+d.s.st > 0 && +a.vap > +(b ? b.vap : 0) + +d.e.esnt));

function summaryT2() {
  const S = {}, d = an2.br, d1 = an.br;
  const list = d ? candidatos(d) : d1 ? candidatos(d1).slice(0, 2) : [];
  if (list.length >= 2) {
    const [a, b] = list, on = started(d);
    const p1of = c => { const x = d1 && candIn(d1, c); return x ? num(x.pvapn) : null; };
    S.pres = { a, b, on, pa: on ? num(a.pvapn) : p1of(a), pb: on ? num(b.pvapn) : p1of(b), pst: d ? num(d.s.pstn) : 0, final: !!d && d.tf === "s", won: d && t2Won(d, a, b) ? a : null, official: a.e === "s" };
  }
  const gov = T2_GOV.map(uf => ({ uf, d: an2.gov[uf] })).filter(x => x.d);
  if (gov.length) {
    const el = [];
    for (const x of gov) { const [a, b] = candidatos(x.d); if (t2Won(x.d, a, b)) el.push({ uf: x.uf, c: a }); }
    S.gov = { el, on: gov.filter(x => started(x.d)).length, total: T2_GOV.length };
  }
  if (started(d)) S.turn = { pc: num(d.e.pcn), pa: num(d.e.pan), pc1: d1 ? num(d1.e.pcn) : null };
  else if (d1) S.turn = { pc: null, pc1: num(d1.e.pcn) };
  S.status = !d ? "wait" : d.tf === "s" ? "final" : started(d) ? "live" : "wait";
  return S;
}

const partyCount = arr => Object.entries(arr.reduce((m, x) => (m[x.c.partido] = (m[x.c.partido] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]);
const chips = (pairs, n = 3) => pairs.slice(0, n).map(([sg, k]) => `<span class="sm-chip" style="--pc:${partyColor(sg)}"><i></i>${esc(sg)} <b>${k}</b></span>`).join("");
const smPh = c => `<span class="sm-ph" style="--col:${colorFor(c)}">${esc(initials(c.nmu))}<img src="${photo(1, "br", c.sqcand)}" alt="" onerror="this.remove()"></span>`;

function camTile(S, note) {
  return S.cam ? `<button class="sm-tile" data-go="partidos">
      <span class="sm-k">Câmara dos Deputados${note ? " · 1º turno" : ""}</span>
      <span class="sm-big">Maiores bancadas</span>
      <span class="sm-chips">${chips(S.cam.rows.map(r => [r.sg, r.cam]), 4)}</span>
      <span class="sm-s">${note ? "eleita em 4 de outubro · " : ""}${S.cam.seats} de 513 cadeiras distribuídas</span>
    </button>` : "";
}
function senTile(S, note) {
  return S.sen ? `<button class="sm-tile" data-go="mapa" data-cargo="5" data-turno="1">
      <span class="sm-k">Senado${note ? " · 1º turno" : ""}</span>
      <span class="sm-big"><b class="num">${S.sen.el.length}</b> de ${S.sen.total} vagas definidas</span>
      <span class="sm-chips">${chips(partyCount(S.sen.el))}</span>
      <span class="sm-s">${note ? "o Senado não tem 2º turno" : "partidos com mais senadores eleitos"}</span>
    </button>` : "";
}

function tilesT1() {
  const S = summaryData(), tiles = [];
  if (S.pres) {
    const { a, b, pa, pb, status } = S.pres;
    const head = status === "won" ? `${esc(title(a.nmu))} eleito no 1º turno` : status === "leadwin" ? `${esc(title(a.nmu))} acima de 50%` : status === "runoff" ? "Vai ter 2º turno" : "2º turno provável";
    tiles.push(`<button class="sm-tile pres" data-go="resultado" data-cargo="1" data-uf="br" data-turno="1">
      <span class="sm-k">Presidente</span><span class="sm-h">${head}</span>
      <span class="sm-duel"><span class="sm-c">${smPh(a)}<span><b style="color:${colorFor(a)}">${esc(title(a.nmu))}</b><em class="num">${pct(pa, 1)}</em></span></span>
        <span class="sm-x">×</span><span class="sm-c">${smPh(b)}<span><b style="color:${colorFor(b)}">${esc(title(b.nmu))}</b><em class="num">${pct(pb, 1)}</em></span></span></span>
      ${status !== "won" ? `<span class="sm-s">2º turno em 25 de outubro</span>` : ""}
    </button>`);
  }
  if (S.gov) {
    tiles.push(`<button class="sm-tile" data-go="mapa" data-cargo="3" data-turno="1">
      <span class="sm-k">Governadores</span>
      <span class="sm-big"><b class="num">${S.gov.el.length}</b> eleitos <span class="sm-sep">·</span> <b class="num">${S.gov.ro.length}</b> no 2º turno</span>
      <span class="sm-chips">${chips(partyCount(S.gov.el))}</span>
      <span class="sm-s">${S.gov.el.length ? "partidos com mais governadores eleitos" : "nenhum governador definido ainda"}</span>
    </button>`);
  }
  tiles.push(senTile(S), camTile(S));
  if (S.turn) {
    tiles.push(`<button class="sm-tile" data-go="analista">
      <span class="sm-k">Comparecimento</span>
      <span class="sm-big"><b class="num">${pct(S.turn.pc, 1)}</b></span>
      <span class="sm-s">abstenção de ${pct(S.turn.pa, 1)} · 2022: ${B22 ? pct(B22.turnout.br.pc, 1) : "–"}</span>
    </button>`);
  }
  const status = S.turn ? (S.turn.final ? "Apuração encerrada" : `${pct(S.turn.pst, 1)} das urnas apuradas`) : "carregando…";
  return { tiles: tiles.filter(Boolean), status, final: !!S.turn && (S.turn.final || S.turn.pst >= 99.9) };
}

function tilesT2() {
  const S = summaryT2(), S1 = summaryData(), tiles = [];
  const waitTxt = brDate() <= T2_DAY && brNow() < POLLS_CLOSE ? "Apuração começa às 17h" : "Aguardando os primeiros números";
  if (S.pres) {
    const { a, b, on, pa, pb, won, official, pst } = S.pres;
    const head = official ? `${esc(title(a.nmu))} eleito presidente` : won ? `${esc(title(a.nmu))} já ganhou` : on ? `${esc(title(a.nmu))} lidera` : waitTxt;
    const em = p => p == null ? "–" : pct(p, 1);
    tiles.push(`<button class="sm-tile pres" data-go="resultado" data-cargo="1" data-uf="br" data-turno="2">
      <span class="sm-k">Presidente · 2º turno</span><span class="sm-h">${head}</span>
      <span class="sm-duel"><span class="sm-c">${smPh(a)}<span><b style="color:${colorFor(a)}">${esc(title(a.nmu))}</b><em class="num">${em(pa)}</em></span></span>
        <span class="sm-x">×</span><span class="sm-c">${smPh(b)}<span><b style="color:${colorFor(b)}">${esc(title(b.nmu))}</b><em class="num">${em(pb)}</em></span></span></span>
      <span class="sm-s">${official ? "resultado oficial do TSE" : won ? "garantido matematicamente pelos números da apuração" : on ? `${pct(pst, 1)} das urnas apuradas` : "percentuais do 1º turno, entre todos os candidatos"}</span>
    </button>`);
  }
  if (S.gov) {
    tiles.push(`<button class="sm-tile" data-go="resultado" data-cargo="3" data-uf="${T2_KEY}" data-turno="2">
      <span class="sm-k">Governadores · 2º turno</span>
      <span class="sm-big"><b class="num">${S.gov.total}</b> estados <span class="sm-sep">·</span> <b class="num">${S.gov.el.length}</b> definidos</span>
      <span class="sm-chips">${S.gov.el.length ? chips(partyCount(S.gov.el)) : T2_GOV.map(u => `<span class="sm-chip">${u.toUpperCase()}</span>`).join("")}</span>
      <span class="sm-s">${S.gov.el.length ? "partidos dos eleitos no 2º turno" : S.gov.on ? `${S.gov.on} de ${S.gov.total} estados com apuração` : waitTxt.toLowerCase()}</span>
    </button>`);
  }
  if (S.turn) {
    tiles.push(`<button class="sm-tile" data-go="analista">
      <span class="sm-k">Comparecimento</span>
      <span class="sm-big"><b class="num">${S.turn.pc == null ? "–" : pct(S.turn.pc, 1)}</b></span>
      <span class="sm-s">${S.turn.pc == null ? "aparece com a apuração · " : `abstenção de ${pct(S.turn.pa, 1)} · `}1º turno: ${S.turn.pc1 == null ? "–" : pct(S.turn.pc1, 1)}</span>
    </button>`);
  }
  tiles.push(senTile(S1, true), camTile(S1, true));
  const status = S.status === "final" ? "Apuração encerrada" : S.status === "live" ? `${pct(S.pres ? S.pres.pst : 0, 1)} das urnas apuradas` : waitTxt;
  return { tiles: tiles.filter(Boolean), status, final: S.status === "final", wait: S.status === "wait" };
}

function renderSummary() {
  const box = $("smTiles"); if (!box) return;
  const v = smView(), R = v === "t2" ? tilesT2() : tilesT1();
  $("smTitle").textContent = v === "t2" ? "Resumo do 2º turno" : "Resumo do 1º turno";
  $("smDate").textContent = v === "t2" ? "Eleições 2026 · 25 de outubro" : "Eleições 2026 · 4 de outubro";
  $("resumo").setAttribute("aria-label", $("smTitle").textContent);
  $("smTabs").querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.v === v));
  if (!R.tiles.length) return;
  box.innerHTML = R.tiles.join("");
  $("smStatus").textContent = R.status;
  $("smStatus").classList.toggle("final", R.final);
  $("smStatus").classList.toggle("wait", !!R.wait);
}

$("smTabs").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  sm.view = b.dataset.v;
  renderSummary();
});
$("smTiles").addEventListener("click", e => {
  const t = e.target.closest(".sm-tile"); if (!t) return;
  if (t.dataset.cargo) go(+t.dataset.cargo, t.dataset.uf || "sp", +(t.dataset.turno || 1));
  $(t.dataset.go)?.scrollIntoView({ behavior: "smooth" });
});
setInterval(renderSummary, 20000);
