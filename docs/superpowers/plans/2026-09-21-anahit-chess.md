# Anahit Chess Tournament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static preview into a working tournament site with registration, automatic pairing, emailed result reporting, live standings/bracket and a one-key admin page, deployed on Cloudflare Pages + D1.

**Architecture:** Static `web/` served by Cloudflare Pages; API in `functions/api/**` (Pages Functions) using a D1 binding `DB`; pure tournament logic in `functions/_lib/tournament.js` unit-tested with `node --test`; Resend for email via `functions/_lib/mail.js`.

**Tech Stack:** Cloudflare Pages Functions (Workers runtime), D1 (SQLite), Resend REST, vanilla HTML/CSS/JS, wrangler 4, Node 24 for tests.

**Spec:** `docs/superpowers/specs/2026-09-21-anahit-chess-design.md`

## Global Constraints

- No build step, no npm runtime dependencies; `wrangler` is the only devDependency.
- Emails and tokens never appear in public API responses.
- Domain/sender/thresholds only in `wrangler.toml` `[vars]`; secrets `RESEND_API_KEY`, `ADMIN_KEY` via `wrangler pages secret put`.
- Results stored from p1's perspective: `'1-0' | '0-1' | '1/2'`.
- Auto-confirm window `CONFIRM_HOURS` = 48. Knockout threshold `KNOCKOUT_FROM` = 12.
- Commit after each task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Scaffold, config, schema, Cloudflare resources

**Files:**
- Create: `package.json`, `wrangler.toml`, `schema.sql`, `functions/_lib/http.js`, `functions/_lib/db.js`
- Modify: `.gitignore` (add `node_modules/`, `.wrangler/`, `.dev.vars`)

**Interfaces produced:**
- `http.js`: `json(data, status=200, headers={})`, `bad(msg, status=400)`, `readJson(request)` (throws `bad` on invalid), `requireAdmin(request, env)` (throws 401 `bad`), `handle(fn)` wrapper that catches thrown Responses/errors and returns them.
- `db.js`: `getSetting(db, key, fallback)`, `setSetting(db, key, value)`, `listPlayers(db)` → rows ordered by id with `code` added (`'P'+String(index+1).padStart(2,'0')`), `listGames(db)`, `nowIso()`.

- [ ] Step 1: `package.json` with scripts `test: node --test tests/`, `dev: wrangler pages dev`, `deploy: wrangler pages deploy`; devDependency `wrangler ^4`.
- [ ] Step 2: `wrangler.toml`:
```toml
name = "anahit-chess"
compatibility_date = "2026-09-01"
pages_build_output_dir = "web"
[vars]
SITE_URL = "https://anahit-chess.pages.dev"
MAIL_FROM = "Anahit Chess <onboarding@resend.dev>"
ADMIN_EMAIL = "pya.karimi@gmail.com"
KNOCKOUT_FROM = "12"
CONFIRM_HOURS = "48"
CLOSE_DATE = "2026-09-30T23:59:59+04:00"
START_DATE = "2026-10-01"
[[d1_databases]]
binding = "DB"
database_name = "anahit-chess"
database_id = "<filled after wrangler d1 create>"
```
- [ ] Step 3: `schema.sql` per spec, plus `INSERT OR IGNORE INTO settings VALUES ('phase','registration');`.
- [ ] Step 4: `npx wrangler d1 create anahit-chess` → paste id into toml; `npx wrangler d1 execute anahit-chess --remote --file schema.sql`; `npx wrangler pages project create anahit-chess --production-branch main`.
- [ ] Step 5: Commit.

### Task 2: Tournament logic (pure, tested)

**Files:**
- Create: `functions/_lib/tournament.js`, `tests/tournament.test.js`

