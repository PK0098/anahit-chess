import { json, bad, handle, requireAdmin } from '../../_lib/http.js';
import { getSetting, setSetting, listPlayers, listGames, nowIso } from '../../_lib/db.js';
import { decideFormat, rrPairings, koBracket } from '../../_lib/tournament.js';
import { emailPairings } from '../../_lib/sweep.js';

export const onRequestPost = handle(async ({ request, env }) => {
  requireAdmin(request, env);
  const db = env.DB;
  if ((await getSetting(db, 'phase')) !== 'registration') throw bad('Registration is already closed', 409);
  const players = await listPlayers(db);
  if (players.length < 2) throw bad('Need at least 2 players', 400);

  const ids = players.map((p) => p.id);
  const format = decideFormat(ids.length, Number(env.KNOCKOUT_FROM || 12));
  const games = format === 'ko' ? koBracket(ids).games : rrPairings(ids);

  const stmt = db.prepare('INSERT INTO games (round, slot, p1, p2, status, result, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  await db.batch(games.map((g) => g.p2 === null
    ? stmt.bind(g.round, g.slot, g.p1, null, 'confirmed', '1-0', nowIso())
    : stmt.bind(g.round, g.slot, g.p1, g.p2, 'pending', null, null)));
  await setSetting(db, 'format', format);
  await setSetting(db, 'phase', 'play');

  const created = await listGames(db);
  await emailPairings(db, env, created, format, false);
  return json({ ok: true, format, players: ids.length, games: created.length });
});
