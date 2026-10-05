/* Simulador do 2º turno (Presidente).
   Simulação aritmética a partir do 1º turno, estado por estado: cada um dos dois finalistas mantém
   seus votos e recebe uma parte dos votos dos demais candidatos. Não é pesquisa nem previsão.
   Cenário "Como em 2022": em cada estado, os votos dos demais se dividem como o saldo observado
   entre o 1º e o 2º turno de 2022 (base-2022.json → t2). */
const ro = { mode: "2022", x: 0.5, over: {}, adv: false };

function roFinalists() {
  if (!an.br) return null;
  const list = candidatos(an.br);
  if (list.length < 3 || !+list[0].vap) return null;
  return { A: list[0], B: list[1], others: list.slice(2) };
}
// fração dos votos dos demais que vai para B no cenário de 2022 (t = fração que foi para o PT em 2022)
function rate22(uf, B, A) {
  const t2 = B22 && B22.t2 ? (B22.t2[uf] || B22.t2.br) : null;
  if (!t2) return 0.5;
  if (B.partido === "PT") return t2.t;
  if (B.partido === "PL") return 1 - t2.t;
  if (A.partido === "PT") return 1 - t2.t;
  if (A.partido === "PL") return t2.t;
  return 0.5;
}

function roSimulate(mode = ro.mode, x = ro.x, over = ro.over) {
  const F = roFinalists(); if (!F) return null;
  const { A, B } = F;
  const rows = []; let W = 0, wA2 = 0, wB2 = 0, wA1 = 0, wB1 = 0, wO = 0;
  const ufs = [...UFS.map(([uf]) => uf), "zz"];
  for (const uf of ufs) {
    const d = uf === "zz" ? an.zz : an.ufs[uf]; if (!d) continue;
    const list = candidatos(d), a = list.find(c => c.sqcand === A.sqcand), b = list.find(c => c.sqcand === B.sqcand);
    if (!a || !b || !+d.v.vv) continue;
    const A1 = num(a.pvapn), B1 = num(b.pvapn);
    let toB = 0, O = 0;
    for (const c of list) {
      if (c.sqcand === A.sqcand || c.sqcand === B.sqcand) continue;
      const s = num(c.pvapn); O += s;
      const r = mode === "custom" ? (over[c.sqcand] ?? x) : mode === "meio" ? 0.5 : rate22(uf, B, A);
      toB += s * r;
    }
    const B2 = B1 + toB, A2 = A1 + (O - toB);
    const pst = Math.max(0.01, num(d.s.pstn) / 100), w = +d.v.vv / pst;     // votos válidos estimados no fim da apuração
    rows.push({ uf, A1, B1, O, A2, B2, w, pst: pst * 100 });
    W += w; wA2 += A2 * w; wB2 += B2 * w; wA1 += A1 * w; wB1 += B1 * w; wO += O * w;
  }
  if (!W) return null;
  const nat = { A2: wA2 / W, B2: wB2 / W, A1: wA1 / W, B1: wB1 / W, O: wO / W };
  nat.beB = Math.max(0, (50 - nat.B1) / nat.O);   // fração dos demais de que B precisa para chegar a 50%
  nat.beA = Math.max(0, (50 - nat.A1) / nat.O);
  return { A, B, others: F.others, rows, nat, mode };
}

