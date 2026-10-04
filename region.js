/* Visão por região: cartões das 5 regiões e a lista de disputas de uma região (Governador/Senador). */

function regionLeaders(key) {
  return regionUfs(key).map(uf => {
    const d = mapCargo === state.cargo && mapData[uf]; if (!d) return null;
    const list = candidatos(d), nv = state.cargo === 5 ? +d.carg[0].nv || 1 : 1;
    const P = ufProj[uf], dec = typeof decidedInfo === "function" ? decidedInfo(uf) : null;
    return { uf, d, list, nv, top: list.slice(0, nv).filter(c => +c.vap > 0), pst: num(d.s.pstn), P, dec };
  }).filter(Boolean);
}

function statusOf(x) {
  if (x.dec) return { cls: "won", t: x.dec.how === "Oficial TSE" ? "✓ Eleito" : "✓ Já ganhou" };
  if (!x.P) return { cls: "", t: "Lidera" };
  if (state.cargo === 3 && x.P.r.pFirst < 0.5) return { cls: "run", t: `2º turno provável (${pctP(1 - x.P.r.pFirst)})` };
  const t = tier(x.P.p);
  return { cls: t[1], t: t[2] };
}

/* lista de disputas (Governador/Senador numa região) */
function renderRegionRaces(d) {
  const key = d.region, rows = regionLeaders(key);
  $("resTitle").textContent = `${CARGO[state.cargo]} · ${REGKEY[key]}`;
  $("cands").innerHTML = `<p class="rr-hint">${rows.length} estados · ${pct(num(d.s.pstn), 1)} das urnas apuradas na região. Toque num estado para ver a disputa completa.</p>` +
    rows.map(x => {
      const s = statusOf(x), c0 = x.top[0];
      if (!c0) return `<button class="race" data-uf="${x.uf}"><div class="ruf">${x.uf.toUpperCase()}</div><div class="rnm"><b>${esc(UFNAME[x.uf])}</b><span>aguardando votos</span></div></button>`;
      return `<button class="race" data-uf="${x.uf}" style="--col:${colorFor(c0)}">
        <div class="ruf">${x.uf.toUpperCase()}</div>
        <div class="rph">${x.top.map(c => `<span style="--col:${colorFor(c)}">${esc(initials(c.nmu))}<img src="${photo(state.cargo, x.uf, c.sqcand)}" alt="" loading="lazy" onerror="this.remove()"></span>`).join("")}</div>
        <div class="rnm"><b>${x.top.map(c => esc(title(c.nmu))).join(" e ")}</b><span>${x.top.map(c => esc(c.partido)).join(" · ")} · ${pct(x.pst, 1)} apurado</span></div>
        <div class="rpc"><b class="num">${x.top.map(c => pct(num(c.pvapn), 1)).join("<br>")}</b><em class="st ${s.cls}">${s.t}</em></div>
      </button>`;
    }).join("");
  $("cands").querySelectorAll(".race").forEach(b => b.onclick = () => go(state.cargo, b.dataset.uf));
}

/* cartões das 5 regiões */
function renderRegionCards() {
  const box = $("regCards"); if (!box) return;
  const cargo = state.cargo;
  $("regTitle").textContent = `Visão por região · ${CARGO[cargo]}`;
  box.innerHTML = Object.entries(REGKEY).map(([key, name]) => {
    const b = REG_BBOX[key], pad = 14, ufs = regionUfs(key), rows = regionLeaders(key);
    const shapes = ufs.map(uf => {
      const x = rows.find(r => r.uf === uf), c = x && x.top[0];
      return `<path d="${BR_MAP.paths[uf]}" fill="${c ? colorFor(c) : "var(--land)"}" stroke="var(--surface)" stroke-width="${2 / 1}" vector-effect="non-scaling-stroke"/>`;
    }).join("");
    const agg = rows.length === ufs.length ? aggregateRegion(cargo, key) : null;
    const pst = agg ? num(agg.s.pstn) : 0;
    let body = "";
    if (!agg) body = `<div class="skel" style="height:48px"></div>`;
    else if (cargo === 1) {
      const list = candidatos(agg).slice(0, 2);
      body = list.map(c => `<div class="rl" style="--col:${colorFor(c)}"><span>${esc(title(c.nmu))}</span><b class="num">${pct(num(c.pvapn), 1)}</b><i><em style="width:${num(c.pvapn)}%"></em></i></div>`).join("");
    } else {
      const cnt = {};
      rows.forEach(x => x.top.forEach(c => { cnt[c.partido] = cnt[c.partido] || { n: 0, c }; cnt[c.partido].n++; }));
      const items = Object.values(cnt).sort((a, b) => b.n - a.n);
      body = `<div class="rchips">${items.slice(0, 5).map(x => `<span style="--col:${colorFor(x.c)}"><i></i>${esc(x.c.partido)} <b>${x.n}</b></span>`).join("")}${items.length > 5 ? `<span>+${items.length - 5}</span>` : ""}</div>
        <div class="rsub">${cargo === 3 ? "governos" : "vagas no Senado"} em que cada partido está à frente</div>`;
    }
    const won = rows.filter(x => x.dec).length;
    const lead = agg && cargo === 1 ? candidatos(agg)[0] : null;
    return `<button class="rcard ${state.uf === key ? "on" : ""}" data-r="${key}" style="--rc:${lead ? colorFor(lead) : "var(--line)"}">
      <div class="rh"><b>${name}</b><span class="num">${agg ? pct(pst, 0) : "–"} apurado</span></div>
      <div class="rpb"><div style="width:${pst}%"></div></div>
      <svg viewBox="${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}" aria-hidden="true">${shapes}</svg>
      <div class="rbody">${body}</div>
      <div class="rf"><span>Comparec. <b class="num">${agg ? pct(num(agg.e.pcn), 1) : "–"}</b></span><span class="${won ? "ok" : ""}">✓ ${won}/${ufs.length} definidos</span></div>
      <div class="rgo">${state.uf === key ? "Mostrando esta região" : "Ver só esta região ›"}</div>
    </button>`;
  }).join("");
}

$("regCards").addEventListener("click", e => {
  const b = e.target.closest(".rcard"); if (!b) return;
  const key = b.dataset.r;
  go(state.cargo, state.uf === key ? (state.cargo === 1 ? "br" : "sp") : key);
  if (state.uf === key) $("top").scrollIntoView({ behavior: "smooth" });
});
renderRegionCards();
