// Animazioni sobrie, stile iPhone: brevi (0,2-0,6 s), solo quando si naviga, mai mentre scrivi.
// Con "Riduci movimento" attivo sul dispositivo non si muove niente.
const ridotto = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(.25, .8, .25, 1)";

/* ---------- Pillola che scivola nei controlli a segmenti (schede, 12/13/14, tema) ---------- */
const posizioni = new Map(); // ultima posizione per controllo, così anche un controllo ridisegnato parte da lì
export function pillola(box, chiave) {
  if (!box) return;
  let p = box.querySelector(":scope > .pill"), nuova = false;
  if (!p) {
    p = document.createElement("span"); p.className = "pill"; p.setAttribute("aria-hidden", "true");
    box.prepend(p); box.classList.add("has-pill"); nuova = true;
  }
  const on = box.querySelector(':scope > button[aria-selected="true"], :scope > button[aria-pressed="true"]');
  if (!on || !on.offsetWidth) { p.style.opacity = "0"; return; }
  const dove = { x: on.offsetLeft, w: on.offsetWidth }, prima = posizioni.get(chiave);
  posizioni.set(chiave, dove);
  const metti = (q) => { p.style.transform = `translateX(${q.x}px)`; p.style.width = q.w + "px"; };
  p.style.opacity = "1";
  if (!prima || ridotto()) { p.style.transition = "none"; metti(dove); void p.offsetWidth; p.style.transition = ""; return; }
  if (nuova) { p.style.transition = "none"; metti(prima); void p.offsetWidth; p.style.transition = ""; }
  metti(dove);
}

/* ---------- Contenuto che entra (cambio scheda o mese) ---------- */
export function entra(elementi) {
  if (ridotto()) return;
  elementi.forEach((el) => el.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE }));
}

/* ---------- Barre colorate che si riempiono da sinistra ---------- */
export function riempi(barre) {
  if (ridotto()) return;
  barre.forEach((b) => b.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 600, easing: EASE }));
}
/** Barra dell'obiettivo: la parte piena cresce fino alla percentuale. */
export function allunga(spans) {
  if (ridotto()) return;
  spans.forEach((s) => { const w = s.style.width; if (w) s.animate([{ width: "0%" }, { width: w }], { duration: 700, easing: EASE }); });
}
/** Barre del grafico del Deposito: crescono dal basso, una dopo l'altra. */
export function cresci(barre) {
  if (ridotto()) return;
  barre.forEach((b, i) => b.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { duration: 450, delay: i * 25, easing: EASE, fill: "backwards" }));
}

/* ---------- Numeri che "contano" fino al nuovo valore ---------- */
// Ogni numero da animare ha data-k (chiave), data-n (valore) e data-f ("eur" o "eur0").
const ultimi = new Map();
export function contaNumeri(radice, formati) {
  radice.querySelectorAll("[data-k][data-n]").forEach((el) => {
    const k = el.dataset.k, a = Number(el.dataset.n), da = ultimi.get(k), fmt = formati[el.dataset.f] || formati.eur;
    ultimi.set(k, a);
    if (da == null || da === a || ridotto() || !isFinite(a)) return;
    const t0 = performance.now(), D = 450;
    const passo = (t) => {
      if (el._fermo || !el.isConnected) return; // mentre scrivi comanda l'aggiornamento normale
      const x = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - x, 3);
      el.textContent = fmt(x < 1 ? da + (a - da) * e : a);
      if (x < 1) requestAnimationFrame(passo);
    };
    el.textContent = fmt(da); requestAnimationFrame(passo);
  });
}
/** Aggiorna il valore ricordato (quando cambia mentre scrivi) e ferma un conteggio in corso. */
export function fermaNumero(el, valore) {
  if (!el) return;
  el._fermo = true;
  if (el.dataset.k) { el.dataset.n = valore; ultimi.set(el.dataset.k, valore); }
}
/** Ricorda i valori attuali senza animarli (dopo un aggiornamento mentre scrivi). */
export function ricorda(radice) {
  radice.querySelectorAll("[data-k][data-n]").forEach((el) => ultimi.set(el.dataset.k, Number(el.dataset.n)));
}
