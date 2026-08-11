create function public.get_shopping_list(target_list_id uuid)
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
  where lists.id = target_list_id and members.user_id = auth.uid();
$$;

grant execute on function public.get_shopping_list(uuid) to authenticated, anon;
