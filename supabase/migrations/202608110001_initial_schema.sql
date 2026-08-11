create extension if not exists pgcrypto;

create type public.list_role as enum ('owner', 'editor');

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_members (
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.list_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table public.list_invites (
  list_id uuid primary key references public.shopping_lists(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  quantity text check (quantity is null or char_length(quantity) <= 30),
  is_bought boolean not null default false,
  created_by_name text check (created_by_name is null or char_length(created_by_name) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_items_list_id_idx on public.shopping_items(list_id, is_bought, created_at);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger shopping_lists_updated_at before update on public.shopping_lists for each row execute procedure public.touch_updated_at();
create trigger shopping_items_updated_at before update on public.shopping_items for each row execute procedure public.touch_updated_at();

create function public.is_list_member(target_list_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.list_members where list_id = target_list_id and user_id = auth.uid());
$$;
create function public.is_list_owner(target_list_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.list_members where list_id = target_list_id and user_id = auth.uid() and role = 'owner');
$$;

alter table public.shopping_lists enable row level security;
alter table public.list_members enable row level security;
alter table public.list_invites enable row level security;
alter table public.shopping_items enable row level security;

create policy "members read lists" on public.shopping_lists for select using (public.is_list_member(id));
create policy "owners update lists" on public.shopping_lists for update using (public.is_list_owner(id)) with check (public.is_list_owner(id));
create policy "owners delete lists" on public.shopping_lists for delete using (public.is_list_owner(id));
create policy "members read themselves" on public.list_members for select using (user_id = auth.uid());
create policy "members read items" on public.shopping_items for select using (public.is_list_member(list_id));
create policy "members add items" on public.shopping_items for insert with check (public.is_list_member(list_id));
create policy "members update items" on public.shopping_items for update using (public.is_list_member(list_id)) with check (public.is_list_member(list_id));
create policy "members delete items" on public.shopping_items for delete using (public.is_list_member(list_id));

create function public.create_shopping_list(list_name text) returns table(id uuid, invite_token uuid) language plpgsql security definer set search_path = public as $$
declare new_id uuid; new_token uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  insert into public.shopping_lists(name) values (trim(list_name)) returning shopping_lists.id into new_id;
  insert into public.list_members(list_id, user_id, role) values (new_id, auth.uid(), 'owner');
  insert into public.list_invites(list_id) values (new_id) returning token into new_token;
  return query select new_id, new_token;
end;
$$;

create function public.join_list_by_invite(invite_token uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select list_id into target_id from public.list_invites where token = invite_token;
  if target_id is null then raise exception 'Invalid or expired invite link'; end if;
  insert into public.list_members(list_id, user_id, role) values (target_id, auth.uid(), 'editor') on conflict do nothing;
  return target_id;
end;
$$;

create function public.get_list_invite(target_list_id uuid) returns uuid language sql stable security definer set search_path = public as $$
  select token from public.list_invites where list_id = target_list_id and public.is_list_owner(target_list_id);
$$;

grant execute on function public.create_shopping_list(text), public.join_list_by_invite(uuid), public.get_list_invite(uuid) to authenticated, anon;
alter publication supabase_realtime add table public.shopping_lists, public.shopping_items;
