import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rrPairings, koBracket, koNextRound, winnerOf, standings, toP1Result, decideFormat, validateRegistration,
} from '../functions/_lib/tournament.js';

// Round robin: the whole point is "everyone plays everyone once", so the
// pair set must be complete and free of duplicates or self-pairs.
test('rrPairings produces every pair exactly once', () => {
  const ids = [1, 2, 3, 4, 5];
  const games = rrPairings(ids);
  assert.equal(games.length, 10);
  const seen = new Set();
  for (const g of games) {
    assert.notEqual(g.p1, g.p2);
    const key = [g.p1, g.p2].sort().join('-');
    assert.ok(!seen.has(key), 'duplicate pair ' + key);
    seen.add(key);
    assert.equal(g.round, 1);
  }
  assert.deepEqual(games.map((g) => g.slot), [...Array(10).keys()]);
});

// Knockout with 5 players needs an 8-slot bracket: 3 byes so that round 2 has 4 players.
test('koBracket pads to a power of two with byes first', () => {
  const b = koBracket([10, 20, 30, 40, 50], () => 0.5); // deterministic shuffle
  assert.equal(b.size, 8);
  assert.equal(b.games.length, 4);
  const byes = b.games.filter((g) => g.p2 === null);
  assert.equal(byes.length, 3);
  assert.deepEqual(byes.map((g) => g.slot), [0, 1, 2]);
  const ids = b.games.flatMap((g) => [g.p1, g.p2]).filter((x) => x !== null).sort((a, c) => a - c);
  assert.deepEqual(ids, [10, 20, 30, 40, 50]);
});

test('koBracket with exact power of two has no byes', () => {
  const b = koBracket([1, 2, 3, 4], () => 0.5);
  assert.equal(b.size, 4);
  assert.equal(b.games.filter((g) => g.p2 === null).length, 0);
});

test('winnerOf follows p1-perspective result', () => {
  assert.equal(winnerOf({ p1: 1, p2: 2, result: '1-0', status: 'confirmed' }), 1);
  assert.equal(winnerOf({ p1: 1, p2: 2, result: '0-1', status: 'confirmed' }), 2);
  assert.equal(winnerOf({ p1: 1, p2: 2, result: '1/2', status: 'confirmed' }), null);
  assert.equal(winnerOf({ p1: 1, p2: 2, result: '1-0', status: 'reported' }), null, 'unconfirmed games have no winner yet');
});

// Advancement must wait for the whole round and pair winners by slot parity so the bracket shape holds.
test('koNextRound waits for the round, then pairs winners by slot', () => {
  const r1 = [
    { round: 1, slot: 0, p1: 1, p2: null, result: '1-0', status: 'confirmed' },
    { round: 1, slot: 1, p1: 2, p2: 3, result: '0-1', status: 'confirmed' },
    { round: 1, slot: 2, p1: 4, p2: 5, result: '1-0', status: 'reported' },
    { round: 1, slot: 3, p1: 6, p2: 7, result: '0-1', status: 'confirmed' },
  ];
  assert.equal(koNextRound(r1, 1), null);
  r1[2].status = 'confirmed';
  const r2 = koNextRound(r1, 1);
  assert.deepEqual(r2, [
    { round: 2, slot: 0, p1: 1, p2: 3 },
    { round: 2, slot: 1, p1: 4, p2: 7 },
  ]);
});

test('koNextRound returns null after the final (single game round)', () => {
  const final = [{ round: 3, slot: 0, p1: 1, p2: 3, result: '1-0', status: 'confirmed' }];
  assert.equal(koNextRound(final, 3), null);
});

// 3/1/0 scoring is the tournament's stated rule; ties break on wins so a
// draw-heavy player does not outrank a winner with equal points.
test('standings applies 3/1/0, sorts by points then wins, and builds last-5 form', () => {
  const players = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const games = [
    { p1: 1, p2: 2, result: '1-0', status: 'confirmed', confirmed_at: '2026-10-02T10:00:00Z' },
    { p1: 2, p2: 3, result: '1/2', status: 'confirmed', confirmed_at: '2026-10-03T10:00:00Z' },
    { p1: 1, p2: 3, result: '1/2', status: 'confirmed', confirmed_at: '2026-10-04T10:00:00Z' },
    { p1: 3, p2: 2, result: '1-0', status: 'reported', confirmed_at: null }, // not counted
  ];
  const s = standings(players, games);
  assert.deepEqual(s.map((r) => r.id), [1, 3, 2]);
  assert.deepEqual(s[0], { id: 1, played: 2, w: 1, d: 1, l: 0, points: 4, form: ['W', 'D'] });
  assert.equal(s[1].points, 2); assert.equal(s[2].points, 1);
  assert.deepEqual(s[2].form, ['L', 'D']);
});

test('standings tie on points prefers more wins', () => {
  const players = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const games = [
    { p1: 1, p2: 2, result: '1-0', status: 'confirmed', confirmed_at: '2026-10-02T10:00:00Z' },
    { p1: 3, p2: 4, result: '1/2', status: 'confirmed', confirmed_at: '2026-10-02T10:00:00Z' },
    { p1: 3, p2: 1, result: '1/2', status: 'confirmed', confirmed_at: '2026-10-02T11:00:00Z' },
    { p1: 3, p2: 2, result: '1/2', status: 'confirmed', confirmed_at: '2026-10-02T12:00:00Z' },
  ];
  const s = standings(players, games); // 1: 4pts 1w ; 3: 3pts 0w
  assert.deepEqual(s.slice(0, 2).map((r) => r.id), [1, 3]);
});

test('toP1Result converts the reporter perspective', () => {
  assert.equal(toP1Result('p1', 'win'), '1-0');
  assert.equal(toP1Result('p1', 'loss'), '0-1');
  assert.equal(toP1Result('p2', 'win'), '0-1');
  assert.equal(toP1Result('p2', 'loss'), '1-0');
  assert.equal(toP1Result('p2', 'draw'), '1/2');
  assert.throws(() => toP1Result('p1', 'meh'));
});

test('decideFormat uses the threshold inclusively', () => {
  assert.equal(decideFormat(12, 12), 'ko');
  assert.equal(decideFormat(11, 12), 'rr');
});

test('validateRegistration normalizes and rejects bad input', () => {
  const ok = validateRegistration({ name: '  Pouya Karimi ', company: '', email: 'P@X.io', photo: null });
  assert.deepEqual(ok, { name: 'Pouya Karimi', company: 'Freelance', email: 'p@x.io', photo: null });
  assert.throws(() => validateRegistration({ name: '', email: 'a@b.c' }), /name/i);
  assert.throws(() => validateRegistration({ name: 'A', email: 'nope' }), /email/i);
  assert.throws(() => validateRegistration({ name: 'A', email: 'a@b.c', photo: 'data:text/plain;base64,QUJD' }), /photo/i);
  assert.throws(() => validateRegistration({ name: 'A', email: 'a@b.c', photo: 'data:image/jpeg;base64,' + 'A'.repeat(90000) }), /photo/i);
  const withPhoto = validateRegistration({ name: 'A', email: 'a@b.c', photo: 'data:image/jpeg;base64,/9j/' });
  assert.equal(withPhoto.photo, 'data:image/jpeg;base64,/9j/');
});
