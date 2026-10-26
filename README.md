# Conti del mese

Web app per gestire le spese mensili: resto in tasca mese per mese, tredicesima e quattordicesima, e simulazione del conto deposito (Conto Arancio ING al 4% per 12 mesi).

- **Frontend**: HTML, CSS e JavaScript semplici (moduli ES), senza build. Pubblicata con GitHub Pages.
- **Dati**: Supabase (Postgres + login con email e password). Ogni utente vede solo i propri dati.
- **Installabile**: su iPhone *Condividi → Aggiungi alla schermata Home*, su Android/Chrome *Installa app*.

## Struttura

```
index.html              pagina e struttura (menu, schede)
css/style.css           grafica; colori in variabili, tema chiaro e scuro
js/config.js            URL e chiave pubblica di Supabase
js/calc.js              calcoli puri: mesi, resto, 13ª/14ª, simulazione deposito
js/store.js             lettura e salvataggio su Supabase, backup
js/app.js               interfaccia: login, schede Mesi / Conto Arancio / Modello
sw.js                   cache per aprire l'app offline
manifest.webmanifest    nome e icone per l'installazione
supabase/schema.sql     tabelle e regole di accesso del database
```

## Configurazione (una volta sola)

### 1. Supabase
1. Crea un account su [supabase.com](https://supabase.com) e un nuovo progetto (piano Free, regione Europe).
2. **SQL Editor → New query**: incolla il contenuto di `supabase/schema.sql` e premi **Run**.
3. **Authentication → URL Configuration**: in *Site URL* metti l'indirizzo dell'app su GitHub Pages
   (es. `https://TUONOME.github.io/conti-del-mese/`) e aggiungilo anche in *Redirect URLs*.
   Serve per i link di conferma email e di recupero password.
4. **Project Settings → API**: copia *Project URL* e la chiave *anon / publishable* in `js/config.js`.
   La chiave anon può stare nel codice pubblico: i dati sono protetti dalle regole del database.
   **Non mettere mai la chiave `service_role`** nel codice.

### 2. GitHub Pages
**Settings → Pages → Build and deployment**: *Deploy from a branch*, branch `main`, cartella `/ (root)`.
Dopo un minuto l'app è su `https://TUONOME.github.io/conti-del-mese/`.

### 3. Primo accesso
Apri l'app, **Crea account** con email e password e conferma l'email. Al primo accesso puoi
**importare un backup** (`.json`) oppure partire da zero. Il backup si esporta in qualsiasi momento
dal menu ⋯ → *Esporta backup*.

> I file di backup contengono i tuoi dati: **non caricarli su GitHub** (il repository è pubblico).
> Il file `.gitignore` li esclude già se si chiamano `*backup*.json`.

## Come modificarla

1. Cambia i file (a mano o chiedendo a Claude Code nel repository).
2. Fai commit e push su `main`: GitHub Pages pubblica in circa un minuto.
3. Se hai cambiato file dell'app, aumenta `VERSION` in `sw.js` (es. `v1` → `v2`) così la cache si rinnova.

Dove mettere le mani:
- **Nuove categorie di spesa**: `CATS` in `js/calc.js` (e un colore `--c-…` in `css/style.css`).
- **Regole di calcolo** (resto, deposito, tasse): `js/calc.js`.
- **Nuovi campi salvati**: aggiungi la colonna in `supabase/schema.sql` (con `alter table … add column …`
  eseguito nell'SQL Editor) e poi in `js/store.js` (lettura e salvataggio).
- **Nuove schermate**: un pulsante in `.tabs` di `index.html` e una funzione `renderX` in `js/app.js`.

### Provarla sul computer prima del push
I moduli ES richiedono un piccolo server locale:
```
python3 -m http.server 8000
```
poi apri `http://localhost:8000` (aggiungi `http://localhost:8000` anche ai *Redirect URLs* di Supabase).

## Più utenti
Lo schema è già pronto: chiunque crei un account ha il suo piano spese separato. Se per ora vuoi
che possa registrarsi solo tu, in Supabase disattiva **Authentication → Sign In / Providers → Allow new users to sign up**
dopo aver creato il tuo account.

## Come sono calcolati gli interessi
Stima mensile: versamenti a inizio mese, interesse = saldo × tasso ÷ 12, meno il 26% di imposta sulle
rendite e il bollo dello 0,2% annuo ripartito sui mesi. La banca liquida e arrotonda a modo suo, quindi
le cifre reali possono differire di qualche centesimo.
