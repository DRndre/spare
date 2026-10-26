// Calcoli puri: nessun accesso al DOM o al database. Facili da testare e modificare.

export const CATS = [
  { k: "casa", n: "Casa", c: "--c-casa" },
  { k: "auto", n: "Auto", c: "--c-auto" },
  { k: "abbonamenti", n: "Abbonamenti", c: "--c-abb" },
  { k: "persona", n: "Persona", c: "--c-persona" },
  { k: "altro", n: "Altro", c: "--c-altro" },
];

const MN = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MNL = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

export const DEFAULT_PIANO = {
  stipendio: 0,
  entrate_extra: 0, // altre entrate mensili più o meno fisse
  risparmio: 0,
  soglia: 0, // 0 = nessuna soglia: avviso solo se il resto va sotto zero
  tredicesima: 0,
  quattordicesima: 0,
  mensilita: 13, // 12, 13 o 14
  mese_13: 12, // mese della tredicesima (1-12)
  mese_14: 6, // mese della quattordicesima (1-12)
  extra_al_deposito: true,
  usa_deposito: false, // false = niente conto deposito: si conta solo quanto metti da parte
  mese_inizio: "2026-11",
  mese_fine: "2027-12",
  senza_fine: true, // true = i mesi si allungano da soli fino a dicembre dell'anno dopo
  voci: [],
};

