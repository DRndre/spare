// Interfaccia: login, schede Mesi / Conto Deposito / Modello.
import {
  N, round, fmt, eur, parseNum, uid, monthRange, monthLabel, monthLabelLong,
  extraInfo, monthData, calcMonth, statoResto, testoResto, simulaDeposito, ordinaPeriodi, periodoDelMese, addMonths,
  mesiPiano, meseCorrente, MESI_NOMI, fineSpesa, attivaNel,
} from "./calc.js";
import {
  sb, configured, state, onStatus, loadAll, savePiano, saveDeposito, saveMese, resetMese, exportData, importData,
} from "./store.js";
import { LOGO } from "./logo.js";
import { categorie, catInfo, badge, icona } from "./categorie.js";
import { apriCategorie } from "./categorie-ui.js";
const SLOGAN = "Spare | Quanto ti resta?"; // titolo per accesso, benvenuto e anteprima del link
import { apriGuida, apriAiuto } from "./guida.js";
import { apriSicurezza, serveCodice, mostraCodice } from "./sicurezza.js";
import { pillola, entra, riempi, allunga, cresci, contaNumeri, fermaNumero, ricorda, apri as aprire, chiudi, evidenzia } from "./anim.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

let view = ["mesi", "deposito", "modello"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "mesi";
let sel = null;
let needsRender = false;
let empty = false;

const months = () => mesiPiano(state.piano);
let depAnno = null; // anno mostrato nella tabella del conto deposito

/** Mese da aprire: quello di oggi se c'è, altrimenti il più vicino. */
function meseIniziale(ms) {
  const cur = meseCorrente();
  if (ms.includes(cur)) return cur;
  return cur < ms[0] ? ms[0] : ms[ms.length - 1];
}
/** Pulsanti degli anni (compaiono solo se gli anni sono più di uno). */
function yearsBar(ms, anno, onPick, id) {
  const anni = [...new Set(ms.map((x) => x.slice(0, 4)))];
  const bar = document.createElement("div"); bar.className = "years"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Scegli l'anno");
  if (anni.length < 2) { bar.hidden = true; return bar; }
  anni.forEach((a) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = a; b.id = id + a; b.setAttribute("aria-pressed", String(a === anno));
    b.onclick = () => onPick(a);
    bar.appendChild(b);
  });
  return bar;
}
/** Scritte che cambiano se si usa o no un conto deposito. */
const usaDep = () => !!state.piano.usa_deposito;
const T = () => usaDep()
  ? { tab: "Deposito", rispBreve: "Al conto deposito", prelHint: "Ripresi dal deposito", risp: "Risparmio al conto deposito", prel: "Prelievo dal conto deposito", va: "Va nel conto deposito", formula: "al deposito", leg: "Conto Deposito", col: "Al deposito", dove: "nel conto deposito" }
  : { tab: "Risparmi", rispBreve: "Messo da parte", prelHint: "Ripresi dai risparmi", risp: "Risparmio del mese", prel: "Prelievo dai risparmi", va: "Va nei risparmi", formula: "messo da parte", leg: "Risparmio", col: "Da parte", dove: "da parte" };
/** Modello vuoto (chi inserisce ogni mese a mano): le previsioni contano solo i mesi compilati. */
const modelloVuoto = () => { const p = state.piano; return !N(p.stipendio) && !N(p.buoni_num) && !N(p.risparmio) && !(p.voci || []).length; };
/** Simulazione dei risparmi: con il conto deposito ci sono gli interessi, senza no. */
function simula(ms) {
  const dep = state.deposito;
  return simulaDeposito(ms, state.piano, state.mesi, usaDep() ? dep : { saldo_iniziale: dep.saldo_iniziale, periodi: [], tasse: 0, bollo: 0 });
}
/** Saldo alla fine del mese indicato (o quello di partenza se il mese è prima dell'inizio). */
function saldoAl(d, id) {
  let s = N(state.deposito.saldo_iniziale);
  for (const r of d.rows) { if (r.id > id) break; s = r.saldo; }
  return s;
}
/** Stato dell'obiettivo: percentuale di oggi e mese in cui lo raggiungi continuando così. */
function goalStatus(ms) {
  const dep = state.deposito, g = N(dep.obiettivo);
  if (!(g > 0)) return '<span class="hint">Scrivi una cifra per vedere a che punto sei e quando ci arrivi.</span>';
  const d = simula(ms), oggi = meseCorrente(), ora = saldoAl(d, oggi);
  const pct = Math.max(0, Math.min(100, (ora / g) * 100));
  let quando;
  if (N(dep.saldo_iniziale) >= g) quando = "Obiettivo già raggiunto.";
  else {
    // Oltre la fine del periodo continuo con il Modello, per al massimo 50 anni
    const lungo = ms.concat(monthRange(addMonths(ms[ms.length - 1], 1), addMonths(ms[ms.length - 1], 600)));
    const hit = simula(lungo).rows.find((r) => r.saldo >= g);
    if (!hit) quando = "Con i risparmi di ora non ci arrivi: prova ad aumentare il risparmio del mese.";
    else if (hit.id <= oggi) quando = `Raggiunto a <b>${monthLabelLong(hit.id)}</b>.`;
    else {
      const [y1, m1] = oggi.split("-").map(Number), [y2, m2] = hit.id.split("-").map(Number), n = (y2 - y1) * 12 + (m2 - m1);
      quando = `Continuando così ci arrivi a <b>${monthLabelLong(hit.id)}</b> (tra ${n} ${n === 1 ? "mese" : "mesi"}).`;
    }
  }
  const nome = dep.obiettivo_nome ? esc(dep.obiettivo_nome) + ": " : "";
  return `<div class="goal-top"><span>${nome}<b>${eur(ora)}</b> di ${eur(g)}</span><span class="goal-pct">${Math.round(pct)}%</span></div>
    <div class="goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><span style="width:${pct}%"></span></div>
    <div class="hint">${quando}</div>`;
}
let tassoAperto = false; // modulo "nuovo tasso" aperto
let avvisoAperto = false; // interruttore "Avviso resto basso" acceso ma senza cifra
let goalAnima = false; // il modulo dell'obiettivo si è appena aperto
let goalEdit = false; // modulo dell'obiettivo aperto
let goalPrima = null;  // valori prima di aprire il modulo (per "Annulla")
function goalCard(v, ms) {
  const dep = state.deposito, g = N(dep.obiettivo);
  const card = document.createElement("section"); card.className = "card pad goal";
  if (!goalEdit && !(g > 0)) {
    card.innerHTML = `<p class="hint flush">Hai un traguardo? Per esempio la caparra della casa: vedi a che punto sei e quando ci arrivi.</p>`;
    const b = document.createElement("button"); b.type = "button"; b.className = "add-open flush-x"; b.innerHTML = `${icona("plus", "currentColor", 16)} Imposta un obiettivo`;
    b.onclick = () => { goalPrima = { obiettivo: 0, nome: "" }; goalEdit = true; goalAnima = true; render(); $("g-imp")?.focus({ preventScroll: true }); };
    card.appendChild(b); v.appendChild(card); return;
  }
  if (goalEdit) {
    const fs = document.createElement("div"); fs.className = "fields";
    fs.appendChild(moneyField("Cifra da raggiungere", g, (n) => { dep.obiettivo = n; saveDeposito(); }, { id: "g-imp" }));
    const nf = document.createElement("label"); nf.className = "field"; nf.htmlFor = "g-nome";
    nf.innerHTML = `<span class="label">Per cosa</span><input type="text" id="g-nome" placeholder="es. Caparra casa" autocomplete="off"><span class="hint">Facoltativo</span>`;
    const ni = nf.querySelector("input"); ni.value = dep.obiettivo_nome || "";
    ni.addEventListener("input", () => { dep.obiettivo_nome = ni.value; saveDeposito(); refresh(); });
    fs.appendChild(nf);
    card.appendChild(fs);
  }
  card.insertAdjacentHTML("beforeend", `<div class="goal-status" id="goal-status">${goalStatus(ms)}</div>`);
  const act = document.createElement("div"); act.className = "goal-act";
  const mb = document.createElement("button"); mb.type = "button"; mb.className = "link";
  mb.textContent = goalEdit ? "Fatto" : "Modifica";
  mb.onclick = () => {
    if (!goalEdit) { goalPrima = { obiettivo: g, nome: dep.obiettivo_nome || "" }; goalAnima = true; }
    goalEdit = !goalEdit; render();
  };
  act.appendChild(mb);
  if (goalEdit) {
    // Annulla: rimette i valori di prima e chiude il modulo
    const an = document.createElement("button"); an.type = "button"; an.className = "link"; an.textContent = "Annulla";
    an.onclick = () => {
      const pr = goalPrima || { obiettivo: g, nome: dep.obiettivo_nome || "" };
      if (N(dep.obiettivo) !== pr.obiettivo || (dep.obiettivo_nome || "") !== pr.nome) { dep.obiettivo = pr.obiettivo; dep.obiettivo_nome = pr.nome; saveDeposito(); }
      goalEdit = false; render();
    };
    act.prepend(an);
  }
  if (goalEdit && goalPrima && goalPrima.obiettivo > 0) {
    const rm = document.createElement("button"); rm.type = "button"; rm.className = "link danger-link"; rm.textContent = "Elimina obiettivo";
    rm.onclick = () => { dep.obiettivo = 0; dep.obiettivo_nome = ""; saveDeposito(); goalEdit = false; render(); };
    act.prepend(rm);
  }
  card.appendChild(act);
  v.appendChild(card);
  if (goalEdit && goalAnima) { goalAnima = false; aprire(card.querySelector(".fields")); }
}
/** Mese di riferimento del Modello: oggi, dentro il periodo dei conti. */
function meseRif() { const ms = months(), o = meseCorrente(); return o < ms[0] ? ms[0] : o > ms[ms.length - 1] ? ms[ms.length - 1] : o; }
/** Spese del Modello attive nel mese di riferimento (quelle a tempo finite o non iniziate non contano). */
const vociModello = () => (state.piano.voci || []).filter((v) => attivaNel(v, meseRif()));
const meseCorto = (id) => monthLabel(id).toLowerCase();
/** Testo dell'etichetta di una spesa a tempo. */
function testoPeriodo(v) {
  const f = fineSpesa(v), r = meseRif(), n = Number(v.rate);
  if (r < v.da) return { spenta: true, t: `Prima rata: ${meseCorto(v.da)} · ${n} ${n === 1 ? "rata" : "rate"}` };
  if (r > f) return { spenta: true, t: `Finita · ultima rata ${meseCorto(f)}` };
  const [y1, m1] = r.split("-").map(Number), [y2, m2] = f.split("-").map(Number), resto = (y2 - y1) * 12 + (m2 - m1) + 1;
  return { spenta: false, t: `${meseCorto(v.da)} → ${meseCorto(f)} · ${resto === 1 ? "ultima rata" : `ancora ${resto} rate`}` };
}
/** Campi "Dal mese" + "Numero di rate" con l'ultima rata calcolata. w = { da, rate } viene aggiornato. */
function campiPeriodo(w, idp, onCambio) {
  const o = meseCorrente(), opts = monthRange(addMonths(o, -48), addMonths(o, 60));
  if (!opts.includes(w.da)) opts.unshift(w.da);
  const box = document.createElement("div"); box.className = "per-campi";
  box.innerHTML = `<label class="per-f" for="${idp}-da"><span class="label">Dal mese</span><select id="${idp}-da">${opts.map((id) => `<option value="${id}"${id === w.da ? " selected" : ""}>${monthLabelLong(id)}</option>`).join("")}</select></label>
    <label class="per-f" for="${idp}-n"><span class="label">Numero di rate</span><input type="text" inputmode="numeric" id="${idp}-n" placeholder="es. 12" autocomplete="off"></label>
    <span class="hint per-fine"></span>`;
  const sd = box.querySelector("select"), ni = box.querySelector("input"), fine = box.querySelector(".per-fine");
  if (w.rate) ni.value = w.rate;
  const agg = () => {
    const n = Math.round(parseNum(ni.value));
    w.da = sd.value; w.rate = n >= 1 && n <= 600 ? n : 0;
    fine.textContent = w.rate ? `Ultima rata: ${monthLabelLong(fineSpesa(w)).toLowerCase()}` : "Se è già iniziata, scegli il mese della prima rata.";
    onCambio && onCambio();
  };
  sd.onchange = agg; ni.addEventListener("input", () => { ni.value = ni.value.replace(/\D/g, "").slice(0, 3); agg(); });
  agg();
  return box;
}
/** Mesi personalizzati che cadono nel periodo di una spesa a tempo. */
const mesiPersNelPeriodo = (w) => months().filter((id) => state.mesi[id] && id >= w.da && id <= fineSpesa(w));
/** Chiave della categoria di una spesa (una categoria sconosciuta o eliminata conta come "Altro"). */
const ck = (k) => catInfo(state.piano, k).k;
const colore = (c) => (c.startsWith("--") ? `var(${c})` : c);
/** "13ª e 14ª", "13ª" o "" secondo le mensilità. */
const extraNomi = () => (N(state.piano.mensilita) >= 14 ? "13ª e 14ª" : N(state.piano.mensilita) >= 13 ? "13ª" : "");

