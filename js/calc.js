// Calcoli puri: nessun accesso al DOM o al database. Facili da testare e modificare.

// Le categorie delle spese sono in categorie.js

const MN = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MNL = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

export const DEFAULT_PIANO = {
  stipendio: 0,
  entrate_extra: 0, // non più usato nel Modello: le entrate extra si scrivono solo nei mesi
  buoni_num: 0, // buoni pasto al mese (numero)
  buoni_valore: 0, // valore di un buono pasto in €
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
  categorie: [], // categorie create dall'utente: [{k, n, c, i}]
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
// useGrouping "always": il punto delle migliaia anche sui numeri di 4 cifre (1.200 e non 1200), come in Chrome
export const fmt = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });
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

/** Spese a tempo (es. a rate): { da: "AAAA-MM", rate: n }. Ultimo mese, o null se la spesa non ha fine. */
export const fineSpesa = (v) => (v && v.da && N(v.rate) >= 1 ? addMonths(v.da, N(v.rate) - 1) : null);
/** La spesa conta nel mese id? (senza periodo: sempre) */
export const attivaNel = (v, id) => !v || !v.da || (id >= v.da && (!fineSpesa(v) || id <= fineSpesa(v)));

/** Categorie dove si può pagare con i buoni pasto (interruttore "Pagata con i buoni"). */
export const CAT_BUONI = ["spesa", "svago"];
/** Spese di un mese pagate con i buoni (solo categorie ammesse). */
const conBuoni = (voci) => round(voci.filter((v) => v.buoni && CAT_BUONI.includes(v.cat)).reduce((a, v) => a + N(v.importo), 0));

/** Dati effettivi di un mese: quelli personalizzati se esistono, altrimenti il Modello.
 *  buoniAvanzati = buoni pasto non spesi nei mesi prima (si accumulano dal primo mese dei conti). */
export function monthData(id, piano, mesi) {
  const m = meseBase(id, piano, mesi);
  m.buoniAvanzati = buoniAvanzatiPrima(id, piano, mesi);
  return m;
}
function buoniAvanzatiPrima(id, piano, mesi) {
  if (!(N(piano.buoni_valore) > 0)) return 0;
  let av = 0;
  for (const x of monthRange(piano.mese_inizio, id)) {
    if (x >= id) break;
    const b = meseBase(x, piano, mesi), disp = av + N(b.buoni);
    av = round(disp - conBuoni(b.voci));
  }
  return av;
}
function meseBase(id, piano, mesi) {
  const d = mesi[id];
  const ex = extraInfo(id, piano);
  const exDefault = ex ? ex.importo : 0;
  if (d) {
    return {
      custom: true,
      stipendio: N(d.stipendio),
      entrate_extra: N(d.entrate_extra), // solo nel mese (null = 0)
      buoni_num: d.buoni_num == null ? N(piano.buoni_num) : N(d.buoni_num),
      buoni: round((d.buoni_num == null ? N(piano.buoni_num) : N(d.buoni_num)) * N(piano.buoni_valore)),
      risparmio: N(d.risparmio),
      prelievo: N(d.prelievo),
      extra: !ex ? 0 : d.extra == null ? exDefault : N(d.extra),
      extra_dep: !ex || d.extra_dep == null ? null : N(d.extra_dep), // null = come il Modello (tutta o niente)
      voci: (d.voci || []).filter((v) => attivaNel(v, id)),
    };
  }
  return { custom: false, stipendio: N(piano.stipendio), entrate_extra: 0, buoni_num: N(piano.buoni_num), buoni: round(N(piano.buoni_num) * N(piano.buoni_valore)), risparmio: N(piano.risparmio), prelievo: 0, extra: exDefault, voci: (piano.voci || []).filter((v) => attivaNel(v, id)) };
}

export function calcMonth(m, piano) {
  const spese = round(m.voci.reduce((a, v) => a + N(v.importo), 0));
  // 13ª/14ª al deposito: la cifra scelta nel mese (al massimo tutta), se no come dice il Modello
  const extraDep = m.extra_dep != null ? Math.min(N(m.extra_dep), N(m.extra)) : piano.extra_al_deposito ? N(m.extra) : 0;
  const toDep = round(N(m.risparmio) + extraDep);
  // Buoni pasto di lato: non entrano nel resto in tasca. Le spese "pagate con i buoni" escono dai buoni disponibili
  // (avanzati + ricevuti) e non toccano mai il resto.
  const buoni = round(N(m.buoni));
  const buoniDisp = round(N(m.buoniAvanzati) + buoni);
  const speseBuoni = conBuoni(m.voci);
  const buoniUsati = speseBuoni;
  const buoniAvanzo = round(buoniDisp - buoniUsati);
  const speseSoldi = round(spese - buoniUsati);
  const entrate = round(N(m.stipendio) + N(m.entrate_extra) + N(m.extra)); // solo soldi veri
  const resto = round(entrate - speseSoldi - toDep);
  return { spese, speseSoldi, toDep, entrate, resto, extraDep, buoni, buoniDisp, speseBuoni, buoniUsati, buoniAvanzo };
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
