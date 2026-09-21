(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const initials = (name) => (name || '').trim().split(/\s+/).filter(Boolean).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  const AVATARS = ['#e0552b', '#cfd6e3', '#d9a92f', '#d9d0bb'];
  const PIECES = ['♜', '♞', '♝', '♛', '♚', '♟'];
  const TILTS = ['-1.5deg', '1deg', '-0.6deg', '1.6deg', '-1.1deg', '0.8deg'];
  const MEDAL = [
    { bg: '#d9a92f', piece: '♔' },
    { bg: '#b8b4ab', piece: '♕' },
    { bg: '#b8794f', piece: '♖' },
  ];

  // ---- phase -------------------------------------------------------------
  const params = new URLSearchParams(location.search);
  const phase = params.get('phase') === 'play' ? 'play' : params.get('phase') === 'registration' ? 'registration' : CONFIG.phase;
  document.body.dataset.phase = phase;

  // ---- shared: player tiles ---------------------------------------------
  function avatarEl(p, size) {
    const a = document.createElement('div');
    a.className = 'avatar ' + size;
    a.style.backgroundColor = p.avatarBg || AVATARS[0];
    if (p.photo) { a.style.backgroundImage = `url('${p.photo}')`; a.textContent = ''; }
    else a.textContent = initials(p.name) || '?';
    return a;
  }
  function decorate(list) {
    return list.map((p, i) => ({
      ...p,
      avatarBg: AVATARS[i % AVATARS.length],
      piece: PIECES[i % PIECES.length],
      tilt: TILTS[i % TILTS.length],
      code: 'P' + pad(i + 1),
    }));
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
      a.href = '#register';
      a.className = 'tile claim';
      a.innerHTML = `<div class="avatar md">?</div><div><div class="tile-name">You, ${'P' + pad(list.length + 1)}</div><div class="tile-sub">Claim this spot →</div></div>`;
      grid.appendChild(a);
    }
  }

  // ---- registration phase -----------------------------------------------
  function initRegistration() {
    const registrants = [...MOCK.registrants];
    const close = new Date(CONFIG.closeDate);
    let photo = '';

    function refresh() {
      const list = decorate(registrants);
      const n = list.length;
      $('reg-count').textContent = n;
      $('already-n').textContent = n;
      $('players-n-reg').textContent = n;
      $('reg-format').textContent = n >= CONFIG.knockoutFrom ? 'K.O.' : 'League';
      $('reg-code').textContent = 'P' + pad(n + 1);
      $('done-code').textContent = 'P' + pad(n + 1);
      renderTiles(list, { sub: (p) => p.company || 'Freelance', claim: true });
    }
    function tick() {
      const ms = Math.max(0, close - Date.now());
      const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      $('countdown').textContent = ms > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : 'Registration closed';
      $('countdown-short').textContent = ms > 0 ? `${d}d ${pad(h)}h` : 'closed';
      $('reg-days').textContent = d;
    }
    tick(); setInterval(tick, 1000);
    refresh();

    const form = $('reg-form'), done = $('reg-done'), nameIn = $('f-name'), compIn = $('f-company'), emailIn = $('f-email');
    nameIn.addEventListener('input', () => form.classList.toggle('filled', !!nameIn.value.trim()));
    $('photo-input').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { photo = r.result; $('photo-pick').style.backgroundImage = `url('${photo}')`; $('photo-hint').hidden = true; };
      r.readAsDataURL(f);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameIn.value.trim(), company = compIn.value.trim() || 'Freelance', email = emailIn.value.trim();
      if (!name) { nameIn.focus(); return; }
      if (!emailIn.checkValidity()) { emailIn.focus(); emailIn.reportValidity(); return; }
      // Mock only: real version POSTs to the API here.
      registrants.push({ name, company, photo });
      $('done-name').textContent = name;
      $('done-company').textContent = company;
      $('done-email').textContent = email;
      const av = $('done-avatar');
      av.style.backgroundImage = photo ? `url('${photo}')` : '';
      av.textContent = photo ? '' : initials(name);
      form.hidden = true; done.hidden = false;
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
      $('toast-name').textContent = name; $('toast-email').textContent = email;
      $('toast').hidden = false;
      clearTimeout(toastTm); toastTm = setTimeout(() => { $('toast').hidden = true; }, 9000);
    }
    $('toast-close').addEventListener('click', () => { clearTimeout(toastTm); $('toast').hidden = true; });
  }

  // ---- play phase ---------------------------------------------------------
  function initPlay() {
    const players = decorate(MOCK.players).map((p) => ({ ...p, played: p.w + p.d + p.l, points: p.w * 3 + p.d }));
    const n = players.length;
    const sorted = [...players].sort((a, b) => b.points - a.points || b.w - a.w);
    const gamesTotal = n * (n - 1) / 2;
    const gamesPlayed = players.reduce((s, p) => s + p.played, 0) / 2;

    $('play-count').textContent = n;
    $('play-total').textContent = gamesTotal;
    $('play-played').textContent = gamesPlayed;
    $('st-played').textContent = gamesPlayed;
    $('st-total').textContent = gamesTotal;
    $('players-n-play').textContent = n;
    $('hero-format').textContent = n >= CONFIG.knockoutFrom ? 'Knockout bracket' : 'Single round robin';

    const podium = $('podium');
    sorted.slice(0, 3).forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'pod'; el.style.setProperty('--pc', MEDAL[i].bg);
      el.innerHTML = `<div class="pod-rank">${i + 1}</div><div><div class="pod-name"></div><div class="pod-rec">${p.points} pts · ${p.w}W ${p.d}D ${p.l}L</div></div><div class="pod-piece">${MEDAL[i].piece}</div>`;
      el.querySelector('.pod-name').textContent = p.name;
      podium.appendChild(el);
    });

    const rows = $('rows');
    sorted.forEach((p, i) => {
      const tr = document.createElement('tr');
      const m = i < 3 ? MEDAL[i] : null;
      if (m) tr.className = 'top';
      const form = p.form.split('').map((l) => `<span class="chip ${l}">${l}</span>`).join('');
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

    renderTiles(players, { sub: (p) => p.tag || p.company, claim: false });
    initTicker();
  }

  function initTicker() {
    const el = $('ticker'), track = $('ticker-track');
    track.textContent = MOCK.pgn + MOCK.pgn;
    const k = { x: 0, drag: false, lastX: 0, last: 0, vel: 0 };
    const speed = 60; // seconds per half loop
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

  if (phase === 'play') initPlay(); else initRegistration();
})();