/* ---------- Stato salvataggio ---------- */
function setStatus(s, t) { const el = $("status"); el.dataset.s = s; $("statusTxt").textContent = t; }
onStatus(setStatus);

/* ---------- Login ---------- */
function showAuth(mode = "login", msg = "") {
  $("app").hidden = true;
  const a = $("auth"); a.hidden = false;
  document.title = SLOGAN;
  const titles = { login: "Accedi", signup: "Crea il tuo account", reset: "Recupera la password", newpass: "Scegli una nuova password" };
  a.innerHTML = `
    <form class="auth-card" id="authForm" novalidate>
      <h1 class="brand">${LOGO}</h1>
      <h2>${titles[mode]}</h2>
      ${mode !== "newpass" ? `<label class="lf" for="au-email"><span class="label">Email</span><input type="email" id="au-email" autocomplete="email" required></label>` : ""}
      ${mode !== "reset" ? `<label class="lf" for="au-pass"><span class="label">Password</span><input type="password" id="au-pass" autocomplete="${mode === "login" ? "current-password" : "new-password"}" minlength="8" required></label>` : ""}
      <div class="msg" id="au-msg" ${msg ? "" : "hidden"}>${esc(msg)}</div>
      <button class="btn primary wide" type="submit">${{ login: "Accedi", signup: "Crea account", reset: "Invia il link", newpass: "Salva password" }[mode]}</button>
      <div class="auth-links">
        ${mode === "login" ? `<button type="button" class="link" data-m="signup">Non hai un account? Creane uno</button><button type="button" class="link" data-m="reset">Password dimenticata?</button>` : ""}
        ${mode === "signup" || mode === "reset" ? `<button type="button" class="link" data-m="login">Torna all'accesso</button>` : ""}
      </div>
    </form>`;
  a.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => showAuth(b.dataset.m)));
  $("authForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const out = $("au-msg");
    const say = (t, ok) => { out.hidden = false; out.textContent = t; out.dataset.ok = ok ? "1" : ""; };
    const email = $("au-email")?.value.trim();
    const pass = $("au-pass")?.value;
    if (mode !== "newpass" && !email) return say("Scrivi la tua email.");
    if (mode !== "reset" && (!pass || pass.length < 8)) return say("La password deve avere almeno 8 caratteri.");
    const btn = ev.submitter || a.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) say("Account creato. Controlla la tua email e conferma l'indirizzo, poi accedi.", true);
      } else if (mode === "reset") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        say("Ti ho mandato un link per scegliere una nuova password.", true);
      } else if (mode === "newpass") {
        const { error } = await sb.auth.updateUser({ password: pass });
        if (error) throw error;
        start();
      }
    } catch (e) {
      say(traduciErrore(e));
    }
    btn.disabled = false;
  };
}
function traduciErrore(e) {
  const m = (e && e.message) || "";
  if (/Invalid login credentials/i.test(m)) return "Email o password non corretti.";
  if (/Email not confirmed/i.test(m)) return "Devi prima confermare l'email: cerca il messaggio nella posta (anche nello spam).";
  if (/already registered/i.test(m)) return "Esiste già un account con questa email: prova ad accedere.";
  if (/rate limit/i.test(m)) return "Troppi tentativi ravvicinati: riprova fra qualche minuto.";
  if (/fetch/i.test(m)) return "Nessuna connessione: controlla internet e riprova.";
  return m || "Qualcosa non ha funzionato. Riprova.";
}

/* ---------- Avvio ---------- */
async function start() {
  // Verifica in due passaggi: se l'utente l'ha attivata, prima chiedo il codice
  if (await serveCodice(sb)) {
    $("app").hidden = true; const a = $("auth"); a.hidden = false; document.title = SLOGAN;
    mostraCodice({ sb, box: a, logo: LOGO, onOk: () => start() });
    return;
  }
  $("auth").hidden = true; $("app").hidden = false;
  $("who").textContent = state.user.email || "";
  setStatus("idle", "Caricamento…");
  $("view").innerHTML = '<div class="empty">Sto caricando i tuoi conti…</div>';
  try {
    empty = await loadAll();
    setStatus("saved", "Aggiornato");
  } catch (e) {
    setStatus("error", "Non riesco a caricare: " + traduciErrore(e));
    $("view").innerHTML = '<div class="empty">Non riesco a leggere i dati. Controlla la connessione e ricarica la pagina.</div>';
    return;
  }
  const ms = months();
  if (!sel || !ms.includes(sel)) sel = meseIniziale(ms);
  render();
}

async function boot() {
  if (!configured) {
    $("auth").hidden = false;
    $("auth").innerHTML = '<div class="auth-card"><h1 class="brand">' + LOGO + '</h1><p>Manca la configurazione di Supabase: inserisci URL e chiave in <code>js/config.js</code> (vedi README).</p></div>';
    return;
  }
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") { state.user = session?.user || null; showAuth("newpass"); return; }
    if (event === "SIGNED_OUT") { state.user = null; showAuth("login"); return; }
    if (event === "SIGNED_IN" && session && (!state.user || state.user.id !== session.user.id)) { state.user = session.user; start(); }
  });
  const { data } = await sb.auth.getSession();
  if (data.session) { state.user = data.session.user; start(); } else showAuth("login");
}

// Quando torni sull'app (da un altro dispositivo potresti aver cambiato qualcosa), ricarico i dati.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !state.user) return;
  try { empty = await loadAll(); softRender(); } catch (e) { /* offline: tengo ciò che ho */ }
});

/* ---------- Componenti ---------- */
function moneyField(label, value, onVal, { hint = "", cls = "", id, unit = "€" } = {}) {
  const f = document.createElement("label");
  f.className = "field" + (cls ? " " + cls : "");
  f.htmlFor = id;
  f.innerHTML = `<span class="label">${esc(label)}</span><span class="money"><input type="text" inputmode="decimal" autocomplete="off" id="${id}"><span class="eur">${unit}</span></span>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}`;
  const inp = f.querySelector("input");
  inp.value = fmt.format(value);
  inp.addEventListener("input", () => { const n = parseNum(inp.value); if (!isNaN(n) && n >= 0) { onVal(round(n)); refresh(); } });
  inp.addEventListener("blur", () => { const n = parseNum(inp.value); inp.value = fmt.format(isNaN(n) ? value : round(n)); });
  return f;
}

/** Campo con un numero intero (es. quanti buoni pasto). onVal(n, elementoHint). */
function numField(label, value, onVal, { hint = "", id, unit = "" } = {}) {
  const f = document.createElement("label"); f.className = "field"; f.htmlFor = id;
  f.innerHTML = `<span class="label">${esc(label)}</span><span class="money"><input type="text" inputmode="numeric" autocomplete="off" id="${id}"><span class="eur">${esc(unit)}</span></span><span class="hint">${esc(hint)}</span>`;
  const inp = f.querySelector("input"), h = f.querySelector(".hint");
  inp.value = String(Math.round(N(value)));
  inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 3); const n = Number(inp.value || 0); onVal(n, h); refresh(); });
  inp.addEventListener("blur", () => { if (!inp.value) inp.value = "0"; });
  return f;
}

/** Buoni pasto in un solo riquadro: [20] buoni × [6,50] € = 130,00 €. Senza onValore il valore è fisso (dal Modello). */
function buoniField(num, valore, onNum, onValore, { id } = {}) {
  const f = document.createElement("div"); f.className = "field buoni";
  f.innerHTML = `<label class="label" for="${id}">Buoni pasto</label>
    <div class="bp-row"><input type="text" inputmode="numeric" autocomplete="off" id="${id}" class="bp-n" aria-label="Numero di buoni"><span class="bp-x">×</span>
    ${onValore ? `<input type="text" inputmode="decimal" autocomplete="off" id="${id}-v" class="bp-v" aria-label="Valore di un buono">` : `<span class="bp-fisso">${fmt.format(valore)}</span>`}<span class="eur">€</span></div>
    <span class="hint"></span>`;
  const ni = f.querySelector(".bp-n"), vi = f.querySelector(".bp-v"), h = f.querySelector(".hint");
  let n = Math.round(N(num)), v = N(valore);
  const tot = () => { h.textContent = v > 0 ? `${n} ${n === 1 ? "buono" : "buoni"} = ${eur(round(n * v))}` : "Numero × valore di un buono (0 se non ne ricevi)"; };
  ni.value = String(n);
  ni.addEventListener("input", () => { ni.value = ni.value.replace(/\D/g, "").slice(0, 3); n = Number(ni.value || 0); onNum(n); tot(); refresh(); });
  ni.addEventListener("blur", () => { if (!ni.value) ni.value = "0"; });
  if (vi) {
    vi.value = fmt.format(v);
    vi.addEventListener("input", () => { const x = parseNum(vi.value); if (!isNaN(x) && x >= 0) { v = round(x); onValore(v); tot(); refresh(); } });
    vi.addEventListener("blur", () => { vi.value = fmt.format(v); });
  }
  tot();
  return f;
}

function confirmInline(host, text, okLabel, onOk) {
  if (host.querySelector(".confirm")) return;
  const cf = document.createElement("div"); cf.className = "confirm";
  cf.innerHTML = `<span>${esc(text)}</span>`;
  const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Annulla"; no.onclick = () => cf.remove();
  const si = document.createElement("button"); si.type = "button"; si.className = "btn danger"; si.textContent = okLabel; si.onclick = onOk;
  cf.append(no, si); host.appendChild(cf); si.focus();
}

function vociEditor(container, getVoci, change, prefix, { titoloFuori = false, periodi = false, mese = null } = {}) {
  const voci = getVoci();
  // nel Modello il totale conta solo le spese attive questo mese (quelle a tempo finite o future no)
  const tot = eur(round(voci.filter((v) => !periodi || attivaNel(v, meseRif())).reduce((a, v) => a + N(v.importo), 0)));
  if (titoloFuori) container.appendChild(secHead("Spese", tot, "spese"));
  const card = document.createElement("section"); card.className = "card spese";
  card.innerHTML = titoloFuori ? "" : `<div class="card-head"><h2>Spese</h2><span class="tot" data-live="spese">${tot}</span></div>`;
  if (!voci.length) card.insertAdjacentHTML("beforeend", '<div class="empty">Nessuna spesa: aggiungi la prima qui sotto.</div>');
  categorie(state.piano).forEach((c) => {
    const vs = voci.filter((v) => ck(v.cat) === c.k);
    if (!vs.length) return;
    const g = document.createElement("div"); g.className = "group";
    g.innerHTML = `<div class="group-head"><span class="gname">${badge(c, 24)}${esc(c.n)}</span><span class="gsum" data-gsum="${c.k}"></span></div>`;
    vs.forEach((v) => {
      const r = document.createElement("div"); r.className = "row"; r.dataset.riga = v.id;
      const nome = document.createElement("input"); nome.type = "text"; nome.value = v.nome; nome.id = prefix + "n-" + v.id; nome.setAttribute("aria-label", "Nome voce");
      nome.addEventListener("input", () => change((list) => { const x = list.find((z) => z.id === v.id); if (x) x.nome = nome.value; }));
      const wi = document.createElement("span"); wi.className = "imp";
      const imp = document.createElement("input"); imp.type = "text"; imp.inputMode = "decimal"; imp.value = fmt.format(N(v.importo)); imp.id = prefix + "i-" + v.id; imp.setAttribute("aria-label", "Importo di " + v.nome);
      imp.addEventListener("input", () => { const n = parseNum(imp.value); if (!isNaN(n) && n >= 0) { change((list) => { const x = list.find((z) => z.id === v.id); if (x) x.importo = round(n); }); refresh(); } });
      imp.addEventListener("blur", () => { const n = parseNum(imp.value); if (!isNaN(n)) imp.value = fmt.format(round(n)); });
      wi.append(imp, Object.assign(document.createElement("span"), { className: "eur", textContent: "€" }));
      const del = document.createElement("button"); del.type = "button"; del.className = "del"; del.setAttribute("aria-label", "Elimina " + v.nome);
      del.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.6 9h4.8L11 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      del.onclick = () => confirmInline(r, `Eliminare “${v.nome}”?`, "Elimina", () => { change((list) => { const i = list.findIndex((z) => z.id === v.id); if (i >= 0) list.splice(i, 1); }); render(); });
      r.append(nome, wi);
      if (periodi) {
        // spesa a tempo: etichetta sotto il nome e pulsante per impostare / cambiare il periodo
        r.classList.add("con-per");
        const pb = document.createElement("button"); pb.type = "button"; pb.className = "del per-btn" + (v.da ? " on" : "");
        pb.setAttribute("aria-label", (v.da ? "Cambia il periodo di " : "Imposta un periodo per ") + v.nome); pb.title = v.da ? "Cambia il periodo" : "Solo per un periodo (es. a rate)";
        pb.innerHTML = icona("calendar", "currentColor", 16);
        const apriPer = () => {
          if (r.querySelector(".per-edit")) { r.querySelector(".per-edit").remove(); return; }
          const w = { da: v.da || meseRif(), rate: v.rate || 0 };
          const ed = document.createElement("div"); ed.className = "per-edit";
          const err = document.createElement("div"); err.className = "err"; err.hidden = true;
          ed.appendChild(campiPeriodo(w, prefix + "pe-" + v.id, () => { err.hidden = true; }));
          const act = document.createElement("div"); act.className = "per-act";
          if (v.da) {
            const tg = document.createElement("button"); tg.type = "button"; tg.className = "link danger-link"; tg.textContent = "Togli il periodo";
            tg.onclick = () => { change((list) => { const x = list.find((z) => z.id === v.id); if (x) { delete x.da; delete x.rate; } }); render(); };
            act.appendChild(tg);
          }
          const an = document.createElement("button"); an.type = "button"; an.className = "link"; an.textContent = "Annulla"; an.onclick = () => ed.remove();
          const ok = document.createElement("button"); ok.type = "button"; ok.className = "link"; ok.textContent = "Fatto";
          ok.onclick = () => {
            if (!w.rate) { err.textContent = "Scrivi quante rate sono, ad esempio 12."; err.hidden = false; ed.querySelector("input").focus(); return; }
            change((list) => { const x = list.find((z) => z.id === v.id); if (x) { x.da = w.da; x.rate = w.rate; } }); render();
          };
          act.append(an, ok); ed.append(err, act); r.appendChild(ed); aprire(ed);
        };
        pb.onclick = apriPer;
        r.append(pb, del);
        if (v.da) {
          const tp = testoPeriodo(v);
          if (tp.spenta) r.classList.add("spenta");
          const tag = document.createElement("button"); tag.type = "button"; tag.className = "per-tag"; tag.textContent = tp.t; tag.onclick = apriPer;
          r.appendChild(tag);
        }
      } else {
        r.append(del);
        if (mese && v.da && fineSpesa(v)) {
          // in un mese: "Rata 3 di 6 · fino a apr 2027"
          const [y1, m1] = v.da.split("-").map(Number), [y2, m2] = mese.split("-").map(Number), k = (y2 - y1) * 12 + (m2 - m1) + 1;
          const tag = document.createElement("span"); tag.className = "per-tag ro";
          tag.textContent = `Rata ${k} di ${v.rate} · fino a ${meseCorto(fineSpesa(v))}`;
          r.classList.add("con-tag"); r.appendChild(tag);
        }
      }
      g.appendChild(r);
    });
    card.appendChild(g);
  });
  const form = document.createElement("form"); form.className = "add"; form.autocomplete = "off";
  form.innerHTML = `<div class="add-tit">Nuova spesa</div><input class="n" type="text" id="${prefix}a-nome" placeholder="Nome (es. Palestra)" aria-label="Nome della voce"><input type="text" inputmode="decimal" id="${prefix}a-imp" placeholder="0,00" aria-label="Importo mensile"><div class="add-act"><button class="btn" type="button" data-annulla="1">Annulla</button><button class="btn primary" type="submit">Aggiungi</button></div><div class="cat-pick" role="radiogroup" aria-label="Categoria"></div><div class="err" hidden></div>`;
  const pick = form.querySelector(".cat-pick");
  let catScelta = addCat;
  // Modello: "Solo per un periodo" (spesa a rate)
  const wPer = { da: meseRif(), rate: 0 }; let perOn = false, perBox = null;
  if (periodi) {
    const sw = switchRow(prefix + "a-per", "Solo per un periodo", "Per esempio un acquisto a rate", false, (x) => {
      perOn = x;
      if (x) { perBox = campiPeriodo(wPer, prefix + "a-pe", () => { form.querySelector(".err").hidden = true; }); perBox.classList.add("per-in-form"); sw.after(perBox); aprire(perBox); perBox.querySelector("input").focus({ preventScroll: true }); }
      else if (perBox) { perBox.remove(); perBox = null; }
    });
    sw.classList.add("per-sw"); form.querySelector(".cat-pick").after(sw);
  }
  const disegnaPick = () => {
    if (!categorie(state.piano).some((c) => c.k === catScelta)) catScelta = "casa";
    pick.innerHTML = categorie(state.piano).map((c) => `<button type="button" role="radio" class="cat-chip" data-k="${c.k}" aria-checked="${c.k === catScelta}" style="--cc:${c.c}">${icona(c.i, c.k === catScelta ? "#fff" : c.c, 15)}${esc(c.n)}</button>`).join("")
      + `<button type="button" class="cat-chip nuova" data-new="1">${icona("tag", "currentColor", 15)}Nuova categoria</button>`;
  };
  disegnaPick();
  pick.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.new) { apriCategorie({ state, savePiano, saveMese, nuova: true, onCreata: (k) => { addCat = k; }, onChange: () => { addAperto = prefix; render(); } }); return; }
    catScelta = addCat = b.dataset.k; disegnaPick();
  };
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const nome = form.querySelector(".n").value.trim();
    const imp = parseNum(form.querySelector("[inputmode]").value);
    const err = form.querySelector(".err");
    if (!nome) { err.textContent = "Scrivi il nome della voce."; err.hidden = false; return; }
    if (isNaN(imp) || imp < 0) { err.textContent = "Scrivi un importo valido, ad esempio 25,50."; err.hidden = false; return; }
    if (perOn && !wPer.rate) { err.textContent = "Scrivi quante rate sono, ad esempio 12."; err.hidden = false; perBox?.querySelector("input").focus(); return; }
    const cat = catScelta;
    const nid = uid();
    const nuova = { id: nid, nome, importo: round(imp), cat, ...(perOn ? { da: wPer.da, rate: wPer.rate } : {}) };
    const aggiungi = (ancheMesi) => {
      change((list) => list.push(nuova));
      if (ancheMesi) mesiPersNelPeriodo(nuova).forEach((id) => { state.mesi[id].voci.push({ ...nuova, id: uid() }); saveMese(id); });
      nuovaRiga = nid; render();
      $(prefix + "a-nome")?.focus();
    };
    // la rata cade in mesi personalizzati (che non seguono il Modello)? Chiedo
    const pers = perOn ? mesiPersNelPeriodo(nuova) : [];
    if (!pers.length) { aggiungi(false); return; }
    const nomi = pers.length <= 3 ? pers.map((id) => monthLabelLong(id).toLowerCase()).join(", ").replace(/, ([^,]*)$/, " e $1") : `${pers.length} mesi`;
    form.querySelector(".confirm")?.remove();
    const cf = document.createElement("div"); cf.className = "confirm per-conf";
    cf.innerHTML = `<span>Hai personalizzato ${nomi}: ${pers.length === 1 ? "quel mese non segue" : "quei mesi non seguono"} il Modello. Aggiungo la rata anche lì?</span>`;
    const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Solo nel Modello"; no.onclick = () => aggiungi(false);
    const si = document.createElement("button"); si.type = "button"; si.className = "btn primary"; si.textContent = pers.length === 1 ? "Anche in quel mese" : "Anche in quei mesi"; si.onclick = () => aggiungi(true);
    cf.append(no, si); form.appendChild(cf); si.focus();
  };
  // il modulo si apre solo quando serve
  const apri = document.createElement("button"); apri.type = "button"; apri.className = "add-open"; apri.id = prefix + "a-open";
  apri.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Aggiungi una spesa';
  const aperto = addAperto === prefix || !voci.length;
  form.hidden = !aperto; apri.hidden = aperto;
  apri.onclick = () => { addAperto = prefix; form.hidden = false; apri.hidden = true; aprire(form); $(prefix + "a-nome")?.focus({ preventScroll: true }); };
  // Annulla (o Esc): svuota e chiude il modulo senza aggiungere niente
  const chiudiForm = () => {
    form.reset(); form.querySelector(".err").hidden = true; addAperto = null;
    chiudi(form, () => { form.hidden = true; apri.hidden = false; apri.focus(); });
  };
  form.querySelector("[data-annulla]").onclick = chiudiForm;
  form.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); chiudiForm(); } });
  card.append(apri, form);
  container.appendChild(card);
}
let addAperto = null; // modulo "nuova spesa" aperto (resta aperto dopo un'aggiunta)
let addCat = "casa";  // ultima categoria scelta per una nuova spesa
/** Titolo di sezione piccolo e grigio, con il totale a destra. */
function secHead(titolo, totale = "", live = "") {
  const h = document.createElement("div"); h.className = "sec-head";
  h.innerHTML = `<h3>${esc(titolo)}</h3>${totale !== "" ? `<span${live ? ` data-live="${live}"` : ""}>${totale}</span>` : ""}`;
  return h;
}

function formula(m, c, extraNome) {
  let f = `<b>${eur(m.stipendio)}</b> stipendio`;
  if (N(m.buoni)) f += ` + <b>${eur(m.buoni)}</b> buoni pasto`;
  if (N(m.entrate_extra)) f += ` + <b>${eur(m.entrate_extra)}</b> entrate extra`;
  if (m.extra) f += ` + <b>${eur(m.extra)}</b> ${(extraNome || "extra").toLowerCase()}`;
  return f + ` − spese <b>${eur(c.spese)}</b> − ${T().formula} <b>${eur(c.toDep)}</b>`;
}
function hero(m, c, extraNome, { conTitolo = false } = {}) {
  const s = document.createElement("section"); s.className = "hero"; s.setAttribute("aria-live", "polite");
  s.innerHTML = `${conTitolo ? "" : '<div class="label">Resto in tasca</div>'}
    <div class="hero-row"><div class="big${c.resto < 0 ? " neg" : ""}" data-live="resto" data-k="resto-mesi" data-n="${c.resto}" data-f="eur">${eur(c.resto)}</div>
    <div class="chip" data-k="${statoResto(c.resto, state.piano.soglia)}" data-live="chip">${testoResto(c.resto, state.piano.soglia)}</div></div>
    <div class="formula" data-live="formula">${formula(m, c, extraNome)}</div>
    <div class="bar" data-live="bar" role="img" aria-label="Ripartizione delle entrate"></div><div class="legend" data-live="legend"></div>`;
  fillBar(s.querySelector('[data-live="bar"]'), s.querySelector('[data-live="legend"]'), m, c);
  return s;
}
function fillBar(bar, leg, m, c) {
  const parts = categorie(state.piano).map((x) => ({ n: x.n, c: x.c, i: x.i, v: m.voci.filter((v) => ck(v.cat) === x.k).reduce((a, v) => a + N(v.importo), 0) })).filter((p) => p.v > 0);
  if (c.toDep > 0) parts.push({ n: T().leg, c: "--c-risp", v: c.toDep });
  const base = Math.max(c.entrate, parts.reduce((a, p) => a + p.v, 0)) || 1;
  bar.innerHTML = ""; leg.innerHTML = "";
  parts.forEach((p) => { const s = document.createElement("span"); s.style.flex = `0 0 ${(p.v / base) * 100}%`; s.style.background = colore(p.c); s.title = p.n + ": " + eur(p.v); bar.appendChild(s); });
  parts.concat(c.resto > 0 ? [{ n: "Resto", c: "--c-resto", v: c.resto }] : []).forEach((p) => {
    const d = document.createElement("span");
    d.innerHTML = p.i ? icona(p.i, p.c, 13) : `<i style="background:${colore(p.c)}"></i>`;
    d.appendChild(document.createTextNode(`${p.n} ${Math.round((p.v / base) * 100)}%`)); leg.appendChild(d);
  });
}

/* ---------- Mesi personalizzati ---------- */
function ensureMese(id) {
  if (!state.mesi[id]) {
    const t = monthData(id, state.piano, state.mesi);
    state.mesi[id] = { stipendio: t.stipendio, entrate_extra: null, buoni_num: null, risparmio: t.risparmio, prelievo: 0, extra: null, voci: t.voci.map((v) => ({ ...v })) };
  }
  return state.mesi[id];
}

/* ---------- Viste ---------- */
function renderOnboarding(v) {
  v.innerHTML = `<section class="card pad"><h2>Benvenuto</h2>
    <p>Spare ti dice quanto ti resta in tasca ogni mese e quanto metti da parte. Per iniziare rispondi a qualche domanda: ci vogliono un paio di minuti e puoi cambiare tutto anche dopo.</p>
    <div class="actions"><button class="btn primary" type="button" id="ob-zero">Inizia la configurazione</button><button class="btn" type="button" id="ob-import">Ho un backup da importare</button></div>
    <button class="link" type="button" id="ob-salta">Salta, configuro da solo</button></section>`;
  $("ob-import").onclick = () => $("importFile").click();
  $("ob-zero").onclick = () => guida(true);
  $("ob-salta").onclick = saltaGuida;
}

function renderMesi(v) {
  const all = months();
  if (!all.includes(sel)) sel = meseIniziale(all);
  const anno = sel.slice(0, 4);
  const ms = all.filter((id) => id.startsWith(anno));
  v.appendChild(yearsBar(all, anno, (a) => { const cur = meseCorrente(); sel = cur.startsWith(a) && all.includes(cur) ? cur : all.find((id) => id.startsWith(a)); render(); }, "y-"));
  const chips = document.createElement("div"); chips.className = "chips"; chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "Scegli il mese");
  ms.forEach((id) => {
    const c = calcMonth(monthData(id, state.piano, state.mesi), state.piano);
    const b = document.createElement("button"); b.type = "button"; b.className = "chip-m"; b.id = "chip-" + id; b.setAttribute("aria-pressed", String(id === sel));
    b.innerHTML = `<span class="m"><span class="pin" data-k="${statoResto(c.resto, state.piano.soglia)}"></span>${monthLabel(id)}</span>`;
    b.onclick = () => { sel = id; render(); $("chip-" + id)?.scrollIntoView({ inline: "center", block: "nearest" }); };
    chips.appendChild(b);
  });
  v.appendChild(chips);

  const m = monthData(sel, state.piano, state.mesi), c = calcMonth(m, state.piano), ex = extraInfo(sel, state.piano);
  const tb = document.createElement("div"); tb.className = "toolbar month-head";
  tb.innerHTML = `<h2>${monthLabelLong(sel)}${ex ? `<span class="tag">+ ${ex.nome}</span>` : ""}</h2>`;
  if (m.custom) {
    const box = document.createElement("div"); box.className = "mh-right";
    box.innerHTML = '<span class="tag custom">personalizzato</span>';
    const rb = document.createElement("button"); rb.type = "button"; rb.className = "link"; rb.textContent = "Ripristina";
    rb.onclick = () => confirmInline(tb, `Le modifiche di ${monthLabelLong(sel)} andranno perse.`, "Ripristina", async () => { await resetMese(sel); render(); });
    box.appendChild(rb); tb.appendChild(box);
  } else tb.insertAdjacentHTML("beforeend", `<span class="mh-right hint">${modelloVuoto() ? "Da compilare" : "Segue il Modello"}</span>`);
  // Copia dal mese prima: entrate, risparmio, prelievo e spese (non la 13ª/14ª, che dipende dal mese)
  const prima = addMonths(sel, -1);
  if (all.includes(prima)) {
    const cb = document.createElement("button"); cb.type = "button"; cb.className = "link mh-copia";
    cb.innerHTML = `${icona("copy", "currentColor", 15)} Copia dal mese prima`;
    const copia = () => {
      const t = monthData(prima, state.piano, state.mesi), old = state.mesi[sel];
      state.mesi[sel] = { stipendio: t.stipendio, entrate_extra: null, buoni_num: t.buoni_num, risparmio: t.risparmio, prelievo: t.prelievo,
        extra: old ? old.extra : null, voci: t.voci.map((x) => ({ ...x, id: uid() })) };
      saveMese(sel); render();
    };
    cb.onclick = () => (m.custom
      ? confirmInline(tb, `Sostituisco i numeri di ${monthLabelLong(sel).toLowerCase()} con quelli di ${monthLabelLong(prima).toLowerCase()}?`, "Sostituisci", copia)
      : copia());
    tb.appendChild(cb);
  }
  v.appendChild(tb);

  v.appendChild(secHead("Resto in tasca"));
  v.appendChild(hero(m, c, ex?.nome, { conTitolo: true }));

  v.appendChild(secHead("Entrate", eur(c.entrate), "entrate"));
  const fe = document.createElement("div"); fe.className = "fields";
  fe.appendChild(moneyField("Stipendio", m.stipendio, (n) => { ensureMese(sel).stipendio = n; saveMese(sel); }, { id: "m-stip-" + sel }));
  if (N(state.piano.buoni_valore) > 0) {
    const vb = N(state.piano.buoni_valore);
    fe.appendChild(buoniField(m.buoni_num, vb, (n) => { ensureMese(sel).buoni_num = n; saveMese(sel); }, null, { id: "m-buoni-" + sel }));
  }
  fe.appendChild(moneyField("Entrate extra", N(m.entrate_extra), (n) => { ensureMese(sel).entrate_extra = n; saveMese(sel); }, { id: "m-entr-" + sel, hint: "Solo questo mese" }));
  if (ex) fe.appendChild(moneyField(ex.nome, m.extra, (n) => { ensureMese(sel).extra = n; saveMese(sel); }, { id: "m-extra-" + sel, cls: "extra", hint: state.piano.extra_al_deposito ? T().va : "Resta in tasca" }));
  v.appendChild(fe);

  v.appendChild(secHead("Risparmio", eur(round(c.toDep - N(m.prelievo))), "risparmio"));
  const fr = document.createElement("div"); fr.className = "fields";
  fr.appendChild(moneyField(T().rispBreve, m.risparmio, (n) => { ensureMese(sel).risparmio = n; saveMese(sel); }, { id: "m-risp-" + sel, hint: c.extraDep ? `+ ${eur(c.extraDep)} di ${ex?.corto || "extra"}` : "" }));
  fr.appendChild(moneyField("Prelievo", m.prelievo, (n) => { ensureMese(sel).prelievo = n; saveMese(sel); }, { id: "m-prel-" + sel, hint: T().prelHint }));
  v.appendChild(fr);

  vociEditor(v, () => monthData(sel, state.piano, state.mesi).voci, (fn) => { fn(ensureMese(sel).voci); saveMese(sel); }, "m" + sel + "-", { titoloFuori: true, mese: sel });

  // Il tuo anno: grafico a barre + tabella completa a richiesta
  v.appendChild(secHead("Il tuo anno"));
  const yc = document.createElement("section"); yc.className = "card pad year"; yc.id = "year-card";
  yc.innerHTML = yearCardHtml(ms, anno);
  v.appendChild(yc);
  wireYear(ms, anno);
}

/* ---------- Grafico dell'anno ---------- */
let chartSel = null;   // mese con il fumetto aperto
let showTable = false; // tabella completa aperta
let tutteCat = false;  // elenco completo delle categorie dell'anno
function datiAnno(ms) {
  return ms.map((id) => {
    const md = monthData(id, state.piano, state.mesi), cc = calcMonth(md, state.piano);
    return { id, resto: cc.resto, parte: Math.max(0, round(cc.toDep - N(md.prelievo))), cc, ex: extraInfo(id, state.piano) };
  });
}
function tetto(v) { // valore "tondo" per la scala: 100, 200, 500, 1.000, 1.600, 2.000…
  if (v <= 0) return 100;
  const passi = [1, 1.2, 1.5, 1.6, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  return passi.map((p) => p * e).find((x) => x >= v);
}
function yearCardHtml(ms, anno) {
  const d = datiAnno(ms);
  return `<div class="yc-top"><span class="yc-ic" aria-hidden="true">${icona("calendar", "currentColor", 20)}</span>
    <div><b>Il tuo ${anno}</b><small>Dove vanno le entrate dell'anno${d.length < 12 ? ` (${d.length} ${d.length === 1 ? "mese" : "mesi"})` : ""}</small></div></div>
    <div id="yc-chart">${chartHtml(d, anno)}</div>
    <div class="yc-stats" id="yc-stats">${statsAnno(d, anno)}</div>
    <button type="button" class="yc-link" id="yc-toggle" aria-expanded="${showTable}">${showTable ? "Nascondi la tabella" : "Vedi la tabella completa"}<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="${showTable ? "M3 9l4-4 4 4" : "M3 5l4 4 4-4"}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="tbl-wrap" id="yc-table"${showTable ? "" : " hidden"}>${tabellaAnno(d, anno)}</div>`;
}
/** Rimasto in tasca nell'anno, con il mese in cui ti resta di più e quello in cui ti resta di meno. */
function statsAnno(d) {
  if (!d.length) return "";
  const entrate = d.reduce((a, x) => a + x.cc.entrate, 0), resto = d.reduce((a, x) => a + x.resto, 0);
  const meno = d.reduce((m, x) => (x.resto < m.resto ? x : m), d[0]);
  const piu = d.reduce((m, x) => (x.resto > m.resto ? x : m), d[0]);
  const p = entrate > 0 ? Math.round((resto / entrate) * 100) : 0;
  const box = (x, tit, ic, cls) => `<button type="button" class="yc-low ${cls}" data-open="${x.id}"><small>${icona(ic, "currentColor", 14)}${tit}</small><b class="${x.resto < 0 ? "bad" : ""}">${eur0(x.resto)}</b><span>${MESI_NOMI[Number(x.id.slice(5)) - 1]} ›</span></button>`;
  const head = `<div class="yr-head"><span class="ya-ic" style="--cc:var(--muted)">${icona("wallet", "var(--muted)", 15)}</span><span class="ya-n">Rimasto in tasca</span><span class="ya-v${resto < 0 ? " neg" : ""}">${eur0(resto)}</span><span class="ya-p">${p}%</span></div>`;
  if (Math.abs(piu.resto - meno.resto) < 0.005)
    return head + `<div class="yc-same">${icona("sparkles", "currentColor", 16)}<span>Tutti i mesi uguali: ti restano <b>${eur0(piu.resto)}</b> al mese.</span></div>`;
  return head + box(piu, "Mese migliore", "trending-up", "best") + box(meno, "Mese peggiore", "trending-down", "worst");
}
const eur0 = (v) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always" }).format(Math.round(v)) + " €";
function chartHtml(d) {
  // somme dell'anno: entrate, spese per categoria, messo da parte, resto in tasca
  const entrate = d.reduce((a, x) => a + x.cc.entrate, 0), buoniA = round(d.reduce((a, x) => a + N(x.cc.buoni), 0));
  const perCat = {};
  d.forEach((x) => monthData(x.id, state.piano, state.mesi).voci.forEach((v) => { const k = ck(v.cat); perCat[k] = (perCat[k] || 0) + N(v.importo); }));
  const parte = d.reduce((a, x) => a + x.parte, 0), resto = d.reduce((a, x) => a + x.resto, 0);
  const spese = Object.values(perCat).reduce((a, v) => a + v, 0);
  const righe = categorie(state.piano).filter((c) => perCat[c.k] > 0).map((c) => ({ n: c.n, c: c.c, i: c.i, v: perCat[c.k] })).sort((a, b) => b.v - a.v);
  const base = Math.max(entrate, spese + parte + Math.max(0, resto)) || 1;
  const pct = (v) => { const x = (v / base) * 100; return x > 0 && x < 1 ? "<1" : Math.round(x); };
  const seg = righe.map((r) => ({ c: r.c, v: r.v, n: r.n })).concat(parte > 0 ? [{ c: "var(--c-risp)", v: parte, n: T().leg }] : []);
  const bar = seg.map((x) => `<span style="flex:0 0 ${(x.v / base) * 100}%;background:${x.c}" title="${esc(x.n)}: ${eur(x.v)}"></span>`).join("");
  const riga = (ic, col, nome, v, extra = "") => `<div class="ya-row${extra}"><span class="ya-ic" style="--cc:${col}">${ic}</span><span class="ya-n">${nome}</span><span class="ya-v">${eur0(v)}</span><span class="ya-p">${pct(v)}%</span></div>`;
  return `<div class="ya-head"><div><small>Entrate</small><b data-k="ya-ent" data-n="${entrate}" data-f="eur0">${eur0(entrate)}</b>${buoniA ? `<span class="ya-sub">di cui ${eur0(buoniA)} in buoni</span>` : ""}</div><div><small>Spese</small><b data-k="ya-spe" data-n="${spese}" data-f="eur0">${eur0(spese)}</b></div><div><small>${usaDep() ? "Al deposito" : "Da parte"}</small><b class="pos" data-k="ya-dep" data-n="${parte}" data-f="eur0">${eur0(parte)}</b></div></div>
    <div class="bar ya-bar" role="img" aria-label="Ripartizione delle entrate dell'anno">${bar}</div>
    <div class="ya-list">${(tutteCat ? righe : righe.slice(0, 5)).map((r) => riga(icona(r.i, r.c, 15), r.c, esc(r.n), r.v)).join("")}
      ${righe.length > 5 ? `<button type="button" class="ya-more" id="ya-more" aria-expanded="${tutteCat}">${icona(tutteCat ? "minus" : "plus", "currentColor", 15)}${tutteCat ? "Mostra di meno" : "Mostra di più"}</button>` : ""}
</div>
    ${parte > 0 ? `<div class="ya-dep">${riga(icona("piggy-bank", "var(--c-risp)", 15), "var(--c-risp)", usaDep() ? "Al deposito" : "Messo da parte", parte)}</div>` : ""}`;
}
function tabellaAnno(d, anno) {
  let t = { e: 0, s: 0, d: 0, r: 0 };
  let html = `<table><thead><tr><th>Mese</th><th>Entrate</th><th>Spese</th><th>${T().col}</th><th>Resto</th></tr></thead><tbody>`;
  d.forEach(({ id, cc, ex }) => {
    t.e += cc.entrate; t.s += cc.spese; t.d += cc.toDep; t.r += cc.resto;
    html += `<tr class="click${id === sel ? " sel" : ""}" data-id="${id}" tabindex="0"><td><span class="pin" data-k="${statoResto(cc.resto, state.piano.soglia)}"></span>${monthLabel(id)}${ex ? ` <span class="tag">${ex.corto}</span>` : ""}</td><td>${fmt.format(cc.entrate)}</td><td>${fmt.format(cc.spese)}</td><td>${fmt.format(cc.toDep)}</td><td class="${cc.resto < 0 ? "neg" : ""}">${fmt.format(cc.resto)}</td></tr>`;
  });
  return html + `</tbody><tfoot><tr><td>Totale ${anno}</td><td>${fmt.format(round(t.e))}</td><td>${fmt.format(round(t.s))}</td><td>${fmt.format(round(t.d))}</td><td>${fmt.format(round(t.r))}</td></tr></tfoot></table>`;
}
function apriMese(id) { sel = id; chartSel = id; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
function wireYear(ms, anno) {
  const card = $("year-card"); if (!card) return;
  card.onclick = (e) => {
    const low = e.target.closest("[data-open]"); if (low) { apriMese(low.dataset.open); return; }
    if (e.target.closest("#ya-more")) { tutteCat = !tutteCat; $("yc-chart").innerHTML = chartHtml(datiAnno(ms), anno); return; }
    if (e.target.closest("#yc-toggle")) { showTable = !showTable; card.innerHTML = yearCardHtml(ms, anno); return; }
    const tr = e.target.closest("tr[data-id]"); if (tr) apriMese(tr.dataset.id);
  };
  card.onkeydown = (e) => { const tr = e.target.closest("tr[data-id]"); if (tr && e.key === "Enter") apriMese(tr.dataset.id); };
}

function renderDeposito(v) {
  const ms = months(), dep = state.deposito;
  const d = simulaDeposito(ms, state.piano, state.mesi, dep);
  const periodi = ordinaPeriodi(dep.periodi);

  // Sul conto: saldo a fine periodo, com'è fatto, e saldo di oggi
  v.appendChild(secHead("Sul conto"));
  v.insertAdjacentHTML("beforeend", `<section class="hero dep-hero" id="dep-tiles">${depHero(d, ms)}</section>`);
  if (!periodi.length) v.insertAdjacentHTML("beforeend", `<div class="note">Aggiungi qui sotto il tasso del tuo conto deposito: finché non c'è, gli interessi restano a zero.</div>`);

  // Obiettivo
  v.appendChild(secHead("Obiettivo"));
  goalCard(v, ms);

  // Tasso nel tempo
  v.appendChild(secHead("Tasso nel tempo"));
  const opts = monthRange("2025-01", "2030-12");
  const card = document.createElement("section"); card.className = "card tassi";
  card.innerHTML = `<p class="hint card-hint">Ogni tasso vale dal suo mese fino al successivo.</p>`;
  if (!periodi.length) card.insertAdjacentHTML("beforeend", '<div class="empty">Nessun tasso: aggiungi il primo qui sotto.</div>');
  periodi.forEach((p) => {
    const r = document.createElement("div"); r.className = "row periodo"; r.dataset.riga = p.id;
    const da = document.createElement("select"); da.id = "p-da-" + p.id; da.setAttribute("aria-label", "Dal mese");
    da.innerHTML = opts.map((id) => `<option value="${id}"${id === p.da ? " selected" : ""}>da ${monthLabel(id)}</option>`).join("");
    da.onchange = () => { p.da = da.value; saveDeposito(); render(); };
    const wi = document.createElement("span"); wi.className = "imp";
    const t = document.createElement("input"); t.type = "text"; t.inputMode = "decimal"; t.id = "p-t-" + p.id; t.value = fmt.format(N(p.tasso)); t.setAttribute("aria-label", "Tasso lordo annuo");
    t.addEventListener("input", () => { const n = parseNum(t.value); if (!isNaN(n) && n >= 0 && n < 100) { p.tasso = round(n); saveDeposito(); refresh(); } });
    t.addEventListener("blur", () => { const n = parseNum(t.value); t.value = fmt.format(isNaN(n) ? N(p.tasso) : round(n)); render(); });
    wi.append(t, Object.assign(document.createElement("span"), { className: "eur", textContent: "%" }));
    const nome = document.createElement("input"); nome.type = "text"; nome.id = "p-n-" + p.id; nome.value = p.nome || ""; nome.placeholder = "Banca o conto (facoltativo)"; nome.setAttribute("aria-label", "Nome del conto");
    nome.addEventListener("input", () => { p.nome = nome.value; saveDeposito(); });
    nome.addEventListener("blur", () => render());
    const del = document.createElement("button"); del.type = "button"; del.className = "del"; del.setAttribute("aria-label", "Elimina questo tasso");
    del.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M6.5 4V2.5h3V4M5 4l.6 9h4.8L11 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    del.onclick = () => confirmInline(r, `Eliminare il tasso da ${monthLabel(p.da)}?`, "Elimina", () => { dep.periodi = dep.periodi.filter((x) => x.id !== p.id); saveDeposito(); render(); });
    r.append(da, wi, nome, del); card.appendChild(r);
  });
  const ab = document.createElement("button"); ab.type = "button"; ab.className = "add-open"; ab.id = "p-add";
  ab.innerHTML = `${icona("plus", "currentColor", 16)} ${periodi.length ? "Aggiungi un cambio di tasso" : "Aggiungi il tasso"}`;
  // Modulo per un nuovo tasso: si apre col pulsante, tasso vuoto e obbligatorio, con Annulla
  const oggi = meseCorrente();
  let daProposto = oggi < ms[0] ? ms[0] : oggi; // mese di oggi; se ha già un tasso, il mese dopo l'ultimo
  if (periodi.some((x) => x.da >= daProposto)) daProposto = addMonths(periodi[periodi.length - 1].da, 1);
  if (!opts.includes(daProposto)) daProposto = opts[opts.length - 1];
  const form = document.createElement("form"); form.className = "add tasso"; form.autocomplete = "off";
  form.innerHTML = `<div class="add-tit">Nuovo tasso</div><select id="pa-da" aria-label="Dal mese">${opts.map((id) => `<option value="${id}"${id === daProposto ? " selected" : ""}>da ${monthLabel(id)}</option>`).join("")}</select>`
    + `<span class="imp"><input type="text" inputmode="decimal" id="pa-t" placeholder="es. 2,50" aria-label="Tasso lordo annuo"><span class="eur">%</span></span>`
    + `<input type="text" id="pa-n" placeholder="Banca o conto (facoltativo)" aria-label="Nome del conto">`
    + `<div class="add-act"><button class="btn" type="button" data-annulla="1">Annulla</button><button class="btn primary" type="submit">Aggiungi</button></div><div class="err" hidden></div>`;
  const errT = form.querySelector(".err");
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const txt = $("pa-t").value.trim(), n = parseNum(txt), da = $("pa-da").value;
    if (!txt || isNaN(n)) { errT.textContent = "Scrivi il tasso, ad esempio 2,50."; errT.hidden = false; $("pa-t").focus(); return; }
    if (n < 0 || n >= 100) { errT.textContent = "Il tasso deve essere tra 0 e 100."; errT.hidden = false; $("pa-t").focus(); return; }
    if ((dep.periodi || []).some((x) => x.da === da)) { errT.textContent = `C'è già un tasso da ${monthLabel(da)}: cambialo nella sua riga qui sopra.`; errT.hidden = false; return; }
    const nid = uid();
    dep.periodi = [...(dep.periodi || []), { id: nid, da, tasso: round(n), nome: $("pa-n").value.trim() }];
    tassoAperto = false; saveDeposito(); nuovaRiga = nid; render();
  };
  const chiudiTasso = () => { tassoAperto = false; form.reset(); errT.hidden = true; chiudi(form, () => { form.hidden = true; ab.hidden = false; ab.focus(); }); };
  form.querySelector("[data-annulla]").onclick = chiudiTasso;
  form.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); chiudiTasso(); } });
  form.querySelector("#pa-t").addEventListener("input", () => { errT.hidden = true; });
  form.hidden = !tassoAperto; ab.hidden = tassoAperto;
  ab.onclick = () => { tassoAperto = true; form.hidden = false; ab.hidden = true; aprire(form); $("pa-t").focus({ preventScroll: true }); };
  card.append(ab, form);
  v.appendChild(card);

  // Impostazioni del conto
  v.appendChild(secHead("Impostazioni del conto"));
  const fs = document.createElement("div"); fs.className = "fields three";
  fs.appendChild(moneyField("Saldo di partenza", N(dep.saldo_iniziale), (n) => { dep.saldo_iniziale = n; saveDeposito(); }, { id: "d-saldo", hint: `Già sul conto a ${monthLabelLong(ms[0]).toLowerCase()}` }));
  fs.appendChild(moneyField("Tasse", N(dep.tasse), (n) => { dep.tasse = n; saveDeposito(); }, { id: "d-tasse", unit: "%", hint: "In Italia 26%" }));
  fs.appendChild(moneyField("Bollo annuo", N(dep.bollo), (n) => { dep.bollo = n; saveDeposito(); }, { id: "d-bollo", unit: "%", hint: "Di solito 0,2%" }));
  v.appendChild(fs);

  // Il tuo anno: saldo che cresce mese per mese
  const anni = [...new Set(ms.map((x) => x.slice(0, 4)))];
  if (!anni.includes(depAnno)) depAnno = anni.includes(meseCorrente().slice(0, 4)) ? meseCorrente().slice(0, 4) : anni[0];
  v.appendChild(secHead("Il tuo anno"));
  const tc = document.createElement("section"); tc.className = "card pad year"; tc.id = "dep-year";
  v.appendChild(tc);
  disegnaDepAnno(tc, ms, d);
}
let depChartSel = null; // mese con il fumetto aperto nel grafico del deposito
function disegnaDepAnno(tc, ms, d) {
  const righe = d.rows.filter((r) => r.id.startsWith(depAnno));
  const vers = righe.reduce((a, r) => a + r.versato - r.prelievo, 0), net = righe.reduce((a, r) => a + r.netto - r.bollo, 0);
  const prel = righe.reduce((a, r) => a + r.prelievo, 0), dep = usaDep();
  tc.innerHTML = `<div class="yc-top"><span class="yc-ic" aria-hidden="true">${icona("piggy-bank", "currentColor", 20)}</span>
      <div><b>${dep ? "Il conto" : "I risparmi"} nel ${depAnno}</b><small>Come ${dep ? "cresce il saldo" : "crescono"}, mese per mese</small></div></div>`;
  const yb = yearsBar(ms, depAnno, (a) => { depAnno = a; depChartSel = null; render(); }, "dy-");
  tc.appendChild(yb);
  tc.insertAdjacentHTML("beforeend", `<div class="ya-head two"><div><small>${dep ? "Versato" : "Messo da parte"} nel ${depAnno}</small><b data-k="dy-vers" data-n="${vers}" data-f="eur0">${eur0(vers)}</b></div>${dep ? `<div><small>Interessi netti</small><b class="pos">${net >= 0 ? "+" : ""}${eur0(net)}</b></div>` : `<div><small>Prelievi</small><b>${eur0(prel)}</b></div>`}</div>
    <div class="yc-chart dep-chart" id="dep-chart">${depChartHtml(righe)}</div>
    <button type="button" class="yc-link" id="dep-toggle" aria-expanded="${showDepTable}">${showDepTable ? "Nascondi la tabella" : "Vedi la tabella completa"}<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="${showDepTable ? "M3 9l4-4 4 4" : "M3 5l4 4 4-4"}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="tbl-wrap" id="dep-table"${showDepTable ? "" : " hidden"}>${dep ? depTable(d, depAnno) : risTable(d, depAnno)}</div>`);
  tc.onclick = (e) => {
    const col = e.target.closest(".yc-col[data-id]");
    if (col) { depChartSel = depChartSel === col.dataset.id ? null : col.dataset.id; $("dep-chart").innerHTML = depChartHtml(righe); return; }
    if (e.target.closest("#dep-toggle")) { showDepTable = !showDepTable; disegnaDepAnno(tc, ms, d); }
  };
}
let showDepTable = false;
function depChartHtml(righe) {
  const tutti = Array.from({ length: 12 }, (_, i) => depAnno + "-" + String(i + 1).padStart(2, "0"));
  const by = Object.fromEntries(righe.map((r) => [r.id, r]));
  const top = tetto(Math.max(0, ...righe.map((r) => r.saldo)));
  if (depChartSel && !by[depChartSel]) depChartSel = null;
  const oggi = meseCorrente();
  const cols = tutti.map((id, i) => {
    const r = by[id];
    if (!r) return `<div class="yc-col off" aria-hidden="true"></div>`;
    const h = (r.saldo / top) * 100, e2 = extraInfo(id, state.piano);
    const tip = id === depChartSel ? `<div class="yc-tip ${i < 6 ? "l" : "r"}"><b>${monthLabelLong(id)}</b><span>${usaDep() ? "Saldo" : "Da parte"} ${eur(r.saldo)}</span><span>${r.versato - r.prelievo >= 0 ? "+" : ""}${eur(r.versato - r.prelievo)} ${usaDep() ? "versati" : "messi da parte"}${r.extra && e2 ? " (con " + e2.corto + ")" : ""}</span>${usaDep() ? `<span>+${eur(r.netto)} di interessi</span>` : ""}</div>` : "";
    return `<button type="button" class="yc-col${id === depChartSel ? " on" : ""}" data-id="${id}" aria-label="${monthLabelLong(id)}: saldo ${eur(r.saldo)}"><span class="b-d${r.cambio ? " cambio" : ""}" style="bottom:0;height:${h}%"></span>${tip}</button>`;
  }).join("");
  const lab = tutti.map((id, i) => `<span class="${id === oggi ? "now" : ""}${by[id] && extraInfo(id, state.piano) && by[id].extra ? " x" : ""}">${"GFMAMGLASOND"[i]}</span>`).join("");
  const f0 = (v) => new Intl.NumberFormat("it-IT", { useGrouping: "always" }).format(v);
  return `<div class="yc-plot"><span class="yc-grid" style="bottom:0"></span><span class="yc-grid dash" style="bottom:50%"></span><span class="yc-grid dash" style="bottom:100%"><em>${f0(top)}</em></span><div class="yc-cols">${cols}</div></div><div class="yc-x">${lab}</div>
    <p class="hint dep-tap">${depChartSel ? "" : "Tocca un mese per vedere il saldo"}</p>`;
}
function depHero(d, ms) {
  const fine = ms[ms.length - 1], oggi = meseCorrente(), dep = usaDep();
  const base = N(state.deposito.saldo_iniziale);
  const dettaglio = dep
    ? `${base ? `<b>${eur0(base)}</b> di partenza + ` : ""}<b>${eur0(d.totVersato)}</b> versati + <b>${eur0(d.totNetto)}</b> di interessi − <b>${eur0(d.totBollo)}</b> di bollo`
    : `${base ? `<b>${eur0(base)}</b> già da parte + ` : ""}<b>${eur0(d.totVersato)}</b> messi da parte`;
  return `<div class="dh-label">${dep ? "Oggi sul conto" : "Messo da parte oggi"}</div><div class="big" data-k="dep-oggi" data-n="${saldoAl(d, oggi)}" data-f="eur">${eur(saldoAl(d, oggi))}</div>
    <div class="hint dh-stima">${modelloVuoto() ? "Stima solo sui mesi che hai compilato" : "Stima dai tuoi conti"}, fino a ${monthLabelLong(oggi < ms[0] ? ms[0] : oggi > fine ? fine : oggi).toLowerCase()}${oggi < ms[0] ? " (i tuoi conti partono da " + monthLabelLong(ms[0]).toLowerCase() + ")" : ""}</div>
    <div class="dh-prev"><div class="dh-prev-top"><span>${icona("calendar", "currentColor", 14)} Previsto a ${monthLabelLong(fine).toLowerCase()}</span><b data-k="dep-fine" data-n="${d.saldo}" data-f="eur0">${eur0(d.saldo)}</b></div><div class="formula">${dettaglio}</div></div>`;
}

