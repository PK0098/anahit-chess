// Pure tournament logic. No I/O. Results are stored from p1's perspective:
// '1-0' p1 won, '0-1' p2 won, '1/2' draw.

export function rrPairings(ids) {
  const games = [];
  let slot = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      games.push({ round: 1, slot: slot++, p1: ids[i], p2: ids[j] });
    }
  }
  return games;
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Single elimination. Bracket size is the next power of two; the first
// (size - n) slots are byes so round 2 is full.
export function koBracket(ids, rand = Math.random) {
  const n = ids.length;
  let size = 1;
  while (size < n) size *= 2;
  const order = shuffle(ids, rand);
  const byes = size - n;
  const games = [];
  let k = 0;
  for (let slot = 0; slot < size / 2; slot++) {
    if (slot < byes) games.push({ round: 1, slot, p1: order[k++], p2: null });
    else games.push({ round: 1, slot, p1: order[k++], p2: order[k++] });
  }
  return { size, games };
}

export function winnerOf(game) {
  if (game.p2 === null || game.p2 === undefined) return game.p1; // bye
  if (game.status !== 'confirmed') return null;
  if (game.result === '1-0') return game.p1;
  if (game.result === '0-1') return game.p2;
  return null;
}

// Returns the next round's games once every game in `round` is confirmed,
// or null if the round is incomplete or was the final.
export function koNextRound(games, round) {
  const cur = games.filter((g) => g.round === round).sort((a, b) => a.slot - b.slot);
  if (cur.length <= 1) return null;
  if (cur.some((g) => winnerOf(g) === null)) return null;
  const next = [];
  for (let i = 0; i < cur.length; i += 2) {
    next.push({ round: round + 1, slot: i / 2, p1: winnerOf(cur[i]), p2: winnerOf(cur[i + 1]) });
  }
  return next;
}

export function standings(players, games) {
  const rows = new Map(players.map((p) => [p.id, { id: p.id, played: 0, w: 0, d: 0, l: 0, points: 0, form: [] }]));
  const done = games
    .filter((g) => g.status === 'confirmed' && g.p2 !== null && g.p2 !== undefined && g.result)
    .sort((a, b) => String(a.confirmed_at).localeCompare(String(b.confirmed_at)));
  for (const g of done) {
    const a = rows.get(g.p1), b = rows.get(g.p2);
    if (!a || !b) continue;
    a.played++; b.played++;
    if (g.result === '1-0') { a.w++; b.l++; a.form.push('W'); b.form.push('L'); }
    else if (g.result === '0-1') { b.w++; a.l++; b.form.push('W'); a.form.push('L'); }
    else { a.d++; b.d++; a.form.push('D'); b.form.push('D'); }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, points: r.w * 3 + r.d, form: r.form.slice(-5) }))
    .sort((a, b) => b.points - a.points || b.w - a.w || a.id - b.id);
}

export function toP1Result(youAre, outcome) {
  if (outcome === 'draw') return '1/2';
  if (outcome !== 'win' && outcome !== 'loss') throw new Error('Invalid outcome');
  const p1Wins = (youAre === 'p1') === (outcome === 'win');
  return p1Wins ? '1-0' : '0-1';
}

export function decideFormat(n, knockoutFrom) {
  return n >= knockoutFrom ? 'ko' : 'rr';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]*$/;

export function validateRegistration(body) {
  const b = body || {};
  const name = String(b.name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 40) throw new Error('Name must be 1 to 40 characters');
  let company = String(b.company || '').trim().replace(/\s+/g, ' ');
  if (!company) company = 'Freelance';
  if (company.length > 40) throw new Error('Company must be at most 40 characters');
  const email = String(b.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) throw new Error('Please enter a valid email');
  let photo = b.photo ? String(b.photo) : null;
  if (photo) {
    if (photo.length > 80000) throw new Error('Photo is too large');
    if (!PHOTO_RE.test(photo)) throw new Error('Photo must be a JPEG, PNG or WebP image');
  }
  return { name, company, email, photo };
}
