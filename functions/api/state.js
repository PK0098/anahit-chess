import { json, handle } from '../_lib/http.js';
import { getSetting, listPlayers, listGames, publicPlayer, publicGame } from '../_lib/db.js';
import { sweep } from '../_lib/sweep.js';

export const onRequestGet = handle(async ({ env }) => {
  const db = env.DB;
  await sweep(db, env);
  const [phase, format, champion, players, games] = await Promise.all([
    getSetting(db, 'phase', 'registration'),
    getSetting(db, 'format', null),
    getSetting(db, 'champion', null),
    listPlayers(db),
    listGames(db),
  ]);
  return json({
    phase, format,
    champion: champion ? Number(champion) : null,
    closeDate: env.CLOSE_DATE,
    startDate: env.START_DATE,
    knockoutFrom: Number(env.KNOCKOUT_FROM || 12),
    confirmHours: Number(env.CONFIRM_HOURS || 48),
    players: players.map(publicPlayer),
    games: games.map(publicGame),
  });
});
