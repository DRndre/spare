// Interfaccia: login, schede Mesi / Conto Deposito / Modello.
import {
  CATS, N, round, fmt, eur, parseNum, uid, monthRange, monthLabel, monthLabelLong,
  extraInfo, monthData, calcMonth, statoResto, testoResto, simulaDeposito, ordinaPeriodi, periodoDelMese, addMonths,
} from "./calc.js";
import {
  sb, configured, state, onStatus, loadAll, savePiano, saveDeposito, saveMese, resetMese, exportData, importData,
} from "./store.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

let view = ["mesi", "deposito", "modello"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "mesi";
let sel = null;
let needsRender = false;
let empty = false;

const months = () => monthRange(state.piano.mese_inizio, state.piano.mese_fine);

/* ---------- Stato salvataggio ---------- */
function setStatus(s, t) { const el = $("status"); el.dataset.s = s; $("statusTxt").textContent = t; }
onStatus(setStatus);

/* ---------- Login ---------- */
function showAuth(mode = "login", msg = "") {
  $("app").hidden = true;
  const a = $("auth"); a.hidden = false;
  const titles = { login: "Accedi", signup: "Crea il tuo account", reset: "Recupera la password", newpass: "Scegli una nuova password" };
  a.innerHTML = `
    <form class="auth-card" id="authForm" novalidate>
      <h1>Conti del mese</h1>
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
  const cur = new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");
  if (!sel || !ms.includes(sel)) sel = ms.includes(cur) ? cur : ms[0];
  render();
}

async function boot() {
  if (!configured) {
    $("auth").hidden = false;
    $("auth").innerHTML = '<div class="auth-card"><h1>Conti del mese</h1><p>Manca la configurazione di Supabase: inserisci URL e chiave in <code>js/config.js</code> (vedi README).</p></div>';
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

function confirmInline(host, text, okLabel, onOk) {
  if (host.querySelector(".confirm")) return;
  const cf = document.createElement("div"); cf.className = "confirm";
  cf.innerHTML = `<span>${esc(text)}</span>`;
  const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Annulla"; no.onclick = () => cf.remove();
  const si = document.createElement("button"); si.type = "button"; si.className = "btn danger"; si.textContent = okLabel; si.onclick = onOk;
  cf.append(no, si); host.appendChild(cf); si.focus();
}

function vociEditor(container, getVoci, change, prefix) {
  const voci = getVoci();
  const card = document.createElement("section"); card.className = "card";
  card.innerHTML = `<div class="card-head"><h2>Spese</h2><span class="tot" data-live="spese">${eur(round(voci.reduce((a, v) => a + N(v.importo), 0)))}</span></div>`;
  if (!voci.length) card.insertAdjacentHTML("beforeend", '<div class="empty">Nessuna spesa: aggiungi la prima qui sotto.</div>');
  CATS.forEach((c) => {
    const vs = voci.filter((v) => v.cat === c.k);
    if (!vs.length) return;
    const g = document.createElement("div"); g.className = "group";
    g.innerHTML = `<div class="group-head"><span class="gname"><i style="background:var(${c.c})"></i>${c.n}</span><span class="gsum" data-gsum="${c.k}"></span></div>`;
    vs.forEach((v) => {
      const r = document.createElement("div"); r.className = "row";
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
      r.append(nome, wi, del); g.appendChild(r);
    });
    card.appendChild(g);
  });
  const form = document.createElement("form"); form.className = "add"; form.autocomplete = "off";
  form.innerHTML = `<input class="n" type="text" id="${prefix}a-nome" placeholder="Nuova voce (es. Palestra)" aria-label="Nome della voce"><input type="text" inputmode="decimal" id="${prefix}a-imp" placeholder="0,00" aria-label="Importo mensile"><select id="${prefix}a-cat" aria-label="Categoria">${CATS.map((c) => `<option value="${c.k}">${c.n}</option>`).join("")}</select><button class="btn primary" type="submit">Aggiungi</button><div class="err" hidden></div>`;
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const nome = form.querySelector(".n").value.trim();
    const imp = parseNum(form.querySelector("[inputmode]").value);
    const err = form.querySelector(".err");
    if (!nome) { err.textContent = "Scrivi il nome della voce."; err.hidden = false; return; }
    if (isNaN(imp) || imp < 0) { err.textContent = "Scrivi un importo valido, ad esempio 25,50."; err.hidden = false; return; }
    const cat = form.querySelector("select").value;
    change((list) => list.push({ id: uid(), nome, importo: round(imp), cat }));
    render();
    $(prefix + "a-nome")?.focus();
  };
  card.appendChild(form);
  container.appendChild(card);
}

function formula(m, c, extraNome) {
  let f = `<b>${eur(m.stipendio)}</b> stipendio`;
  if (m.extra) f += ` + <b>${eur(m.extra)}</b> ${(extraNome || "extra").toLowerCase()}`;
  return f + ` − spese <b>${eur(c.spese)}</b> − al deposito <b>${eur(c.toDep)}</b>`;
}
function hero(m, c, extraNome) {
  const s = document.createElement("section"); s.className = "hero"; s.setAttribute("aria-live", "polite");
  s.innerHTML = `<div class="label">Resto in tasca</div>
    <div class="hero-row"><div class="big${c.resto < 0 ? " neg" : ""}" data-live="resto">${eur(c.resto)}</div>
    <div class="chip" data-k="${statoResto(c.resto, state.piano.soglia)}" data-live="chip">${testoResto(c.resto, state.piano.soglia)}</div></div>
    <div class="formula" data-live="formula">${formula(m, c, extraNome)}</div>
    <div class="bar" data-live="bar" role="img" aria-label="Ripartizione delle entrate"></div><div class="legend" data-live="legend"></div>`;
  fillBar(s.querySelector('[data-live="bar"]'), s.querySelector('[data-live="legend"]'), m, c);
  return s;
}
function fillBar(bar, leg, m, c) {
  const parts = CATS.map((x) => ({ n: x.n, c: x.c, v: m.voci.filter((v) => v.cat === x.k).reduce((a, v) => a + N(v.importo), 0) })).filter((p) => p.v > 0);
  if (c.toDep > 0) parts.push({ n: "Conto Deposito", c: "--c-risp", v: c.toDep });
  const base = Math.max(c.entrate, parts.reduce((a, p) => a + p.v, 0)) || 1;
  bar.innerHTML = ""; leg.innerHTML = "";
  parts.forEach((p) => { const s = document.createElement("span"); s.style.flex = `0 0 ${(p.v / base) * 100}%`; s.style.background = `var(${p.c})`; s.title = p.n + ": " + eur(p.v); bar.appendChild(s); });
  parts.concat(c.resto > 0 ? [{ n: "Resto", c: "--c-resto", v: c.resto }] : []).forEach((p) => {
    const d = document.createElement("span"); d.innerHTML = `<i style="background:var(${p.c})"></i>`; d.appendChild(document.createTextNode(`${p.n} ${Math.round((p.v / base) * 100)}%`)); leg.appendChild(d);
  });
}

/* ---------- Mesi personalizzati ---------- */
function ensureMese(id) {
  if (!state.mesi[id]) {
    const t = monthData(id, state.piano, state.mesi);
    state.mesi[id] = { stipendio: t.stipendio, risparmio: t.risparmio, prelievo: 0, extra: null, voci: t.voci.map((v) => ({ ...v })) };
  }
  return state.mesi[id];
}

/* ---------- Viste ---------- */
function renderOnboarding(v) {
  v.innerHTML = `<section class="card pad"><h2>Benvenuto</h2>
    <p>Non hai ancora dati. Puoi caricare un backup (il file <code>.json</code> esportato da Conti del mese) oppure partire da zero e inserire stipendio e spese nel Modello.</p>
    <div class="actions"><button class="btn primary" type="button" id="ob-import">Importa un backup</button><button class="btn" type="button" id="ob-zero">Parto da zero</button></div></section>`;
  $("ob-import").onclick = () => $("importFile").click();
  $("ob-zero").onclick = () => { empty = false; savePiano(); saveDeposito(); view = "modello"; render(); };
}

function renderMesi(v) {
  const ms = months();
  const chips = document.createElement("div"); chips.className = "chips"; chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "Scegli il mese");
  ms.forEach((id) => {
    const c = calcMonth(monthData(id, state.piano, state.mesi), state.piano);
    const b = document.createElement("button"); b.type = "button"; b.className = "chip-m"; b.id = "chip-" + id; b.setAttribute("aria-pressed", String(id === sel));
    b.innerHTML = `<span class="m"><span class="pin" data-k="${statoResto(c.resto, state.piano.soglia)}"></span>${monthLabel(id)}</span><span class="r">${eur(c.resto)}</span>`;
    b.onclick = () => { sel = id; render(); $("chip-" + id)?.scrollIntoView({ inline: "center", block: "nearest" }); };
    chips.appendChild(b);
  });
  v.appendChild(chips);

  const m = monthData(sel, state.piano, state.mesi), c = calcMonth(m, state.piano), ex = extraInfo(sel, state.piano);
  const tb = document.createElement("div"); tb.className = "toolbar";
  tb.innerHTML = `<h2>${monthLabelLong(sel)}${ex ? `<span class="tag">+ ${ex.nome}</span>` : ""}${m.custom ? '<span class="tag custom">personalizzato</span>' : ""}</h2>`;
  if (m.custom) {
    const rb = document.createElement("button"); rb.type = "button"; rb.className = "btn"; rb.textContent = "Ripristina dal modello";
    rb.onclick = () => confirmInline(tb, `Le modifiche di ${monthLabelLong(sel)} andranno perse.`, "Ripristina", async () => { await resetMese(sel); render(); });
    tb.appendChild(rb);
  } else tb.insertAdjacentHTML("beforeend", '<span class="hint">Segue il Modello: modifica qui per personalizzare solo questo mese.</span>');
  v.appendChild(tb);
  v.appendChild(hero(m, c, ex?.nome));

  const fs = document.createElement("div"); fs.className = "fields";
  fs.appendChild(moneyField("Stipendio netto", m.stipendio, (n) => { ensureMese(sel).stipendio = n; saveMese(sel); }, { id: "m-stip-" + sel }));
  if (ex) fs.appendChild(moneyField(ex.nome, m.extra, (n) => { ensureMese(sel).extra = n; saveMese(sel); }, { id: "m-extra-" + sel, cls: "extra", hint: state.piano.extra_al_deposito ? "Va nel conto deposito" : "Resta in tasca" }));
  fs.appendChild(moneyField("Risparmio al conto deposito", m.risparmio, (n) => { ensureMese(sel).risparmio = n; saveMese(sel); }, { id: "m-risp-" + sel }));
  fs.appendChild(moneyField("Prelievo dal conto deposito", m.prelievo, (n) => { ensureMese(sel).prelievo = n; saveMese(sel); }, { id: "m-prel-" + sel, hint: "Se tiri fuori soldi dal deposito" }));
  v.appendChild(fs);

  vociEditor(v, () => monthData(sel, state.piano, state.mesi).voci, (fn) => { fn(ensureMese(sel).voci); saveMese(sel); }, "m" + sel + "-");

  const card = document.createElement("section"); card.className = "card";
  card.innerHTML = '<div class="card-head"><h2>Tutti i mesi</h2><span class="hint">Tocca una riga per aprirla</span></div>';
  let t = { e: 0, s: 0, d: 0, r: 0 };
  let html = "<table><thead><tr><th>Mese</th><th>Entrate</th><th>Spese</th><th>Al deposito</th><th>Resto</th></tr></thead><tbody>";
  ms.forEach((id) => {
    const cc = calcMonth(monthData(id, state.piano, state.mesi), state.piano), e2 = extraInfo(id, state.piano);
    t.e += cc.entrate; t.s += cc.spese; t.d += cc.toDep; t.r += cc.resto;
    html += `<tr class="click${id === sel ? " sel" : ""}" data-id="${id}" tabindex="0"><td><span class="pin" data-k="${statoResto(cc.resto, state.piano.soglia)}"></span>${monthLabel(id)}${e2 ? ` <span class="tag">${e2.corto}</span>` : ""}</td><td>${fmt.format(cc.entrate)}</td><td>${fmt.format(cc.spese)}</td><td>${fmt.format(cc.toDep)}</td><td class="${cc.resto < 0 ? "neg" : ""}">${fmt.format(cc.resto)}</td></tr>`;
  });
  html += `</tbody><tfoot><tr><td>Totale</td><td>${fmt.format(round(t.e))}</td><td>${fmt.format(round(t.s))}</td><td>${fmt.format(round(t.d))}</td><td>${fmt.format(round(t.r))}</td></tr></tfoot></table>`;
  const w = document.createElement("div"); w.className = "tbl-wrap"; w.innerHTML = html; card.appendChild(w); v.appendChild(card);
  w.querySelectorAll("tr[data-id]").forEach((tr) => { const go = () => { sel = tr.dataset.id; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }; tr.onclick = go; tr.onkeydown = (e) => { if (e.key === "Enter") go(); }; });
}

function renderDeposito(v) {
  const ms = months(), dep = state.deposito;
  const d = simulaDeposito(ms, state.piano, state.mesi, dep);
  const periodi = ordinaPeriodi(dep.periodi);
    v.insertAdjacentHTML("beforeend", `<div class="tiles">
    <div class="tile ing"><span class="label">Da parte a ${monthLabel(ms[ms.length - 1])}</span><span class="v">${eur(d.saldo)}</span><span class="hint">Saldo stimato del conto deposito</span></div>
    <div class="tile"><span class="label">Versato in totale</span><span class="v">${eur(d.totVersato)}</span><span class="hint">Risparmi${state.piano.extra_al_deposito ? " + 13ª e 14ª" : ""} meno prelievi</span></div>
    <div class="tile"><span class="label">Interessi netti</span><span class="v">${eur(d.totNetto)}</span><span class="hint">Dopo le tasse; bollo stimato ${eur(d.totBollo)}</span></div></div>
    ${periodi.length ? "" : `<div class="note">Aggiungi qui sotto il tasso del tuo conto deposito: finché non c'è, gli interessi restano a zero.</div>`}`);

  // Tassi nel tempo
  const opts = monthRange("2025-01", "2030-12");
  const card = document.createElement("section"); card.className = "card";
  card.innerHTML = `<div class="card-head"><h2>Tasso nel tempo</h2><span class="hint">Ogni tasso vale dal suo mese fino al successivo</span></div>`;
  if (!periodi.length) card.insertAdjacentHTML("beforeend", '<div class="empty">Nessun tasso: aggiungi il primo qui sotto.</div>');
  periodi.forEach((p) => {
    const r = document.createElement("div"); r.className = "row periodo";
    const da = document.createElement("select"); da.id = "p-da-" + p.id; da.setAttribute("aria-label", "Dal mese");
    da.innerHTML = opts.map((id) => `<option value="${id}"${id === p.da ? " selected" : ""}>da ${monthLabel(id)}</option>`).join("");
    da.onchange = () => { p.da = da.value; saveDeposito(); render(); };
    const wi = document.createElement("span"); wi.className = "imp";
    const t = document.createElement("input"); t.type = "text"; t.inputMode = "decimal"; t.id = "p-t-" + p.id; t.value = fmt.format(N(p.tasso)); t.setAttribute("aria-label", "Tasso lordo annuo");
    t.addEventListener("input", () => { const n = parseNum(t.value); if (!isNaN(n) && n >= 0 && n < 100) { p.tasso = round(n); saveDeposito(); } });
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
  const add = document.createElement("div"); add.className = "add solo";
  const ab = document.createElement("button"); ab.type = "button"; ab.className = "btn primary"; ab.id = "p-add";
  ab.textContent = periodi.length ? "Aggiungi un cambio di tasso" : "Aggiungi il tasso";
  ab.onclick = () => {
    const last = periodi[periodi.length - 1];
    const da = last ? addMonths(last.da, 12) : ms[0];
    dep.periodi = [...(dep.periodi || []), { id: uid(), da: opts.includes(da) ? da : opts[opts.length - 1], tasso: last ? N(last.tasso) : 0, nome: "" }];
    saveDeposito(); render(); document.querySelector(".row.periodo:last-of-type input")?.focus();
  };
  add.appendChild(ab); card.appendChild(add);
  v.appendChild(card);

  const fs = document.createElement("div"); fs.className = "fields";
  fs.appendChild(moneyField("Saldo di partenza", N(dep.saldo_iniziale), (n) => { dep.saldo_iniziale = n; saveDeposito(); }, { id: "d-saldo", hint: "Già sul conto all'inizio del periodo" }));
  fs.appendChild(moneyField("Tasse sugli interessi", N(dep.tasse), (n) => { dep.tasse = n; saveDeposito(); }, { id: "d-tasse", unit: "%", hint: "In Italia 26%" }));
  fs.appendChild(moneyField("Imposta di bollo annua", N(dep.bollo), (n) => { dep.bollo = n; saveDeposito(); }, { id: "d-bollo", unit: "%", hint: "Di solito 0,2% (alcune banche la pagano loro: metti 0)" }));
  v.appendChild(fs);

  const maxS = Math.max(1, ...d.rows.map((r) => r.saldo));
  let html = '<table><thead><tr><th>Mese</th><th>Tasso</th><th>Versato</th><th>Interessi netti</th><th>Bollo</th><th>Saldo</th><th aria-hidden="true"></th></tr></thead><tbody>';
  d.rows.forEach((r) => {
    const vers = r.versato - r.prelievo, e2 = extraInfo(r.id, state.piano);
    html += `<tr class="${r.cambio ? "promo-end" : ""}"><td>${monthLabel(r.id)}${r.extra && e2 ? ` <span class="tag">${e2.corto}</span>` : ""}</td><td title="${r.periodo?.nome ? esc(r.periodo.nome) : ""}">${fmt.format(r.tasso)}%</td><td class="${vers < 0 ? "neg" : ""}">${vers >= 0 ? "+" : ""}${fmt.format(vers)}</td><td>+${fmt.format(r.netto)}</td><td>−${fmt.format(r.bollo)}</td><td>${fmt.format(r.saldo)}</td><td><span class="mini" style="width:${Math.max(2, Math.round((r.saldo / maxS) * 80))}px"></span></td></tr>`;
  });
  html += "</tbody></table>";
  v.insertAdjacentHTML("beforeend", `<section class="card"><div class="card-head"><h2>Mese per mese</h2><span class="hint">Versamenti e prelievi si cambiano nella scheda Mesi</span></div><div class="tbl-wrap">${html}</div></section>`);
}

function renderModello(v) {
  const p = state.piano, ms = months();
  const nCustom = ms.filter((id) => state.mesi[id]).length;
  v.insertAdjacentHTML("beforeend", `<p class="hint flush">Il Modello è il mese tipo: i mesi che non hai personalizzato lo seguono. ${nCustom ? `Mesi personalizzati: ${nCustom} (non cambiano se modifichi qui).` : "Nessun mese personalizzato."}</p>`);
  const m = { stipendio: N(p.stipendio), risparmio: N(p.risparmio), voci: p.voci, prelievo: 0, extra: 0 };
  v.appendChild(hero(m, calcMonth(m, p), ""));
  const fs = document.createElement("div"); fs.className = "fields";
  fs.appendChild(moneyField("Stipendio netto", N(p.stipendio), (n) => { p.stipendio = n; savePiano(); }, { id: "t-stip" }));
  fs.appendChild(moneyField("Risparmio al conto deposito", N(p.risparmio), (n) => { p.risparmio = n; savePiano(); }, { id: "t-risp" }));
  fs.appendChild(moneyField("Soglia resto in tasca (facoltativa)", N(p.soglia), (n) => { p.soglia = n; savePiano(); }, { id: "t-soglia", hint: "Ti avvisa se il resto scende sotto questa cifra. 0 = nessun avviso" }));
  fs.appendChild(moneyField("Tredicesima (dicembre)", N(p.tredicesima), (n) => { p.tredicesima = n; savePiano(); }, { id: "t-13", cls: "extra", hint: "Netto stimato: correggilo con la busta" }));
  fs.appendChild(moneyField("Quattordicesima (giugno)", N(p.quattordicesima), (n) => { p.quattordicesima = n; savePiano(); }, { id: "t-14", cls: "extra", hint: "Metti 0 se il contratto non la prevede" }));
  v.appendChild(fs);

  // Periodo coperto
  const opts = monthRange("2025-01", "2030-12");
  const per = document.createElement("div"); per.className = "fields";
  per.innerHTML = `<label class="field" for="t-da"><span class="label">Dal mese</span><select id="t-da">${opts.map((id) => `<option value="${id}"${id === p.mese_inizio ? " selected" : ""}>${monthLabelLong(id)}</option>`).join("")}</select></label>
    <label class="field" for="t-a"><span class="label">Al mese</span><select id="t-a">${opts.map((id) => `<option value="${id}"${id === p.mese_fine ? " selected" : ""}>${monthLabelLong(id)}</option>`).join("")}</select></label>`;
  per.querySelector("#t-da").onchange = (e) => { if (e.target.value <= p.mese_fine) { p.mese_inizio = e.target.value; savePiano(); render(); } else e.target.value = p.mese_inizio; };
  per.querySelector("#t-a").onchange = (e) => { if (e.target.value >= p.mese_inizio) { p.mese_fine = e.target.value; savePiano(); render(); } else e.target.value = p.mese_fine; };
  v.appendChild(per);

  const ck = document.createElement("label"); ck.className = "check"; ck.htmlFor = "t-extradep";
  ck.innerHTML = `<input type="checkbox" id="t-extradep"${p.extra_al_deposito ? " checked" : ""}><span><b>Metti tredicesima e quattordicesima nel conto deposito</b><br><span class="hint">Se lo togli, restano nel resto in tasca di giugno e dicembre.</span></span>`;
  ck.querySelector("input").onchange = (e) => { p.extra_al_deposito = e.target.checked; savePiano(); render(); };
  v.appendChild(ck);
  vociEditor(v, () => p.voci, (fn) => { fn(p.voci); savePiano(); }, "t-");
}

/* ---------- Render ---------- */
function render() {
  needsRender = false;
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.v === view)));
  const v = $("view"), y = window.scrollY;
  v.innerHTML = "";
  if (empty) { renderOnboarding(v); return; }
  if (view === "mesi") renderMesi(v); else if (view === "deposito") renderDeposito(v); else renderModello(v);
  updateGroupSums();
  window.scrollTo(0, y);
}
const currentMonth = () => (view === "modello"
  ? { stipendio: N(state.piano.stipendio), risparmio: N(state.piano.risparmio), voci: state.piano.voci, prelievo: 0, extra: 0 }
  : monthData(sel, state.piano, state.mesi));
function updateGroupSums() {
  const voci = currentMonth().voci;
  document.querySelectorAll("[data-gsum]").forEach((el) => { el.textContent = eur(voci.filter((x) => x.cat === el.dataset.gsum).reduce((a, x) => a + N(x.importo), 0)); });
}
// Aggiornamento leggero mentre scrivi: cambia solo i numeri, non gli input.
function refresh() {
  if (view === "deposito") return;
  const m = currentMonth(), c = calcMonth(m, state.piano), q = (s) => document.querySelector(`[data-live="${s}"]`);
  if (q("resto")) { q("resto").textContent = eur(c.resto); q("resto").classList.toggle("neg", c.resto < 0); }
  if (q("chip")) { q("chip").dataset.k = statoResto(c.resto, state.piano.soglia); q("chip").textContent = testoResto(c.resto, state.piano.soglia); }
  if (q("formula")) q("formula").innerHTML = formula(m, c, view === "mesi" ? extraInfo(sel, state.piano)?.nome : "");
  if (q("bar")) fillBar(q("bar"), q("legend"), m, c);
  if (q("spese")) q("spese").textContent = eur(c.spese);
  updateGroupSums();
  if (view === "mesi") {
    const chip = $("chip-" + sel);
    if (chip) { chip.querySelector(".r").textContent = eur(c.resto); chip.querySelector(".pin").dataset.k = statoResto(c.resto, state.piano.soglia); }
    const tr = document.querySelector(`tr[data-id="${sel}"]`);
    if (tr) { const td = tr.children; td[1].textContent = fmt.format(c.entrate); td[2].textContent = fmt.format(c.spese); td[3].textContent = fmt.format(c.toDep); td[4].textContent = fmt.format(c.resto); td[4].className = c.resto < 0 ? "neg" : ""; }
  }
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
$("menuBtn").onclick = () => { const m = $("menu"); m.hidden = !m.hidden; $("menuBtn").setAttribute("aria-expanded", String(!m.hidden)); };
document.addEventListener("click", (e) => { if (!$("menu").hidden && !e.target.closest("#menu, #menuBtn")) { $("menu").hidden = true; $("menuBtn").setAttribute("aria-expanded", "false"); } });
$("doExport").onclick = () => {
  const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "conti-del-mese-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $("menu").hidden = true;
};
$("doImport").onclick = () => { $("menu").hidden = true; $("importFile").click(); };
$("importFile").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  setStatus("saving", "Importazione…");
  try {
    await importData(JSON.parse(await f.text()));
    empty = false;
    const ms = months(); if (!ms.includes(sel)) sel = ms[0];
    render();
  } catch (err) { setStatus("error", "Importazione non riuscita: " + (err.message || "file non valido")); }
};
$("doLogout").onclick = async () => { $("menu").hidden = true; await sb.auth.signOut(); };

boot();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
