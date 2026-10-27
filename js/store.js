// Archivio dati su Supabase. Ogni riga appartiene a un utente (user_id) e le regole
// del database (Row Level Security) fanno vedere a ciascuno solo le proprie.
import { createClient } from "./vendor/supabase.js"; // libreria Supabase inclusa nell'app (vedi vendor/LEGGIMI.txt)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { DEFAULT_PIANO, DEFAULT_DEPOSITO, N, uid, periodiDaVecchi, meseCorrente } from "./calc.js";

export const configured = !SUPABASE_URL.includes("INSERISCI") && !SUPABASE_ANON_KEY.includes("INSERISCI");
export const sb = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const state = {
  user: null,
  piano: { ...DEFAULT_PIANO },
  deposito: { ...DEFAULT_DEPOSITO },
  mesi: {},
};

const listeners = new Set();
export const onStatus = (fn) => listeners.add(fn);
const status = (s, t) => listeners.forEach((fn) => fn(s, t));

function fixVoci(v) {
  return Array.isArray(v)
    ? v.map((x) => ({ id: String(x.id || uid()), nome: String(x.nome || ""), importo: N(x.importo), cat: x.cat ? String(x.cat) : "altro" }))
    : [];
}
const cleanVoci = (v) => fixVoci(v);
function fixCategorie(v) {
  return Array.isArray(v)
    ? v.filter((c) => c && c.k && String(c.n || "").trim()).map((c) => ({ k: String(c.k), n: String(c.n).trim().slice(0, 40), c: /^#[0-9a-f]{6}$/i.test(c.c) ? c.c : "#8E8E93", i: String(c.i || "tag") }))
    : [];
}

function pianoFromRow(r) {
  const p = { ...DEFAULT_PIANO };
  for (const k of Object.keys(DEFAULT_PIANO)) if (r[k] != null) p[k] = r[k];
  p.voci = fixVoci(r.voci);
  p.categorie = fixCategorie(r.categorie);
  ["stipendio", "entrate_extra", "risparmio", "soglia", "tredicesima", "quattordicesima", "mensilita", "mese_13", "mese_14"].forEach((k) => (p[k] = N(p[k])));
  // Dati della prima versione (senza mensilità): la ricavo dagli importi
  if (r.mensilita == null) p.mensilita = N(p.quattordicesima) > 0 ? 14 : N(p.tredicesima) > 0 ? 13 : 12;
  if (![12, 13, 14].includes(p.mensilita)) p.mensilita = 13;
  if (!(p.mese_13 >= 1 && p.mese_13 <= 12)) p.mese_13 = 12;
  if (!(p.mese_14 >= 1 && p.mese_14 <= 12)) p.mese_14 = 6;
  if (r.senza_fine == null) p.senza_fine = false;
  if (r.usa_deposito == null) p.usa_deposito = true; // dati della prima versione: c'era sempre il deposito
  p.usa_deposito = !!p.usa_deposito;
  p.senza_fine = !!p.senza_fine;
  return p;
}
function fixPeriodi(v) {
  return Array.isArray(v)
    ? v.filter((x) => x && /^\d{4}-(0[1-9]|1[0-2])$/.test(x.da))
        .map((x) => ({ id: String(x.id || uid()), da: x.da, tasso: N(x.tasso), nome: String(x.nome || "") }))
    : [];
}
function depositoFromRow(r) {
  return {
    saldo_iniziale: N(r.saldo_iniziale),
    // I backup vecchi non hanno "periodi": li ricavo da promo + tasso dopo la promo.
    periodi: r.periodi === undefined ? periodiDaVecchi(r) : fixPeriodi(r.periodi),
    obiettivo: N(r.obiettivo), obiettivo_nome: String(r.obiettivo_nome || ""),
    tasse: r.tasse == null ? DEFAULT_DEPOSITO.tasse : N(r.tasse),
    bollo: r.bollo == null ? DEFAULT_DEPOSITO.bollo : N(r.bollo),
  };
}
const depositoRow = (d) => ({ saldo_iniziale: N(d.saldo_iniziale), periodi: fixPeriodi(d.periodi), obiettivo: N(d.obiettivo), obiettivo_nome: String(d.obiettivo_nome || ""), tasse: N(d.tasse), bollo: N(d.bollo) });
function meseFromRow(r) {
  return { stipendio: N(r.stipendio), entrate_extra: r.entrate_extra == null ? null : N(r.entrate_extra), risparmio: N(r.risparmio), prelievo: N(r.prelievo), extra: r.extra == null ? null : N(r.extra), voci: fixVoci(r.voci) };
}

/** Piano per chi parte da zero: inizia dal mese corrente e non ha fine. */
function pianoNuovo() {
  const oggi = meseCorrente();
  return { ...DEFAULT_PIANO, voci: [], mese_inizio: oggi, mese_fine: (Number(oggi.slice(0, 4)) + 1) + "-12" };
}

/** Carica tutto dell'utente collegato. Restituisce true se l'utente non ha ancora dati. */
export async function loadAll() {
  const uidUser = state.user.id;
  const [p, d, m] = await Promise.all([
    sb.from("piani").select("*").eq("user_id", uidUser).maybeSingle(),
    sb.from("depositi").select("*").eq("user_id", uidUser).maybeSingle(),
    sb.from("mesi").select("*").eq("user_id", uidUser),
  ]);
  for (const r of [p, d, m]) if (r.error) throw r.error;
  // Non sovrascrivere ciò che l'utente sta modificando in questo momento
  if (!busy("piano")) state.piano = p.data ? pianoFromRow(p.data) : pianoNuovo();
  if (!busy("deposito")) state.deposito = d.data ? depositoFromRow(d.data) : { ...DEFAULT_DEPOSITO, periodi: [] };
  const next = {};
  (m.data || []).forEach((r) => { next[r.mese] = busy("mese:" + r.mese) && state.mesi[r.mese] ? state.mesi[r.mese] : meseFromRow(r); });
  Object.keys(state.mesi).forEach((id) => { if (!next[id] && busy("mese:" + id)) next[id] = state.mesi[id]; });
  state.mesi = next;
  return !p.data && !d.data && !(m.data || []).length;
}

/* ---------- Salvataggio con attesa: un salvataggio per volta per ogni riga ---------- */
const jobs = {};
const busy = (key) => { const j = jobs[key]; return !!(j && (j.timer || j.saving || j.again)); };
const anyBusy = () => Object.keys(jobs).some(busy);

function schedule(key, write) {
  const j = jobs[key] || (jobs[key] = {});
  j.write = write;
  clearTimeout(j.timer);
  j.timer = setTimeout(() => { j.timer = null; run(key); }, 700);
  status("saving", "Modifiche in corso…");
}
async function run(key) {
  const j = jobs[key];
  if (j.saving) { j.again = true; return; }
  j.saving = true;
  try {
    const { error } = await j.write();
    if (error) throw error;
  } catch (e) {
    j.saving = false;
    status("error", "Non salvato: " + (e.message || "controlla la connessione"));
    j.retry = setTimeout(() => run(key), 4000);
    return;
  }
  j.saving = false;
  if (j.again) { j.again = false; run(key); return; }
  if (!anyBusy()) status("saved", "Salvato");
}

const now = () => new Date().toISOString();

export function savePiano() {
  schedule("piano", () => {
    const p = state.piano;
    return sb.from("piani").upsert({
      user_id: state.user.id,
      stipendio: N(p.stipendio), entrate_extra: N(p.entrate_extra), risparmio: N(p.risparmio), soglia: N(p.soglia),
      tredicesima: N(p.tredicesima), quattordicesima: N(p.quattordicesima),
      mensilita: N(p.mensilita), mese_13: N(p.mese_13), mese_14: N(p.mese_14), senza_fine: !!p.senza_fine, usa_deposito: !!p.usa_deposito,
      extra_al_deposito: !!p.extra_al_deposito, mese_inizio: p.mese_inizio, mese_fine: p.mese_fine,
      voci: cleanVoci(p.voci), categorie: fixCategorie(p.categorie), updated_at: now(),
    });
  });
}
export function saveDeposito() {
  schedule("deposito", () => {
    const d = state.deposito;
    return sb.from("depositi").upsert({ user_id: state.user.id, ...depositoRow(d), updated_at: now() });
  });
}
export function saveMese(id) {
  schedule("mese:" + id, () => {
    const m = state.mesi[id];
    return sb.from("mesi").upsert({
      user_id: state.user.id, mese: id,
      stipendio: N(m.stipendio), entrate_extra: m.entrate_extra == null ? null : N(m.entrate_extra), risparmio: N(m.risparmio), prelievo: N(m.prelievo),
      extra: m.extra == null ? null : N(m.extra), voci: cleanVoci(m.voci), updated_at: now(),
    });
  });
}
export async function resetMese(id) {
  const j = jobs["mese:" + id];
  if (j) { clearTimeout(j.timer); clearTimeout(j.retry); j.timer = null; j.again = false; }
  delete state.mesi[id];
  status("saving", "Ripristino…");
  const { error } = await sb.from("mesi").delete().eq("user_id", state.user.id).eq("mese", id);
  status(error ? "error" : "saved", error ? "Non ripristinato: " + error.message : "Salvato");
}

/* ---------- Backup ---------- */
export function exportData() {
  // "conti-del-mese" è il nome interno dei backup: resta così perché i vecchi file restino leggibili
  return { app: "conti-del-mese", versione: 1, esportato: now(), piano: state.piano, deposito: state.deposito, mesi: state.mesi };
}
export async function importData(json) {
  if (!json || json.app !== "conti-del-mese") throw new Error("Il file non è un backup di Spare.");
  state.piano = pianoFromRow(json.piano || {});
  state.deposito = depositoFromRow(json.deposito || {});
  state.mesi = {};
  Object.entries(json.mesi || {}).forEach(([id, r]) => { if (/^\d{4}-\d{2}$/.test(id)) state.mesi[id] = meseFromRow(r); });
  const u = state.user.id, t = now(), p = state.piano, d = state.deposito;
  const r1 = await sb.from("piani").upsert({ user_id: u, ...p, voci: cleanVoci(p.voci), updated_at: t });
  if (r1.error) throw r1.error;
  const r2 = await sb.from("depositi").upsert({ user_id: u, ...depositoRow(d), updated_at: t });
  if (r2.error) throw r2.error;
  const r3 = await sb.from("mesi").delete().eq("user_id", u);
  if (r3.error) throw r3.error;
  const rows = Object.entries(state.mesi).map(([id, m]) => ({ user_id: u, mese: id, ...m, voci: cleanVoci(m.voci), updated_at: t }));
  if (rows.length) { const r4 = await sb.from("mesi").insert(rows); if (r4.error) throw r4.error; }
  status("saved", "Salvato");
}