/** Mese di oggi in formato "AAAA-MM". */
export function meseCorrente(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

/** Ultimo mese mostrato: con "senza fine" è dicembre dell'anno dopo quello di oggi. */
export function meseFine(piano, oggi = meseCorrente()) {
  if (!piano.senza_fine) return piano.mese_fine;
  const f = (Number(oggi.slice(0, 4)) + 1) + "-12";
  return f < piano.mese_inizio ? (Number(piano.mese_inizio.slice(0, 4)) + 1) + "-12" : f;
}

/** Mesi coperti dal piano. */
export const mesiPiano = (piano, oggi) => monthRange(piano.mese_inizio, meseFine(piano, oggi));

// periodi: [{ id, da: "AAAA-MM", tasso: % lordo annuo, nome: "banca/conto" }]
// Ogni periodo vale dal suo mese fino al periodo successivo.
export const DEFAULT_DEPOSITO = {
  saldo_iniziale: 0,
  periodi: [],
  obiettivo: 0, // cifra da raggiungere (0 = nessun obiettivo)
  obiettivo_nome: "",
  tasse: 26,
  bollo: 0.2,
};

export const N = (v) => Number(v) || 0;
export const round = (v) => Math.round(v * 100) / 100;
export const fmt = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const eur = (v) => fmt.format(v) + " €";

/** Accetta "1.234,56", "57,84", "12.5", "€ 30". Restituisce NaN se vuoto o non valido. */
export function parseNum(s) {
  if (s == null) return NaN;
  let t = String(s).trim().replace(/\s|€|%/g, "");
  if (t === "") return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "1.430" = millequattrocentotrenta
  return Number(t);
}

export function uid() {
  return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Elenco mesi "AAAA-MM" da inizio a fine compresi (massimo 50 anni). */
export function monthRange(start, end) {
  const out = [];
  let [y, m] = String(start).split("-").map(Number);
  const [ey, em] = String(end).split("-").map(Number);
  if (!y || !m || !ey || !em) return out;
  while ((y < ey || (y === ey && m <= em)) && out.length < 600) {
    out.push(y + "-" + String(m).padStart(2, "0"));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export const monthLabel = (id) => { const [y, m] = id.split("-"); return MN[+m - 1] + " " + y; };
export const MESI_NOMI = MNL;
export const monthLabelLong = (id) => { const [y, m] = id.split("-"); return MNL[+m - 1] + " " + y; };
export const addMonths = (id, n) => { let [y, m] = id.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + "-" + String(m).padStart(2, "0"); };

/** Mensilità extra del mese, secondo mensilità e mesi scelti nel Modello. */
export function extraInfo(id, piano) {
  const m = Number(id.slice(5, 7)), n = N(piano.mensilita) || 13;
  if (n >= 13 && m === (N(piano.mese_13) || 12)) return { nome: "Tredicesima", corto: "13ª", importo: N(piano.tredicesima) };
  if (n >= 14 && m === (N(piano.mese_14) || 6)) return { nome: "Quattordicesima", corto: "14ª", importo: N(piano.quattordicesima) };
  return null;
}

/** Dati effettivi di un mese: quelli personalizzati se esistono, altrimenti il Modello. */
export function monthData(id, piano, mesi) {
  const d = mesi[id];
  const ex = extraInfo(id, piano);
  const exDefault = ex ? ex.importo : 0;
  if (d) {
    return {
      custom: true,
      stipendio: N(d.stipendio),
      entrate_extra: d.entrate_extra == null ? N(piano.entrate_extra) : N(d.entrate_extra),
      risparmio: N(d.risparmio),
      prelievo: N(d.prelievo),
      extra: !ex ? 0 : d.extra == null ? exDefault : N(d.extra),
      voci: d.voci || [],
    };
  }
  return { custom: false, stipendio: N(piano.stipendio), entrate_extra: N(piano.entrate_extra), risparmio: N(piano.risparmio), prelievo: 0, extra: exDefault, voci: piano.voci || [] };
}

export function calcMonth(m, piano) {
  const spese = round(m.voci.reduce((a, v) => a + N(v.importo), 0));
  const extraDep = piano.extra_al_deposito ? N(m.extra) : 0;
  const toDep = round(N(m.risparmio) + extraDep);
  const entrate = round(N(m.stipendio) + N(m.entrate_extra) + N(m.extra));
  const resto = round(entrate - spese - toDep);
  return { spese, toDep, entrate, resto, extraDep };
}

export function statoResto(resto, soglia) {
  if (resto < 0) return "bad";
  if (N(soglia) > 0 && resto < N(soglia)) return "warn";
  return "good";
}

export function testoResto(resto, soglia) {
  if (resto < 0) return "In rosso di " + eur(-resto);
  if (!(N(soglia) > 0)) return "";
  if (resto < N(soglia)) return eur(round(N(soglia) - resto)) + " sotto la soglia di " + eur(N(soglia));
  return "Sopra la soglia di " + eur(N(soglia));
}

const MESE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Periodi validi, ordinati per mese di inizio (stessi oggetti, non copie: si possono modificare). */
export function ordinaPeriodi(periodi) {
  const list = Array.isArray(periodi) ? periodi : [];
  return list
    .filter((p) => p && MESE_RE.test(p.da))
    .sort((a, b) => (a.da < b.da ? -1 : a.da > b.da ? 1 : list.indexOf(a) - list.indexOf(b)));
}

/** Periodo in vigore in un mese: l'ultimo iniziato entro quel mese (null se nessuno). */
export function periodoDelMese(id, periodi) {
  let cur = null;
  for (const p of ordinaPeriodi(periodi)) if (p.da <= id) cur = p;
  return cur;
}

/** Converte le vecchie impostazioni (promo + tasso dopo la promo) in periodi. */
export function periodiDaVecchi(d) {
  if (d == null || d.tasso_promo == null || !MESE_RE.test(d.inizio_promo || "")) return [];
  return [
    { id: "p1", da: d.inizio_promo, tasso: N(d.tasso_promo), nome: "" },
    { id: "p2", da: addMonths(d.inizio_promo, N(d.mesi_promo) || 12), tasso: N(d.tasso_base), nome: "" },
  ];
}

/**
 * Simulazione del conto deposito mese per mese.
 * Versamenti a inizio mese; interesse mensile = saldo × tasso / 12,
 * meno le tasse sulle rendite (26%) e il bollo (0,2% annuo, ripartito sui mesi). È una stima.
 */
export function simulaDeposito(months, piano, mesi, dep) {
  let saldo = N(dep.saldo_iniziale), totNetto = 0, totBollo = 0, totVersato = 0, prima = null;
  const rows = months.map((id, i) => {
    const m = monthData(id, piano, mesi);
    const c = calcMonth(m, piano);
    const versato = c.toDep;
    const prelievo = Math.min(N(m.prelievo), saldo + versato);
    saldo = saldo + versato - prelievo;
    const periodo = periodoDelMese(id, dep.periodi);
    const tasso = periodo ? N(periodo.tasso) : 0;
    const cambio = i > 0 && periodo && periodo !== prima && periodo.da === id;
    prima = periodo;
    const lordo = (saldo * tasso) / 100 / 12;
    const netto = lordo * (1 - N(dep.tasse) / 100);
    const bollo = (saldo * N(dep.bollo)) / 100 / 12;
    saldo = saldo + netto - bollo;
    totNetto += netto; totBollo += bollo; totVersato += versato - prelievo;
    return { id, versato, prelievo, tasso, periodo, cambio, lordo, netto, bollo, saldo, extra: c.extraDep };
  });
  return { rows, totNetto, totBollo, totVersato, saldo };
}
