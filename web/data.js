// Mock data + config for the frontend preview.
// Later this file is replaced by API calls to the Cloudflare Worker.
window.CONFIG = {
  // 'registration' | 'play'
  phase: 'registration',
  closeDate: '2026-09-30T23:59:59',
  startDate: '2026-10-01',
  knockoutFrom: 12,
};

window.MOCK = {
  // Registration phase: who has signed up so far
  registrants: [
    { name: 'Ani Petrosyan', company: 'Anahit' },
    { name: 'Davit Hakobyan', company: 'Freelance' },
    { name: 'Narek Sargsyan', company: 'Anahit' },
    { name: 'Lilit Avetisyan', company: 'Pharmabits' },
    { name: 'Tigran Grigoryan', company: 'Anahit' },
    { name: 'Mariam Karapetyan', company: 'Freelance' },
    { name: 'Hayk Mkrtchyan', company: 'Anahit' },
  ],
  // Play phase: full field with results
  players: [
    { name: 'Ani Petrosyan', company: 'Anahit', form: 'WWDWW', tag: 'Plays the London System. Unironically.', w: 7, d: 1, l: 1 },
    { name: 'Davit Hakobyan', company: 'Freelance', form: 'WDWWL', tag: 'Reigning coffee-break champion.', w: 6, d: 2, l: 1 },
    { name: 'Narek Sargsyan', company: 'Anahit', form: 'LWWWD', tag: 'Sicilian or nothing.', w: 6, d: 1, l: 2 },
    { name: 'Lilit Avetisyan', company: 'Pharmabits', form: 'WDLWW', tag: 'Has never lost on time. Has never finished a game either.', w: 5, d: 2, l: 2 },
    { name: 'Tigran Grigoryan', company: 'Anahit', form: 'DWDLW', tag: 'Castles early. Regrets nothing.', w: 4, d: 3, l: 2 },
    { name: 'Mariam Karapetyan', company: 'Freelance', form: 'WLDWL', tag: 'Will offer a draw. Decline at your own risk.', w: 4, d: 2, l: 3 },
    { name: 'Hayk Mkrtchyan', company: 'Anahit', form: 'DWDLW', tag: 'Learned chess last month. Dangerous.', w: 3, d: 3, l: 2 },
    { name: 'Sona Harutyunyan', company: 'Pharmabits', form: 'LWLDW', tag: 'Queen’s Gambit, accepted.', w: 3, d: 2, l: 4 },
    { name: 'Aram Vardanyan', company: 'Freelance', form: 'WLLWL', tag: 'Plays the bongcloud. Has won with it.', w: 3, d: 1, l: 5 },
    { name: 'Anahit Hovhannisyan', company: 'Anahit', form: 'LDWLL', tag: 'Endgame specialist (the snacks part).', w: 2, d: 2, l: 5 },
    { name: 'Levon Galstyan', company: 'Anahit', form: 'DLLDL', tag: 'Knight before bishop. Always.', w: 1, d: 3, l: 6 },
    { name: 'Nare Simonyan', company: 'Freelance', form: 'LLWLL', tag: 'Here for the vibes and the en passant.', w: 1, d: 0, l: 8 },
  ],
  pgn: '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#   ✦   Morphy vs. Duke Karl & Count Isouard, Paris 1858. Took 17 moves. You have 10 minutes.   ✦   ',
};
