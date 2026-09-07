-- Permanent identities share memberships across devices. Existing guest data stays intact.
create function public.has_permanent_session() returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
$$;

-- Restrictive policies also apply alongside the existing membership policies.
create policy "permanent sessions only" on public.shopping_lists
  as restrictive for all to public
  using (public.has_permanent_session())
  with check (public.has_permanent_session());

create policy "permanent sessions only" on public.list_members
  as restrictive for all to public
  using (public.has_permanent_session())
  with check (public.has_permanent_session());

create policy "permanent sessions only" on public.list_invites
  as restrictive for all to public
  using (public.has_permanent_session())
  with check (public.has_permanent_session());

create policy "permanent sessions only" on public.shopping_items
  as restrictive for all to public
  using (public.has_permanent_session())
  with check (public.has_permanent_session());

create or replace function public.is_list_member(target_list_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permanent_session() and exists(
    select 1 from public.list_members
    where list_id = target_list_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_list_owner(target_list_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permanent_session() and exists(
    select 1 from public.list_members
    where list_id = target_list_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.create_shopping_list(list_name text) returns table(id uuid, invite_token uuid) language plpgsql security definer set search_path = public as $$
declare new_id uuid; new_token uuid;
begin
  if not public.has_permanent_session() then raise exception 'Sign in with Google is required'; end if;
  insert into public.shopping_lists(name) values (trim(list_name)) returning shopping_lists.id into new_id;
  insert into public.list_members(list_id, user_id, role) values (new_id, auth.uid(), 'owner');
  insert into public.list_invites(list_id) values (new_id) returning token into new_token;
  return query select new_id, new_token;
end;
$$;

create or replace function public.join_list_by_invite(invite_token uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare target_id uuid;
begin
  if not public.has_permanent_session() then raise exception 'Sign in with Google is required'; end if;
  select list_id into target_id from public.list_invites where token = invite_token;
  if target_id is null then raise exception 'Invalid or expired invite link'; end if;
  insert into public.list_members(list_id, user_id, role) values (target_id, auth.uid(), 'editor') on conflict do nothing;
  return target_id;
end;
$$;

create or replace function public.get_shopping_list(target_list_id uuid)
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  updated_at timestamptz,
  role public.list_role
)
language sql
stable
security definer
set search_path = public
as $$
  select lists.id, lists.name, lists.created_at, lists.updated_at, members.role
  from public.shopping_lists as lists
  join public.list_members as members on members.list_id = lists.id
  where public.has_permanent_session() and lists.id = target_list_id and members.user_id = auth.uid();
$$;
