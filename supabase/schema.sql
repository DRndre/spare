-- Conti del mese — schema del database.
-- Da incollare in Supabase: SQL Editor → New query → Run.
-- Ogni riga appartiene a un utente: le regole (Row Level Security) fanno sì che
-- ciascuno legga e scriva SOLO i propri dati. Si può rieseguire senza problemi.

-- 1. Piano (il "Modello": mese tipo e impostazioni)
create table if not exists public.piani (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  stipendio numeric not null default 0,
  risparmio numeric not null default 0,
  soglia numeric not null default 0,
  tredicesima numeric not null default 0,
  quattordicesima numeric not null default 0,
  extra_al_deposito boolean not null default true,
  mese_inizio text not null default '2026-11' check (mese_inizio ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  mese_fine text not null default '2027-12' check (mese_fine ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  voci jsonb not null default '[]'::jsonb,   -- [{id, nome, importo, cat}]
  mensilita integer not null default 13 check (mensilita in (12, 13, 14)),
  mese_13 integer not null default 12 check (mese_13 between 1 and 12),
  mese_14 integer not null default 6 check (mese_14 between 1 and 12),
  senza_fine boolean not null default true,   -- true = i mesi si allungano da soli
  updated_at timestamptz not null default now()
);
alter table public.piani add column if not exists mensilita integer not null default 13 check (mensilita in (12, 13, 14));
alter table public.piani add column if not exists mese_13 integer not null default 12 check (mese_13 between 1 and 12);
alter table public.piani add column if not exists mese_14 integer not null default 6 check (mese_14 between 1 and 12);
alter table public.piani add column if not exists senza_fine boolean not null default true;

-- 2. Conto deposito (le colonne *_promo/tasso_base sono della prima versione: ora si usa "periodi")
create table if not exists public.depositi (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  saldo_iniziale numeric not null default 0,
  tasso_promo numeric not null default 4,
  tasso_base numeric not null default 0.2,
  inizio_promo text not null default '2026-11' check (inizio_promo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  mesi_promo integer not null default 12,
  tasse numeric not null default 26,
  bollo numeric not null default 0.2,
  periodi jsonb not null default '[]'::jsonb,  -- [{id, da: "AAAA-MM", tasso, nome}]
  updated_at timestamptz not null default now()
);
alter table public.depositi add column if not exists periodi jsonb not null default '[]'::jsonb;

-- 3. Mesi personalizzati (solo quelli che modifichi; gli altri seguono il piano)
create table if not exists public.mesi (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mese text not null check (mese ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  stipendio numeric not null default 0,
  risparmio numeric not null default 0,
  prelievo numeric not null default 0,
  extra numeric,                              -- null = usa tredicesima/quattordicesima del piano
  voci jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, mese)
);

-- Regole di accesso: ognuno vede e modifica solo le proprie righe
alter table public.piani enable row level security;
alter table public.depositi enable row level security;
alter table public.mesi enable row level security;

drop policy if exists "solo i miei dati" on public.piani;
drop policy if exists "solo i miei dati" on public.depositi;
drop policy if exists "solo i miei dati" on public.mesi;

create policy "solo i miei dati" on public.piani
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "solo i miei dati" on public.depositi
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "solo i miei dati" on public.mesi
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.piani, public.depositi, public.mesi to authenticated;
revoke all on public.piani, public.depositi, public.mesi from anon;

-- Entrate extra (aggiunte dopo)
alter table public.piani add column if not exists entrate_extra numeric not null default 0;
alter table public.mesi add column if not exists entrate_extra numeric;  -- null = come il Modello

-- Conto deposito sì/no (false per i nuovi account)
alter table public.piani add column if not exists usa_deposito boolean not null default false;

-- Obiettivo di risparmio (0 = nessuno)
alter table public.depositi add column if not exists obiettivo numeric not null default 0;
alter table public.depositi add column if not exists obiettivo_nome text not null default '';

-- Categorie create dall'utente: [{k, n, c (colore), i (icona)}]
alter table public.piani add column if not exists categorie jsonb not null default '[]'::jsonb;

-- Verifica in due passaggi: chi l'ha attivata vede i suoi dati solo se è entrato anche con il codice (aal2).
-- Chi non l'ha attivata non nota differenze. Si può rieseguire.
drop policy if exists "codice se attivo" on public.piani;
drop policy if exists "codice se attivo" on public.depositi;
drop policy if exists "codice se attivo" on public.mesi;

create policy "codice se attivo" on public.piani as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified'))
  with check (array[(select auth.jwt()->>'aal')] <@ (select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified'));
create policy "codice se attivo" on public.depositi as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified'))
  with check (array[(select auth.jwt()->>'aal')] <@ (select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified'));
create policy "codice se attivo" on public.mesi as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified'))
  with check (array[(select auth.jwt()->>'aal')] <@ (select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified'));
