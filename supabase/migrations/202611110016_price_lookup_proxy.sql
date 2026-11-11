-- 016 — Price lookup proxy (DECISIONS #40, 2026-11-11).
-- tcgapi.dev answers server-side calls fine but its CORS policy only allows
-- its own origin, so the browser app can never call it directly — every
-- lookup failed as "didn't answer" even with a valid key. These RPCs make
-- the call from inside the database via pg_net: the caller's OWN key is
-- passed through per call and never stored. Two steps because pg_net is
-- async and its worker takes a few seconds: start returns a request id,
-- result reports pending / the price payload / the service's real error.
create extension if not exists pg_net;

drop function if exists public.price_lookup(text, text);

create or replace function public.price_lookup_start(p_name text, p_key text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  req_id bigint;
  enc text;
begin
  if coalesce(trim(p_key), '') = '' then
    raise exception 'No API key given.';
  end if;
  enc := replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(p_name,
    '%', '%25'), ' ', '%20'), '&', '%26'), '+', '%2B'), '#', '%23'), '?', '%3F'), '''', '%27'), '"', '%22'), '<', '%3C'), '>', '%3E');
  select net.http_get(
    url := 'https://api.tcgapi.dev/v1/search?q=' || enc || '&game=pokemon&per_page=10',
    headers := jsonb_build_object('X-API-Key', p_key, 'Accept', 'application/json'),
    timeout_milliseconds := 10000
  ) into req_id;
  return req_id;
end
$$;

create or replace function public.price_lookup_result(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resp record;
  msg text;
begin
  select status_code, content, error_msg into resp from net._http_response where id = p_id;
  if not found then
    return jsonb_build_object('state', 'pending');
  end if;
  if resp.status_code = 200 then
    return jsonb_build_object('state', 'done', 'ok', true, 'body', resp.content::jsonb);
  end if;
  begin
    msg := (resp.content::jsonb) -> 'error' ->> 'message';
  exception when others then
    msg := null;
  end;
  return jsonb_build_object('state', 'done', 'ok', false,
    'status', coalesce(resp.status_code, 0),
    'error', coalesce(msg, resp.error_msg, 'No answer from the price service.'));
end
$$;

revoke all on function public.price_lookup_start(text, text) from public;
revoke all on function public.price_lookup_result(bigint) from public;
grant execute on function public.price_lookup_start(text, text) to anon, authenticated;
grant execute on function public.price_lookup_result(bigint) to anon, authenticated;
