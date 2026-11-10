-- Regalía: family Secret Santa.
-- Run this once in the Supabase SQL Editor. Safe to run again.
--
-- How access works:
--  * Family members have no accounts. Each person gets a secret personal link
--    (a long random token). Anyone with that link can see and edit only that
--    person's card and see only that person's match.
--  * The organizer page is protected by an organizer code you choose the first
--    time you open it.
--  * More than one family can use the same site. "/#organizer" is the original
--    family; "/#organizer=garcia" (any short name) is a separate family with its
--    own list, organizer code, budget, gift day and draw.
--  * The tables are locked (RLS on, no policies). The website can only use the
--    functions below, never read the tables directly.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.regalia_people (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(extensions.gen_random_bytes(16), 'hex'),
  name text not null check (char_length(name) between 1 and 40),
  shirt text not null default '',
  pants text not null default '',
  shoes text not null default '',
  wishes text[] not null default '{}',
  joined boolean not null default false,
  match_id uuid references public.regalia_people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.regalia_event (
  id int primary key default 1,
  budget text not null default '',
  exchange_date date,
  drawn_at timestamptz,
  admin_hash text
);
insert into public.regalia_event (id) values (1) on conflict do nothing;

-- ---------- families (safe to run on an existing database: nothing is lost) ----------
-- Everyone already in the database stays in the original family ('').
alter table public.regalia_people add column if not exists family text not null default '';
create index if not exists regalia_people_family_idx on public.regalia_people (family);
alter table public.regalia_event add column if not exists family text not null default '';
-- A name shown on everyone's page, e.g. 'Lorenzo''s Family'. Set it with:
--   update public.regalia_event set name = 'Lorenzo''s Family' where family = '';
alter table public.regalia_event add column if not exists name text not null default '';
do $$ declare c text;
begin
  -- Remove the old "only one event" rule so each family can have its own.
  for c in select conname from pg_constraint
           where conrelid = 'public.regalia_event'::regclass and contype = 'c' loop
    execute format('alter table public.regalia_event drop constraint %I', c);
  end loop;
end $$;
create sequence if not exists public.regalia_event_id_seq owned by public.regalia_event.id;
select setval('public.regalia_event_id_seq', greatest((select max(id) from public.regalia_event), 1));
alter table public.regalia_event alter column id set default nextval('public.regalia_event_id_seq');
create unique index if not exists regalia_event_family_key on public.regalia_event (family);
revoke all on sequence public.regalia_event_id_seq from anon, authenticated;

-- Old one-family versions of these functions (replaced below).
drop function if exists public.regalia_check_admin(text);
drop function if exists public.regalia_event_json();
drop function if exists public.regalia_admin_status();
drop function if exists public.regalia_admin_setup(text);
drop function if exists public.regalia_admin_state(text);
drop function if exists public.regalia_admin_add(text, text);
drop function if exists public.regalia_admin_remove(text, uuid);
drop function if exists public.regalia_admin_event(text, text, date);
drop function if exists public.regalia_admin_draw(text);

alter table public.regalia_people enable row level security;
alter table public.regalia_event enable row level security;
revoke all on public.regalia_people, public.regalia_event from anon, authenticated;

-- ---------- helpers ----------

-- Family names: lowercase letters, numbers and dashes. '' is the original family.
create or replace function public.regalia_family(p_family text) returns text
language plpgsql immutable set search_path = public as $$
declare f text := lower(trim(coalesce(p_family, '')));
begin
  if f !~ '^[a-z0-9-]{0,30}$' then raise exception 'bad_family'; end if;
  return f;
end $$;
revoke execute on function public.regalia_family(text) from public, anon, authenticated;

create or replace function public.regalia_check_admin(p_code text, p_family text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select admin_hash into h from regalia_event where family = p_family;
  if h is null or p_code is null or crypt(p_code, h) <> h then
    perform pg_sleep(1);
    raise exception 'wrong_code';
  end if;
end $$;
revoke execute on function public.regalia_check_admin(text, text) from public, anon, authenticated;

create or replace function public.regalia_event_json(p_family text) returns json
language sql security definer set search_path = public as $$
  select json_build_object('name', name, 'budget', budget, 'exchange_date', exchange_date, 'drawn_at', drawn_at)
  from regalia_event where family = p_family;
$$;
revoke execute on function public.regalia_event_json(text) from public, anon, authenticated;

-- ---------- family member functions ----------
-- A personal link already belongs to one family, so these need no family name.

create or replace function public.regalia_me(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare me regalia_people; m regalia_people;
begin
  select * into me from regalia_people where token = p_token;
  if not found then
    perform pg_sleep(0.5);
    return null;
  end if;
  if me.match_id is not null then
    select * into m from regalia_people where id = me.match_id;
  end if;
  return json_build_object(
    'me', json_build_object('id', me.id, 'name', me.name, 'shirt', me.shirt, 'pants', me.pants,
                            'shoes', me.shoes, 'wishes', me.wishes, 'joined', me.joined),
    'match', case when m.id is null then null else
      json_build_object('id', m.id, 'name', m.name, 'shirt', m.shirt, 'pants', m.pants,
                        'shoes', m.shoes, 'wishes', m.wishes) end,
    'event', regalia_event_json(me.family),
    'everyone', coalesce((select json_agg(json_build_object('id', id, 'name', name, 'joined', joined) order by name)
                          from regalia_people where family = me.family), '[]'::json)
  );
end $$;

create or replace function public.regalia_save(
  p_token text, p_name text, p_shirt text, p_pants text, p_shoes text, p_wishes text[]
) returns boolean
language plpgsql security definer set search_path = public as $$
declare clean_name text := left(trim(coalesce(p_name, '')), 40);
begin
  if clean_name = '' then raise exception 'name_required'; end if;
  update regalia_people set
    name = clean_name,
    shirt = left(trim(coalesce(p_shirt, '')), 20),
    pants = left(trim(coalesce(p_pants, '')), 20),
    shoes = left(trim(coalesce(p_shoes, '')), 20),
    wishes = (select coalesce(array_agg(left(trim(w), 80)), '{}')
              from unnest(coalesce(p_wishes, '{}')) with ordinality as t(w, i)
              where i <= 3 and trim(w) <> ''),
    joined = true,
    updated_at = now()
  where token = p_token;
  if not found then raise exception 'not_found'; end if;
  return true;
end $$;

-- ---------- organizer functions ----------
-- p_family is optional; leaving it out means the original family.

create or replace function public.regalia_admin_status(p_family text default '') returns json
language plpgsql security definer set search_path = public as $$
declare f text := regalia_family(p_family);
begin
  return json_build_object('needs_setup',
    not exists (select 1 from regalia_event where family = f and admin_hash is not null));
end $$;

create or replace function public.regalia_admin_setup(p_code text, p_family text default '') returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare f text := regalia_family(p_family); h text;
begin
  if char_length(coalesce(p_code, '')) < 6 then raise exception 'code_too_short'; end if;
  insert into regalia_event (family) values (f) on conflict (family) do nothing;
  select admin_hash into h from regalia_event where family = f for update;
  if h is not null then raise exception 'already_set'; end if;
  update regalia_event set admin_hash = crypt(p_code, gen_salt('bf')) where family = f;
  return true;
end $$;

create or replace function public.regalia_admin_state(p_code text, p_family text default '') returns json
language plpgsql security definer set search_path = public as $$
declare f text := regalia_family(p_family);
begin
  perform regalia_check_admin(p_code, f);
  return json_build_object(
    'event', regalia_event_json(f),
    'people', coalesce((select json_agg(json_build_object(
                 'id', id, 'token', token, 'name', name, 'joined', joined,
                 'has_match', match_id is not null) order by created_at)
               from regalia_people where family = f), '[]'::json)
  );
end $$;

create or replace function public.regalia_admin_add(p_code text, p_name text, p_family text default '') returns boolean
language plpgsql security definer set search_path = public as $$
declare f text := regalia_family(p_family); clean_name text := left(trim(coalesce(p_name, '')), 40);
begin
  perform regalia_check_admin(p_code, f);
  if clean_name = '' then raise exception 'name_required'; end if;
  insert into regalia_people (name, family) values (clean_name, f);
  return true;
end $$;

create or replace function public.regalia_admin_remove(p_code text, p_id uuid, p_family text default '') returns boolean
language plpgsql security definer set search_path = public as $$
declare f text := regalia_family(p_family);
begin
  perform regalia_check_admin(p_code, f);
  delete from regalia_people where id = p_id and family = f;
  return true;
end $$;

create or replace function public.regalia_admin_event(p_code text, p_budget text, p_date date, p_family text default '') returns boolean
language plpgsql security definer set search_path = public as $$
declare f text := regalia_family(p_family);
begin
  perform regalia_check_admin(p_code, f);
  update regalia_event set budget = left(trim(coalesce(p_budget, '')), 20), exchange_date = p_date where family = f;
  return true;
end $$;

-- Draws names on the server, so nobody (not even the organizer) sees the matches.
create or replace function public.regalia_admin_draw(p_code text, p_family text default '') returns int
language plpgsql security definer set search_path = public as $$
declare f text := regalia_family(p_family); ids uuid[]; n int;
begin
  perform regalia_check_admin(p_code, f);
  select array_agg(id order by random()) into ids from regalia_people where family = f;
  n := coalesce(array_length(ids, 1), 0);
  if n < 3 then raise exception 'need_three'; end if;
  -- Everyone in the shuffled circle gives to the next person, so nobody gets themselves.
  update regalia_people p set match_id = ids[(s.i % n) + 1]
  from (select ids[g] as pid, g as i from generate_series(1, n) g) s
  where p.id = s.pid;
  update regalia_event set drawn_at = now() where family = f;
  return n;
end $$;

grant execute on function
  public.regalia_me(text),
  public.regalia_save(text, text, text, text, text, text[]),
  public.regalia_admin_status(text),
  public.regalia_admin_setup(text, text),
  public.regalia_admin_state(text, text),
  public.regalia_admin_add(text, text, text),
  public.regalia_admin_remove(text, uuid, text),
  public.regalia_admin_event(text, text, date, text),
  public.regalia_admin_draw(text, text)
to anon, authenticated;

-- Tell the API to pick up the new tables and functions right away.
notify pgrst, 'reload schema';
