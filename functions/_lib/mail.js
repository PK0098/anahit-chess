// Email via Resend. Never throws: callers must not fail a request because mail failed.

export async function sendMail(env, { to, subject, html, text, replyTo }) {
  if (!env.RESEND_API_KEY) { console.error('RESEND_API_KEY missing'); return { ok: false, error: 'no api key' }; }
  const footerText = '\n\nMade by Pouya · Questions: chess@pouyakarimi.com';
  const body = { from: env.MAIL_FROM, to: Array.isArray(to) ? to : [to], subject, html, text: text ? text + footerText : undefined };
  if (replyTo) body.reply_to = replyTo;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { console.error('resend error', res.status, JSON.stringify(data)); return { ok: false, status: res.status, error: data.message || 'send failed' }; }
    return { ok: true, id: data.id };
  } catch (e) {
    console.error('resend fetch failed', e);
    return { ok: false, error: String(e) };
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const first = (name) => String(name || '').trim().split(/\s+/)[0];
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }); } catch { return iso; } };

function layout(title, inner) {
  return `<!doctype html><html><body style="margin:0;background:#efe6d2;padding:24px 12px;font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;color:#1c1a17">
<div style="max-width:560px;margin:0 auto;background:#faf6ec;border:2px solid #1c1a17;box-shadow:8px 8px 0 #e0552b">
  <div style="background:#1c1a17;color:#efe6d2;padding:14px 20px;border-bottom:3px solid #e0552b;font-weight:700;font-size:16px;letter-spacing:-0.02em">ANAHIT_CHESS</div>
  <div style="padding:22px 20px;font-size:14px;line-height:1.6">
    <h1 style="margin:0 0 14px;font-size:24px;line-height:1.1;letter-spacing:-0.03em;font-family:'Space Grotesk',Arial,sans-serif">${title}</h1>
    ${inner}
  </div>
  <div style="padding:12px 20px;border-top:1px solid #1c1a17;font-size:11px;color:#5c5548">Made by Pouya · Questions: <a href="mailto:chess@pouyakarimi.com" style="color:#2b3f6b">chess@pouyakarimi.com</a></div>
</div></body></html>`;
}

const button = (href, label) => `<p style="margin:18px 0"><a href="${esc(href)}" style="display:inline-block;background:#e0552b;color:#1c1a17;padding:12px 20px;border:2px solid #1c1a17;font-weight:700;text-decoration:none">${esc(label)} →</a></p>`;

const gameLink = (env, token, gameId) => `${env.SITE_URL}/game?t=${encodeURIComponent(token)}&g=${gameId}`;
const meLink = (env, token) => `${env.SITE_URL}/game?t=${encodeURIComponent(token)}`;

function opponentLine(opp) {
  return `<strong>${esc(opp.name)}</strong> (${esc(opp.company)}) · <a href="mailto:${esc(opp.email)}" style="color:#2b3f6b">${esc(opp.email)}</a>`;
}

