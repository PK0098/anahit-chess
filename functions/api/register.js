import { json, bad, readJson, handle } from '../_lib/http.js';
import { getSetting, listPlayers, nowIso } from '../_lib/db.js';
import { validateRegistration } from '../_lib/tournament.js';
import { sendMail, templates } from '../_lib/mail.js';

export const onRequestPost = handle(async ({ request, env }) => {
  const db = env.DB;
  const phase = await getSetting(db, 'phase', 'registration');
  if (phase !== 'registration') throw bad('Registration is closed', 403);

  let data;
  try { data = validateRegistration(await readJson(request)); } catch (e) { throw bad(e.message, 400); }

  const token = crypto.randomUUID();
  try {
    await db.prepare('INSERT INTO players (name, company, email, photo, token, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(data.name, data.company, data.email, data.photo, token, nowIso()).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message || e))) throw bad('That email is already registered', 409);
    throw e;
  }
  const players = await listPlayers(db);
  const player = players.find((p) => p.token === token);
  await sendMail(env, { to: player.email, ...templates.welcome(env, { player }) });
  return json({ id: player.id, code: player.code }, 201);
});
