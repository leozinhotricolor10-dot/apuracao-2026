/* Contagem regressiva até o fechamento das urnas do 2º turno (17h de Brasília = 20:00 UTC).
   Aparece no banner do resumo (modo 2º turno) e no aviso "Aguardando o início da apuração".
   Teste: ?countdownTest=10 define o alvo para daqui a 10 s (aceita 1 a 3600; ignorado fora disso). */
const CD = (() => {
  let target = Date.parse("2026-10-25T20:00:00Z");
  const m = /[?&]countdownTest=(\d{1,4})(?:&|#|$)/.exec(location.search);
  if (m && +m[1] >= 1 && +m[1] <= 3600) target = Date.now() + (+m[1]) * 1000;
  return { target, fired: false, lastLabel: "" };
})();

const cdPad = n => String(n).padStart(2, "0");
const cdPlural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

function cdPending() {   // true enquanto o TSE não publicou os primeiros votos do 2º turno
  const d = typeof an2 !== "undefined" ? an2.br : null;
  return !(d && +d.s.st > 0);
}

function cdRender() {
  const box = document.getElementById("cdBox"); if (!box) return;
  const show = cdPending() && typeof smView === "function" && smView() === "t2";
  box.hidden = !show;
  const err = document.getElementById("err");
  const left = CD.target - Date.now();
  const sec = Math.max(0, Math.ceil(left / 1000));
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), mi = Math.floor(sec % 3600 / 60), s = sec % 60;
  const clock = `${cdPad(d * 24 + h)}:${cdPad(mi)}:${cdPad(s)}`;

  if (show) {
    const done = left <= 0;
    box.classList.toggle("done", done);
    document.getElementById("cdNums").hidden = done;
    document.getElementById("cdDays").hidden = d === 0;
    document.getElementById("cdD").textContent = d;
    document.getElementById("cdH").textContent = cdPad(h);
    document.getElementById("cdM").textContent = cdPad(mi);
    document.getElementById("cdS").textContent = cdPad(s);
    document.getElementById("cdTxt").textContent = done ? "Urnas fechadas · apuração começando" : "Fechamento das urnas e início da apuração do 2º turno";
    const label = done ? "Urnas fechadas, apuração começando"
      : `Faltam ${d ? cdPlural(d, "dia", "dias") + ", " : ""}${cdPlural(h, "hora", "horas")} e ${cdPlural(mi, "minuto", "minutos")} para o fechamento das urnas`;
    if (label !== CD.lastLabel) { CD.lastLabel = label; box.setAttribute("aria-label", label); }
  }

  // aviso estático do app.js vira contagem
  if (err && err.style.display !== "none" && /^(Aguardando o início da apuração do 2º turno|A apuração começa em|Urnas fechadas · apuração começando)/.test(err.textContent) && cdPending()) {
    err.textContent = left > 0 ? `A apuração começa em ${clock} (17h, horário de Brasília). Os números aparecem aqui automaticamente.`
                              : "Urnas fechadas · apuração começando. Aguardando os primeiros números do TSE.";
  }

  if (left <= 0 && !CD.fired) {   // zerou: pede os dados do TSE na hora, sem recarregar a página
    CD.fired = true;
    if (typeof load === "function") load();
  }
}
setInterval(cdRender, 1000);
cdRender();
