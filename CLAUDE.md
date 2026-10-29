# Spare (ex "Conti del mese") — note per Claude

App web personale di Andrea per gestire le spese mensili. Pensata per lui, ma multi-utente:
un amico può crearsi un account e avere il suo piano, separato.
Online su **https://drndre.github.io/spare/** (repository `DRndre/spare`, GitHub Pages, branch `main`, cartella root).
Il vecchio indirizzo `https://drndre.github.io/gestione-spese/` è il repository `DRndre/gestione-spese`, che contiene
solo una pagina che reindirizza qui (e toglie il vecchio service worker): non metterci altro.
Su Supabase *Site URL* e *Redirect URLs* devono contenere `https://drndre.github.io/spare/`.

## Come lavorare con Andrea
- Rispondi in **italiano**, con parole semplici (non è un utente da gergo tecnico), e vai dritto al punto.
- Per modifiche non banali: prima spiega cosa faresti e fai le domande che servono, poi procedi.
- Quando serve cambiare il database, dai la **query SQL completa e pronta da incollare** in Supabase
  (SQL Editor → New query → Run) e aggiorna anche `supabase/schema.sql`.
- Dopo ogni push **controlla che GitHub Pages abbia pubblicato**: una volta la pubblicazione è rimasta
  bloccata "queued". Comando: `gh api repos/DRndre/spare/actions/runs --jq '.workflow_runs[0] | "\(.head_sha[0:7]) \(.status) \(.conclusion)"'`.
  Se resta bloccata, un commit vuoto la fa ripartire.
- Ricordagli di ricaricare con Ctrl + Maiusc + R per vedere le modifiche.

## Tecnologia
- HTML, CSS e JavaScript semplici (moduli ES), **nessuna build**, niente framework. Scelta voluta.
- Dati su **Supabase** (Postgres + login email/password) tramite `@supabase/supabase-js` **inclusa nell'app**:
  `js/vendor/supabase.js` (2.117.3, un file unico fatto con esbuild; istruzioni per aggiornarla in `js/vendor/LEGGIMI.txt`).
  L'unico sito esterno che l'app contatta è Supabase.
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
- **Scheda Mesi** (ordine): anni + mesi (pulsanti con solo il nome; pallino e testo rossi solo nei mesi in negativo, anche in tabella), nome del mese ("Segue il Modello" / "personalizzato · Ripristina"),
  sezioni con titolo piccolo grigio e totale a destra (`secHead`): *Resto in tasca*, *Entrate* (Stipendio, Buoni pasto
  (numero, dal Modello; solo se il valore del buono > 0), Entrate extra (solo quel mese, parte da 0), 13ª/14ª), *Risparmio* (deposito/messo da parte, Prelievo "Ripresi dal deposito"), *Spese* (scheda invariata, modulo
  aperto con "+ Aggiungi una spesa"), *Il tuo anno*: Entrate / Spese / Al deposito dell'anno, barra colorata
  delle entrate dell'anno (come quella del resto in tasca), elenco delle 5 categorie più pesanti ("+ Mostra di più" / "− Mostra di meno"),
  poi blocchi separati: *Al deposito* (verde) e *Rimasto in tasca* (grigio) con Mese migliore / Mese peggiore
  (frecce verde/arancio, numeri neri; aprono il mese; se tutti uguali una riga sola). Niente percentuali in più. Nel riepilogo dell'anno **cifre all'euro** (`eur0`), compresi i mesi; centesimi sempre nella scheda del mese.
  "Vedi la tabella completa" apre la tabella. Testi corti: "Stipendio" (mai "netto").
- **Scheda Deposito** (ordine): *Sul conto* (numero grande = saldo stimato **di oggi**, sotto "Previsto a <fine periodo>"
  con il dettaglio versati + interessi − bollo), *Obiettivo* ("+ Imposta un obiettivo", poi stato + "Modifica"),
  *Tasso nel tempo* (periodi, "+ Aggiungi un cambio di tasso"), *Impostazioni del conto* (saldo di partenza, tasse, bollo),
  *Il tuo anno* (anni, Versato / Interessi netti, grafico a barre verdi del saldo mese per mese, "Vedi la tabella completa").
  Senza deposito (*Risparmi*) stessa struttura: *Messo da parte*, *Obiettivo*, *Impostazioni*, *Il tuo anno* (Messo da parte / Prelievi).