function renderRisparmi(v) {
  const ms = months(), dep = state.deposito, d = simula(ms);
  v.appendChild(secHead("Messo da parte"));
  v.insertAdjacentHTML("beforeend", `<section class="hero dep-hero" id="dep-tiles">${depHero(d, ms)}</section>`);
  v.appendChild(secHead("Obiettivo"));
  goalCard(v, ms);
  v.appendChild(secHead("Impostazioni"));
  v.appendChild(moneyField("Saldo di partenza", N(dep.saldo_iniziale), (n) => { dep.saldo_iniziale = n; saveDeposito(); }, { id: "r-saldo", cls: "riga", hint: `I risparmi da cui parti, a ${monthLabelLong(ms[0]).toLowerCase()}` }));
  const anni = [...new Set(ms.map((x) => x.slice(0, 4)))];
  if (!anni.includes(depAnno)) depAnno = anni.includes(meseCorrente().slice(0, 4)) ? meseCorrente().slice(0, 4) : anni[0];
  v.appendChild(secHead("Il tuo anno"));
  const tc = document.createElement("section"); tc.className = "card pad year"; tc.id = "dep-year";
  v.appendChild(tc);
  disegnaDepAnno(tc, ms, d);
}
function risTiles(d, ms) {
  const oggi = meseCorrente(), fine = ms[ms.length - 1];
  const prel = d.rows.reduce((a, r) => a + r.prelievo, 0), vers = d.rows.reduce((a, r) => a + r.versato, 0);
  const quando = oggi < ms[0] ? "all'inizio" : oggi > fine ? "a " + monthLabel(fine) : "a " + monthLabel(oggi);
  return `<div class="tile ing"><span class="label">Da parte oggi</span><span class="v">${eur(saldoAl(d, oggi))}</span><span class="hint">Messo da parte fino ${quando}</span></div>
    <div class="tile"><span class="label">A ${monthLabel(fine)}</span><span class="v">${eur(d.saldo)}</span><span class="hint">Se continui così</span></div>
    <div class="tile"><span class="label">Versato / prelevato</span><span class="v">${eur(vers)}</span><span class="hint">${prel > 0 ? "Prelevati " + eur(prel) : "Nessun prelievo"}${state.piano.extra_al_deposito && extraNomi() ? " · con " + extraNomi() : ""}</span></div>`;
}
function risTable(d, anno) {
  const maxS = Math.max(1, ...d.rows.map((r) => r.saldo));
  let html = '<table><thead><tr><th>Mese</th><th>Da parte</th><th>Prelievi</th><th>Totale</th><th aria-hidden="true"></th></tr></thead><tbody>';
  d.rows.filter((r) => !anno || r.id.startsWith(anno)).forEach((r) => {
    const e2 = extraInfo(r.id, state.piano);
    html += `<tr><td>${monthLabel(r.id)}${r.extra && e2 ? ` <span class="tag">${e2.corto}</span>` : ""}</td><td>+${fmt.format(r.versato)}</td><td class="${r.prelievo ? "neg" : ""}">${r.prelievo ? "−" + fmt.format(r.prelievo) : "–"}</td><td>${fmt.format(r.saldo)}</td><td><span class="mini" style="width:${Math.max(2, Math.round((r.saldo / maxS) * 80))}px"></span></td></tr>`;
  });
  return html + "</tbody></table>";
}
function depTiles(d, ms) {
  return `<div class="tile ing"><span class="label">Da parte a ${monthLabel(ms[ms.length - 1])}</span><span class="v">${eur(d.saldo)}</span><span class="hint">Saldo stimato del conto deposito</span></div>
    <div class="tile"><span class="label">Versato in totale</span><span class="v">${eur(d.totVersato)}</span><span class="hint">Risparmi${state.piano.extra_al_deposito && extraNomi() ? " + " + extraNomi() : ""} meno prelievi</span></div>
    <div class="tile"><span class="label">Interessi netti</span><span class="v">${eur(d.totNetto)}</span><span class="hint">Dopo le tasse; bollo stimato ${eur(d.totBollo)}</span></div>`;
}
function depTable(d, anno) {
  const maxS = Math.max(1, ...d.rows.map((r) => r.saldo));
  d = { ...d, rows: d.rows.filter((r) => !anno || r.id.startsWith(anno)) };
  let html = '<table><thead><tr><th>Mese</th><th>Tasso</th><th>Versato</th><th>Interessi netti</th><th>Bollo</th><th>Saldo</th><th aria-hidden="true"></th></tr></thead><tbody>';
  d.rows.forEach((r) => {
    const vers = r.versato - r.prelievo, e2 = extraInfo(r.id, state.piano);
    html += `<tr class="${r.cambio ? "promo-end" : ""}"><td>${monthLabel(r.id)}${r.extra && e2 ? ` <span class="tag">${e2.corto}</span>` : ""}</td><td title="${r.periodo?.nome ? esc(r.periodo.nome) : ""}">${fmt.format(r.tasso)}%</td><td class="${vers < 0 ? "neg" : ""}">${vers >= 0 ? "+" : ""}${fmt.format(vers)}</td><td>+${fmt.format(r.netto)}</td><td>−${fmt.format(r.bollo)}</td><td>${fmt.format(r.saldo)}</td><td><span class="mini" style="width:${Math.max(2, Math.round((r.saldo / maxS) * 80))}px"></span></td></tr>`;
  });
  return html + "</tbody></table>";
}

