(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let key = sessionStorage.getItem('adminKey') || new URLSearchParams(location.search).get('key') || '';
  if (new URLSearchParams(location.search).get('key')) history.replaceState(null, '', location.pathname);

  const api = async (path, body) => {
    const r = await fetch('/api/admin/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: 'Bearer ' + key, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error || r.statusText), { status: r.status });
    return d;
  };
  const msg = (el, text, cls) => { el.innerHTML = text ? `<div class="msg ${cls || ''}">${text}</div>` : ''; };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function load() {
    if (!key) { $('login').hidden = false; $('app').hidden = true; return; }
    try {
      const d = await api('overview');
      sessionStorage.setItem('adminKey', key);
      $('login').hidden = true; $('app').hidden = false;
      render(d);
    } catch (e) {
      if (e.status === 401) { key = ''; sessionStorage.removeItem('adminKey'); $('login').hidden = false; $('app').hidden = true; msg($('login-msg'), 'Wrong key.', 'bad'); }
      else msg($('msg'), esc(e.message), 'bad');
    }
  }

  function render(d) {
    const byId = new Map(d.players.map((p) => [p.id, p]));
    const name = (id) => id === null ? '<i>bye</i>' : esc((byId.get(id) || {}).name || '?');
    const phase = d.settings.phase || 'registration';
    $('kv').innerHTML = `
      <div>Phase<b>${esc(phase)}</b></div><div>Format<b>${esc(d.settings.format || '—')}</b></div>
      <div>Players<b>${d.players.length}</b></div><div>Games confirmed<b>${d.games.filter((g) => g.status === 'confirmed' && g.p2 !== null).length} / ${d.games.filter((g) => g.p2 !== null).length}</b></div>
      <div>Flyer scans<b>${esc(d.settings.flyer_scans || 0)}</b></div><div>Knockout from<b>${esc(d.vars.KNOCKOUT_FROM)}</b></div><div>Closes<b style="font-size:13px">${esc(d.vars.CLOSE_DATE)}</b></div>
      <div>Mail from<b style="font-size:12px">${esc(d.vars.MAIL_FROM)}</b></div><div>Site<b style="font-size:12px">${esc(d.vars.SITE_URL)}</b></div>`;
    $('close-btn').disabled = phase !== 'registration' || d.players.length < 2;

    $('pcount').textContent = d.players.length;
    $('players').innerHTML = `<tr><th>Code</th><th>Name</th><th>Company</th><th>Email</th><th>Photo</th><th></th></tr>` +
      d.players.map((p) => `<tr><td>${esc(p.code)}</td><td>${esc(p.name)}</td><td>${esc(p.company)}</td><td>${esc(p.email)}</td><td>${p.hasPhoto ? '✓' : '—'}</td>
        <td>${phase === 'registration' ? `<button class="btn btn-line sm" data-remove="${p.id}">Remove</button>` : ''}</td></tr>`).join('');

    $('gcount').textContent = d.games.length;
    $('games').innerHTML = `<tr><th>#</th><th>Round</th><th>White / p1</th><th>Black / p2</th><th>Status</th><th>Result</th><th>Set result</th></tr>` +
      d.games.map((g) => `<tr><td>${g.id}</td><td>${g.round}</td><td>${name(g.p1)}</td><td>${name(g.p2)}</td>
        <td><span class="tag ${esc(g.status)}">${esc(g.status)}</span>${g.reported_by ? `<div style="font-size:11px;color:#5c5548">by ${name(g.reported_by)}</div>` : ''}</td>
        <td>${esc(g.result || '—')}</td>
        <td>${g.p2 === null ? '' : `<select data-res="${g.id}"><option value="1-0">1-0 (p1 wins)</option><option value="0-1">0-1 (p2 wins)</option>${d.settings.format === 'ko' ? '' : '<option value="1/2">½-½</option>'}</select> <button class="btn btn-dark sm" data-resolve="${g.id}">Set</button>`}</td></tr>`).join('');

    $('players').querySelectorAll('[data-remove]').forEach((b) => b.onclick = async () => {
      if (!confirm('Remove this player?')) return;
      try { await api('remove', { id: Number(b.dataset.remove) }); load(); } catch (e) { msg($('msg'), esc(e.message), 'bad'); }
    });
    $('games').querySelectorAll('[data-resolve]').forEach((b) => b.onclick = async () => {
      const id = Number(b.dataset.resolve);
      const result = $('games').querySelector(`[data-res="${id}"]`).value;
      if (!confirm(`Set game #${id} to ${result} and confirm it? Both players get an email.`)) return;
      try { await api('resolve', { g: id, result }); msg($('msg'), `Game #${id} set to ${result}.`, 'ok'); load(); } catch (e) { msg($('msg'), esc(e.message), 'bad'); }
    });
  }

  $('key-go').onclick = () => { key = $('key').value.trim(); load(); };
  $('key').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('key-go').click(); });
  $('logout').onclick = (e) => { e.preventDefault(); sessionStorage.removeItem('adminKey'); key = ''; load(); };
  $('refresh').onclick = load;
  $('close-btn').onclick = async () => {
    if (!confirm('Close registration now? This decides the format, creates all pairings and emails every player. It cannot be undone.')) return;
    $('close-btn').disabled = true;
    try { const r = await api('close', {}); msg($('msg'), `Closed. Format: <b>${esc(r.format)}</b>, ${r.players} players, ${r.games} games created. Emails sent.`, 'ok'); }
    catch (e) { msg($('msg'), esc(e.message), 'bad'); }
    load();
  };
  $('test-go').onclick = async () => {
    msg($('test-msg'), 'Sending…');
    try { const r = await api('test-email', { to: $('test-to').value.trim() }); msg($('test-msg'), 'Sent. Resend id: ' + esc(r.id), 'ok'); }
    catch (e) { msg($('test-msg'), esc(e.message), 'bad'); }
  };
  load();
})();
