import { json, bad, readJson, handle } from '../_lib/http.js';
import { getSetting, nowIso } from '../_lib/db.js';
import { playerByToken, gameForPlayer } from '../_lib/players.js';
import { sendMail, templates, outcomeText } from '../_lib/mail.js';
import { sweep } from '../_lib/sweep.js';

export const onRequestPost = handle(async ({ request, env }) => {
  const db = env.DB;
  const body = await readJson(request);
  const { me, byId } = await playerByToken(db, body.t);
  if ((await getSetting(db, 'phase')) !== 'play') throw bad('The tournament is not in play', 403);
  const g = await gameForPlayer(db, body.g, me);
  if (g.status !== 'reported') throw bad('There is nothing to confirm on this game', 409);
  if (g.reported_by === me.id) throw bad('You cannot confirm your own report', 403);

  const p1 = byId.get(g.p1), p2 = byId.get(g.p2);
  const reporter = byId.get(g.reported_by);
  if (body.action === 'dispute') {
    await db.prepare("UPDATE games SET status = 'disputed' WHERE id = ?").bind(g.id).run();
    if (env.ADMIN_EMAIL) await sendMail(env, { to: env.ADMIN_EMAIL, ...templates.dispute(env, { game: g, p1, p2, reporter, result: g.result }) });
    return json({ ok: true, status: 'disputed' });
  }
  if (body.action !== 'confirm') throw bad('Action must be confirm or dispute', 400);

  await db.prepare("UPDATE games SET status = 'confirmed', confirmed_at = ? WHERE id = ?").bind(nowIso(), g.id).run();
  const text = outcomeText(g, p1, p2);
  await Promise.all([
    sendMail(env, { to: p1.email, ...templates.confirmed(env, { player: p1, opponent: p2, outcomeText: text }) }),
    sendMail(env, { to: p2.email, ...templates.confirmed(env, { player: p2, opponent: p1, outcomeText: text }) }),
  ]);
  await sweep(db, env);
  return json({ ok: true, status: 'confirmed' });
});
