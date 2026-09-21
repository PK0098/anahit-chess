# Anahit Friendly Chess Tournament — Design Spec

Date: 2026-09-21. Owner: Pouya. Status: approved in chat (automation level B, Cloudflare stack, 48h auto-confirm).

## Goal

A low-maintenance tournament site for the Anahit coworking space. People register via a QR flyer, the site decides the format from headcount, pairs players, emails them, lets them report results, and shows live standings or a bracket. Pouya only presses "close registration" and settles disputes.

## Non-goals (first run)

Accounts/passwords, double elimination, waitlist, editing your own card, multiple simultaneous tournaments, i18n, analytics.

## Stack

- Cloudflare Pages project `anahit-chess`: static site from `web/`, API as Pages Functions in `functions/`.
- Cloudflare D1 database `anahit-chess` bound as `DB`.
- Resend REST API for email (send-only key).
- No build step, no framework. Plain HTML/CSS/JS front, plain JS functions. Node `node --test` for unit tests of pure logic.

## Configuration

Vars in `wrangler.toml` `[vars]`: `SITE_URL` (e.g. `https://chess.doost.store`), `MAIL_FROM` (`Anahit Chess <chess@doost.store>`), `ADMIN_EMAIL`, `KNOCKOUT_FROM` (12), `CONFIRM_HOURS` (48), `CLOSE_DATE` (`2026-09-30T23:59:59+04:00`), `START_DATE` (`2026-10-01`).
Secrets: `RESEND_API_KEY`, `ADMIN_KEY`.
Domain and sender must be changeable by editing vars only.

## Data model (D1)

```sql
settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);           -- phase: registration|play|done ; format: rr|ko ; champion: player id
players(id INTEGER PRIMARY KEY, name TEXT NOT NULL, company TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE, photo TEXT,   -- data URL (<=60KB) or NULL
        token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
games(id INTEGER PRIMARY KEY, round INTEGER NOT NULL, slot INTEGER NOT NULL,
      p1 INTEGER NOT NULL, p2 INTEGER,                            -- p2 NULL = bye (ko only)
      result TEXT,                                                -- '1-0' | '0-1' | '1/2' (p1 perspective)
      status TEXT NOT NULL DEFAULT 'pending',                     -- pending|reported|confirmed|disputed
      reported_by INTEGER, reported_at TEXT, confirmed_at TEXT);
```

Player public code is `P` + zero-padded id order (position in `ORDER BY id`).

## Phases

- `registration` (default): landing shows register card, field so far, countdown. `POST /api/register` open.
- `play`: landing shows standings (rr) or bracket (ko), players grid. Registration closed.
- `done`: same as play plus champion banner. No further reports.

Phase flips only via admin action, never by clock. The countdown is informational.

## Format decision (at close)

`n = players count`. `n < 2` → refuse to close. `n >= KNOCKOUT_FROM` → `ko`, else `rr`.

- **rr**: every pair once, all games `round = 1`, `slot` = sequential. Scoring 3/1/0. Sort by points, then wins, then head-to-head ignored (ties shown as ties).
- **ko**: single elimination. Players shuffled, bracket size `B = 2^ceil(log2 n)`. Round 1 has `B/2` slots; the first `B - n` slots are byes (p2 NULL, status confirmed, result `1-0`). Winners advance to round `r+1`, slot `floor(slot/2)`, position by slot parity. When every game of a round is confirmed the next round is created and pairing emails sent. When the final is confirmed, `champion` is set and phase becomes `done`. Draws are not allowed in ko: the report form offers won/lost only.

## Result flow

1. Either player opens their game link `/game?t=<token>&g=<id>` and reports won / lost / (draw if rr).
2. Game becomes `reported`; opponent is emailed a confirm/dispute link (same page).
3. Opponent confirms → `confirmed`. Disputes → `disputed`, admin emailed.
4. Reports left `reported` for more than `CONFIRM_HOURS` are auto-confirmed lazily: every `GET /api/state` and every confirm/report call first runs `UPDATE games SET status='confirmed', confirmed_at=now WHERE status='reported' AND reported_at < now - CONFIRM_HOURS`, then, in ko, advances rounds if complete.
5. Admin can set/override any game's result (`resolve`), which confirms it.
6. Reporting on a game that is already `confirmed` is refused. The reporter cannot confirm their own report.

## API (Pages Functions, JSON)

