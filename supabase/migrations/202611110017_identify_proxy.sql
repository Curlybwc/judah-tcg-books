-- 017 — Photo identification proxy (DECISIONS #43, 2026-11-11).
-- Same CORS story as #40: tcgapi.dev's POST /v1/identify (photo → exact
-- catalog name + prices, billed in scans) is unreachable from the browser,
-- so the call starts here via pg_net and is polled with the existing
-- price_lookup_result. The photo goes as a JSON data URL (their API
-- accepts base64/data-URL JSON bodies); the caller's own key passes
-- through per call and is never stored. Nothing about the photo is kept.
create or replace function public.identify_start(p_image text, p_key text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  req_id bigint;
begin
  if coalesce(trim(p_key), '') = '' then
    raise exception 'No API key given.';
  end if;
  if p_image is null or length(p_image) < 100 then
    raise exception 'No photo given.';
  end if;
  select net.http_post(
    url := 'https://api.tcgapi.dev/v1/identify?game=pokemon&include=prices',
    body := jsonb_build_object('image', p_image),
    headers := jsonb_build_object('X-API-Key', p_key, 'Content-Type', 'application/json', 'Accept', 'application/json'),
    timeout_milliseconds := 30000
  ) into req_id;
  return req_id;
end
$$;

revoke all on function public.identify_start(text, text) from public;
grant execute on function public.identify_start(text, text) to anon, authenticated;