/** Riga con interruttore (stile iPhone): titolo e spiegazione a sinistra, interruttore a destra. */
function switchRow(id, titolo, hint, checked, onCh) {
  const l = document.createElement("label"); l.className = "field riga sw-row"; l.htmlFor = id;
  l.innerHTML = `<span class="label">${esc(titolo)}</span><input type="checkbox" role="switch" class="sw" id="${id}"${checked ? " checked" : ""}>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}`;
  l.querySelector("input").onchange = (e) => onCh(e.target.checked);
  return l;
}

function renderModello(v) {
  const p = state.piano, ms = months();
  const nCustom = ms.filter((id) => state.mesi[id]).length;
  const tb = document.createElement("div"); tb.className = "toolbar month-head";
  tb.innerHTML = `<h2>Il mese tipo</h2><span class="mh-right hint">${nCustom ? `${nCustom} ${nCustom === 1 ? "mese personalizzato" : "mesi personalizzati"}` : "Nessun mese personalizzato"}</span>`;
  v.appendChild(tb);
  v.insertAdjacentHTML("beforeend", `<p class="hint flush mod-intro">I mesi che non hai personalizzato seguono il Modello: cambi qui, cambiano tutti.</p>`);

  // Resto in tasca
  const m = { stipendio: N(p.stipendio), entrate_extra: 0, buoni: round(N(p.buoni_num) * N(p.buoni_valore)), risparmio: N(p.risparmio), voci: vociModello(), prelievo: 0, extra: 0 };
  const c = calcMonth(m, p);
  // Resto in tasca in piccolo: una riga e la barra sottile (il riquadro grande è in Mesi)
  const rs = document.createElement("section"); rs.className = "hero mod-resto"; rs.setAttribute("aria-live", "polite");
  rs.innerHTML = `<div class="mr-top">Ti restano <b class="${c.resto < 0 ? "neg" : ""}" data-live="resto" data-k="resto-modello" data-n="${c.resto}" data-f="eur">${eur(c.resto)}</b> ${(p.voci || []).some((x) => x.da) ? "a " + monthLabelLong(meseRif()).toLowerCase() : "al mese"}</div><div class="bar" data-live="bar" role="img" aria-label="Ripartizione delle entrate"></div><div data-live="legend" hidden></div>`;
  fillBar(rs.querySelector('[data-live="bar"]'), rs.querySelector('[data-live="legend"]'), m, c);
  v.appendChild(rs);

  // Entrate
  v.appendChild(secHead("Entrate", eur(c.entrate), "entrate"));
  const fs = document.createElement("div"); fs.className = "fields";
  fs.appendChild(moneyField("Stipendio", N(p.stipendio), (n) => { p.stipendio = n; savePiano(); }, { id: "t-stip" }));
  // Buoni pasto (o altro benefit fisso) accanto allo stipendio: numero al mese × valore di un buono
  fs.appendChild(buoniField(N(p.buoni_num), N(p.buoni_valore), (n) => { p.buoni_num = n; savePiano(); }, (n) => { p.buoni_valore = n; savePiano(); }, { id: "t-buoni" }));
  v.appendChild(fs);
  v.insertAdjacentHTML("beforeend", '<p class="hint flush mod-nota">Le entrate che non arrivano tutti i mesi (rimborsi, extra) scrivile solo nel mese, nella scheda Mesi.</p>');

  // Mensilità: 12, 13 o 14, con importo e mese di 13ª e 14ª
  const nm = N(p.mensilita) || 13;
  v.appendChild(secHead("Mensilità"));
  const rm = document.createElement("div"); rm.className = "field riga seg-row";
  rm.innerHTML = `<span class="label">Buste paga in un anno</span><span class="hint">${nm === 12 ? "Senza tredicesima" : nm === 13 ? "Con la tredicesima" : "Con tredicesima e quattordicesima"}</span>`;
  const sg = document.createElement("div"); sg.className = "seg mens"; sg.setAttribute("role", "group"); sg.setAttribute("aria-label", "Mensilità");
  [12, 13, 14].forEach((k) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = k; b.setAttribute("aria-pressed", String(k === nm));
    b.onclick = () => { if (k !== nm) { p.mensilita = k; savePiano(); render(); } };
    sg.appendChild(b);
  });
  rm.appendChild(sg); v.appendChild(rm);
  const sel12 = (id, label, value, opts, onCh, hint = "") => {
    const f = document.createElement("label"); f.className = "field"; f.htmlFor = id;
    f.innerHTML = `<span class="label">${label}</span><select id="${id}">${opts.map(([v2, t]) => `<option value="${v2}"${String(v2) === String(value) ? " selected" : ""}>${t}</option>`).join("")}</select>${hint ? `<span class="hint">${hint}</span>` : ""}`;
    f.querySelector("select").onchange = (e) => onCh(e.target.value);
    return f;
  };
  const mesiOpt = (esclusa) => MESI_NOMI.map((n, i) => [i + 1, n]).filter(([k]) => k !== esclusa);
  if (nm >= 13) {
    const fx = document.createElement("div"); fx.className = "fields mens-x";
    fx.appendChild(moneyField("Tredicesima", N(p.tredicesima), (n) => { p.tredicesima = n; savePiano(); }, { id: "t-13", cls: "extra", hint: "Dalla busta paga" }));
    fx.appendChild(sel12("t-m13", "Mese", p.mese_13, mesiOpt(nm >= 14 ? p.mese_14 : 0), (x) => { p.mese_13 = Number(x); savePiano(); render(); }, "Di solito dicembre"));
    if (nm >= 14) {
      fx.appendChild(moneyField("Quattordicesima", N(p.quattordicesima), (n) => { p.quattordicesima = n; savePiano(); }, { id: "t-14", cls: "extra", hint: "Dalla busta paga" }));
      fx.appendChild(sel12("t-m14", "Mese", p.mese_14, mesiOpt(p.mese_13), (x) => { p.mese_14 = Number(x); savePiano(); render(); }, "Spesso giugno o luglio"));
    }
    v.appendChild(fx);
    const nomiMesi = nm >= 14 ? `${MESI_NOMI[p.mese_13 - 1].toLowerCase()} e ${MESI_NOMI[p.mese_14 - 1].toLowerCase()}` : MESI_NOMI[p.mese_13 - 1].toLowerCase();
    const chi = nm >= 14 ? "13ª e 14ª" : "Tredicesima";
    v.appendChild(switchRow("t-extradep", `${chi} ${usaDep() ? "al deposito" : "da parte"}`,
      p.extra_al_deposito ? `${nm >= 14 ? "Vanno" : "Va"} ${T().dove} a ${nomiMesi}` : `${nm >= 14 ? "Restano" : "Resta"} in tasca a ${nomiMesi}`,
      p.extra_al_deposito, (x) => { p.extra_al_deposito = x; savePiano(); render(); }));
  }

  // Risparmio
  v.appendChild(secHead("Risparmio", eur(c.toDep), "risparmio"));
  v.appendChild(moneyField(T().rispBreve, N(p.risparmio), (n) => { p.risparmio = n; savePiano(); }, { id: "t-risp", cls: "riga", hint: "Ogni mese" }));

  // Spese
  vociEditor(v, () => p.voci, (fn) => { fn(p.voci); savePiano(); }, "t-", { titoloFuori: true, periodi: true });

  // Impostazioni: periodo e avviso
  v.appendChild(secHead("Impostazioni"));
  const oggi = meseCorrente();
  const opts = monthRange((Number(oggi.slice(0, 4)) - 5) + "-01", (Number(oggi.slice(0, 4)) + 10) + "-12");
  if (!opts.includes(p.mese_inizio)) opts.unshift(p.mese_inizio);
  const per = document.createElement("div"); per.className = "fields";
  per.innerHTML = `<label class="field" for="t-da"><span class="label">Dal mese</span><select id="t-da">${opts.map((id) => `<option value="${id}"${id === p.mese_inizio ? " selected" : ""}>${monthLabel(id)}</option>`).join("")}</select><span class="hint">Il primo mese dei tuoi conti</span></label>
    <label class="field" for="t-a"><span class="label">Fino a</span><select id="t-a"><option value="">Senza fine</option>${opts.filter((id) => id >= p.mese_inizio).map((id) => `<option value="${id}"${!p.senza_fine && id === p.mese_fine ? " selected" : ""}>${monthLabel(id)}</option>`).join("")}</select><span class="hint">${p.senza_fine ? `Si allunga da solo: ora fino a ${monthLabelLong(months().slice(-1)[0])}` : "Ultimo mese dei tuoi conti"}</span></label>`;
  if (p.senza_fine) per.querySelector("#t-a").value = "";
  per.querySelector("#t-da").onchange = (e) => {
    const x = e.target.value;
    if (p.senza_fine || x <= p.mese_fine) { p.mese_inizio = x; savePiano(); render(); } else e.target.value = p.mese_inizio;
  };
  per.querySelector("#t-a").onchange = (e) => {
    const x = e.target.value;
    if (!x) p.senza_fine = true; else { p.senza_fine = false; p.mese_fine = x; }
    savePiano(); render();
  };
  v.appendChild(per);
  v.appendChild(switchRow("t-usadep", "Uso un conto deposito", usaDep() ? "Scheda Deposito, con tassi e interessi" : "Scheda Risparmi, senza interessi", usaDep(), (x) => { p.usa_deposito = x; savePiano(); render(); }));

  // Avviso resto basso: interruttore; acceso chiede una cifra obbligatoria (soglia 0 = spento)
  const avvisoOn = N(p.soglia) > 0 || avvisoAperto;
  v.appendChild(switchRow("t-avviso", "Avviso resto basso", avvisoOn ? "Ti avvisa se il resto in tasca scende sotto la cifra" : "Spento", avvisoOn, (x) => {
    if (x) { avvisoAperto = true; render(); $("t-soglia")?.focus(); }
    else { avvisoAperto = false; if (N(p.soglia)) { p.soglia = 0; savePiano(); } render(); }
  }));
  if (avvisoOn) {
    const fsg = moneyField("Avvisami sotto", N(p.soglia), (n) => { const x = n > 0 ? n : 0; if (x !== N(p.soglia)) { p.soglia = x; savePiano(); } }, { id: "t-soglia", cls: "riga" });
    const inp = fsg.querySelector("input"), err = document.createElement("span");
    err.className = "err"; err.textContent = "Scrivi una cifra, ad esempio 300."; err.hidden = true; fsg.appendChild(err);
    inp.placeholder = "es. 300"; if (!(N(p.soglia) > 0)) inp.value = "";
    const controlla = () => { const n = parseNum(inp.value); err.hidden = !isNaN(n) && n > 0; if (!err.hidden && N(p.soglia)) { p.soglia = 0; savePiano(); refresh(); } };
    inp.addEventListener("input", controlla);
    inp.addEventListener("blur", () => { controlla(); if (!(N(p.soglia) > 0)) inp.value = ""; });
    v.appendChild(fsg);
  }
}

