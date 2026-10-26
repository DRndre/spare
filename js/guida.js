// Configurazione guidata (5 passaggi) e pagina "Come funziona".
// La guida lavora su una copia dei dati: salva solo quando si preme "Fine".
import { N, round, fmt, eur, parseNum, uid, calcMonth, meseCorrente, monthRange, monthLabelLong, MESI_NOMI, CATS } from "./calc.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

// Spese di esempio da spuntare, divise per gruppo
const ESEMPI = [
  { g: "Casa", voci: [["Affitto o mutuo", "casa"], ["Bollette (luce e gas)", "casa"], ["Condominio", "casa"], ["Internet casa", "casa"]] },
  { g: "Auto e trasporti", voci: [["Rata auto", "auto"], ["Assicurazione auto", "auto"], ["Bollo auto", "auto"], ["Carburante", "auto"], ["Abbonamento mezzi", "auto"]] },
  { g: "Telefono e abbonamenti", voci: [["Telefono", "abbonamenti"], ["Streaming (Netflix, Spotify…)", "abbonamenti"], ["Palestra", "abbonamenti"]] },
  { g: "Persona", voci: [["Spesa alimentare", "persona"], ["Barbiere o parrucchiere", "persona"]] },
];

/* ---------- Finestra sopra l'app ---------- */
function apriFoglio(titolo, onClose) {
  const ov = document.createElement("div"); ov.className = "sheet-bg";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titolo)}">
    <div class="sheet-head"><h2>${esc(titolo)}</h2><button type="button" class="icon-btn sheet-x" aria-label="Chiudi">
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>
    <div class="sheet-body"></div><div class="sheet-foot"></div></div>`;
  document.body.appendChild(ov); document.body.classList.add("no-scroll");
  const close = () => { ov.remove(); document.body.classList.remove("no-scroll"); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") { close(); onClose && onClose(); } };
  document.addEventListener("keydown", onKey);
  ov.querySelector(".sheet-x").onclick = () => { close(); onClose && onClose(); };
  return { ov, body: ov.querySelector(".sheet-body"), foot: ov.querySelector(".sheet-foot"), close };
}

/* Campo con importo (€ o %) */
function campo(label, value, onVal, { hint = "", unit = "€", id } = {}) {
  const f = document.createElement("label"); f.className = "field"; f.htmlFor = id;
  f.innerHTML = `<span class="label">${esc(label)}</span><span class="money"><input type="text" inputmode="decimal" autocomplete="off" id="${id}"><span class="eur">${unit}</span></span>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}`;
  const inp = f.querySelector("input"); inp.value = value ? fmt.format(value) : "";
  inp.placeholder = "0,00";
  inp.addEventListener("input", () => { const n = parseNum(inp.value); onVal(isNaN(n) || n < 0 ? 0 : round(n)); });
  inp.addEventListener("blur", () => { const n = parseNum(inp.value); inp.value = isNaN(n) || !n ? "" : fmt.format(round(n)); });
  return f;
}
function scelta(label, value, opzioni, onCh, { hint = "", id } = {}) {
  const f = document.createElement("label"); f.className = "field"; f.htmlFor = id;
  f.innerHTML = `<span class="label">${esc(label)}</span><select id="${id}">${opzioni.map(([v, t]) => `<option value="${v}"${String(v) === String(value) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}`;
  f.querySelector("select").onchange = (e) => onCh(e.target.value);
  return f;
}
function spunta(testo, checked, onCh, sotto = "") {
  const l = document.createElement("label"); l.className = "check";
  l.innerHTML = `<input type="checkbox"${checked ? " checked" : ""}><span><b>${esc(testo)}</b>${sotto ? `<br><span class="hint">${esc(sotto)}</span>` : ""}</span>`;
  l.querySelector("input").onchange = (e) => onCh(e.target.checked);
  return l;
}
const griglia = (...els) => { const d = document.createElement("div"); d.className = "fields"; els.forEach((e) => e && d.appendChild(e)); return d; };
const testo = (html, cls = "hint") => { const p = document.createElement("p"); p.className = cls + " flush"; p.innerHTML = html; return p; };

/* ---------- Configurazione guidata ---------- */
export function apriGuida({ state, savePiano, saveDeposito, primaVolta, onDone, onCancel }) {
  const p0 = state.piano, d0 = state.deposito;
  const oggi = meseCorrente();
  // copia di lavoro
  const w = {
    mese_inizio: primaVolta ? oggi : p0.mese_inizio,
    stipendio: N(p0.stipendio), entrate_extra: N(p0.entrate_extra),
    mensilita: N(p0.mensilita) || 13, tredicesima: N(p0.tredicesima), quattordicesima: N(p0.quattordicesima),
    mese_13: N(p0.mese_13) || 12, mese_14: N(p0.mese_14) || 6,
    risparmio: N(p0.risparmio), saldo_iniziale: N(d0.saldo_iniziale), extra_al_deposito: p0.extra_al_deposito !== false,
    usa_deposito: !!p0.usa_deposito, tasso: 0, banca: "",
    esistenti: (p0.voci || []).map((v) => ({ ...v })),
    nuove: {}, // nome → { importo, cat, scelta }
    altre: [],
  };
  const haTassi = (d0.periodi || []).length > 0;
  let passo = 0;
  const PASSI = ["Le tue entrate", "Mensilità", "Spese fisse", "Risparmi", "Riepilogo"];
  const f = apriFoglio("Configurazione guidata", () => onCancel && onCancel());

  function vociFinali() {
    const out = w.esistenti.map((v) => ({ ...v }));
    Object.entries(w.nuove).forEach(([nome, x]) => { if (x.scelta && x.importo > 0) out.push({ id: uid(), nome, importo: x.importo, cat: x.cat }); });
    w.altre.forEach((x) => { if (x.nome.trim() && x.importo > 0) out.push({ id: uid(), nome: x.nome.trim(), importo: x.importo, cat: x.cat }); });
    return out;
  }
  function pianoProva() {
    return { ...p0, stipendio: w.stipendio, entrate_extra: w.entrate_extra, risparmio: w.risparmio, mensilita: w.mensilita,
      tredicesima: w.tredicesima, quattordicesima: w.quattordicesima, mese_13: w.mese_13, mese_14: w.mese_14,
      extra_al_deposito: w.extra_al_deposito, usa_deposito: w.usa_deposito, voci: vociFinali() };
  }

  function disegna() {
    const b = f.body; b.innerHTML = "";
    b.insertAdjacentHTML("beforeend", `<div class="steps" aria-label="Passaggio ${passo + 1} di ${PASSI.length}">${PASSI.map((t, i) => `<span class="${i === passo ? "on" : i < passo ? "done" : ""}"></span>`).join("")}</div>
      <h3 class="step-title">${passo + 1}. ${PASSI[passo]}</h3>`);
    if (passo === 0) {
      b.appendChild(testo("Partiamo da quanto entra ogni mese. Puoi cambiare tutto anche dopo, nella scheda <b>Modello</b>."));
      const opts = monthRange((Number(oggi.slice(0, 4)) - 2) + "-01", (Number(oggi.slice(0, 4)) + 2) + "-12").map((id) => [id, monthLabelLong(id)]);
      b.appendChild(griglia(
        campo("Stipendio netto mensile", w.stipendio, (n) => (w.stipendio = n), { id: "w-stip", hint: "Quello che ti arriva sul conto" }),
        campo("Entrate extra", w.entrate_extra, (n) => (w.entrate_extra = n), { id: "w-entr", hint: "Seconde entrate più o meno fisse (vuoto se non ne hai)" }),
      ));
      b.appendChild(griglia(scelta("Da che mese partiamo?", w.mese_inizio, opts, (x) => (w.mese_inizio = x), { id: "w-inizio", hint: "Di solito il mese in corso" })));
    }
    if (passo === 1) {
      b.appendChild(testo("Quante buste paga ricevi in un anno? Con 13 c'è la tredicesima, con 14 anche la quattordicesima."));
      b.appendChild(griglia(scelta("Mensilità", w.mensilita, [[12, "12 mensilità"], [13, "13 (con tredicesima)"], [14, "14 (con 13ª e 14ª)"]], (x) => { w.mensilita = Number(x); disegna(); }, { id: "w-mens" })));
      const mesi = (escl) => MESI_NOMI.map((n, i) => [i + 1, n]).filter(([k]) => k !== escl);
      if (w.mensilita >= 13) b.appendChild(griglia(
        campo("Tredicesima (netto stimato)", w.tredicesima, (n) => (w.tredicesima = n), { id: "w-13" }),
        scelta("Arriva a", w.mese_13, mesi(w.mensilita >= 14 ? w.mese_14 : 0), (x) => { w.mese_13 = Number(x); disegna(); }, { id: "w-m13", hint: "Di solito dicembre" }),
      ));
      if (w.mensilita >= 14) b.appendChild(griglia(
        campo("Quattordicesima (netto stimato)", w.quattordicesima, (n) => (w.quattordicesima = n), { id: "w-14" }),
        scelta("Arriva a", w.mese_14, mesi(w.mese_13), (x) => { w.mese_14 = Number(x); disegna(); }, { id: "w-m14", hint: "Spesso giugno o luglio" }),
      ));
      if (w.mensilita >= 13) b.appendChild(testo("Non sai la cifra esatta? Metti più o meno uno stipendio: la correggi quando arriva la busta paga."));
    }
    if (passo === 2) {
      b.appendChild(testo("Spunta le spese che hai e scrivi quanto costano <b>al mese</b>. Se una spesa arriva ogni tanto, dividila: ad esempio un bollo da 232 € l'anno diventa 19,33 € al mese."));
      if (w.esistenti.length) b.appendChild(testo(`Hai già <b>${w.esistenti.length} spese</b> nel Modello (totale ${eur(w.esistenti.reduce((a, v) => a + N(v.importo), 0))}): restano come sono. Qui puoi aggiungerne altre.`, "note"));
      const nomiEsistenti = new Set(w.esistenti.map((v) => v.nome.toLowerCase()));
      ESEMPI.forEach((gr) => {
        const box = document.createElement("div"); box.className = "card wiz-group";
        box.innerHTML = `<div class="group-head"><span class="gname">${esc(gr.g)}</span></div>`;
        gr.voci.forEach(([nome, cat]) => {
          if (nomiEsistenti.has(nome.toLowerCase())) return;
          const x = w.nuove[nome] || (w.nuove[nome] = { importo: 0, cat, scelta: false });
          const r = document.createElement("div"); r.className = "row wiz-row";
          r.innerHTML = `<label class="wiz-ck"><input type="checkbox"${x.scelta ? " checked" : ""}><span>${esc(nome)}</span></label><span class="imp"><input type="text" inputmode="decimal" placeholder="0,00" aria-label="Importo di ${esc(nome)}"><span class="eur">€</span></span>`;
          const ck = r.querySelector("input[type=checkbox]"), imp = r.querySelector(".imp input");
          imp.value = x.importo ? fmt.format(x.importo) : ""; imp.disabled = !x.scelta;
          ck.onchange = () => { x.scelta = ck.checked; imp.disabled = !ck.checked; if (ck.checked) imp.focus(); };
          imp.addEventListener("input", () => { const n = parseNum(imp.value); x.importo = isNaN(n) || n < 0 ? 0 : round(n); });
          box.appendChild(r);
        });
        if (box.querySelectorAll(".wiz-row").length) b.appendChild(box);
      });
      // spese libere
      const box = document.createElement("div"); box.className = "card wiz-group";
      box.innerHTML = `<div class="group-head"><span class="gname">Altre spese</span></div>`;
      w.altre.forEach((x, i) => {
        const r = document.createElement("div"); r.className = "row wiz-altra";
        r.innerHTML = `<input type="text" placeholder="Nome (es. Assicurazione casa)" aria-label="Nome della spesa"><span class="imp"><input type="text" inputmode="decimal" placeholder="0,00" aria-label="Importo"><span class="eur">€</span></span><select aria-label="Categoria">${CATS.map((c) => `<option value="${c.k}"${c.k === x.cat ? " selected" : ""}>${c.n}</option>`).join("")}</select>`;
        const [n, im] = r.querySelectorAll("input"); n.value = x.nome; im.value = x.importo ? fmt.format(x.importo) : "";
        n.addEventListener("input", () => (x.nome = n.value));
        im.addEventListener("input", () => { const v = parseNum(im.value); x.importo = isNaN(v) || v < 0 ? 0 : round(v); });
        r.querySelector("select").onchange = (e) => (x.cat = e.target.value);
        box.appendChild(r);
      });
      const add = document.createElement("div"); add.className = "add solo";
      add.innerHTML = `<button type="button" class="btn">+ Aggiungi un'altra spesa</button>`;
      add.querySelector("button").onclick = () => { w.altre.push({ nome: "", importo: 0, cat: "altro" }); disegna(); f.body.querySelector(".wiz-altra:last-of-type input")?.focus(); };
      box.appendChild(add);
      b.appendChild(box);
    }
    if (passo === 3) {
      b.appendChild(testo("Quanto vuoi mettere da parte ogni mese? Lascia vuoto se per ora non risparmi."));
      b.appendChild(griglia(
        campo("Risparmio del mese", w.risparmio, (n) => (w.risparmio = n), { id: "w-risp" }),
        campo("Risparmi che hai già", w.saldo_iniziale, (n) => (w.saldo_iniziale = n), { id: "w-gia", hint: "Vuoto se non ne hai" }),
      ));
      if (w.mensilita >= 13) b.appendChild(spunta(`Metti da parte anche ${w.mensilita >= 14 ? "tredicesima e quattordicesima" : "la tredicesima"}`, w.extra_al_deposito, (v) => (w.extra_al_deposito = v), "Se non la spunti, restano nel resto in tasca di quei mesi."));
      b.appendChild(spunta("Tengo i risparmi su un conto deposito", w.usa_deposito, (v) => { w.usa_deposito = v; disegna(); }, "Un conto che ti dà degli interessi. Se non ce l'hai, non spuntare."));
      if (w.usa_deposito) {
        if (haTassi) b.appendChild(testo("I tassi del tuo conto li trovi e li cambi nella scheda <b>Deposito</b>.", "note"));
        else {
          const bf = document.createElement("label"); bf.className = "field"; bf.htmlFor = "w-banca";
          bf.innerHTML = `<span class="label">Banca o conto</span><input type="text" id="w-banca" placeholder="Facoltativo" autocomplete="off">`;
          const bi = bf.querySelector("input"); bi.value = w.banca; bi.addEventListener("input", () => (w.banca = bi.value));
          b.appendChild(griglia(campo("Tasso lordo annuo", w.tasso, (n) => (w.tasso = n), { id: "w-tasso", unit: "%", hint: "Quello che dice la banca, es. 2,5" }), bf));
        }
      }
    }
    if (passo === 4) {
      const pp = pianoProva();
      const c = calcMonth({ stipendio: pp.stipendio, entrate_extra: pp.entrate_extra, risparmio: pp.risparmio, voci: pp.voci, prelievo: 0, extra: 0 }, pp);
      b.insertAdjacentHTML("beforeend", `<div class="hero wiz-hero"><div class="label">Ogni mese ti restano in tasca</div><div class="big${c.resto < 0 ? " neg" : ""}">${eur(c.resto)}</div>
        <div class="formula"><b>${eur(c.entrate)}</b> di entrate − <b>${eur(c.spese)}</b> di spese (${pp.voci.length}) − <b>${eur(c.toDep)}</b> messi da parte</div></div>`);
      if (c.resto < 0) b.appendChild(testo("Le spese superano le entrate: torna indietro e controlla le cifre, oppure riduci il risparmio.", "note"));
      const righe = [];
      if (w.mensilita >= 13) righe.push(`Tredicesima a ${MESI_NOMI[w.mese_13 - 1].toLowerCase()}${w.mensilita >= 14 ? `, quattordicesima a ${MESI_NOMI[w.mese_14 - 1].toLowerCase()}` : ""}${w.extra_al_deposito ? ": vanno nei risparmi" : ": restano in tasca"}.`);
      righe.push(w.usa_deposito ? "Scheda <b>Deposito</b>: risparmi con gli interessi del conto." : "Scheda <b>Risparmi</b>: quanto metti da parte, mese per mese.");
      righe.push("Nella scheda <b>Mesi</b> puoi cambiare un singolo mese (una spesa in più, uno stipendio diverso) senza toccare gli altri.");
      b.appendChild(testo(righe.join("<br>")));
    }
    // pulsanti
    f.foot.innerHTML = "";
    const indietro = document.createElement("button"); indietro.type = "button"; indietro.className = "btn"; indietro.textContent = "Indietro";
    indietro.disabled = passo === 0; indietro.onclick = () => { passo--; disegna(); f.body.scrollTop = 0; };
    const avanti = document.createElement("button"); avanti.type = "button"; avanti.className = "btn primary";
    avanti.textContent = passo === PASSI.length - 1 ? "Fine" : "Avanti";
    avanti.onclick = () => { if (passo < PASSI.length - 1) { passo++; disegna(); f.body.scrollTop = 0; } else salva(); };
    f.foot.append(indietro, avanti);
    f.body.querySelector("input:not([disabled]), select")?.focus({ preventScroll: true });
  }

  function salva() {
    const p = state.piano, d = state.deposito;
    Object.assign(p, { stipendio: w.stipendio, entrate_extra: w.entrate_extra, risparmio: w.risparmio, mensilita: w.mensilita,
      tredicesima: w.tredicesima, quattordicesima: w.quattordicesima, mese_13: w.mese_13, mese_14: w.mese_14,
      extra_al_deposito: w.extra_al_deposito, usa_deposito: w.usa_deposito, voci: vociFinali(), mese_inizio: w.mese_inizio });
    if (p.mese_fine < p.mese_inizio) p.senza_fine = true;
    d.saldo_iniziale = w.saldo_iniziale;
    if (w.usa_deposito && !haTassi && w.tasso > 0) d.periodi = [{ id: uid(), da: w.mese_inizio, tasso: w.tasso, nome: w.banca.trim() }];
    savePiano(); saveDeposito();
    f.close();
    onDone && onDone();
  }
  disegna();
}

/* ---------- Come funziona ---------- */
const AIUTO = [
  ["Il Modello", "È il tuo <b>mese tipo</b>: stipendio, spese fisse e risparmio. Tutti i mesi lo seguono, finché non ne cambi uno. Se modifichi il Modello, cambiano tutti i mesi che non hai personalizzato."],
  ["La scheda Mesi", "Qui vedi un mese alla volta. Se in un mese hai una spesa in più o uno stipendio diverso, cambialo lì: quel mese diventa <b>personalizzato</b> e gli altri non cambiano. Con <b>Ripristina dal modello</b> torna come il Modello. In alto scegli l'anno."],
  ["Resto in tasca", "È quello che ti rimane: <b>entrate</b> (stipendio, entrate extra, 13ª e 14ª) <b>meno spese meno risparmio</b>. Se va sotto zero diventa rosso. Nel Modello puoi mettere una soglia per avere un avviso quando scende sotto una cifra."],
  ["Spese che non sono mensili", "L'app ragiona a mesi. Una spesa annuale o ogni qualche mese va divisa: bollo da 232 € l'anno = 19,33 € al mese; abbonamento da 21 € ogni 6 mesi = 3,50 € al mese. Una spesa una tantum invece mettila solo nel mese in cui la paghi."],
  ["Tredicesima e quattordicesima", "Nel Modello scegli quante mensilità hai (12, 13 o 14), quanto valgono e in che mese arrivano. Puoi metterle da parte in automatico oppure lasciarle nel resto in tasca di quel mese."],
  ["Deposito o Risparmi", "Se usi un conto deposito, la scheda <b>Deposito</b> stima gli interessi: in <b>Tasso nel tempo</b> aggiungi una riga ogni volta che cambia il tasso o cambi banca. Se non hai un conto deposito, la scheda si chiama <b>Risparmi</b> e conta solo quanto metti da parte. Lo scegli nel Modello."],
  ["Obiettivo", "Nella scheda Deposito o Risparmi puoi scrivere una cifra da raggiungere (es. la caparra della casa): vedi a che punto sei e in che mese ci arrivi continuando così."],
  ["Telefono e computer", "Entra con la stessa email e password: i dati sono gli stessi ovunque. Sul telefono puoi aggiungere Spare alla schermata Home (iPhone: Safari → Condividi → Aggiungi alla schermata Home). Il tema chiaro o scuro si sceglie dal menu ⋯."],
  ["Backup e privacy", "I tuoi dati li vedi solo tu. Dal menu ⋯ puoi esportare un backup (un file) e reimportarlo quando vuoi."],
];
export function apriAiuto() {
  const f = apriFoglio("Come funziona");
  f.body.innerHTML = AIUTO.map(([t, h], i) => `<details class="faq"${i === 0 ? " open" : ""}><summary>${esc(t)}</summary><p>${h}</p></details>`).join("");
  const ok = document.createElement("button"); ok.type = "button"; ok.className = "btn primary"; ok.textContent = "Ho capito"; ok.onclick = f.close;
  f.foot.appendChild(ok);
}