- **Scheda Modello** (ordine): titolo "Il mese tipo" (a destra quanti mesi personalizzati), riga piccola
  "Ti restano X € al mese" con barra sottile (niente riquadro grande: quello è in Mesi), *Entrate* (Stipendio e Buoni pasto affiancati;
  Buoni pasto in un solo riquadro "20 × 6,50 €" con `buoniField`; niente più "Entrate extra" nel Modello), *Mensilità* (pulsanti 12/13/14, riquadri arancio 13ª/14ª con il mese, interruttore "13ª e 14ª al deposito"),
  *Risparmio* (riga a tutta larghezza), *Spese*, *Impostazioni* (Dal mese / Fino a, interruttore "Uso un conto deposito",
  interruttore "Avviso resto basso": spento = soglia 0; acceso chiede "Avvisami sotto", cifra obbligatoria, messaggio rosso;
  spegnendolo la cifra si cancella).
- Regole di design: scelte sì/no = **interruttore** stile iPhone (`switchRow`, classe `.sw`), anche nella configurazione guidata;
  scelte da un elenco = spunta. Un campo da solo = riga a tutta larghezza (`moneyField` con `cls: "riga"`).
  Moduli per aggiungere (spesa, tasso) = riquadro grigio arrotondato dentro la scheda, con titolo ("Nuova spesa", "Nuovo tasso"),
  pulsanti Annulla / Aggiungi, campi obbligatori con messaggio rosso; Esc chiude. Obiettivo: Annulla, "Elimina obiettivo".
- **Animazioni** (`js/anim.js`, sobrie stile iPhone, nulla con "Riduci movimento", mai mentre scrivi): pillola che scivola
  in schede / 12-13-14 / tema; contenuto che entra cambiando scheda o mese; numeri con `data-k`/`data-n`/`data-f` che contano
  (da 0 quando entri in una scheda, dal valore prima quando cambi mese o modifichi); barre che si riempiono, barre del Deposito
  che crescono, barra dell'obiettivo; moduli Nuova spesa / Nuovo tasso / Obiettivo che scendono e risalgono (focus con
  `preventScroll`, se no il titolo resta nascosto); riga appena aggiunta (spesa, tasso, categoria) con lampo azzurro.
  Per far provare modifiche delicate dal telefono: copia dell'app in `anteprima/` su main (senza service worker), poi toglierla.
