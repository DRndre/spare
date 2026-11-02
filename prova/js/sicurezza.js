// Menu ☰ → Sicurezza: ultimo accesso, verifica in due passaggi (app di autenticazione, facoltativa),
// esci da tutti i dispositivi. I codici li controlla Supabase; il codice QR lo crea Supabase.
import { apriFoglio } from "./guida.js";
import { entra, evidenzia } from "./anim.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const quando = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) + " alle " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
};
const soloCifre = (s) => String(s || "").replace(/\D/g, "").slice(0, 6);
function traduci(e) {
  const m = (e && e.message) || "";
  if (/invalid.*code|Invalid TOTP|code.*invalid|expired/i.test(m)) return "Codice sbagliato o scaduto: riprova con quello che vedi adesso nell'app.";
  if (/friendly name/i.test(m)) return "Hai già un'app con questo nome: scegline un altro.";
  if (/aal2|AAL2/i.test(m)) return "Per questa operazione devi essere entrato con il codice: esci e rientra.";
  if (/rate limit|too many/i.test(m)) return "Troppi tentativi ravvicinati: aspetta un minuto e riprova.";
  if (/fetch/i.test(m)) return "Nessuna connessione: controlla internet e riprova.";
  return m || "Qualcosa non ha funzionato. Riprova.";
}
/** Campo per il codice a 6 cifre (tastiera numerica, compilazione automatica dove il telefono la offre). */
export function campoCodice(id) {
  const l = document.createElement("label"); l.className = "field"; l.htmlFor = id;
  l.innerHTML = `<span class="label">Codice di 6 cifre</span><input type="text" id="${id}" class="codice" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">`;
  const i = l.querySelector("input");
  i.addEventListener("input", () => { i.value = soloCifre(i.value); });
  return l;
}

/** Prima di entrare: se l'utente ha la verifica attiva, chiede il codice. Restituisce true se serve. */
export async function serveCodice(sb) {
  try {
    const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  } catch { return false; }
}
/** Schermata del codice dopo email e password. */
export async function mostraCodice({ sb, box, logo, onOk }) {
  const { data } = await sb.auth.mfa.listFactors();
  const fattori = (data && data.totp) || [];
  box.innerHTML = `<form class="auth-card" id="mfaForm" novalidate>
      <h1 class="brand">${logo}</h1>
      <h2>Verifica in due passaggi</h2>
      <p class="hint flush">Apri la tua app di autenticazione e scrivi il codice di <b>Spare</b>.</p>
      ${fattori.length > 1 ? `<label class="lf" for="mfa-f"><span class="label">App</span><select id="mfa-f">${fattori.map((f) => `<option value="${f.id}">${esc(f.friendly_name || "App di autenticazione")}</option>`).join("")}</select></label>` : ""}
      <div id="mfa-c"></div>
      <div class="msg" id="mfa-msg" hidden></div>
      <button class="btn primary wide" type="submit">Conferma</button>
      <div class="auth-links"><button type="button" class="link" id="mfa-esci">Esci e accedi con un altro account</button></div>
    </form>`;
  const cc = campoCodice("mfa-code"); cc.className = "lf"; box.querySelector("#mfa-c").appendChild(cc);
  const msg = box.querySelector("#mfa-msg"), inp = box.querySelector("#mfa-code");
  box.querySelector("#mfa-esci").onclick = () => sb.auth.signOut();
  inp.focus();
  box.querySelector("#mfaForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const code = soloCifre(inp.value);
    if (code.length !== 6) { msg.hidden = false; msg.textContent = "Scrivi le 6 cifre del codice."; inp.focus(); return; }
    const factorId = box.querySelector("#mfa-f")?.value || fattori[0]?.id;
    const btn = ev.submitter || box.querySelector("button[type=submit]"); btn.disabled = true;
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
    btn.disabled = false;
    if (error) { msg.hidden = false; msg.textContent = traduci(error); inp.select(); return; }
    onOk();
  };
}

