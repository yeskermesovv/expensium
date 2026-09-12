-- Схема для облачной синхронизации трат.
-- Выполните этот файл целиком в Supabase: SQL Editor -> New query -> Run.

create table if not exists public.entries (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  amount      numeric,
  currency    text not null default 'KZT',
  type        text not null default 'expense',
  category_id text not null default 'other',
  title       text,
  note        text,
  date        timestamptz not null,
  created_at  timestamptz not null default now(),
  -- Время правки ставит клиент: по нему синхронизация выбирает свежую версию
  updated_at  timestamptz not null,
  -- Удаление мягкое, иначе оно не доедет до других устройств
  deleted     boolean not null default false
);

-- Выборка всегда идёт по владельцу и времени правки
create index if not exists entries_user_updated_idx
  on public.entries (user_id, updated_at desc);

alter table public.entries enable row level security;

-- Публичный ключ лежит в коде сайта, поэтому доступ ограничивают эти политики:
-- каждый видит и меняет только свои строки.
drop policy if exists "Свои записи видно" on public.entries;
create policy "Свои записи видно"
  on public.entries for select
  using (auth.uid() = user_id);

drop policy if exists "Свои записи можно добавлять" on public.entries;
create policy "Свои записи можно добавлять"
  on public.entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Свои записи можно менять" on public.entries;
create policy "Свои записи можно менять"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Свои записи можно удалять" on public.entries;
create policy "Свои записи можно удалять"
  on public.entries for delete
  using (auth.uid() = user_id);

-- ── Счета ────────────────────────────────────────────────────────────────────
-- Появились позже записей, поэтому счёт по умолчанию задан константой 'main':
-- он должен совпадать на всех устройствах, а миграция записей не проводится.

create table if not exists public.accounts (
  id              text primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null default 'Счёт',
  currency        text not null default 'KZT',
  -- Сколько лежало на счёте до первой записи: без этого остаток по карте
  -- показывал бы только разницу доходов и расходов
  opening_balance numeric not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null,
  deleted         boolean not null default false
);

create index if not exists accounts_user_updated_idx
  on public.accounts (user_id, updated_at desc);

alter table public.accounts enable row level security;

drop policy if exists "Свои счета видно" on public.accounts;
create policy "Свои счета видно"
  on public.accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Свои счета можно добавлять" on public.accounts;
create policy "Свои счета можно добавлять"
  on public.accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Свои счета можно менять" on public.accounts;
create policy "Свои счета можно менять"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Свои счета можно удалять" on public.accounts;
create policy "Свои счета можно удалять"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- Счёт у записи. Значение по умолчанию раздаёт старым строкам тот же счёт,
-- который клиент подставляет локально, поэтому обновлять их не нужно.
alter table public.entries
  add column if not exists account_id text not null default 'main';

create index if not exists entries_user_account_idx
  on public.entries (user_id, account_id);
