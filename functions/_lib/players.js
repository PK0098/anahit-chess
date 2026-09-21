import { bad } from './http.js';
import { listPlayers } from './db.js';

// Resolve a player by personal token. Throws 404 if unknown.
export async function playerByToken(db, token) {
  if (!token || typeof token !== 'string' || token.length > 64) throw bad('Unknown player link', 404);
  const players = await listPlayers(db);
  const me = players.find((p) => p.token === token);
  if (!me) throw bad('Unknown player link', 404);
  return { me, players, byId: new Map(players.map((p) => [p.id, p])) };
}

export async function gameForPlayer(db, gameId, me) {
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw bad('Unknown game', 404);
  const g = await db.prepare('SELECT * FROM games WHERE id = ?').bind(id).first();
  if (!g || (g.p1 !== me.id && g.p2 !== me.id)) throw bad('Unknown game', 404);
  return g;
}
