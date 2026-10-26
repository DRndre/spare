# Conti del mese — note per Claude

App web personale di Andrea per gestire le spese mensili. Pensata per lui, ma multi-utente:
un amico può crearsi un account e avere il suo piano, separato.
Online su **https://drndre.github.io/gestione-spese/** (GitHub Pages, branch `main`, cartella root).

## Come lavorare con Andrea
- Rispondi in **italiano**, con parole semplici (non è un utente da gergo tecnico), e vai dritto al punto.
- Per modifiche non banali: prima spiega cosa faresti e fai le domande che servono, poi procedi.
- Quando serve cambiare il database, dai la **query SQL completa e pronta da incollare** in Supabase
  (SQL Editor → New query → Run) e aggiorna anche `supabase/schema.sql`.
- Dopo ogni push **controlla che GitHub Pages abbia pubblicato**: una volta la pubblicazione è rimasta
  bloccata "queued". Comando: `gh api repos/DRndre/gestione-spese/actions/runs --jq '.workflow_runs[0] | "\(.head_sha[0:7]) \(.status) \(.conclusion)"'`.
  Se resta bloccata, un commit vuoto la fa ripartire.
- Ricordagli di ricaricare con Ctrl + Maiusc + R per vedere le modifiche.

## Tecnologia
- HTML, CSS e JavaScript semplici (moduli ES), **nessuna build**, niente framework. Scelta voluta.
- Dati su **Supabase** (Postgres + login email/password) tramite `@supabase/supabase-js` da jsDelivr
  (versione fissata in `js/store.js`).
- `js/config.js` contiene URL del progetto e chiave **publishable/anon**: può stare nel codice pubblico.
  **Mai** la chiave `service_role`. Il repository è **pubblico**: niente dati personali né backup
  (`.gitignore` esclude `*backup*.json`).
- Ogni tabella ha `user_id` e Row Level Security "solo i miei dati": ognuno vede solo le sue righe.
- `sw.js` (service worker) tiene i file per l'offline, prima la rete con `cache: "no-cache"`.
  **Aumenta `VERSION` in `sw.js` a ogni modifica dei file dell'app.**

## File
- `js/calc.js` — calcoli puri, senza DOM né database: mesi, resto in tasca, 13ª/14ª, simulazione deposito.
- `js/store.js` — lettura/scrittura su Supabase (salvataggio con attesa di 700 ms e nuovo tentativo), backup.
- `js/app.js` — interfaccia: login, schede **Mesi / Deposito / Modello** (nella barra la scheda si chiama solo "Deposito").
- `css/style.css` — "stile iPhone": colori di sistema Apple come variabili, tema chiaro e scuro, carattere **Inter**
  ovunque, file in `fonts/inter.woff2` (niente Google Fonts). Blu `--accent` per tutta l'app,
  arancio `--ing` solo per tredicesima/quattordicesima.
- `supabase/schema.sql` — schema completo, rieseguibile (contiene anche gli `alter table` successivi).

## Modello dei dati
- **piani** (una riga per utente, il "Modello" = mese tipo): stipendio, entrate_extra, risparmio,
  soglia (0 = nessun avviso), mensilita (12/13/14), tredicesima, quattordicesima, mese_13, mese_14 (1-12),
  extra_al_deposito, usa_deposito, mese_inizio, mese_fine, senza_fine, voci (jsonb `[{id, nome, importo, cat}]`).
- **depositi** (una riga per utente): saldo_iniziale, obiettivo (0 = nessuno), obiettivo_nome, tasse (26), bollo (0,2), periodi
  (jsonb `[{id, da: "AAAA-MM", tasso, nome}]`: ogni tasso vale dal suo mese fino al successivo).
  Le colonne `tasso_promo`, `tasso_base`, `inizio_promo`, `mesi_promo` sono della prima versione e non si usano più.
- **mesi** (solo i mesi personalizzati; gli altri seguono il Modello): stipendio, entrate_extra (null = come il Modello),
  risparmio, prelievo, extra (null = importo di 13ª/14ª dal Modello), voci.

## Regole di calcolo
- Resto in tasca = stipendio + entrate extra + 13ª/14ª − spese − risparmio − 13ª/14ª (se vanno nel deposito).
- "Senza fine": i mesi arrivano fino a dicembre dell'anno dopo quello di oggi.
- Deposito: versamenti a inizio mese; interesse mensile = saldo × tasso ÷ 12, meno il 26% di tasse,
  meno il bollo annuo ÷ 12. È una stima.
- Con `usa_deposito` spento la scheda "Deposito" diventa "Risparmi": stessi conti senza interessi
  (parte da `depositi.saldo_iniziale`, "Già da parte all'inizio"), con tabella mese per mese.
- Obiettivo (in Deposito e in Risparmi): barra di avanzamento sul saldo di oggi e mese in cui si raggiunge,
  proseguendo oltre la fine del periodo con il Modello (al massimo 50 anni).
- Chi parte da zero: inizio = mese corrente, senza fine, 13 mensilità, deposito spento.

## Modifiche al database già eseguite su Supabase (in ordine)
1. Schema iniziale (`piani`, `depositi`, `mesi`, RLS).
2. `depositi.periodi` + conversione dei vecchi campi promo in periodi.
3. `piani.mensilita`, `mese_13`, `mese_14`, `senza_fine`.
4. `piani.entrate_extra`, `mesi.entrate_extra`.
5. `piani.usa_deposito`.
6. `depositi.obiettivo`, `depositi.obiettivo_nome`.

## Come provare le modifiche
- `node --check js/app.js` e test dei calcoli importando `js/calc.js` da uno script `.mjs`.
- Per vedere le schermate senza Supabase: servire la cartella con `python3 -m http.server`, aprire con
  Playwright e intercettare l'URL di `supabase-js` con un modulo finto che restituisce dati di prova
  (`createClient` con `from().select().eq().maybeSingle()`, `upsert`, `auth.getSession`).
