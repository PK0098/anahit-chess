import { json, handle, requireAdmin } from '../../_lib/http.js';
import { listPlayers, listGames } from '../../_lib/db.js';
import { sweep } from '../../_lib/sweep.js';

export const onRequestGet = handle(async ({ request, env }) => {
  requireAdmin(request, env);
  const db = env.DB;
  await sweep(db, env);
  const { results: settings } = await db.prepare('SELECT key, value FROM settings').all();
  const players = (await listPlayers(db)).map(({ token, photo, ...p }) => ({ ...p, hasPhoto: !!photo }));
  const games = await listGames(db);
  return json({
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    vars: { SITE_URL: env.SITE_URL, MAIL_FROM: env.MAIL_FROM, KNOCKOUT_FROM: env.KNOCKOUT_FROM, CONFIRM_HOURS: env.CONFIRM_HOURS, CLOSE_DATE: env.CLOSE_DATE },
    players, games,
  });
});