- **Sicurezza** (`js/sicurezza.js`, menu ☰ → Sicurezza): ultimo accesso (`last_sign_in_at`), verifica in due passaggi
  **facoltativa** con app di autenticazione (TOTP di Supabase, gratis; niente SMS), più app collegabili ("+ Aggiungi un'altra
  app", consigliato come riserva perché Supabase non dà codici di riserva), "Rimuovi", "Esci da tutti i dispositivi"
  (`signOut({scope:"global"})`). All'accesso `start()` chiede il codice se `nextLevel` è aal2. Nel database la policy
  restrittiva "codice se attivo" (query 8) pretende aal2 solo da chi ha la verifica. Se un utente perde tutte le app:
  Supabase → Authentication → Users → utente → togliere il fattore. Il proprietario del progetto vede i dati di tutti
  in Table Editor (le RLS valgono tra utenti, non per lui): Andrea lo sa.
- **Spese a tempo / a rate** (solo nel Modello): voce con `da: "AAAA-MM"` e `rate: n` facoltativi (in `voci` jsonb, nessuna
  colonna nuova; `fixVoci` li conserva). `attivaNel(v, id)` / `fineSpesa(v)` in calc.js: `monthData` conta solo le spese
  attive nel mese. Nel modulo "Nuova spesa" del Modello interruttore "Solo per un periodo" → Dal mese + Numero di rate
  (obbligatorio, "Ultima rata: …"); se il periodo tocca mesi personalizzati chiede "Solo nel Modello" / "Anche in quei mesi".
  Ogni riga del Modello ha l'icona calendario per impostare/cambiare/togliere il periodo; etichetta azzurra
  "nov 2026 → ott 2027 · ancora N rate", grigia e riga sbiadita se finita o non iniziata. "Ti restano" e il totale
  Spese del Modello contano le spese attive nel mese di oggi (`meseRif()`), con "a <mese>" se ci sono spese a tempo.
- **Buoni pasto**: `piani.buoni_num`/`buoni_valore`, `mesi.buoni_num` (null = come il Modello). Contano tra le entrate e nel
  resto in tasca (pagano spese già in elenco); "di cui X € in buoni" sotto Entrate nel riepilogo dell'anno. `piani.entrate_extra`
  non si usa più (le entrate extra sono solo nei mesi). Prima della query 10 l'app tratta le vecchie entrate extra del Modello
  come 1 buono (`colBuoni`). Nei mesi le spese a rate mostrano l'etichetta "Rata 3 di 6 · fino a apr 2027".
- **Ogni mese a mano** (niente "spegni il Modello", perché il Modello regge le previsioni): in Mesi il link
  **"Copia dal mese prima"** (entrate, risparmio, prelievo e spese; non la 13ª/14ª; se il mese è già personalizzato chiede
  conferma; non c'è nel primo mese); nella configurazione guidata, solo al primo accesso, interruttore
  "Preferisco inserire ogni mese a mano" (salta le spese fisse, Modello vuoto); con il Modello vuoto (`modelloVuoto()`)
  i mesi dicono "Da compilare" e il Deposito "Stima solo sui mesi che hai compilato".
- **In sospeso (Andrea ha detto di aspettare):** regole più severe per la password; **residuo del mese precedente**
  (idea proposta: riga "Dal mese prima" automatica ma correggibile con la cifra vera, interruttore nel Modello,
  negativo che toglie dal mese dopo, riepilogo dell'anno per singolo mese + "In tasca a fine anno").
  **Dashboard / Riepilogo** (Andrea deve capire bene come farla): bozza nel branch `anteprima-riepilogo`, online in
  `anteprima/` su main finché Andrea non dice di toglierla. Scheda "Riepilogo" prima: Quello che hai (deposito + altri
  investimenti, conto corrente escluso), Altri investimenti scritti a mano (nell'anteprima in localStorage; nell'app vera
  servirebbe una colonna jsonb), mese di oggi, anno in breve con top 3 categorie e grafico del resto, rate in corso, obiettivo.
  Decisioni di Andrea (d'accordo): dati veri da aggiornare ogni tanto, non solo previsioni; per ogni investimento **quanto
  versato + quanto vale oggi + data di aggiornamento**; il conto corrente passa dal residuo del mese (farlo prima);
  provarla sul telefono prima di decidere. **Già predisposto:** colonna `piani.investimenti` jsonb (query 9) e in store.js
  `fixInvestimenti` / `state.piano.investimenti` `[{id, nome, tipo: "investimento"|"conto", versato, valore, aggiornato}]`,
  salvata solo se la colonna esiste (`colInvestimenti`), compresa nel backup, con `storico: [{data, versato, valore}]`
  (un punto a ogni aggiornamento, per il grafico nel tempo). Nessuna schermata ancora.
  **Stile voluto: come Moneyfarm** — valore totale grande, versato totale, guadagno in € e %, grafico nel tempo
  "valore" contro "versato" (deposito dalla simulazione mese per mese, investimenti dallo storico), scelta del periodo
  (1 anno / tutto), composizione per prodotto in € e %. Rendimenti TW/MW e confronti con altri fondi: no.
- `js/categorie.js` — 17 categorie di base (Casa, Auto e trasporti, Abbonamenti, Cura personale, Spesa, Salute,
  Svago e uscite, Animali, Viaggi, Rate e prestiti, Regali, Figli, Sport, Abbigliamento, Formazione, Tasse, Altro)
  con colore e icona (set Lucide, licenza ISC, icone incluse nel file), più quelle dell'utente. Una categoria
  sconosciuta o eliminata conta come "Altro". `js/categorie-ui.js`: menu ☰ → Categorie (crea, modifica, elimina:
  le spese di una categoria eliminata passano in Altro); "Nuova categoria" anche da "+ Aggiungi una spesa".
- `js/guida.js` — **Configurazione guidata** in 5 passaggi (entrate, mensilità, spese fisse con esempi da spuntare,
  risparmi/deposito, riepilogo): parte al primo accesso ("Inizia la configurazione") e si riapre dal menu ☰
  senza cancellare le spese già presenti. Si può saltare ("Salta" nel primo passaggio o "Salta, configuro da solo"
  nel benvenuto): si va al Modello vuoto. Contiene anche la pagina **Come funziona** (menu ☰).
- Tema: menu ☰ → Automatico / Chiaro / Scuro, salvato **per dispositivo** in `localStorage` ("spare-tema"),
  applicato con `data-theme` sull'html (script in testa a `index.html`, così non lampeggia).
- `js/logo.js` + `icons/logo.svg` — logo "spare": scritta in **Fraunces 800** trasformata in disegno (niente
  carattere da caricare) con sotto la barra colorata delle spese. Usato in alto nella pagina e nell'accesso.
- `icons/` — icone dell'app (scritta Fraunces + barra), `favicon.svg`/`favicon-32.png` ("s" + barra).
  In `icons/alternativa-inter/` c'è la prima versione dell'icona con la scritta in Inter, tenuta come alternativa.
- Titolo della scheda del browser: "Spare | Mesi", "Spare | Deposito" (o "Risparmi"), "Spare | Modello" dentro l'app;
  slogan **"Spare | Quanto ti resta?"** per accesso, benvenuto e anteprima del link (tag og: in `index.html`,
  immagine `icons/anteprima.png` 1200×630).
- `supabase/schema.sql` — schema completo, rieseguibile (contiene anche gli `alter table` successivi).

## Modello dei dati
- **piani** (una riga per utente, il "Modello" = mese tipo): stipendio, entrate_extra, risparmio,
  soglia (0 = nessun avviso), mensilita (12/13/14), tredicesima, quattordicesima, mese_13, mese_14 (1-12),
  extra_al_deposito, usa_deposito, mese_inizio, mese_fine, senza_fine, voci (jsonb `[{id, nome, importo, cat}]`),
  categorie (jsonb `[{k, n, c, i}]`: categorie create dall'utente; chiave `c…`, colore esadecimale, nome icona),
  investimenti (jsonb, vedi Riepilogo in sospeso).
- **depositi** (una riga per utente): saldo_iniziale, obiettivo (0 = nessuno), obiettivo_nome, tasse (26), bollo (0,2), periodi
  (jsonb `[{id, da: "AAAA-MM", tasso, nome}]`: ogni tasso vale dal suo mese fino al successivo).
  Le colonne `tasso_promo`, `tasso_base`, `inizio_promo`, `mesi_promo` sono della prima versione e non si usano più.
- **mesi** (solo i mesi personalizzati; gli altri seguono il Modello): stipendio, entrate_extra (solo del mese; null = 0), buoni_num (null = come il Modello),
  risparmio, prelievo, extra (null = importo di 13ª/14ª dal Modello), voci.

## Regole di calcolo
- Resto in tasca = stipendio + buoni pasto + entrate extra + 13ª/14ª − spese − risparmio − 13ª/14ª (se vanno nel deposito).
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
7. `piani.categorie`; spostate "Fondo conigli" → animali e "Klarna Multa" → rate (Modello e mesi).
8. Funzione `public.ha_verifica()` (security definer: `auth.mfa_factors` non è leggibile dagli utenti) e policy restrittiva
   "codice se attivo" su `piani`, `depositi`, `mesi`. (Un primo tentativo che leggeva direttamente `auth.mfa_factors` aveva bloccato l'app.)
9. `piani.investimenti` jsonb (predisposizione per il Riepilogo).
10. Buoni pasto: `piani.buoni_num`, `piani.buoni_valore`, `mesi.buoni_num`; entrate extra del Modello spostate nei buoni — *da confermare che Andrea l'abbia eseguita*.

## Come provare le modifiche
- `node --check js/app.js` e test dei calcoli importando `js/calc.js` da uno script `.mjs`.
- Per vedere le schermate senza Supabase: servire la cartella con `python3 -m http.server`, aprire con
  Playwright e intercettare `js/vendor/supabase.js` con un modulo finto che restituisce dati di prova
  (`createClient` con `from().select().eq().maybeSingle()`, `upsert`, `auth.getSession`).
