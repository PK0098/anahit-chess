export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function bad(message, status = 400) { return new HttpError(message, status); }

export async function readJson(request) {
  try { return await request.json(); } catch { throw bad('Invalid JSON body'); }
}

export function requireAdmin(request, env) {
  const auth = request.headers.get('authorization') || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) throw bad('Unauthorized', 401);
}

// Wraps a handler so thrown HttpErrors become JSON responses.
export function handle(fn) {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Internal error' }, 500);
    }
  };
}
