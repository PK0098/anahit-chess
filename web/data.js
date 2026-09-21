// Mock state used only when /api/state is unreachable (e.g. the GitHub Pages preview).
// Shape mirrors the API response.
(function () {
  const names = [
    ['Ani Petrosyan', 'Anahit', 'Plays the London System. Unironically.'],
    ['Davit Hakobyan', 'Freelance', 'Reigning coffee-break champion.'],
    ['Narek Sargsyan', 'Anahit', 'Sicilian or nothing.'],
    ['Lilit Avetisyan', 'Pharmabits', 'Has never lost on time. Has never finished a game either.'],
    ['Tigran Grigoryan', 'Anahit', 'Castles early. Regrets nothing.'],
    ['Mariam Karapetyan', 'Freelance', 'Will offer a draw. Decline at your own risk.'],
    ['Hayk Mkrtchyan', 'Anahit', 'Learned chess last month. Dangerous.'],
    ['Sona Harutyunyan', 'Pharmabits', 'Queen’s Gambit, accepted.'],
    ['Aram Vardanyan', 'Freelance', 'Plays the bongcloud. Has won with it.'],
    ['Anahit Hovhannisyan', 'Anahit', 'Endgame specialist (the snacks part).'],
    ['Levon Galstyan', 'Anahit', 'Knight before bishop. Always.'],
    ['Nare Simonyan', 'Freelance', 'Here for the vibes and the en passant.'],
  ];
  const players = names.map(([name, company, tag], i) => ({ id: i + 1, code: 'P' + String(i + 1).padStart(2, '0'), name, company, tag, hasPhoto: false }));
  // Deterministic pseudo-random results for a round robin in progress.
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const games = []; let id = 1, slot = 0;
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const r = rnd();
    const played = rnd() < 0.7;
    games.push({
      id: id++, round: 1, slot: slot++, p1: players[i].id, p2: players[j].id,
      result: played ? (r < 0.42 ? '1-0' : r < 0.8 ? '0-1' : '1/2') : null,
      status: played ? 'confirmed' : 'pending',
      confirmedAt: played ? new Date(2026, 9, 1 + Math.floor(rnd() * 20)).toISOString() : null,
    });
  }
  window.MOCK_STATE = {
    phase: 'registration', format: 'rr', champion: null,
    closeDate: '2026-09-30T23:59:59+04:00', startDate: '2026-10-01', knockoutFrom: 12, confirmHours: 48,
    players, games,
    registrants: players.slice(0, 7),
  };
})();
