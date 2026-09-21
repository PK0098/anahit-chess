import { koNextRound } from './tournament.js';
import { getSetting, setSetting, listGames, listPlayers, nowIso } from './db.js';
import { sendMail, templates } from './mail.js';

// Auto-confirm stale reports, then (knockout) create the next round when a
// round is complete, emailing the advancing players. Safe to call on every request.
export async function sweep(db, env) {
  const hours = Number(env.CONFIRM_HOURS || 48);
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  await db.prepare("UPDATE games SET status = 'confirmed', confirmed_at = ? WHERE status = 'reported' AND reported_at < ?")
    .bind(nowIso(), cutoff).run();

  const format = await getSetting(db, 'format');
  const phase = await getSetting(db, 'phase');
  if (format !== 'ko' || phase !== 'play') return { advanced: [] };
  return advanceKnockout(db, env);
}

export async function advanceKnockout(db, env) {
  const games = await listGames(db);
  if (!games.length) return { advanced: [] };
  const lastRound = Math.max(...games.map((g) => g.round));
  const cur = games.filter((g) => g.round === lastRound);

  // Final decided?
  if (cur.length === 1 && cur[0].status === 'confirmed' && cur[0].p2 !== null) {
    const winner = cur[0].result === '1-0' ? cur[0].p1 : cur[0].result === '0-1' ? cur[0].p2 : null;
    if (winner) {
      await setSetting(db, 'champion', winner);
      await setSetting(db, 'phase', 'done');
      const players = await listPlayers(db);
      const champ = players.find((p) => p.id === winner);
      const t = templates.champion(env, { champion: champ });
      await Promise.all(players.map((p) => sendMail(env, { to: p.email, ...t })));
    }
    return { advanced: [] };
  }

  const next = koNextRound(games, lastRound);
  if (!next) return { advanced: [] };

  const stmt = db.prepare('INSERT INTO games (round, slot, p1, p2, status) VALUES (?, ?, ?, ?, ?)');
  await db.batch(next.map((g) => stmt.bind(g.round, g.slot, g.p1, g.p2, 'pending')));
  const created = (await listGames(db)).filter((g) => g.round === lastRound + 1);
  await emailPairings(db, env, created, 'ko', true);
  return { advanced: created };
}

// One email per player listing their games in `games`.
export async function emailPairings(db, env, games, format, isNextRound) {
  const players = await listPlayers(db);
  const byId = new Map(players.map((p) => [p.id, p]));
  const round = games.length ? games[0].round : 1;
  const perPlayer = new Map();
  for (const g of games) {
    for (const [me, other] of [[g.p1, g.p2], [g.p2, g.p1]]) {
      if (me === null || me === undefined) continue;
      const opp = other === null || other === undefined ? null : byId.get(other);
      if (!perPlayer.has(me)) perPlayer.set(me, []);
      perPlayer.get(me).push({ id: g.id, opponent: opp ? { name: opp.name, company: opp.company, email: opp.email } : null });
    }
  }
  await Promise.all([...perPlayer.entries()].map(([id, list]) => {
    const player = byId.get(id);
    if (!player) return null;
    const t = templates.pairings(env, { player, format, round, games: list, isNextRound });
    return sendMail(env, { to: player.email, ...t });
  }));
}
