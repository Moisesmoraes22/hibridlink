-- One ended offer (no longer active), so its page can say "oferta encerrada" and suggest similar
-- ones instead of a bare 404. The public read policy only releases active offers, so this is a
-- narrow door: a single id, and only fields that were already public while the offer was live.
-- The affiliate link is NOT returned (a stale link must not be offered).
create or replace function public.closed_offer(offer_id uuid)
returns table (
  id uuid,
  store_id text,
  title text,
  image text,
  category_slug text,
  price numeric,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.store_id::text, o.title, o.image, o.category_slug, o.price, o.last_seen_at
  from public.offers o
  where o.id = offer_id and not o.is_active
$$;

revoke all on function public.closed_offer(uuid) from public;
grant execute on function public.closed_offer(uuid) to anon, authenticated;
