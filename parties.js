/* Visão por partido: Câmara (cadeiras pela distribuição atual do TSE), governos e Senado. */
const PT_REFRESH = 120000, TOTAL_SEATS = 513;
let pt = { data: { 3: {}, 5: {}, 6: {} }, stamp: 0, loading: false, visible: false, showAll: false, sort: "cam" };

async function loadParties(force) {
  if (pt.loading || (!force && Date.now() - pt.stamp < PT_REFRESH)) return renderParties();
  pt.loading = true; pt.stamp = Date.now();
  $("ptStatus").textContent = "Atualizando dados dos partidos…";
  const jobs = [];
  for (const cargo of [3, 5, 6]) for (const [uf] of UFS) {
    if (cargo !== 6 && mapCargo === cargo && mapData[uf]) { pt.data[cargo][uf] = mapData[uf]; continue; }
    jobs.push(getJSON(`6259/dados/${uf}/${uf}-c${String(cargo).padStart(4, "0")}-e006259-u.json`).then(d => { pt.data[cargo][uf] = d; }).catch(() => {}));
  }
  await Promise.all(jobs);
  pt.loading = false;
  renderParties();
}

function aggregateParties() {
  const P = {};
  const get = sg => P[sg] = P[sg] || { sg, cam: 0, votos: 0, gov: 0, govE: 0, govUF: [], sen: 0, senE: 0 };
  let vvCam = 0, seatsKnown = 0, pstSum = 0, pstN = 0;
  for (const [uf, d] of Object.entries(pt.data[6])) {
    const c = d.carg[0];
    vvCam += +d.v.vv || 0; pstSum += num(d.s.pstn); pstN++;
    for (const a of c.agr || []) {
      for (const p of a.par || []) get(p.sg).votos += +p.tvan || 0;
      const vag = +a.vag || 0;
      if (!vag) continue;
      seatsKnown += vag;
      // dentro da federação/partido, as cadeiras vão aos mais votados
      const cands = a.par.flatMap(p => p.cand.filter(x => !x.dvt || x.dvt.startsWith("Válido")).map(x => ({ v: +x.vap, sg: p.sg })));
      cands.sort((x, y) => y.v - x.v).slice(0, vag).forEach(x => get(x.sg).cam++);
    }
  }
  for (const [uf, d] of Object.entries(pt.data[3])) {
    const l = candidatos(d)[0];
    if (!l || +l.vap === 0) continue;
    const x = get(l.partido); x.gov++; x.govUF.push(uf.toUpperCase());
    if (l.e === "s") x.govE++;
  }
  for (const [uf, d] of Object.entries(pt.data[5])) {
    const list = candidatos(d), nv = +d.carg[0].nv || 1;
    list.slice(0, nv).forEach(c => { if (+c.vap > 0) { const x = get(c.partido); x.sen++; if (c.e === "s") x.senE++; } });
  }
  const rows = Object.values(P).filter(x => x.cam || x.gov || x.sen || x.votos);
  rows.forEach(x => x.pv = vvCam ? x.votos / vvCam * 100 : 0);
  return { rows, seatsKnown, pst: pstN ? pstSum / pstN : 0, ufsCam: Object.keys(pt.data[6]).length };
}

