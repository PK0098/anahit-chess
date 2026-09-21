import { json, bad, readJson, handle, requireAdmin } from '../../_lib/http.js';
import { getSetting } from '../../_lib/db.js';

export const onRequestPost = handle(async ({ request, env }) => {
  requireAdmin(request, env);
  const db = env.DB;
  if ((await getSetting(db, 'phase')) !== 'registration') throw bad('Players can only be removed during registration', 409);
  const body = await readJson(request);
  const res = await db.prepare('DELETE FROM players WHERE id = ?').bind(Number(body.id)).run();
  if (!res.meta.changes) throw bad('Unknown player', 404);
  return json({ ok: true });
});
