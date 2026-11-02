// Gestione delle categorie: elenco, creazione, modifica ed eliminazione di quelle dell'utente.
import { uid } from "./calc.js";
import { BASE, ENT_BASE, ICONE, PALETTE, categorie, tipiEntrata, badge, icona } from "./categorie.js";
import { apriFoglio } from "./guida.js";
import { entra, evidenzia } from "./anim.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

/** Quante spese (o entrate extra) usano una categoria (Modello + mesi personalizzati). */
function usi(state, k, tipo = "spese") {
  if (tipo === "entrate") return Object.values(state.mesi).reduce((n, m) => n + (m.entrate || []).filter((v) => v.cat === k).length, 0);
  let n = (state.piano.voci || []).filter((v) => v.cat === k).length;
  Object.values(state.mesi).forEach((m) => { n += (m.voci || []).filter((v) => v.cat === k).length; });
  return n;
}
/** Cosa cambia tra categorie delle spese e tipi di entrata. */
const CONF = {
  spese: { lista: categorie, base: BASE, campo: "categorie", pref: "c", uno: "spesa", tanti: "spese", tuoi: "Le tue categorie", nessuno: "Non hai ancora creato categorie.", crea: "Crea una categoria",
    diSpare: "Categorie di Spare", intro: "Ogni spesa ha una categoria: il colore è quello della barra in <b>Resto in tasca</b>. Puoi creare le tue.", nuova: "Nuova categoria", es: "es. Fumetti", cosa: "categoria" },
  entrate: { lista: tipiEntrata, base: ENT_BASE, campo: "cat_entrate", pref: "e", uno: "entrata", tanti: "entrate", tuoi: "I tuoi tipi di entrata", nessuno: "Non hai ancora creato tipi di entrata.", crea: "Crea un tipo di entrata",
    diSpare: "Tipi di Spare", intro: "Ogni entrata extra ha un tipo: così sai da dove arrivano i soldi in più. Puoi creare i tuoi.", nuova: "Nuovo tipo", es: "es. Ripetizioni", cosa: "tipo" },
};

/**
 * Apre la gestione categorie. Con `nuova: true` parte direttamente dal modulo di creazione;
 * `onCreata(k)` riceve la chiave della categoria appena creata.
 */