function hemicycle(total, rows = 13) {
  const r0 = 0.46, radii = Array.from({ length: rows }, (_, i) => r0 + (1 - r0) * i / (rows - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map(r => Math.round(total * r / sum));
  counts[rows - 1] += total - counts.reduce((a, b) => a + b, 0);
  const pts = [];
  radii.forEach((r, i) => { const n = counts[i]; for (let j = 0; j < n; j++) { const a = Math.PI * (1 - (n === 1 ? .5 : j / (n - 1))); pts.push({ a, r, x: r * Math.cos(a), y: r * Math.sin(a) }); } });
  pts.sort((p, q) => q.a - p.a || p.r - q.r);
  return { pts, dot: (1 - r0) / (rows - 1) * 0.42 };
}
const HEMI = hemicycle(TOTAL_SEATS);

function renderParties() {
  const A = pt.agg = aggregateParties();
  const rows = [...A.rows].sort((a, b) => (b[pt.sort] - a[pt.sort]) || (b.cam - a.cam) || (b.votos - a.votos));
  const byCam = [...A.rows].filter(x => x.cam).sort((a, b) => b.cam - a.cam || b.votos - a.votos);
  // hemiciclo
  const colors = [];
  byCam.forEach(x => { for (let i = 0; i < x.cam; i++) colors.push({ c: partyColor(x.sg), sg: x.sg }); });
  const S = 200;
  $("hemi").innerHTML = HEMI.pts.map((p, i) => {
    const s = colors[i];
    return `<circle cx="${(S + p.x * S).toFixed(1)}" cy="${(S - p.y * S + 6).toFixed(1)}" r="${(HEMI.dot * S).toFixed(2)}" fill="${s ? s.c : "var(--land)"}"${s ? ` data-sg="${esc(s.sg)}"` : ""}/>`;
  }).join("") +
    `<text x="${S}" y="${S - 14}" text-anchor="middle" style="font:700 38px 'Space Grotesk',sans-serif;fill:var(--text)">${A.seatsKnown}</text>` +
    `<text x="${S}" y="${S + 4}" text-anchor="middle" style="font:500 11.5px Inter,sans-serif;fill:var(--muted)">${A.seatsKnown >= TOTAL_SEATS ? "cadeiras" : `de ${TOTAL_SEATS} distribuídas`}</text>`;
  $("hemiLeg").innerHTML = byCam.slice(0, 12).map(x => `<span><i style="background:${partyColor(x.sg)}"></i>${esc(x.sg)} <b class="num">${x.cam}</b></span>`).join("") +
    (byCam.length > 12 ? `<span>+${byCam.length - 12} partidos</span>` : "");

  // destaques
  const topCam = byCam[0], topGov = [...A.rows].sort((a, b) => b.gov - a.gov)[0], topVot = [...A.rows].sort((a, b) => b.votos - a.votos)[0];
  const box = (l, sg, v, s) => `<div class="pk" style="--pc:${sg ? partyColor(sg) : "var(--faint)"}"><div class="l">${l}</div><div class="v"><i></i>${esc(sg || "–")} <b class="num">${v}</b></div><div class="s">${s}</div></div>`;
  $("ptKpis").innerHTML =
    box("Maior bancada na Câmara", topCam && topCam.sg, topCam ? topCam.cam : "", topCam ? `${pct(topCam.cam / TOTAL_SEATS * 100, 1)} das cadeiras` : "aguardando") +
    box("Mais governos (lidera)", topGov && topGov.gov ? topGov.sg : null, topGov && topGov.gov ? topGov.gov : "", topGov && topGov.gov ? topGov.govUF.join(", ") : "aguardando") +
    box("Mais votado para a Câmara", topVot && topVot.sg, topVot ? pct(topVot.pv, 1) : "", topVot ? `${big(topVot.votos)} de votos` : "aguardando") +
    `<div class="pk"><div class="l">Partidos com deputados</div><div class="v"><b class="num">${byCam.length}</b></div><div class="s">maioria absoluta: 257 cadeiras</div></div>`;

  // tabela
  const maxCam = Math.max(1, ...rows.map(x => x.cam));
  const show = pt.showAll ? rows : rows.slice(0, 12);
  const th = (k, t) => `<th class="n ${pt.sort === k ? "on" : ""}" data-sort="${k}">${t}${pt.sort === k ? " ▾" : ""}</th>`;
  $("ptTable").innerHTML = `<table class="pt"><thead><tr><th>Partido</th>${th("cam", "Câmara")}${th("gov", "Governos")}${th("sen", "Senado")}${th("votos", "Votos p/ Câmara")}</tr></thead><tbody>
    ${show.map(x => `<tr style="--pc:${partyColor(x.sg)}">
      <td><span class="sw"></span><b>${esc(x.sg)}</b></td>
      <td class="n"><div class="cb"><div style="width:${x.cam / maxCam * 100}%"></div></div><b class="num">${x.cam || "–"}</b></td>
      <td class="n num" title="${x.govUF.join(", ")}">${x.gov ? `${x.gov}${x.govE ? ` <span class="ok">(${x.govE} ✓)</span>` : ""}` : "–"}</td>
      <td class="n num">${x.sen ? `${x.sen}${x.senE ? ` <span class="ok">(${x.senE} ✓)</span>` : ""}` : "–"}</td>
      <td class="n num">${x.votos ? pct(x.pv, 1) : "–"}</td></tr>`).join("")}
    </tbody></table>` +
    (rows.length > 12 ? `<button class="more" id="ptMore">${pt.showAll ? "Mostrar menos" : `Ver todos os ${rows.length} partidos`}</button>` : "");
  if ($("ptMore")) $("ptMore").onclick = () => { pt.showAll = !pt.showAll; renderParties(); };
  $("ptStatus").textContent = A.ufsCam
    ? `Câmara: distribuição atual de cadeiras calculada pelo TSE com ${pct(A.pst, 1)} das urnas apuradas (média dos estados). Muda até o fim da apuração. Governos e Senado: quem está à frente agora; ✓ = eleito.`
    : "Carregando dados dos partidos…";
  if (typeof renderAnalyst === "function") renderAnalyst();
}

/* carrega só quando a seção aparece na tela */
(function initParties() {
  const sec = $("partidos");
  new IntersectionObserver(es => { pt.visible = es[0].isIntersecting; if (pt.visible) loadParties(); }, { rootMargin: "200px" }).observe(sec);
  setInterval(() => { if (pt.visible && state.auto && !document.hidden) loadParties(); }, 15000);
  $("ptTable").addEventListener("click", e => { const t = e.target.closest("th[data-sort]"); if (t) { pt.sort = t.dataset.sort; renderParties(); } });
  $("hemi").addEventListener("pointermove", e => {
    const c = e.target.closest("circle[data-sg]"), tip = $("tip");
    if (!c || e.pointerType !== "mouse") { tip.style.opacity = 0; return; }
    const x = pt.agg && pt.agg.rows.find(r => r.sg === c.dataset.sg);
    if (!x) return;
    tip.innerHTML = `<h4>${esc(x.sg)}</h4><div class="s">${x.cam} cadeiras · ${pct(x.cam / TOTAL_SEATS * 100, 1)} da Câmara</div><div class="s" style="margin:0">Governos: ${x.gov || 0} · Senado: ${x.sen || 0}</div>`;
    tip.style.opacity = 1; tip.style.left = Math.min(e.clientX + 16, innerWidth - 266) + "px"; tip.style.top = (e.clientY + 16) + "px";
  });
  $("hemi").addEventListener("mouseleave", () => $("tip").style.opacity = 0);
})();
