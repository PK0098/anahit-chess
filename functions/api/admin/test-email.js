import { json, bad, readJson, handle, requireAdmin } from '../../_lib/http.js';
import { sendMail } from '../../_lib/mail.js';

export const onRequestPost = handle(async ({ request, env }) => {
  requireAdmin(request, env);
  const body = await readJson(request);
  if (!body.to) throw bad('Missing "to"');
  const r = await sendMail(env, {
    to: body.to, subject: 'Q hub Chess test email',
    html: '<p>If you can read this, email works. ♟</p>', text: 'If you can read this, email works.',
  });
  return json(r, r.ok ? 200 : 502);
});
