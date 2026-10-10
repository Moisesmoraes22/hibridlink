-- "Peça este produto": what visitors searched for and did not find. The collector reads the
-- pending ones, searches the stores for them and marks each as fulfilled (with how many offers
-- it found) or empty. No personal data: only the normalised search term and a counter.
create table if not exists public.product_requests (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,                 -- normalised: lowercase, no accents
  display_term text not null,                -- as the visitor typed it (trimmed)
  requests integer not null default 1,
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'empty')),
  found integer not null default 0,
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create index if not exists product_requests_pending_idx
  on public.product_requests (requests desc, last_requested_at desc)
  where status = 'pending';

-- Nobody reads or writes the table directly: only the two functions below (and the collector,
-- with the service key, which bypasses RLS).
alter table public.product_requests enable row level security;

-- Registers (or counts again) a request. The term must already be normalised by the caller;
-- the shape is checked here too, so a direct call cannot store anything else.
create or replace function public.request_product(p_term text, p_display text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t text := lower(btrim(p_term));
  d text := left(btrim(p_display), 80);
  row_ public.product_requests;
begin
  if t !~ '^[a-z0-9][a-z0-9 .+/-]{2,59}$' or t ~ '(http|www\.|\.com)' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  insert into public.product_requests as r (term, display_term)
  values (t, d)
  on conflict (term) do update
    set requests = r.requests + 1,
        last_requested_at = now(),
        -- an "empty" answer is tried again after a week
        status = case when r.status = 'empty' and r.fulfilled_at < now() - interval '7 days'
                      then 'pending' else r.status end
  returning * into row_;

  return jsonb_build_object('ok', true, 'status', row_.status, 'found', row_.found, 'requests', row_.requests);
end;
$$;

-- Status of up to 10 terms, for the visitor's own browser to show "your request was answered".
create or replace function public.request_status(p_terms text[])
returns table (term text, status text, found integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.term, r.status, r.found
  from public.product_requests r
  where r.term = any (p_terms[1:10])
$$;

revoke all on function public.request_product(text, text) from public;
revoke all on function public.request_status(text[]) from public;
grant execute on function public.request_product(text, text) to anon, authenticated;
grant execute on function public.request_status(text[]) to anon, authenticated;
