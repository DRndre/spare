-- Conti del mese — schema del database.
-- Da incollare in Supabase: SQL Editor → New query → Run.
-- Ogni riga appartiene a un utente: le regole (Row Level Security) fanno sì che
-- ciascuno legga e scriva SOLO i propri dati. Si può rieseguire senza problemi.

-- 1. Piano (il "Modello": mese tipo e impostazioni)
create table if not exists public.piani (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  stipendio numeric not null default 0,
  risparmio numeric not null default 0,
  soglia numeric not null default 600,
  tredicesima numeric not null default 0,
  quattordicesima numeric not null default 0,
  extra_al_deposito boolean not null default true,
  mese_inizio text not null default '2026-11' check (mese_inizio ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  mese_fine text not null default '2027-12' check (mese_fine ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  voci jsonb not null default '[]'::jsonb,   -- [{id, nome, importo, cat}]
  updated_at timestamptz not null default now()
);

-- 2. Conto deposito (Conto Arancio ING)
create table if not exists public.depositi (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  saldo_iniziale numeric not null default 0,
  tasso_promo numeric not null default 4,
  tasso_base numeric not null default 0.2,
  inizio_promo text not null default '2026-11' check (inizio_promo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  mesi_promo integer not null default 12,
  tasse numeric not null default 26,
  bollo numeric not null default 0.2,
  updated_at timestamptz not null default now()
);

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
