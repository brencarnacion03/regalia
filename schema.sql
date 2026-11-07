-- Regalía: family Secret Santa.
-- Run this once in the Supabase SQL Editor. Safe to run again.
--
-- How access works:
--  * Family members have no accounts. Each person gets a secret personal link
--    (a long random token). Anyone with that link can see and edit only that
--    person's card and see only that person's match.
--  * The organizer page is protected by an organizer code you choose the first
--    time you open it.
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
  id int primary key default 1 check (id = 1),
  budget text not null default '',
  exchange_date date,
  drawn_at timestamptz,
  admin_hash text
);
insert into public.regalia_event (id) values (1) on conflict do nothing;

alter table public.regalia_people enable row level security;
alter table public.regalia_event enable row level security;
revoke all on public.regalia_people, public.regalia_event from anon, authenticated;

-- ---------- helpers ----------

create or replace function public.regalia_check_admin(p_code text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select admin_hash into h from regalia_event where id = 1;
  if h is null or p_code is null or crypt(p_code, h) <> h then
    perform pg_sleep(1);
    raise exception 'wrong_code';
  end if;
end $$;
revoke execute on function public.regalia_check_admin(text) from public, anon, authenticated;

create or replace function public.regalia_event_json() returns json
language sql security definer set search_path = public as $$
  select json_build_object('budget', budget, 'exchange_date', exchange_date, 'drawn_at', drawn_at)
  from regalia_event where id = 1;
$$;
revoke execute on function public.regalia_event_json() from public, anon, authenticated;

-- ---------- family member functions ----------

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
    'event', regalia_event_json(),
    'everyone', coalesce((select json_agg(json_build_object('id', id, 'name', name, 'joined', joined) order by name)
                          from regalia_people), '[]'::json)
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

create or replace function public.regalia_admin_status() returns json
language sql security definer set search_path = public as $$
  select json_build_object('needs_setup', admin_hash is null) from regalia_event where id = 1;
$$;

create or replace function public.regalia_admin_setup(p_code text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if char_length(coalesce(p_code, '')) < 6 then raise exception 'code_too_short'; end if;
  select admin_hash into h from regalia_event where id = 1 for update;
  if h is not null then raise exception 'already_set'; end if;
  update regalia_event set admin_hash = crypt(p_code, gen_salt('bf')) where id = 1;
  return true;
end $$;

create or replace function public.regalia_admin_state(p_code text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform regalia_check_admin(p_code);
  return json_build_object(
    'event', regalia_event_json(),
    'people', coalesce((select json_agg(json_build_object(
                 'id', id, 'token', token, 'name', name, 'joined', joined,
                 'has_match', match_id is not null) order by created_at)
               from regalia_people), '[]'::json)
  );
end $$;

create or replace function public.regalia_admin_add(p_code text, p_name text) returns boolean
language plpgsql security definer set search_path = public as $$
declare clean_name text := left(trim(coalesce(p_name, '')), 40);
begin
  perform regalia_check_admin(p_code);
  if clean_name = '' then raise exception 'name_required'; end if;
  insert into regalia_people (name) values (clean_name);
  return true;
end $$;

create or replace function public.regalia_admin_remove(p_code text, p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform regalia_check_admin(p_code);
  delete from regalia_people where id = p_id;
  return true;
end $$;

create or replace function public.regalia_admin_event(p_code text, p_budget text, p_date date) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform regalia_check_admin(p_code);
  update regalia_event set budget = left(trim(coalesce(p_budget, '')), 20), exchange_date = p_date where id = 1;
  return true;
end $$;

-- Draws names on the server, so nobody (not even the organizer) sees the matches.
create or replace function public.regalia_admin_draw(p_code text) returns int
language plpgsql security definer set search_path = public as $$
declare ids uuid[]; n int;
begin
  perform regalia_check_admin(p_code);
  select array_agg(id order by random()) into ids from regalia_people;
  n := coalesce(array_length(ids, 1), 0);
  if n < 3 then raise exception 'need_three'; end if;
  -- Everyone in the shuffled circle gives to the next person, so nobody gets themselves.
  update regalia_people p set match_id = ids[(s.i % n) + 1]
  from (select ids[g] as pid, g as i from generate_series(1, n) g) s
  where p.id = s.pid;
  update regalia_event set drawn_at = now() where id = 1;
  return n;
end $$;

grant execute on function
  public.regalia_me(text),
  public.regalia_save(text, text, text, text, text, text[]),
  public.regalia_admin_status(),
  public.regalia_admin_setup(text),
  public.regalia_admin_state(text),
  public.regalia_admin_add(text, text),
  public.regalia_admin_remove(text, uuid),
  public.regalia_admin_event(text, text, date),
  public.regalia_admin_draw(text)
to anon, authenticated;

-- Tell the API to pick up the new tables and functions right away.
notify pgrst, 'reload schema';