export function apriCategorie({ state, savePiano, saveMese, onChange, nuova = false, onCreata, tipo = "spese", conEntrate = false }) {
  const f = apriFoglio("Categorie", () => onChange && onChange());
  let K = CONF[tipo];
  const chiudi = () => { f.close(); onChange && onChange(); };

  function elenco(nuovaK, anima = true) {
    f.body.innerHTML = "";
    if (conEntrate) {
      // Spese / Entrate: due elenchi nello stesso foglio
      const sg = document.createElement("div"); sg.className = "seg cat-tipo"; sg.setAttribute("role", "group"); sg.setAttribute("aria-label", "Categorie di");
      [["spese", "Spese"], ["entrate", "Entrate extra"]].forEach(([t, n]) => {
        const b = document.createElement("button"); b.type = "button"; b.textContent = n; b.setAttribute("aria-pressed", String(t === tipo));
        b.onclick = () => { if (t !== tipo) { tipo = t; K = CONF[t]; elenco(null, false); } };
        sg.appendChild(b);
      });
      f.body.appendChild(sg);
    }
    const mie = K.lista(state.piano).filter((c) => !c.base);
    f.body.insertAdjacentHTML("beforeend", `<p class="hint flush">${K.intro}</p>`);
    const box = document.createElement("div"); box.className = "card cat-list";
    box.innerHTML = `<div class="cat-sec">${K.tuoi}</div>` + (mie.length ? "" : `<div class="empty">${K.nessuno}</div>`);
    mie.forEach((c) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "cat-row"; b.dataset.k = c.k;
      const n = usi(state, c.k, tipo);
      b.innerHTML = `${badge(c, 30)}<span class="cat-n">${esc(c.n)}<small>${n ? `${n} ${n === 1 ? K.uno : K.tanti}` : `Nessuna ${K.uno}`}</small></span><span class="cat-go" aria-hidden="true">›</span>`;
      b.onclick = () => modulo(c);
      box.appendChild(b);
    });
    const add = document.createElement("button"); add.type = "button"; add.className = "add-open"; add.innerHTML = `${icona("tag", "currentColor", 16)} ${K.crea}`;
    add.onclick = () => modulo(null);
    box.appendChild(add);
    f.body.appendChild(box);
    const bb = document.createElement("div"); bb.className = "card cat-list";
    bb.innerHTML = `<div class="cat-sec">${K.diSpare}</div>` + K.base.map((c) => `<div class="cat-row ro">${badge(c, 30)}<span class="cat-n">${esc(c.n)}</span></div>`).join("");
    f.body.appendChild(bb);
    f.foot.innerHTML = "";
    const ok = document.createElement("button"); ok.type = "button"; ok.className = "btn primary"; ok.textContent = "Fatto"; ok.onclick = chiudi;
    f.foot.appendChild(ok);
    if (anima) entra([...f.body.children]);
    if (nuovaK) evidenzia(f.body.querySelector(`.cat-row[data-k="${nuovaK}"]`));
  }

  function modulo(cat) {
    const w = cat ? { ...cat } : { k: K.pref + uid(), n: "", c: PALETTE[Math.floor(Math.random() * PALETTE.length)], i: "tag" };
    f.body.innerHTML = "";
    const prev = document.createElement("div"); prev.className = "cat-prev";
    const disegnaPrev = () => { prev.innerHTML = `${badge(w, 44)}<b>${esc(w.n || K.nuova)}</b>`; };
    disegnaPrev();
    f.body.appendChild(prev);

    const nf = document.createElement("label"); nf.className = "field"; nf.htmlFor = "cat-nome";
    nf.innerHTML = `<span class="label">Nome</span><input type="text" id="cat-nome" maxlength="40" placeholder="${K.es}" autocomplete="off">`;
    const ni = nf.querySelector("input"); ni.value = w.n;
    ni.addEventListener("input", () => { w.n = ni.value; disegnaPrev(); err.hidden = true; });
    f.body.appendChild(nf);

    f.body.insertAdjacentHTML("beforeend", '<div class="cat-sec flush">Colore</div>');
    const pal = document.createElement("div"); pal.className = "cat-pal"; pal.setAttribute("role", "radiogroup"); pal.setAttribute("aria-label", "Colore");
    PALETTE.forEach((c) => {
      const b = document.createElement("button"); b.type = "button"; b.style.background = c; b.setAttribute("role", "radio"); b.setAttribute("aria-label", c);
      b.setAttribute("aria-checked", String(c.toLowerCase() === w.c.toLowerCase()));
      b.onclick = () => { w.c = c; pal.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b))); disegnaPrev(); disegnaIcone(); };
      pal.appendChild(b);
    });
    f.body.appendChild(pal);

    f.body.insertAdjacentHTML("beforeend", '<div class="cat-sec flush">Icona</div>');
    const ig = document.createElement("div"); ig.className = "cat-icons"; ig.setAttribute("role", "radiogroup"); ig.setAttribute("aria-label", "Icona");
    const disegnaIcone = () => {
      ig.innerHTML = "";
      Object.keys(ICONE).forEach((nome) => {
        const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-label", nome);
        b.setAttribute("aria-checked", String(nome === w.i)); b.style.setProperty("--cc", w.c);
        b.innerHTML = icona(nome, nome === w.i ? "#fff" : w.c, 20);
        b.onclick = () => { w.i = nome; disegnaIcone(); disegnaPrev(); };
        ig.appendChild(b);
      });
    };
    disegnaIcone();
    f.body.appendChild(ig);
    const err = document.createElement("div"); err.className = "err"; err.hidden = true; f.body.appendChild(err);

    f.foot.innerHTML = "";
    const indietro = document.createElement("button"); indietro.type = "button"; indietro.className = "btn";
    indietro.textContent = nuova && !cat ? "Annulla" : "Indietro";
    indietro.onclick = () => { if (nuova && !cat) chiudi(); else elenco(); };
    const salva = document.createElement("button"); salva.type = "button"; salva.className = "btn primary"; salva.textContent = cat ? "Salva" : "Crea";
    salva.onclick = () => {
      const nome = w.n.trim();
      if (!nome) { err.textContent = `Scrivi il nome ${tipo === "entrate" ? "del tipo" : "della categoria"}.`; err.hidden = false; ni.focus(); return; }
      if (K.lista(state.piano).some((c) => c.k !== w.k && c.n.toLowerCase() === nome.toLowerCase())) { err.textContent = `Esiste già ${tipo === "entrate" ? "un tipo" : "una categoria"} con questo nome.`; err.hidden = false; return; }
      const lista = state.piano[K.campo] || (state.piano[K.campo] = []);
      const i = lista.findIndex((c) => c.k === w.k);
      const dato = { k: w.k, n: nome, c: w.c, i: w.i };
      if (i >= 0) lista[i] = dato; else lista.push(dato);
      savePiano();
      if (nuova && !cat) { f.close(); onCreata && onCreata(w.k); onChange && onChange(); return; }
      elenco(w.k);
    };
    if (cat) {
      const del = document.createElement("button"); del.type = "button"; del.className = "btn danger-soft"; del.textContent = "Elimina";
      del.onclick = () => {
        const n = usi(state, cat.k, tipo);
        if (!confirm2(del, n ? `${n === 1 ? (tipo === "entrate" ? "L'entrata" : "La spesa") : `Le ${n} ${K.tanti}`} di "${cat.n}" ${n === 1 ? "passa" : "passano"} in Altro. Eliminare?` : `Eliminare "${cat.n}"?`)) return;
      };
      del._onOk = () => {
        state.piano[K.campo] = (state.piano[K.campo] || []).filter((c) => c.k !== cat.k);
        if (tipo === "spese") (state.piano.voci || []).forEach((v) => { if (v.cat === cat.k) v.cat = "altro"; });
        Object.entries(state.mesi).forEach(([id, m]) => {
          let cambiato = false;
          (tipo === "entrate" ? m.entrate || [] : m.voci || []).forEach((v) => { if (v.cat === cat.k) { v.cat = "altro"; cambiato = true; } });
          if (cambiato) saveMese(id);
        });
        savePiano(); elenco();
      };
      f.foot.append(indietro, del, salva);
    } else f.foot.append(indietro, salva);
    entra([...f.body.children]);
    if (!cat) ni.focus();
  }

  // Conferma dentro il piè di pagina (niente finestre del browser)
  function confirm2(btn, testo) {
    f.foot.innerHTML = "";
    const t = document.createElement("span"); t.className = "hint cat-conf"; t.textContent = testo;
    const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Annulla";
    const si = document.createElement("button"); si.type = "button"; si.className = "btn danger"; si.textContent = "Elimina";
    const cat = btn; no.onclick = () => elenco(); si.onclick = () => cat._onOk();
    f.foot.append(t, no, si);
    return false;
  }

  if (nuova) modulo(null); else elenco(null, false);
}