Public:
- `GET /api/state` → `{phase, format, closeDate, startDate, knockoutFrom, champion, players:[{id,code,name,company,hasPhoto}], games:[{id,round,slot,p1,p2,result,status,confirmedAt}]}`. Emails and tokens never leave the server.
- `GET /api/photo/:id` → image bytes (from data URL), `Cache-Control: public, max-age=86400`.
- `POST /api/register` `{name, company, email, photo?}` → `201 {id, code}`. Errors: `403 closed`, `409 duplicate email`, `400 validation` (name 1–40 chars, company ≤40 (empty → "Freelance"), valid email, photo data URL ≤ 80,000 chars and `image/jpeg|png|webp`).
- `GET /api/me?t=<token>` → `{player:{id,code,name,company}, games:[{id,round,opponent:{id,code,name,company}, result, status, youAre:'p1'|'p2', canReport, canConfirm}]}`.
- `POST /api/report` `{t, g, result: 'win'|'loss'|'draw'}` → 200. Converts to p1-perspective result.
- `POST /api/confirm` `{t, g, action:'confirm'|'dispute'}` → 200.

Admin (`Authorization: Bearer <ADMIN_KEY>`; 401 otherwise):
- `GET /api/admin/overview` → full players (with emails) + games + settings.
- `POST /api/admin/close` → decides format, creates games, sends pairing emails, phase=play. 409 if already closed.
- `POST /api/admin/resolve` `{g, result:'1-0'|'0-1'|'1/2'}` → confirms, advances ko if needed.
- `POST /api/admin/remove` `{id}` → deletes a player (registration phase only).
- `POST /api/admin/test-email` `{to}` → sends a test email, returns Resend response.

## Emails (Resend, HTML + text)

1. **Welcome** (on register): "You're on the board, {first}. Card {code}." Link to `/me?t=`. Registration closes {date}, games start {date}.
2. **Pairings** (on close, one per player): format announced; list of opponents with each opponent's email and a "report result" link per game. In ko, only the current round's opponent (or "you have a bye").
3. **Next round** (ko, per advancing player): same shape as pairings.
4. **Result reported** (to opponent): "{name} reported {outcome}. Confirm or dispute:" link. Mentions 48h auto-confirm.
5. **Result confirmed** (to both): final score, link to standings.
6. **Dispute** (to ADMIN_EMAIL): game, both players' emails, both claims, admin link.
7. **Champion** (ko final, to all players): winner announcement.

All emails: reply-to is the other player's address where a pair exists, so "reply" arranges the game. Sender `MAIL_FROM`. Failures are logged and never fail the API call except `test-email`.

## Frontend

- `web/index.html` + `styles.css` + `app.js`: existing design. `app.js` fetches `/api/state` on load; if that fails (e.g. GitHub Pages preview) it falls back to `data.js` mock so the preview keeps working. Phase from the API; `?phase=` override only when running on mock.
- Register form posts to `/api/register`; photo is resized client-side to 240×240 JPEG (~15–40KB) before sending. Shows the done card and toast on 201; inline error text on 4xx.
- Play phase, format `rr`: standings section as today, computed from confirmed games. Format `ko`: standings section replaced by a bracket section (columns per round, cards per game, winner bold, byes greyed). Nav label "[2] Bracket".
- Player tiles show photo when present (`/api/photo/:id`), otherwise initials.
- `web/game.html`: reads `t` and `g`, calls `/api/me`, shows the game, buttons to report / confirm / dispute, states after action. Also lists the player's other games (acts as the "me" page; `/me?t=` redirects here).
- `web/admin.html`: asks for the key once (stored in `sessionStorage`), then shows: phase, counts, players table (email, remove in registration), games table with resolve controls, big "Close registration & pair" button with confirmation, test-email box.
- Footer preview links removed in production build (they stay harmless: `?phase=` is ignored when API is live).

## Deploy

- `wrangler.toml` at repo root with `pages_build_output_dir = "web"`, D1 binding, vars.
- `schema.sql` applied with `wrangler d1 execute anahit-chess --remote --file schema.sql`.
- Deploy with `wrangler pages deploy` from repo root. Custom domain `chess.doost.store` added when DNS is on Cloudflare.
- GitHub `main` is the source of truth; `gh-pages` branch preview is retired once the Pages URL exists.

## Testing

- Unit tests (`node --test tests/`): pairing generation (rr count = n(n-1)/2, no self pairs, each pair once), ko bracket (bye count, slot math, advancement, champion), standings sort (points then wins), auto-confirm cutoff, result perspective conversion, register validation.
- Manual smoke after deploy: register two test players, close, report, confirm, check standings; ko path with `KNOCKOUT_FROM=2` on a scratch DB.

## Success criteria

A stranger can scan the flyer, register with a photo on a phone in under a minute, get an email, and later report a result from that email without any help. Pouya's total interaction: one click to close registration, plus disputes.