**Interfaces produced:**
```js
export function rrPairings(ids)            // [{round:1, slot, p1, p2}] all pairs once
export function koBracket(ids, rand=Math.random) // {size, games:[{round:1, slot, p1, p2|null}]} byes first
export function koNextRound(games, round)  // null if round incomplete, else [{round: round+1, slot, p1, p2}]
export function winnerOf(game)             // p1|p2|null ('1/2' → null)
export function standings(players, games)  // [{id, played, w, d, l, points, form:[...last5 'W'|'D'|'L']}] sorted
export function toP1Result(youAre, outcome) // ('p1'|'p2', 'win'|'loss'|'draw') → '1-0'|'0-1'|'1/2'
export function decideFormat(n, knockoutFrom) // 'rr'|'ko'
export function validateRegistration(body) // → {name, company, email, photo|null} or throws Error(message)
```

- [ ] Step 1: Write tests: rr count `n(n-1)/2`, no self pairs, unique pairs; ko with 5 players → size 8, 3 byes in slots 0..2, 4 games; `koNextRound` returns null when a game pending, pairs winners by slot parity, bye winner advances; standings: 3/1/0, sort points then wins, form last 5 by `confirmed_at`; `toP1Result('p2','win')==='0-1'`; `decideFormat(12,12)==='ko'`, `(11,12)==='rr'`; validation rejects bad email, empty name, oversize photo, non-image data URL, defaults company to `Freelance`.
- [ ] Step 2: Run `npm test`, expect failures (module missing).
- [ ] Step 3: Implement. ko byes: `byes = size - n`; slots `0..byes-1` get `{p1: ids[i], p2: null}`; remaining ids fill slots pairwise. Advancement: winners grouped by `Math.floor(slot/2)`; even slot → p1, odd → p2.
- [ ] Step 4: `npm test` green. Commit.

### Task 3: Mail module

**Files:**
- Create: `functions/_lib/mail.js`

**Interfaces produced:**
```js
export async function sendMail(env, {to, subject, html, text, replyTo})  // returns {ok, id|error}; never throws
export const templates = { welcome, pairings, reported, confirmed, dispute, champion } // each (env, data) → {subject, html, text}
```
- [ ] Step 1: `sendMail` POSTs to `https://api.resend.com/emails` with `Authorization: Bearer env.RESEND_API_KEY`, `from: env.MAIL_FROM`. Log failures with `console.error`.
- [ ] Step 2: Templates as plain string builders; shared `layout(title, bodyHtml)` with the site's cream/ink/orange colors inline. Links built from `env.SITE_URL`.
- [ ] Step 3: Commit.

### Task 4: Public API — state, photo, register

**Files:**
- Create: `functions/api/state.js`, `functions/api/photo/[id].js`, `functions/api/register.js`, `functions/_lib/sweep.js`

**Interfaces produced:**
- `sweep.js`: `export async function sweep(db, env)` — auto-confirms stale reports, then if format ko creates the next round when complete (calls `koNextRound`), sets champion/done after the final. Returns `{advanced: [newGames]}` so callers can email.
- `GET /api/state`, `GET /api/photo/:id`, `POST /api/register` as in spec.

- [ ] Step 1: `state.js`: `await sweep()`, then read settings, players (strip email/token/photo → `hasPhoto`), games; respond with vars from env.
- [ ] Step 2: `photo/[id].js`: parse data URL `data:<mime>;base64,<b64>`, return bytes with mime and cache header; 404 if none.
- [ ] Step 3: `register.js`: phase check → 403; `validateRegistration`; insert with `token = crypto.randomUUID()`; on UNIQUE violation → 409; send `welcome`; 201 `{id, code}`.
- [ ] Step 4: Local test with `npx wrangler pages dev web --d1 DB=anahit-chess` and `curl`. Commit.

### Task 5: Player API — me, report, confirm

**Files:**
- Create: `functions/api/me.js`, `functions/api/report.js`, `functions/api/confirm.js`

- [ ] Step 1: `me.js`: find player by token (404 otherwise), games where p1 or p2 = id, join opponent public fields, compute `youAre`, `canReport = status in (pending) or (status=reported and reported_by=me)`, `canConfirm = status=reported and reported_by!=me`.
- [ ] Step 2: `report.js`: validate token+game ownership; refuse if confirmed/disputed; refuse draw when format ko; set result/status/reported_by/reported_at; email opponent `reported`.
- [ ] Step 3: `confirm.js`: validate; must be `reported` and not the reporter; `confirm` → confirmed, email both `confirmed`, then `sweep` to advance ko and email new pairings; `dispute` → disputed, email admin.
- [ ] Step 4: curl through a full cycle locally. Commit.

