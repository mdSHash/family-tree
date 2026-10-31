-- شجرة العيلة: database schema
-- Access model: every tree has two secret codes. The view code lets people read the tree,
-- the edit code lets them add and change people. All access goes through the functions
-- below (security definer); the tables themselves have RLS on with no policies, so the
-- anon key cannot read or write them directly.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  view_code text not null unique,
  edit_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.people (
  tree_id uuid not null references public.trees(id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tree_id, id)
);

alter table public.trees enable row level security;
alter table public.people enable row level security;

-- resolve a code to (tree id, role)
create schema if not exists private;

create or replace function private.resolve_code(p_code text, out tree_id uuid, out role text)
language sql stable security definer set search_path = public as $$
  select id, case when edit_code = p_code then 'edit' else 'view' end
  from trees where edit_code = p_code or view_code = p_code limit 1
$$;

create or replace function public.create_tree(p_name text default '')
returns json language plpgsql security definer set search_path = public as $$
declare t trees;
begin
  insert into trees(name, view_code, edit_code)
  values (left(coalesce(p_name,''),60), encode(extensions.gen_random_bytes(9),'hex'), encode(extensions.gen_random_bytes(12),'hex'))
  returning * into t;
  return json_build_object('id',t.id,'name',t.name,'view_code',t.view_code,'edit_code',t.edit_code);
end $$;

create or replace function public.open_tree(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare r record; t trees;
begin
  select * into r from private.resolve_code(p_code);
  if r.tree_id is null then return null; end if;
  select * into t from trees where id = r.tree_id;
  return json_build_object(
    'id', t.id, 'name', t.name, 'role', r.role, 'updated_at', t.updated_at,
    'view_code', t.view_code,
    'edit_code', case when r.role = 'edit' then t.edit_code end,
    'people', coalesce((select json_agg(p.data || jsonb_build_object('id', p.id)) from people p where p.tree_id = t.id and not coalesce((p.data->>'_deleted')::boolean,false)), '[]'::json)
  );
end $$;

create or replace function public.save_people(p_code text, p_people jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare r record; item jsonb; n int := 0;
begin
  select * into r from private.resolve_code(p_code);
  if r.tree_id is null or r.role <> 'edit' then raise exception 'not_allowed'; end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) > 200 then raise exception 'bad_input'; end if;
  for item in select * from jsonb_array_elements(p_people) loop
    if coalesce(item->>'id','') = '' or length(item::text) > 20000 then raise exception 'bad_person'; end if;
    insert into people(tree_id, id, data, updated_at)
    values (r.tree_id, item->>'id', item - 'id', now())
    on conflict (tree_id, id) do update set data = excluded.data, updated_at = now();
    n := n + 1;
  end loop;
  update trees set updated_at = now() where id = r.tree_id;
  return n;
end $$;

-- removing a person leaves a tombstone; open_tree skips it
create or replace function public.remove_person(p_code text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from private.resolve_code(p_code);
  if r.tree_id is null or r.role <> 'edit' then raise exception 'not_allowed'; end if;
  update people set data = jsonb_build_object('_deleted', true), updated_at = now() where tree_id = r.tree_id and id = p_id;
  update trees set updated_at = now() where id = r.tree_id;
end $$;

create or replace function public.rename_tree(p_code text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from private.resolve_code(p_code);
  if r.tree_id is null or r.role <> 'edit' then raise exception 'not_allowed'; end if;
  update trees set name = left(coalesce(p_name,''),60), updated_at = now() where id = r.tree_id;
end $$;

-- photos: public bucket, small images only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos','photos', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy "photos upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'photos');
