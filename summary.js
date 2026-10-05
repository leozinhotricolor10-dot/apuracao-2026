/* Banner do topo: resumo do 1º turno (Presidente, Governadores, Senado, Câmara, comparecimento). */
function summaryData() {
  const S = {};
  // Presidente
  if (an.br) {
    const list = candidatos(an.br), [a, b] = list, pst = num(an.br.s.pstn);
    if (a && +a.vap) {
      const pa = num(a.pvapn);
      const r = pj.res && state.cargo === 1 && state.uf === "br" ? pj.res : null;
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

const partyCount = arr => Object.entries(arr.reduce((m, x) => (m[x.c.partido] = (m[x.c.partido] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]);
const chips = (pairs, n = 3) => pairs.slice(0, n).map(([sg, k]) => `<span class="sm-chip" style="--pc:${partyColor(sg)}"><i></i>${esc(sg)} <b>${k}</b></span>`).join("");

function renderSummary() {
  const box = $("smTiles"); if (!box) return;
  const S = summaryData();
  const tiles = [];
  if (S.pres) {
    const { a, b, pa, pb, status } = S.pres;
    const ph = c => `<span class="sm-ph" style="--col:${colorFor(c)}">${esc(initials(c.nmu))}<img src="${photo(1, "br", c.sqcand)}" alt="" onerror="this.remove()"></span>`;
    const head = status === "won" ? `${esc(title(a.nmu))} eleito no 1º turno` : status === "leadwin" ? `${esc(title(a.nmu))} acima de 50%` : status === "runoff" ? "Vai ter 2º turno" : "2º turno provável";
    tiles.push(`<button class="sm-tile pres" data-go="resultado">
      <span class="sm-k">Presidente</span><span class="sm-h">${head}</span>
      <span class="sm-duel"><span class="sm-c">${ph(a)}<span><b style="color:${colorFor(a)}">${esc(title(a.nmu))}</b><em class="num">${pct(pa, 1)}</em></span></span>
        <span class="sm-x">×</span><span class="sm-c">${ph(b)}<span><b style="color:${colorFor(b)}">${esc(title(b.nmu))}</b><em class="num">${pct(pb, 1)}</em></span></span></span>
      ${status !== "won" ? `<span class="sm-s">2º turno em 25 de outubro</span>` : ""}
    </button>`);
  }
  if (S.gov) {
    tiles.push(`<button class="sm-tile" data-go="mapa" data-cargo="3">
      <span class="sm-k">Governadores</span>
      <span class="sm-big"><b class="num">${S.gov.el.length}</b> eleitos <span class="sm-sep">·</span> <b class="num">${S.gov.ro.length}</b> no 2º turno</span>
      <span class="sm-chips">${chips(partyCount(S.gov.el))}</span>
      <span class="sm-s">${S.gov.el.length ? "partidos com mais governadores eleitos" : "nenhum governador definido ainda"}</span>
    </button>`);
  }
  if (S.sen) {
    tiles.push(`<button class="sm-tile" data-go="mapa" data-cargo="5">
      <span class="sm-k">Senado</span>
      <span class="sm-big"><b class="num">${S.sen.el.length}</b> de ${S.sen.total} vagas definidas</span>
      <span class="sm-chips">${chips(partyCount(S.sen.el))}</span>
      <span class="sm-s">partidos com mais senadores eleitos</span>
    </button>`);
  }
  if (S.cam) {
    tiles.push(`<button class="sm-tile" data-go="partidos">
      <span class="sm-k">Câmara dos Deputados</span>
      <span class="sm-big">Maiores bancadas</span>
      <span class="sm-chips">${chips(S.cam.rows.map(r => [r.sg, r.cam]), 4)}</span>
      <span class="sm-s">${S.cam.seats} de 513 cadeiras distribuídas</span>
    </button>`);
  }
  if (S.turn) {
    tiles.push(`<button class="sm-tile" data-go="analista">
      <span class="sm-k">Comparecimento</span>
      <span class="sm-big"><b class="num">${pct(S.turn.pc, 1)}</b></span>
      <span class="sm-s">abstenção de ${pct(S.turn.pa, 1)} · 2022: ${B22 ? pct(B22.turnout.br.pc, 1) : "–"}</span>
    </button>`);
  }
  if (!tiles.length) return;
  box.innerHTML = tiles.join("");
  if (S.turn) {
    $("smStatus").textContent = S.turn.final ? "Apuração encerrada" : `${pct(S.turn.pst, 1)} das urnas apuradas`;
    $("smStatus").classList.toggle("final", S.turn.final || S.turn.pst >= 99.9);
  }
}

$("smTiles").addEventListener("click", e => {
  const t = e.target.closest(".sm-tile"); if (!t) return;
  if (t.dataset.cargo) go(+t.dataset.cargo, "sp");
  $(t.dataset.go)?.scrollIntoView({ behavior: "smooth" });
});
setInterval(renderSummary, 20000);