/* ---------- Render ---------- */
function render() {
  needsRender = false;
  const v = $("view"), y = window.scrollY;
  v.innerHTML = "";
  document.title = empty ? SLOGAN : "Spare | " + (view === "mesi" ? "Mesi" : view === "modello" ? "Modello" : T().tab);
  if (empty) { renderOnboarding(v); return; }
  document.querySelector('.tabs button[data-v="deposito"]').textContent = T().tab;
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.v === view)));
  if (view !== "modello") avvisoAperto = false;
  if (view === "mesi") renderMesi(v); else if (view === "deposito") (usaDep() ? renderDeposito : renderRisparmi)(v); else renderModello(v);
  updateGroupSums();
  window.scrollTo(0, y);
  anima(v);
}
/* ---------- Animazioni: solo quando cambi scheda, mese o anno (non mentre modifichi) ---------- */
let visto = { view: null, sel: null, depAnno: null };
let nuovaRiga = null; // id della spesa o del tasso appena aggiunti, da evidenziare
function anima(v) {
  const cambioVista = view !== visto.view, cambioMese = !cambioVista && view === "mesi" && sel !== visto.sel;
  const cambioAnnoDep = !cambioVista && view === "deposito" && depAnno !== visto.depAnno;
  visto = { view, sel, depAnno };
  pillola(document.querySelector(".tabs"), "tabs");
  pillola(v.querySelector(".seg.mens"), "mens");
  contaNumeri(v, { eur, eur0 }, { daZero: cambioVista });
  if (nuovaRiga) { evidenzia(document.querySelector(`[data-riga="${nuovaRiga}"]`)); nuovaRiga = null; }
  if (cambioVista) {
    entra([...v.children]);
    riempi([...v.querySelectorAll(".bar")]); allunga([...v.querySelectorAll(".goal-bar > span")]); cresci([...v.querySelectorAll(".dep-chart .b-d")]);
  } else if (cambioMese) {
    const kids = [...v.children], i = kids.findIndex((el) => el.classList.contains("month-head"));
    entra(kids.slice(Math.max(0, i)));
    riempi([...v.querySelectorAll(".bar")]);
  } else if (cambioAnnoDep) cresci([...v.querySelectorAll(".dep-chart .b-d")]);
}
window.addEventListener("resize", () => pillola(document.querySelector(".tabs"), "tabs"));
const currentMonth = () => (view === "modello"
  ? { stipendio: N(state.piano.stipendio), entrate_extra: 0, buoni: round(N(state.piano.buoni_num) * N(state.piano.buoni_valore)), risparmio: N(state.piano.risparmio), voci: vociModello(), prelievo: 0, extra: 0 }
  : monthData(sel, state.piano, state.mesi));
