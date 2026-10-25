/* Faixa de notícias no rodapé (estilo telejornal), alimentada pelos dados e pelo analista. */
const tk = { html: "", pending: null, hidden: false, idx: 0, count: 0 };
try { tk.hidden = localStorage.getItem("ticker-off") === "1"; } catch {}

function tickerItems() {
  const items = [];
  // placar de Presidente (nacional), do turno que o site está mostrando
  const t2 = state.turno === 2;
  if (t2) {
    const br2 = typeof an2 !== "undefined" ? an2.br : null, br1 = typeof an !== "undefined" ? an.br : null;
    if (started(br2)) {
      const [a, b] = candidatos(br2);
      items.push({ k: "Presidente · 2º turno", t: `${title(a.nmu)} ${pct(num(a.pvapn), 1)} × ${title(b.nmu)} ${pct(num(b.pvapn), 1)} · ${pct(num(br2.s.pstn), 1)} das urnas apuradas`, go: "resultado" });
    } else if (br1) {
      const [a, b] = candidatos(br1);
      if (a && b) items.push({ k: "2º turno", t: `${waitMsg().split(".")[0]}. No 1º turno: ${title(a.nmu)} ${pct(num(a.pvapn), 1)} × ${title(b.nmu)} ${pct(num(b.pvapn), 1)}`, go: "resultado" });
    }
    // governadores no 2º turno
    if (typeof an2 !== "undefined") for (const uf of T2_GOV) {
      const d = an2.gov[uf]; if (!started(d)) continue;
      const [a, b] = candidatos(d);
      if (a && b) items.push({ k: `Governador · ${uf.toUpperCase()}`, t: `${title(a.nmu)} ${pct(num(a.pvapn), 1)} × ${title(b.nmu)} ${pct(num(b.pvapn), 1)} · ${pct(num(d.s.pstn), 1)} apurado`, go: "resultado" });
    }
  } else {
    const br = (typeof an !== "undefined" && an.br) || (state.cargo === 1 && state.uf === "br" ? last : null);
    if (br) {
      const [a, b] = candidatos(br);
      if (a && b && +a.vap > 0) items.push({ k: "Presidente · 1º turno", t: `${title(a.nmu)} ${pct(num(a.pvapn), 1)} × ${title(b.nmu)} ${pct(num(b.pvapn), 1)} · ${pct(num(br.s.pstn), 1)} das urnas apuradas`, go: "resultado" });
    }
  }
  // projeção
  if (pj.res && pj.list && state.cargo === 1 && state.uf === "br") {
    const v = verdict(pj.res, pj.list, "");
    const off = v.badge === "Resultado oficial", sure = v.badge === "Já ganhou";
    if (v.lvl !== "wait") items.push({ k: off ? "Resultado" : sure ? "Já ganhou" : "Projeção", t: off ? v.head : sure ? `${v.head} · garantido matematicamente pelos números da apuração` : `${v.head} (${v.big} ${v.bigL}) · estimativa, não é resultado oficial`, go: "proj" });
  }
  // manchetes do analista
  if (typeof an !== "undefined" && an.out) an.out.filter(x => x.tag !== "Presidente" && x.tag !== "2º turno").slice(0, 8).forEach(x => items.push({ k: x.tag, t: x.title, go: "analista" }));
  // estados com vencedor definido no cargo atual
  if (typeof decidedUfs === "function") {
    const dec = decidedUfs();
    if (dec.length) items.push({ k: "Já ganhou", t: `${CARGO[state.cargo]}: ${dec.length} ${dec.length > 1 ? "estados já têm" : "estado já tem"} vencedor definido (${dec.slice(0, 6).map(([uf]) => uf.toUpperCase()).join(", ")}${dec.length > 6 ? "…" : ""})`, go: "mapa" });
  }
  // últimas atualizações
  store.get(feedKey(), []).slice(0, 5).forEach(e => items.push({ k: hhmm(e.m), t: e.t, go: "feed" }));
  return items;
}

function renderTicker() {
  const bar = $("ticker"); if (!bar) return;
  document.body.classList.toggle("has-ticker", !tk.hidden);
  bar.hidden = tk.hidden;
  if (tk.hidden) return;
  const items = tickerItems();
  if (!items.length) return;
  const one = items.map(x => `<button class="tk-item" data-go="${x.go}"><b>${esc(x.k)}</b>${esc(x.t)}</button><span class="tk-sep" aria-hidden="true">◆</span>`).join("");
  const html = one + one;   // duplicado para o loop contínuo
  if (html === tk.html) return;
  const track = $("tkTrack");
  // troca o conteúdo só no fim de uma volta (sem pulo); na primeira carga, ou quando chegam as manchetes do analista, troca na hora
  if (!tk.html || (tk.count < 10 && items.length > tk.count)) apply(); else tk.pending = apply;
  function apply() {
    tk.html = html; tk.count = items.length; track.innerHTML = html;
    const w = track.scrollWidth / 2, speed = innerWidth < 640 ? 45 : 70;   // px por segundo
    track.style.animationDuration = Math.max(20, w / speed) + "s";
    tk.idx = 0;
  }
}

(function initTicker() {
  const bar = $("ticker"), track = $("tkTrack");
  track.addEventListener("animationiteration", () => { if (tk.pending) { const f = tk.pending; tk.pending = null; f(); } });
  bar.addEventListener("click", e => {
    const it = e.target.closest(".tk-item");
    if (it) {
      if (it.dataset.go === "proj") { feedTab("proj"); $("feed").scrollIntoView({ behavior: "smooth" }); }
      else $(it.dataset.go)?.scrollIntoView({ behavior: "smooth" });
    }
  });
  $("tkClose").onclick = () => { tk.hidden = true; try { localStorage.setItem("ticker-off", "1"); } catch {} renderTicker(); $("tkOpen").hidden = false; };
  $("tkOpen").onclick = () => { tk.hidden = false; try { localStorage.removeItem("ticker-off"); } catch {} $("tkOpen").hidden = true; tk.html = ""; renderTicker(); };
  $("tkOpen").hidden = !tk.hidden;
  // movimento reduzido: troca uma notícia por vez
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(() => {
      const els = track.querySelectorAll(".tk-item"); if (!els.length) return;
      const n = els.length / 2; tk.idx = (tk.idx + 1) % n;
      track.style.transform = `translateX(${-els[tk.idx].offsetLeft}px)`;
    }, 6000);
  }
  setInterval(renderTicker, 5000);
  setTimeout(renderTicker, 1500);
})();