export const templates = {
  welcome(env, { player }) {
    const url = meLink(env, player.token);
    return {
      subject: `You're on the board, ${first(player.name)} (${player.code})`,
      html: layout(`You're on the board, ${esc(first(player.name))}.`, `
        <p>Your card is <strong>${esc(player.code)}</strong>: ${esc(player.name)}, ${esc(player.company)}.</p>
        <p>Registration closes <strong>${fmtDate(env.CLOSE_DATE)}</strong>. Games start <strong>${fmtDate(env.START_DATE)}</strong>. Once the field is set you'll get one email with your opponent(s) and their email address, so you can arrange a time together.</p>
        <p>Every game: 10 minutes each, no increment. Standard rules. Be nice.</p>
        ${button(url, 'Your player page')}
        <p style="font-size:12px;color:#5c5548">Keep this email. The link above is personal and is how you report results.</p>`),
      text: `You're on the board, ${first(player.name)}. Card ${player.code}: ${player.name}, ${player.company}.\nRegistration closes ${fmtDate(env.CLOSE_DATE)}, games start ${fmtDate(env.START_DATE)}.\nYour player page: ${url}`,
    };
  },

  // games: [{id, opponent:{name,company,email} | null}]
  pairings(env, { player, format, round, games, isNextRound }) {
    const fmt = format === 'ko' ? 'knockout bracket' : 'round robin league';
    const rows = games.map((g) => g.opponent
      ? `<li style="margin:8px 0">${opponentLine(g.opponent)}<br><a href="${esc(gameLink(env, player.token, g.id))}" style="color:#2b3f6b">Report this result</a></li>`
      : `<li style="margin:8px 0"><strong>Bye</strong> — you advance to the next round without playing.</li>`).join('');
    const title = isNextRound ? `Round ${round}: your next opponent.` : `Pairings are out.`;
    const intro = isNextRound
      ? `<p>You won your last game. Here is round ${round}.</p>`
      : `<p>Registration closed with enough players for a <strong>${fmt}</strong>. ${format === 'ko' ? 'Lose and you\'re out. Win and you get a new opponent by email.' : 'Play everyone once. Win 3, draw 1, loss 0.'}</p>`;
    const replyTo = games.map((g) => g.opponent && g.opponent.email).filter(Boolean);
    return {
      subject: isNextRound ? `Round ${round}: your next opponent` : `Pairings are out — ${fmt}`,
      replyTo: replyTo.length === 1 ? replyTo[0] : undefined,
      html: layout(title, `${intro}
        <p>Email your opponent${games.length > 1 ? 's' : ''} to pick a time and a corner of Anahit. Bring a phone with a chess clock app set to 10+0.</p>
        <ul style="padding-left:18px;margin:0">${rows}</ul>
        <p>Either player reports the result. The other confirms. Silence for ${esc(env.CONFIRM_HOURS)} hours counts as a confirmation.</p>
        ${button(meLink(env, player.token), 'Your player page')}`),
      text: `${title}\n${games.map((g) => g.opponent ? `- ${g.opponent.name} (${g.opponent.company}) ${g.opponent.email}\n  report: ${gameLink(env, player.token, g.id)}` : '- Bye: you advance without playing').join('\n')}\nYour page: ${meLink(env, player.token)}`,
    };
  },

  reported(env, { player, reporter, outcomeText, gameId }) {
    const url = gameLink(env, player.token, gameId);
    return {
      subject: `${first(reporter.name)} reported your game: ${outcomeText}`,
      replyTo: reporter.email,
      html: layout(`Result reported.`, `
        <p><strong>${esc(reporter.name)}</strong> reported: <strong>${esc(outcomeText)}</strong>.</p>
        <p>If that's right, confirm it. If not, dispute it and the organizer will sort it out.</p>
        ${button(url, 'Confirm or dispute')}
        <p style="font-size:12px;color:#5c5548">No reply within ${esc(env.CONFIRM_HOURS)} hours counts as confirmed.</p>`),
      text: `${reporter.name} reported: ${outcomeText}. Confirm or dispute: ${url}`,
    };
  },

  confirmed(env, { player, opponent, outcomeText }) {
    return {
      subject: `Confirmed: ${outcomeText}`,
      replyTo: opponent.email,
      html: layout(`Confirmed.`, `
        <p>Your game against <strong>${esc(opponent.name)}</strong> is in the books: <strong>${esc(outcomeText)}</strong>.</p>
        ${button(env.SITE_URL + '/#standings', 'See standings')}`),
      text: `Confirmed: ${outcomeText} vs ${opponent.name}. Standings: ${env.SITE_URL}/#standings`,
    };
  },

  dispute(env, { game, p1, p2, reporter, result }) {
    return {
      subject: `Dispute on game #${game.id}: ${p1.name} vs ${p2.name}`,
      html: layout(`Dispute on game #${game.id}.`, `
        <p><strong>${esc(p1.name)}</strong> (${esc(p1.email)}) vs <strong>${esc(p2.name)}</strong> (${esc(p2.email)}).</p>
        <p>${esc(reporter.name)} reported <strong>${esc(result)}</strong> (p1 perspective). The opponent disputed it.</p>
        ${button(env.SITE_URL + '/admin', 'Open admin')}`),
      text: `Dispute on game #${game.id}: ${p1.name} (${p1.email}) vs ${p2.name} (${p2.email}). Reported ${result} by ${reporter.name}. Admin: ${env.SITE_URL}/admin`,
    };
  },

  champion(env, { champion }) {
    return {
      subject: `We have a champion: ${champion.name}`,
      html: layout(`We have a champion.`, `
        <p><strong>${esc(champion.name)}</strong> (${esc(champion.company)}) won the Anahit Friendly Chess Tournament.</p>
        <p>Thanks for playing. Go say hi to someone you played.</p>
        ${button(env.SITE_URL, 'See the final bracket')}`),
      text: `${champion.name} (${champion.company}) won the Anahit Friendly Chess Tournament. ${env.SITE_URL}`,
    };
  },
};

export function outcomeText(game, p1, p2) {
  if (game.result === '1-0') return `${p1.name} beat ${p2.name}`;
  if (game.result === '0-1') return `${p2.name} beat ${p1.name}`;
  return `${p1.name} and ${p2.name} drew`;
}