function updateGroupSums() {
  const voci = currentMonth().voci;
  document.querySelectorAll("[data-gsum]").forEach((el) => { el.textContent = eur(voci.filter((x) => ck(x.cat) === el.dataset.gsum).reduce((a, x) => a + N(x.importo), 0)); });
}
// Aggiornamento leggero mentre scrivi: cambia solo i numeri, non gli input.
function refresh() {
  if (view === "deposito") {
    // Mentre scrivi aggiorno riquadri e tabella, senza toccare i campi
    const ms = months(), d = simula(ms);
    if ($("dep-tiles")) $("dep-tiles").innerHTML = depHero(d, ms);
    if ($("dep-chart")) $("dep-chart").innerHTML = depChartHtml(d.rows.filter((r) => r.id.startsWith(depAnno)));
    if ($("dep-table")) $("dep-table").innerHTML = usaDep() ? depTable(d, depAnno) : risTable(d, depAnno);
    if ($("goal-status")) $("goal-status").innerHTML = goalStatus(ms);
    ricorda($("view"));
    return;
  }
  const m = currentMonth(), c = calcMonth(m, state.piano), q = (s) => document.querySelector(`[data-live="${s}"]`);
  if (q("resto")) { fermaNumero(q("resto"), c.resto); q("resto").textContent = eur(c.resto); q("resto").classList.toggle("neg", c.resto < 0); }
  if (q("chip")) { q("chip").dataset.k = statoResto(c.resto, state.piano.soglia); q("chip").textContent = testoResto(c.resto, state.piano.soglia); }
  if (q("formula")) q("formula").innerHTML = formula(m, c, view === "mesi" ? extraInfo(sel, state.piano)?.nome : "");
  if (q("bar")) fillBar(q("bar"), q("legend"), m, c);
  if (q("spese")) q("spese").textContent = eur(c.spese);
  if (q("entrate")) q("entrate").textContent = eur(c.entrate);
  if (q("risparmio")) q("risparmio").textContent = eur(round(c.toDep - N(m.prelievo)));
  updateGroupSums();
  if (view === "mesi") {
    const chip = $("chip-" + sel);
    if (chip) { chip.querySelector(".pin").dataset.k = statoResto(c.resto, state.piano.soglia); }
    const ms = months().filter((id) => id.startsWith(sel.slice(0, 4)));
    if ($("year-card")) { const d = datiAnno(ms); $("yc-chart").innerHTML = chartHtml(d, sel.slice(0, 4)); $("yc-table").innerHTML = tabellaAnno(d, sel.slice(0, 4));
      $("yc-stats").innerHTML = statsAnno(d, sel.slice(0, 4)); }
  }
  ricorda($("view"));
}
function softRender() {
  const a = document.activeElement;
  if (a && $("view").contains(a) && (a.tagName === "INPUT" || a.tagName === "SELECT")) { needsRender = true; return; }
  render();
}
$("view").addEventListener("focusout", () => setTimeout(() => { if (needsRender) softRender(); }, 0));