/** Pagina Sicurezza (menu ☰). */
export function apriSicurezza({ sb }) {
  const f = apriFoglio("Sicurezza");
  let nuovo = null; // fattore in fase di attivazione

  async function elenco(evidenziaId) {
    f.body.innerHTML = '<p class="hint flush">Un attimo…</p>'; f.foot.innerHTML = "";
    const [{ data: u }, { data: fl }] = await Promise.all([sb.auth.getUser(), sb.auth.mfa.listFactors()]);
    const fattori = (fl && fl.totp) || [];
    f.body.innerHTML = "";
    f.body.insertAdjacentHTML("beforeend", `<div class="sec-blk"><div class="cat-sec flush">Ultimo accesso</div>
      <div class="card sic-card"><b>${quando(u?.user?.last_sign_in_at)}</b><p class="hint flush">L'ultima volta che qualcuno è entrato con la tua password, da qualsiasi dispositivo. Se non eri tu, cambia la password ed esci da tutti i dispositivi.</p></div></div>`);

    const blk = document.createElement("div"); blk.className = "sec-blk";
    blk.innerHTML = `<div class="cat-sec flush">Verifica in due passaggi</div>`;
    const card = document.createElement("div"); card.className = "card sic-card";
    if (!fattori.length) {
      card.innerHTML = `<div class="sic-stato"><span class="sic-pill off">Spenta</span></div>
        <p class="hint flush">Oltre alla password, quando entri da un dispositivo nuovo ti chiede un codice dall'app di autenticazione del telefono (Google Authenticator, Microsoft Authenticator, Password dell'iPhone, 1Password…). È facoltativa.</p>`;
      const b = document.createElement("button"); b.type = "button"; b.className = "add-open flush-x"; b.textContent = "Attiva la verifica";
      b.onclick = () => attiva(true); card.appendChild(b);
    } else {
      card.innerHTML = `<div class="sic-stato"><span class="sic-pill on">Attiva</span></div>
        <p class="hint flush">Quando entri da un dispositivo nuovo, dopo la password ti chiede il codice di una di queste app. Collegane almeno due: se ne perdi una, entri con l'altra.</p>`;
      fattori.forEach((x) => {
        const r = document.createElement("div"); r.className = "sic-row"; r.dataset.riga = x.id;
        r.innerHTML = `<span class="sic-n">${esc(x.friendly_name || "App di autenticazione")}<small>Collegata il ${new Date(x.created_at).toLocaleDateString("it-IT")}</small></span>`;
        const rm = document.createElement("button"); rm.type = "button"; rm.className = "link danger-link"; rm.textContent = "Rimuovi";
        rm.onclick = () => conferma(r, fattori.length === 1 ? `È l'unica app collegata: la verifica si spegne. Rimuovere "${x.friendly_name}"?` : `Rimuovere "${x.friendly_name}"?`, "Rimuovi", async () => {
          const { error } = await sb.auth.mfa.unenroll({ factorId: x.id });
          if (error) { avviso(card, traduci(error)); return; }
          elenco();
        });
        r.appendChild(rm); card.appendChild(r);
      });
      const b = document.createElement("button"); b.type = "button"; b.className = "add-open flush-x"; b.textContent = "+ Aggiungi un'altra app";
      b.onclick = () => attiva(false); card.appendChild(b);
    }
    blk.appendChild(card); f.body.appendChild(blk);

    const ex = document.createElement("div"); ex.className = "sec-blk";
    ex.innerHTML = `<div class="cat-sec flush">Dispositivi</div><div class="card sic-card"><p class="hint flush">Chiude l'accesso su telefono, computer e ogni altro dispositivo, anche questo. Per rientrare servirà di nuovo la password${fattori.length ? " e il codice" : ""}.</p></div>`;
    const eb = document.createElement("button"); eb.type = "button"; eb.className = "btn danger-soft wide"; eb.textContent = "Esci da tutti i dispositivi";
    eb.onclick = () => conferma(ex.querySelector(".sic-card"), "Esci da tutti i dispositivi, compreso questo?", "Esci ovunque", async () => {
      const { error } = await sb.auth.signOut({ scope: "global" });
      if (error) { avviso(ex.querySelector(".sic-card"), traduci(error)); return; }
      f.close();
    });
    ex.querySelector(".sic-card").appendChild(eb); f.body.appendChild(ex);

    const ok = document.createElement("button"); ok.type = "button"; ok.className = "btn primary"; ok.textContent = "Fatto"; ok.onclick = f.close;
    f.foot.appendChild(ok);
    entra([...f.body.children]);
    if (evidenziaId) evidenzia(f.body.querySelector(`[data-riga="${evidenziaId}"]`));
  }

  // Attivazione: nome → codice QR (e chiave da copiare) → primo codice per confermare
  async function attiva(prima) {
    // tolgo eventuali attivazioni lasciate a metà
    const { data: fl } = await sb.auth.mfa.listFactors();
    for (const x of (fl?.all || []).filter((x) => x.status === "unverified")) await sb.auth.mfa.unenroll({ factorId: x.id });
    const usati = (fl?.totp || []).map((x) => (x.friendly_name || "").toLowerCase());
    f.body.innerHTML = ""; f.foot.innerHTML = "";
    f.body.insertAdjacentHTML("beforeend", `<p class="hint flush">${prima ? "Ti servono due minuti e il telefono." : "Collega un'altra app o un altro dispositivo: se ne perdi uno, entri con l'altro."}</p>
      <div class="sec-blk"><div class="cat-sec flush">1. Dai un nome a questa app</div></div>`);
    const nf = document.createElement("label"); nf.className = "field"; nf.htmlFor = "sic-nome";
    nf.innerHTML = `<span class="label">Nome</span><input type="text" id="sic-nome" maxlength="40" autocomplete="off" placeholder="es. iPhone, 1Password">`;
    f.body.lastElementChild.appendChild(nf);
    const err = document.createElement("div"); err.className = "err"; err.hidden = true; f.body.appendChild(err);
    const ni = nf.querySelector("input"); ni.value = prima ? "Telefono" : ""; ni.focus(); ni.select();
    piede("Annulla", () => elenco(), "Avanti", async (btn) => {
      const nome = ni.value.trim();
      if (!nome) { err.hidden = false; err.textContent = "Scrivi un nome, per esempio \"iPhone\"."; ni.focus(); return; }
      if (usati.includes(nome.toLowerCase())) { err.hidden = false; err.textContent = "Hai già un'app con questo nome: scegline un altro."; return; }
      btn.disabled = true;
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: nome, issuer: "Spare" });
      btn.disabled = false;
      if (error) { err.hidden = false; err.textContent = traduci(error); return; }
      nuovo = data; qr(nome);
    });
    entra([...f.body.children]);
  }
  function qr(nome) {
    f.body.innerHTML = ""; f.foot.innerHTML = "";
    const src = String(nuovo.totp.qr_code || "");
    const img = src.startsWith("data:") ? src : "data:image/svg+xml;utf8," + encodeURIComponent(src);
    f.body.insertAdjacentHTML("beforeend", `<div class="sec-blk"><div class="cat-sec flush">2. Inquadra il codice con l'app</div>
      <div class="card sic-card sic-qr"><img src="${esc(img)}" alt="Codice QR per l'app di autenticazione" width="180" height="180">
      <p class="hint flush">Nell'app tocca "+" o "Aggiungi" e inquadra il codice. Sul computer, o se non riesci a inquadrarlo, scrivi questa chiave:</p>
      <div class="sic-key"><code id="sic-key">${esc(nuovo.totp.secret.replace(/(.{4})/g, "$1 ").trim())}</code><button type="button" class="link" id="sic-copy">Copia</button></div></div></div>
      <div class="sec-blk"><div class="cat-sec flush">3. Scrivi il codice che vedi nell'app</div></div>`);
    f.body.lastElementChild.appendChild(campoCodice("sic-code"));
    const err = document.createElement("div"); err.className = "err"; err.hidden = true; f.body.appendChild(err);
    f.body.querySelector("#sic-copy").onclick = async (e) => {
      try { await navigator.clipboard.writeText(nuovo.totp.secret); e.target.textContent = "Copiata"; } catch { e.target.textContent = "Copiala a mano"; }
    };
    const ci = f.body.querySelector("#sic-code");
    piede("Annulla", async () => { await sb.auth.mfa.unenroll({ factorId: nuovo.id }); nuovo = null; elenco(); }, "Conferma", async (btn) => {
      const code = soloCifre(ci.value);
      if (code.length !== 6) { err.hidden = false; err.textContent = "Scrivi le 6 cifre del codice."; ci.focus(); return; }
      btn.disabled = true;
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: nuovo.id, code });
      btn.disabled = false;
      if (error) { err.hidden = false; err.textContent = traduci(error); ci.select(); return; }
      const id = nuovo.id; nuovo = null; elenco(id);
    });
    entra([...f.body.children]);
  }

  function piede(noTxt, onNo, siTxt, onSi) {
    f.foot.innerHTML = "";
    const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = noTxt; no.onclick = onNo;
    const si = document.createElement("button"); si.type = "button"; si.className = "btn primary"; si.textContent = siTxt; si.onclick = () => onSi(si);
    f.foot.append(no, si);
  }
  function conferma(host, testo, okTxt, onOk) {
    if (host.querySelector(".confirm")) return;
    const cf = document.createElement("div"); cf.className = "confirm";
    cf.innerHTML = `<span>${esc(testo)}</span>`;
    const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Annulla"; no.onclick = () => cf.remove();
    const si = document.createElement("button"); si.type = "button"; si.className = "btn danger"; si.textContent = okTxt; si.onclick = onOk;
    cf.append(no, si); host.appendChild(cf); si.focus();
  }
  function avviso(host, testo) { host.insertAdjacentHTML("beforeend", `<div class="err">${esc(testo)}</div>`); }

  elenco();
}
