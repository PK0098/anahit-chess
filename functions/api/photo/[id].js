import { handle, json } from '../../_lib/http.js';

export const onRequestGet = handle(async ({ env, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: 'Not found' }, 404);
  const row = await env.DB.prepare('SELECT photo FROM players WHERE id = ?').bind(id).first();
  const m = row && row.photo && /^data:(image\/[a-z]+);base64,(.*)$/s.exec(row.photo);
  if (!m) return json({ error: 'Not found' }, 404);
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bin, { headers: { 'content-type': m[1], 'cache-control': 'public, max-age=86400' } });
});