/* ---------- interface ---------- */
function renderRunoff() {
  const box = $("roBody"); if (!box) return;
  if (!B22 || !an.br || Object.keys(an.ufs).length < 27) { box.innerHTML = `<div class="skel" style="height:140px"></div>`; return; }
  const S = roSimulate(); if (!S) { box.innerHTML = `<p class="cv-hint">Aguardando dados do 1º turno.</p>`; return; }
  const { A, B, nat } = S;
  const r1 = pj.res && state.cargo === 1 && state.uf === "br" ? pj.res : null;
  if (num(A.pvapn) > 50 && (!r1 || r1.pFirst > 0.5)) { box.innerHTML = `<p class="cv-hint">${esc(title(A.nmu))} tem mais de 50% dos válidos: pelos números atuais, não haveria 2º turno.</p>`; return; }
  const colA = colorFor(A), colB = colorFor(B), win = nat.A2 >= nat.B2 ? A : B;
  const st = { A: 0, B: 0 }; S.rows.filter(r => r.uf !== "zz").forEach(r => r.A2 >= r.B2 ? st.A++ : st.B++);
  const side = (c, p, cls) => `<div class="ro-side ${cls}" style="--col:${colorFor(c)}"><span class="ro-ph">${esc(initials(c.nmu))}<img src="${photo(1, "br", c.sqcand)}" alt="" onerror="this.remove()"></span><div><b>${esc(title(c.nmu))}</b><em class="num">${pct(p, 1)}</em></div></div>`;
  const nat22 = B22.t2.br.t, rB22 = rate22("br", B, A);
  const sliderVal = ro.mode === "custom" ? ro.x : ro.mode === "meio" ? 0.5 : rB22;
  box.innerHTML = `
    <div class="ro-modes seg" id="roModes">
      <button data-m="2022" aria-selected="${ro.mode === "2022"}">Como em 2022</button>
      <button data-m="meio" aria-selected="${ro.mode === "meio"}">Meio a meio</button>
      <button data-m="custom" aria-selected="${ro.mode === "custom"}">Meu cenário</button>
    </div>
    <div class="ro-duel">
      ${side(A, nat.A2, "")}
      <div class="ro-track"><div class="a" style="width:${nat.A2}%;background:${colA}"></div><div class="b" style="width:${nat.B2}%;background:${colB}"></div><span class="mid"></span></div>
      ${side(B, nat.B2, "r")}
    </div>
    <p class="ro-head"><b style="color:${colorFor(win)}">${esc(title(win.nmu))}</b> venceria com ${pct(Math.max(nat.A2, nat.B2), 1)} dos válidos neste cenário, à frente em ${win === A ? st.A : st.B} de 27 estados.</p>
    <div class="ro-be">
      <div><span>Para ${esc(title(B.nmu))} virar</span><b class="num" style="color:${colB}">${nat.beB > 1 ? "impossível" : pct(nat.beB * 100, 0)}</b><em>dos votos dos demais candidatos</em></div>
      <div><span>${esc(title(A.nmu))} precisa de</span><b class="num" style="color:${colA}">${pct(nat.beA * 100, 0)}</b><em>dos votos dos demais candidatos</em></div>
      <div><span>Em 2022, o ${esc(B.partido)} ficou com</span><b class="num">${pct(rB22 * 100, 0)}</b><em>do saldo dos demais (1º → 2º turno)</em></div>
    </div>
    <label class="ro-sl"><span>Dos votos dos demais candidatos (${pct(nat.O, 1)} dos válidos), quanto vai para <b style="color:${colB}">${esc(title(B.nmu))}</b>: <b class="num" id="roXv">${pct(sliderVal * 100, 0)}</b></span>
      <div class="ro-range"><input type="range" id="roX" min="0" max="100" step="1" value="${Math.round(sliderVal * 100)}" style="--col:${colB}">
        <i class="mk be" style="left:${Math.min(100, nat.beB * 100)}%" title="Ponto de virada"></i><i class="mk y22" style="left:${rB22 * 100}%" title="Como em 2022"></i></div>
      <span class="ro-leg"><i class="be"></i>ponto de virada <i class="y22"></i>como em 2022</span>
    </label>
    <details class="ro-adv" ${ro.adv ? "open" : ""}><summary>Ajustar candidato por candidato</summary>
      ${S.others.filter(c => num(c.pvapn) >= 0.5).map(c => {
        const v = ro.over[c.sqcand] ?? sliderVal;
        return `<div class="ro-cand"><span>${esc(title(c.nmu))} <em>${esc(c.partido)} · ${pct(num(c.pvapn), 1)}</em></span><input type="range" min="0" max="100" step="5" value="${Math.round(v * 100)}" data-sq="${c.sqcand}" style="--col:${colB}"><b class="num">${pct(v * 100, 0)} → ${esc(title(B.nmu).split(" ")[0])}</b></div>`;
      }).join("")}
      <p class="feednote">Mexer aqui muda para "Meu cenário". Os candidatos com menos de 0,5% seguem o controle geral.</p>
    </details>
    <div class="ro-map"><svg id="roMap" viewBox="0 -6 1060 1002" aria-label="Quem venceria em cada estado neste cenário"></svg>
      <div class="ro-mapleg"><span><i style="background:${colA}"></i>${esc(title(A.nmu))} · ${st.A}</span><span><i style="background:${colB}"></i>${esc(title(B.nmu))} · ${st.B}</span></div></div>
    <p class="feednote">Simulação aritmética sobre o 1º turno, <b>não é pesquisa nem previsão</b>. Considera que cada finalista mantém seus eleitores e que o comparecimento e os brancos/nulos não mudam. "Como em 2022" aplica, em cada estado, a divisão observada entre o 1º e o 2º turno de 2022 (saldo líquido). Fonte: TSE.</p>`;
  // mapa
  const byUf = Object.fromEntries(S.rows.map(r => [r.uf, r]));
  $("roMap").innerHTML = Object.entries(BR_MAP.paths).map(([uf, d]) => `<path data-uf="${uf}" d="${d}" stroke="var(--surface)" stroke-width="1.3" vector-effect="non-scaling-stroke"/>`).join("");
  $("roMap").querySelectorAll("path").forEach(p => {
    const r = byUf[p.dataset.uf]; if (!r) return setFill(p, "var(--land)");
    const aw = r.A2 >= r.B2, m = Math.abs(r.A2 - r.B2);
    setFill(p, aw ? colA : colB, Math.min(100, 40 + m * 2.5));
  });
  bindRunoff(S);
}

