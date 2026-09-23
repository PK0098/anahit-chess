// QR code target: counts the scan, then sends the visitor to the landing page.
export async function onRequestGet({ env }) {
  try {
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('flyer_scans', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)").run();
  } catch (e) { console.error('flyer counter failed', e); }
  return new Response(null, { status: 302, headers: { location: '/', 'cache-control': 'no-store' } });
}
