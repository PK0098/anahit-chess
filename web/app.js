(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const initials = (name) => (name || '').trim().split(/\s+/).filter(Boolean).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  const AVATARS = ['#e0552b', '#cfd6e3', '#d9a92f', '#d9d0bb'];
  const PIECES = ['♜', '♞', '♝', '♛', '♚', '♟'];
  const TILTS = ['-1.5deg', '1deg', '-0.6deg', '1.6deg', '-1.1deg', '0.8deg'];
  const MEDAL = [{ bg: '#d9a92f', piece: '♔' }, { bg: '#b8b4ab', piece: '♕' }, { bg: '#b8794f', piece: '♖' }];
  const PGN = '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#   ✦   Morphy vs. Duke Karl & Count Isouard, Paris 1858. Took 17 moves. You have 10 minutes.   ✦   ';

  // ---- state -------------------------------------------------------------
  let live = true;
  async function loadState() {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch {
      live = false;
      const params = new URLSearchParams(location.search);
      const m = JSON.parse(JSON.stringify(window.MOCK_STATE));
      m.phase = params.get('phase') === 'play' ? 'play' : 'registration';
      if (m.phase === 'registration') { m.players = m.registrants; m.games = []; }
      return m;
    }
  }

  function decorate(list) {
    return list.map((p, i) => ({ ...p, avatarBg: AVATARS[i % AVATARS.length], piece: PIECES[i % PIECES.length], tilt: TILTS[i % TILTS.length] }));
  }
  function avatarEl(p, size) {
    const a = document.createElement('div');
    a.className = 'avatar ' + size;
    a.style.backgroundColor = p.avatarBg || AVATARS[0];
    if (p.hasPhoto && live) { a.style.backgroundImage = `url('/api/photo/${p.id}')`; a.textContent = ''; }
    else if (p.photo) { a.style.backgroundImage = `url('${p.photo}')`; a.textContent = ''; }
    else a.textContent = initials(p.name) || '?';
    return a;
  }
  function renderTiles(list, opts) {
    const grid = $('player-grid');
    grid.innerHTML = '';
    list.forEach((p) => {
      const t = document.createElement('div');
      t.className = 'tile';
      t.style.setProperty('--tilt', p.tilt);
      t.innerHTML = `<div class="card-code">${p.code}</div><div class="card-piece">${p.piece}</div>`;
      t.appendChild(avatarEl(p, 'md'));
      const body = document.createElement('div');
      body.innerHTML = `<div class="tile-name"></div><div class="tile-sub"></div>`;
      body.querySelector('.tile-name').textContent = p.name;
      body.querySelector('.tile-sub').textContent = opts.sub(p);
      t.appendChild(body);
      grid.appendChild(t);
    });
    if (opts.claim) {
      const a = document.createElement('a');
      a.href = '#register'; a.className = 'tile claim';
      a.innerHTML = `<div class="avatar md">?</div><div><div class="tile-name">You, ${'P' + pad(list.length + 1)}</div><div class="tile-sub">Claim this spot →</div></div>`;
      grid.appendChild(a);
    }
  }

  // Same rules as the server: 3/1/0, sort by points then wins.
  function standings(players, games) {
    const rows = new Map(players.map((p) => [p.id, { ...p, played: 0, w: 0, d: 0, l: 0, points: 0, form: [] }]));
    games.filter((g) => g.status === 'confirmed' && g.p2 !== null && g.result)
      .sort((a, b) => String(a.confirmedAt).localeCompare(String(b.confirmedAt)))
      .forEach((g) => {
        const a = rows.get(g.p1), b = rows.get(g.p2); if (!a || !b) return;
        a.played++; b.played++;
        if (g.result === '1-0') { a.w++; b.l++; a.form.push('W'); b.form.push('L'); }
        else if (g.result === '0-1') { b.w++; a.l++; b.form.push('W'); a.form.push('L'); }
        else { a.d++; b.d++; a.form.push('D'); b.form.push('D'); }
      });
    return [...rows.values()].map((r) => ({ ...r, points: r.w * 3 + r.d, form: r.form.slice(-5) }))
      .sort((a, b) => b.points - a.points || b.w - a.w || a.id - b.id);
  }

  // ---- registration phase -------------------------------------------------
  function initRegistration(state) {
    const close = new Date(state.closeDate);
    let players = decorate(state.players);
    let photo = '';

    function refresh() {
      const n = players.length;
      $('reg-count').textContent = n; $('already-n').textContent = n; $('players-n-reg').textContent = n;
      $('reg-format').textContent = n >= state.knockoutFrom ? 'K.O.' : 'League';
      $('reg-code').textContent = 'P' + pad(n + 1); $('done-code').textContent = 'P' + pad(n + 1);
      renderTiles(players, { sub: (p) => p.company || 'Freelance', claim: true });
    }
    function tick() {
      const ms = Math.max(0, close - Date.now());
      const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      $('countdown').textContent = ms > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : 'Registration closing';
      $('countdown-short').textContent = ms > 0 ? `${d}d ${pad(h)}h` : 'soon';
      $('reg-days').textContent = d;
    }
    tick(); setInterval(tick, 1000);
    refresh();

    const form = $('reg-form'), done = $('reg-done'), nameIn = $('f-name'), compIn = $('f-company'), emailIn = $('f-email'), err = $('form-error'), btn = form.querySelector('button[type=submit]');
    nameIn.addEventListener('input', () => form.classList.toggle('filled', !!nameIn.value.trim()));
    const menu = $('photo-menu'), pick = $('photo-pick');
    const setMenu = (open) => { menu.hidden = !open; pick.setAttribute('aria-expanded', String(open)); };
    pick.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    $('photo-camera').addEventListener('click', () => { setMenu(false); $('photo-input-camera').click(); });
    $('photo-library').addEventListener('click', () => { setMenu(false); $('photo-input').click(); });
    async function onPhotoFile(e) {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        photo = await resizeImage(f, 240);
        pick.style.backgroundImage = `url('${photo}')`; $('photo-hint').hidden = true;
      } catch { showError('That image could not be read. Try another one.'); }
      e.target.value = '';
    }
    $('photo-input').addEventListener('change', onPhotoFile);
    $('photo-input-camera').addEventListener('change', onPhotoFile);
    function showError(msg) { err.textContent = msg; err.hidden = !msg; }
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); showError('');
      const name = nameIn.value.trim(), company = compIn.value.trim() || 'Freelance', email = emailIn.value.trim();
      if (!name) { nameIn.focus(); return; }
      if (!emailIn.checkValidity()) { emailIn.focus(); emailIn.reportValidity(); return; }
      btn.disabled = true; btn.textContent = 'Registering…';
      let res;
      if (live) {
        try {
          const r = await fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, company, email, photo: photo || null }) });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) { showError(data.error || 'Something went wrong. Try again.'); btn.disabled = false; btn.innerHTML = 'Register <span aria-hidden="true">→</span>'; return; }
          res = data;
        } catch { showError('Network error. Try again.'); btn.disabled = false; btn.innerHTML = 'Register <span aria-hidden="true">→</span>'; return; }
      } else res = { id: players.length + 1, code: 'P' + pad(players.length + 1) };
      players = decorate([...players, { id: res.id, code: res.code, name, company, hasPhoto: false, photo }]);
      $('done-name').textContent = name; $('done-company').textContent = company; $('done-email').textContent = email;
      const av = $('done-avatar'); av.style.backgroundImage = photo ? `url('${photo}')` : ''; av.textContent = photo ? '' : initials(name);
      form.hidden = true; done.hidden = false;
      btn.disabled = false; btn.innerHTML = 'Register <span aria-hidden="true">→</span>';
      refresh();
      showToast(name.split(/\s+/)[0], email);
    });
    $('reg-reset').addEventListener('click', () => {
      form.reset(); form.classList.remove('filled'); photo = '';
      $('photo-pick').style.backgroundImage = ''; $('photo-hint').hidden = false;
      done.hidden = true; form.hidden = false;
    });
    let toastTm;
    function showToast(name, email) {
      $('toast-name').textContent = name; $('toast-email').textContent = email; $('toast').hidden = false;
      clearTimeout(toastTm); toastTm = setTimeout(() => { $('toast').hidden = true; }, 9000);
    }
    $('toast-close').addEventListener('click', () => { clearTimeout(toastTm); $('toast').hidden = true; });
  }

  function resizeImage(file, size) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = size; c.height = size;
        const s = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  // ---- play / done phase ----------------------------------------------------
  function initPlay(state) {
    const players = decorate(state.players);
    const byId = new Map(players.map((p) => [p.id, p]));
    const games = state.games;
    const n = players.length;
    const real = games.filter((g) => g.p2 !== null);
    const gamesPlayed = real.filter((g) => g.status === 'confirmed').length;
    const ko = state.format === 'ko';
    document.body.dataset.format = ko ? 'ko' : 'rr';

    $('play-count').textContent = n;
    $('play-total').textContent = ko ? real.length : n * (n - 1) / 2;
    $('play-played').textContent = gamesPlayed;
    $('players-n-play').textContent = n;
    $('hero-format').textContent = ko ? 'Knockout bracket' : 'Single round robin';
    if (ko) { $('nav-standings').textContent = 'Bracket'; $('nav-standings').href = '#bracket'; $('cta-standings').href = '#bracket'; }

    if (state.phase === 'done' && state.champion && byId.get(state.champion)) {
      const c = byId.get(state.champion);
      $('champion').hidden = false;
      $('champion-name').textContent = c.name; $('champion-company').textContent = c.company;
    }

    if (ko) renderBracket(games, byId);
    else renderStandings(players, games, gamesPlayed, ko ? real.length : n * (n - 1) / 2);

    renderTiles(players, { sub: (p) => p.tag || p.company, claim: false });
    initTicker();
  }

  function renderStandings(players, games, played, total) {
    const sorted = standings(players, games);
    $('st-played').textContent = played; $('st-total').textContent = total;
    const last = games.filter((g) => g.confirmedAt).map((g) => g.confirmedAt).sort().pop();
    $('updated-label').textContent = last ? new Date(last).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'just now';
    const podium = $('podium'); podium.innerHTML = '';
    sorted.slice(0, 3).forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'pod'; el.style.setProperty('--pc', MEDAL[i].bg);
      el.innerHTML = `<div class="pod-rank">${i + 1}</div><div><div class="pod-name"></div><div class="pod-rec">${p.points} pts · ${p.w}W ${p.d}D ${p.l}L</div></div><div class="pod-piece">${MEDAL[i].piece}</div>`;
      el.querySelector('.pod-name').textContent = p.name;
      podium.appendChild(el);
    });
    const rows = $('rows'); rows.innerHTML = '';
    sorted.forEach((p, i) => {
      const tr = document.createElement('tr');
      const m = i < 3 ? MEDAL[i] : null;
      if (m) tr.className = 'top';
      const form = p.form.map((l) => `<span class="chip ${l}">${l}</span>`).join('');
      tr.innerHTML = `
        <td><span class="rank-badge" style="${m ? `background:${m.bg};color:#1c1a17` : ''}">${pad(i + 1)}</span></td>
        <td><span class="player-cell"></span></td>
        <td class="c-c muted">${p.played}</td><td class="c-c">${p.w}</td><td class="c-c">${p.d}</td><td class="c-c">${p.l}</td>
        <td><div class="form-row">${form}</div></td>
        <td class="pts">${p.points}</td>`;
      const cell = tr.querySelector('.player-cell');
      cell.appendChild(avatarEl(p, 'sm'));
      const nm = document.createElement('span'); nm.textContent = p.name; cell.appendChild(nm);
      rows.appendChild(tr);
    });
  }

  function renderBracket(games, byId) {
    const wrap = $('bracket-cols'); wrap.innerHTML = '';
    const rounds = [...new Set(games.map((g) => g.round))].sort((a, b) => a - b);
    const size = games.filter((g) => g.round === 1).length * 2;
    const totalRounds = Math.round(Math.log2(size));
    const label = (r) => r === totalRounds ? 'Final' : r === totalRounds - 1 ? 'Semi-finals' : r === totalRounds - 2 ? 'Quarter-finals' : `Round ${r}`;
    for (let r = 1; r <= totalRounds; r++) {
      const col = document.createElement('div'); col.className = 'br-col';
      col.innerHTML = `<div class="br-head">${label(r)}</div>`;
      const list = rounds.includes(r) ? games.filter((g) => g.round === r).sort((a, b) => a.slot - b.slot) : Array.from({ length: size / Math.pow(2, r) }, () => null);
      list.forEach((g) => {
        const card = document.createElement('div'); card.className = 'br-game';
        if (!g) { card.classList.add('tbd'); card.innerHTML = `<div class="br-p">TBD</div><div class="br-p">TBD</div>`; col.appendChild(card); return; }
        const win = g.status === 'confirmed' ? (g.result === '1-0' ? g.p1 : g.result === '0-1' ? g.p2 : null) : null;
        [g.p1, g.p2].forEach((pid) => {
          const row = document.createElement('div'); row.className = 'br-p';
          if (pid === null) { row.classList.add('bye'); row.textContent = 'bye'; }
          else {
            const p = byId.get(pid); row.textContent = p ? p.name : '?';
            if (win === pid) row.classList.add('win');
            else if (win !== null) row.classList.add('lost');
          }
          card.appendChild(row);
        });
        if (g.p2 !== null && g.status !== 'confirmed') { const s = document.createElement('div'); s.className = 'br-status'; s.textContent = g.status === 'reported' ? 'awaiting confirmation' : g.status === 'disputed' ? 'disputed' : 'to be played'; card.appendChild(s); }
        col.appendChild(card);
      });
      wrap.appendChild(col);
    }
  }

  function initTicker() {
    const el = $('ticker'), track = $('ticker-track');
    track.textContent = PGN + PGN;
    const k = { x: 0, drag: false, lastX: 0, last: 0, vel: 0 };
    const speed = 60;
    function loop(t) {
      const dt = k.last ? Math.min((t - k.last) / 1000, 0.05) : 0; k.last = t;
      const half = track.scrollWidth / 2;
      if (!k.drag) { k.x += (-(half / speed) + k.vel) * dt; k.vel *= 0.94; }
      if (half > 0) k.x = ((k.x % half) + half) % half - half;
      track.style.transform = `translateX(${k.x}px)`;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    el.addEventListener('pointerdown', (e) => { k.drag = true; k.lastX = e.clientX; k.vel = 0; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); });
    el.addEventListener('pointermove', (e) => { if (!k.drag) return; const dx = e.clientX - k.lastX; k.lastX = e.clientX; k.x += dx; k.vel = dx * 60; });
    const up = () => { k.drag = false; el.classList.remove('dragging'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  loadState().then((state) => {
    const phase = state.phase === 'registration' ? 'registration' : 'play';
    document.body.dataset.phase = phase;
    document.body.classList.toggle('mock', !live);
    if (phase === 'play') initPlay(state); else initRegistration(state);
  });
})();
