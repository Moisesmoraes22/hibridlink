# Personal data inventory (technical, not legal text)

What the application stores once accounts exist, why, and where. This is the factual base for a future Privacy
Policy; it is not that policy. Items marked **TBD** need a decision by the project owner.

## Stored for signed-in users (Supabase project)

| Data | Where | Purpose | Notes |
|---|---|---|---|
| E-mail address | `auth.users.email` | Sign in, account confirmation, password recovery | Shown on `/conta` and in the account menu |
| Password | `auth.users.encrypted_password` | Sign in | Hashed by Supabase Auth; the application never sees or stores it |
| Name | `auth.users.raw_user_meta_data.full_name` (sent at sign-up) | Greeting on `/conta`, avatar initial | Free text typed by the user |
| User id (UUID) | `auth.users.id` | Links the account to its favorites | |
| Account timestamps | `auth.users` (`created_at`, `email_confirmed_at`, `last_sign_in_at`, confirmation/recovery sent-at) | Account lifecycle, abuse investigation | Maintained by Supabase |
| Sessions and refresh tokens (may include IP and user agent) | `auth.sessions`, `auth.refresh_tokens` | Keep the user signed in; revoke on sign-out | Maintained by Supabase; retention **TBD** (Dashboard setting) |
| Favorites | `public.favorites` (`user_id`, `offer_id`, `created_at`) | Show the same favorites on every device | Only offer ids and when they were saved; no browsing history |

Never collected: phone, address, date of birth, payment data, photo, profile text.

## Stored in the browser (visitors and signed-in users)

| Key / cookie | Content | Purpose |
|---|---|---|
| `hibridlink:favorites` (localStorage) | Copies of the favorited offers (title, image, price, store, link) | Favorites for visitors; offline copy for everyone |
| `ezoom:requests` (localStorage) | Search terms the visitor asked the site to find ("Pedir este produto") and when, up to 10, forgotten after 30 days | To tell the visitor, on a later visit, that the request was answered; never sent anywhere except the term itself |
| `public.product_requests` (database) | The normalised search term, how many times it was requested, status. No user id, no IP, no e-mail | To decide what the collector searches next. Search terms typed by visitors are free text: do not store a term that looks like a link (the database refuses it) |
| `hibridlink:favorites-pending` | Offer ids whose removal is not confirmed by the account yet | Do not resurrect a removed favorite during sync |
| `hibridlink:favorites-account` | Offer ids known to be in the account | Remove the account's favorites from the device on sign-out |
| `hl-theme`, `hl-recent-searches` | Theme choice; last search terms | Convenience |
| `sb-<project>-auth-token` (cookie) | Supabase session (access and refresh token) | Keep the user signed in; read by the server on account pages |

The session cookie is set by `@supabase/ssr`; the browser client must be able to read it, so it is not `HttpOnly`.

## Processors and third parties

- **Supabase**: Auth, database and logs (region **TBD**; check Dashboard > Project Settings).
- **Vercel**: hosting and request logs.
- **E-mail provider**: currently Supabase's built-in sender; **TBD** when custom SMTP is configured.
- **Mercado Livre / Amazon / Shopee**: receive the visitor only when they click "Ver oferta" (affiliate links).

## Analytics and tracking

Vercel Web Analytics (`<Analytics />` in `src/app/layout.tsx`) is the only analytics: cookieless, aggregated
page views, referrers, device and browser; no custom events. No advertising or click-tracking scripts; `OfferLink`
has no tracking. If any is added, this inventory and the
policy must be updated first.

## Deletion

Deleting the Auth user removes `public.favorites` rows automatically (`ON DELETE CASCADE`). Today deletion is manual by
the project owner (see `auth-setup.md`, "Exclusão de conta").

## Decisions for the policy author

Controller identity and contact channel; retention of Auth logs and sessions; data location; legal basis for each
purpose; how a user requests access or deletion; cookie/storage notice wording.