### Task 6: Admin API

**Files:**
- Create: `functions/api/admin/overview.js`, `close.js`, `resolve.js`, `remove.js`, `test-email.js`

- [ ] Step 1: all use `requireAdmin`. `overview` returns everything incl. emails.
- [ ] Step 2: `close`: 409 if phase != registration; n<2 → 400; `decideFormat`; insert games (rr all, or ko round 1 with byes confirmed as `1-0`); `setSetting format`, `phase=play`; per player send `pairings` template with opponent emails + game links.
- [ ] Step 3: `resolve`: set result, status confirmed, confirmed_at; then `sweep` and email.
- [ ] Step 4: `remove`: registration phase only; delete player.
- [ ] Step 5: `test-email`: `sendMail` to given address, return raw result.
- [ ] Step 6: Commit.

### Task 7: Frontend wiring

**Files:**
- Modify: `web/app.js`, `web/index.html`, `web/styles.css`, `web/data.js`

- [ ] Step 1: `app.js`: `loadState()` → fetch `/api/state`; on failure use `MOCK` shaped the same (`players`, `games`) and honor `?phase=`. Registration and play renderers consume `{players, games, format}`; compute standings client-side with the same rules (copy of `standings` logic; kept small).
- [ ] Step 2: Register form: `resizeImage(file, 240)` via canvas → JPEG data URL quality 0.8; POST `/api/register`; handle 409/400/403 inline (`.form-error` element); on 201 show done card + toast.
- [ ] Step 3: Bracket section `#bracket` (play, ko): columns per round; each game card shows both players (or "bye"), winner bold, pending greyed. Nav link text switches to "Bracket". Hide standings when ko.
- [ ] Step 4: Player tiles: `hasPhoto ? background-image: url(/api/photo/ID)`.
- [ ] Step 5: `done` phase: champion banner under hero.
- [ ] Step 6: Visual check desktop + mobile in built-in browser via `wrangler pages dev`. Commit.

### Task 8: Game page

**Files:**
- Create: `web/game.html`, `web/game.js`; `web/_redirects` with `/me  /game.html  302` (query preserved).

- [ ] Step 1: Reads `t`, `g` from URL; fetch `/api/me?t=`; render header card for the player; the game `g` (if present) highlighted at top with actions; other games listed below with their links.
- [ ] Step 2: Actions POST to `/api/report` / `/api/confirm`; re-fetch after; show state text ("Waiting for {name} to confirm", "Confirmed", "Disputed — the organizer will settle it").
- [ ] Step 3: Same design tokens as index (reuse `styles.css` + a few page-specific rules). Mobile-first since it opens from email. Commit.

### Task 9: Admin page

**Files:**
- Create: `web/admin.html`, `web/admin.js`

- [ ] Step 1: Key prompt → `sessionStorage.adminKey`; all fetches send `Authorization: Bearer`.
- [ ] Step 2: Overview: phase/format/counts; players table (code, name, company, email, remove button in registration); games table (round, players, status, result, resolve select + button); "Close registration & create pairings" with `confirm()`; test-email input.
- [ ] Step 3: Commit.

### Task 10: Deploy and smoke test

- [ ] Step 1: `npx wrangler pages secret put RESEND_API_KEY` (pipe from env var), `ADMIN_KEY` (generate 32 hex chars, store in memory file for Pouya).
- [ ] Step 2: `npx wrangler pages deploy` → note `*.pages.dev` URL; set `SITE_URL` var to it; redeploy.
- [ ] Step 3: Smoke: register two players (to Pouya's own Resend email since domain unverified), admin close, report, confirm, standings show. Reset DB after (`DELETE FROM games; DELETE FROM players; UPDATE settings SET value='registration' WHERE key='phase'`).
- [ ] Step 4: Push `main`; retire gh-pages preview note in README. Commit.