function bindRunoff(S) {
  $("roModes").onclick = e => { const b = e.target.closest("button"); if (!b) return; ro.mode = b.dataset.m; if (ro.mode !== "custom") ro.over = {}; renderRunoff(); };
  $("roX").oninput = e => { ro.mode = "custom"; ro.x = +e.target.value / 100; $("roXv").textContent = pct(+e.target.value, 0); clearTimeout(ro.t); ro.t = setTimeout(renderRunoff, 60); };
  document.querySelectorAll(".ro-cand input").forEach(inp => inp.oninput = e => { ro.mode = "custom"; ro.adv = true; ro.over[e.target.dataset.sq] = +e.target.value / 100; clearTimeout(ro.t); ro.t = setTimeout(renderRunoff, 60); });
  document.querySelector(".ro-adv").ontoggle = e => ro.adv = e.target.open;
  $("roMap").onpointermove = e => {
    const p = e.target.closest("path"), tip = $("tip"); if (!p || e.pointerType !== "mouse") { tip.style.opacity = 0; return; }
    const r = S.rows.find(x => x.uf === p.dataset.uf); if (!r) return;
    tip.innerHTML = `<h4>${esc(UFNAME[r.uf])}</h4><div class="s">1º turno: ${esc(title(S.A.nmu))} ${pct(r.A1, 1)} · ${esc(title(S.B.nmu))} ${pct(r.B1, 1)} · demais ${pct(r.O, 1)}</div>
      <div class="r" style="--col:${colorFor(S.A)}"><span>${esc(title(S.A.nmu))}</span><b class="num">${pct(r.A2, 1)}</b><div class="b"><div style="width:${r.A2}%"></div></div></div>
      <div class="r" style="--col:${colorFor(S.B)}"><span>${esc(title(S.B.nmu))}</span><b class="num">${pct(r.B2, 1)}</b><div class="b"><div style="width:${r.B2}%"></div></div></div>`;
    tip.style.opacity = 1; tip.style.left = Math.min(e.clientX + 16, innerWidth - 266) + "px"; tip.style.top = Math.min(e.clientY + 16, innerHeight - tip.offsetHeight - 10) + "px";
  };
  $("roMap").onmouseleave = () => $("tip").style.opacity = 0;
}

/* ---------- comentários para o "Meu analista" ---------- */
function runoffInsights(out) {
  if (!B22 || !B22.t2 || Object.keys(an.ufs).length < 27) return;
  const F = roFinalists(); if (!F || num(F.A.pvapn) > 50) return;
  const S22 = roSimulate("2022"), Sm = roSimulate("meio"); if (!S22) return;
  const { A, B, nat } = S22, nA = title(A.nmu), nB = title(B.nmu);
  out.push({ cat: "pres", tag: "2º turno · simulação", score: 90, col: colorFor(B),
    title: nat.beB > 1 ? `Pelos números do 1º turno, ${nB} não alcança 50% nem com todos os votos dos demais` : `Para virar no 2º turno, ${nB} precisa de ${pct(nat.beB * 100, 0)} dos votos dos demais candidatos`,
    body: `Somados, os candidatos fora da disputa têm ${pct(nat.O, 1)} dos válidos. ${nA} precisa de só ${pct(nat.beA * 100, 0)} desses votos para passar de 50%. Em 2022, o saldo entre os turnos deu ao ${B.partido === "PT" || B.partido === "PL" ? B.partido : "candidato"} ${pct(rate22("br", B, A) * 100, 0)} desses votos. Conta aritmética sobre o 1º turno; não é pesquisa.` });
  const w = nat.A2 >= nat.B2 ? A : B;
  out.push({ cat: "pres", tag: "2º turno · simulação", score: 86, col: colorFor(w),
    title: `Se os votos se dividirem como em 2022, ${title(w.nmu)} teria ${pct(Math.max(nat.A2, nat.B2), 1)} no 2º turno`,
    body: `Aplicando, estado por estado, a divisão observada entre o 1º e o 2º turno de 2022: ${nA} ${pct(nat.A2, 1)} × ${nB} ${pct(nat.B2, 1)}. No cenário "meio a meio", ficaria ${pct(Sm.nat.A2, 1)} × ${pct(Sm.nat.B2, 1)}. Teste outros cenários no simulador.` });
}