/* ---------- Barra in alto ---------- */
document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => {
  view = b.dataset.v;
  history.replaceState(null, "", "#" + view);
  render(); window.scrollTo(0, 0);
}));
$("brand").innerHTML = LOGO;
/** Apre o chiude il menu: il pulsante passa da hamburger a X (animazione in CSS). */
function setMenu(aperto) {
  $("menu").hidden = !aperto;
  if (aperto) pillola($("temaSeg"), "tema");
  $("menuBtn").setAttribute("aria-expanded", String(aperto));
  $("menuBtn").setAttribute("aria-label", aperto ? "Chiudi menu" : "Apri menu");
}
const chiudiMenu = () => setMenu(false);
$("menuBtn").onclick = () => setMenu($("menu").hidden);
document.addEventListener("click", (e) => { if (!$("menu").hidden && !e.target.closest("#menu, #menuBtn")) chiudiMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("menu").hidden) { chiudiMenu(); $("menuBtn").focus(); } });
$("doExport").onclick = () => {
  const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "spare-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  chiudiMenu();
};
/** Senza guida: salvo un piano vuoto e apro il Modello, dove si inserisce tutto a mano. */
function saltaGuida() { empty = false; savePiano(); saveDeposito(); view = "modello"; history.replaceState(null, "", "#modello"); render(); window.scrollTo(0, 0); }
function guida(primaVolta) {
  apriGuida({
    state, savePiano, saveDeposito, primaVolta, onSkip: saltaGuida,
    onDone: () => { empty = false; view = "mesi"; sel = meseIniziale(months()); history.replaceState(null, "", "#mesi"); render(); window.scrollTo(0, 0); },
  });
}
$("doGuida").onclick = () => { chiudiMenu(); guida(empty); };
$("doCategorie").onclick = () => { chiudiMenu(); apriCategorie({ state, savePiano, saveMese, onChange: () => render() }); };
$("doAiuto").onclick = () => { chiudiMenu(); apriAiuto(); };
$("doSicurezza").onclick = () => { chiudiMenu(); apriSicurezza({ sb }); };
$("doImport").onclick = () => { chiudiMenu(); $("importFile").click(); };
$("importFile").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  setStatus("saving", "Importazione…");
  try {
    await importData(JSON.parse(await f.text()));
    empty = false;
    const ms = months(); if (!ms.includes(sel)) sel = meseIniziale(ms);
    render();
  } catch (err) { setStatus("error", "Importazione non riuscita: " + (err.message || "file non valido")); }
};
/* ---------- Tema chiaro / scuro (per dispositivo) ---------- */
function temaAttuale() { try { return localStorage.getItem("spare-tema") || "auto"; } catch (e) { return "auto"; } }
function applicaTema(t) {
  const root = document.documentElement;
  if (t === "light" || t === "dark") root.dataset.theme = t; else delete root.dataset.theme;
  try { if (t === "auto") localStorage.removeItem("spare-tema"); else localStorage.setItem("spare-tema", t); } catch (e) { /* memoria del browser non disponibile */ }
  // colore della barra del browser/telefono
  const scuro = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = scuro ? "#000000" : "#F2F2F7"; if (t !== "auto") m.removeAttribute("media"); });
  document.querySelectorAll("#temaSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
  pillola($("temaSeg"), "tema");
}
document.querySelectorAll("#temaSeg button").forEach((b) => (b.onclick = () => applicaTema(b.dataset.t)));
applicaTema(temaAttuale());

$("doLogout").onclick = async () => { chiudiMenu(); await sb.auth.signOut(); };

boot();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
