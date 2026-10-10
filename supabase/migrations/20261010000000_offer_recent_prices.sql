-- Last recorded prices of every live offer that has two or more, in ONE request.
-- The site used to read the whole price_history table page by page (up to 40 requests per page
-- build, and it stopped at 40,000 rows). This returns a single JSON value, so PostgREST's
-- 1000-row cap does not apply. Runs with the caller's rights: price_history and offers are
-- already public-read through RLS, nothing new is exposed.
create or replace function public.offer_recent_prices(per_offer integer default 8)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('offer_id', offer_id, 'prices', prices, 'last_at', last_at)),
    '[]'::jsonb
  )
  from (
    select h.offer_id,
           array_agg(h.price order by h.recorded_at, h.id) as prices, -- oldest first
           max(h.recorded_at) as last_at
    from (
      select ph.offer_id, ph.price, ph.recorded_at, ph.id,
             row_number() over (partition by ph.offer_id order by ph.recorded_at desc, ph.id desc) as rn,
             count(*) over (partition by ph.offer_id) as n
      from public.price_history ph
      join public.offers o on o.id = ph.offer_id and o.is_active
    ) h
    where h.n >= 2 and h.rn <= least(greatest(per_offer, 2), 20)
    group by h.offer_id
  ) t
$$;

revoke all on function public.offer_recent_prices(integer) from public;
grant execute on function public.offer_recent_prices(integer) to anon, authenticated;
