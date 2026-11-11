-- Migration 012 — join_book_set: its RETURNS TABLE column name `set_id`
-- collided with the book_members column in the ON CONFLICT clause
-- (42702 ambiguous, caught by the two-user caller proof). OUT parameters
-- renamed; behavior identical.
drop function if exists public.join_book_set(text);
create or replace function public.join_book_set(p_code text)
returns table (joined_set_id uuid, joined_set_name text)
language plpgsql security definer set search_path = public as $$
declare s public.book_sets;
begin
  select * into s from public.book_sets where join_code = upper(trim(p_code));
  if s.id is null then
    raise exception 'That join code does not match any set of books.';
  end if;
  insert into public.book_members (set_id, user_id, email, role)
  values (s.id, auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'member')
  on conflict (set_id, user_id) do nothing;
  return query select s.id, s.name;
end $$;
revoke execute on function public.join_book_set(text) from public, anon;
grant execute on function public.join_book_set(text) to authenticated;
