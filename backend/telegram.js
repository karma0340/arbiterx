/**
 * ArbiterX Telegram Notifications
 *
 * Sends a Telegram message when the matching engine detects real arbitrage.
 *
 * SETUP (free, takes 2 minutes):
 * 1. Open Telegram → search @BotFather → send /newbot
 * 2. Follow prompts → copy your BOT TOKEN
 * 3. Start a chat with your new bot, send it any message
 * 4. Visit: https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
 * 5. Copy the "chat":{"id":XXXXXXX} value
 * 6. Add to backend/.env:
 *      TELEGRAM_BOT_TOKEN=1234567890:ABCdefGhIJKlmNoPQRsTUVwxyz
 *      TELEGRAM_CHAT_ID=123456789
 *      TELEGRAM_MIN_ARB=2.0   (only alert if arb% > this value)
 */

const https = require('https');

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID    = process.env.TELEGRAM_CHAT_ID   || '';
const MIN_ARB    = parseFloat(process.env.TELEGRAM_MIN_ARB || '2.0');

let lastSentAt = {}; // event key → timestamp, to prevent spam

function sendTelegramMessage(text) {
  if (!BOT_TOKEN || !CHAT_ID) return; // Not configured
  const body = JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };

  const req = https.request(options, res => {
    if (res.statusCode !== 200) {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => console.error('[Telegram] Error:', d.slice(0, 200)));
    }
  });
  req.on('error', e => console.error('[Telegram] Request error:', e.message));
  req.write(body);
  req.end();
}

/**
 * Called when the matching engine emits an arbFound event.
 * Only sends if arb% > MIN_ARB and same alert not sent in last 5 minutes.
 */
function notifyArb(opportunity) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  if ((opportunity.arbPercentage || 0) < MIN_ARB) return;

  // Anti-spam: same event max once per 5 minutes
  const dedupKey = opportunity.event + '::' + opportunity.market;
  const now = Date.now();
  if (lastSentAt[dedupKey] && now - lastSentAt[dedupKey] < 5 * 60 * 1000) return;
  lastSentAt[dedupKey] = now;

  const arb = (opportunity.arbPercentage || 0).toFixed(2);
  const legs = (opportunity.legs || [
    { selection: 'Back', bookmaker: opportunity.bookmaker, odds: opportunity.bookmakerOdds },
    { selection: 'Lay',  bookmaker: opportunity.exchanger, odds: opportunity.exchangerOdds },
  ]);

  const legsText = legs.map(l =>
    `  ${l.selection}: <b>${l.bookmaker}</b> @ <b>${l.odds?.toFixed ? l.odds.toFixed(2) : l.odds}</b>`
  ).join('\n');

  // Stake calculator: €1000 budget
  const budget = 1000;
  const impliedSum = legs.reduce((s, l) => s + (l.odds > 1 ? 1 / l.odds : 0), 0);
  const profit = impliedSum < 1 ? ((1 - impliedSum) / impliedSum * budget).toFixed(2) : '?';

  const message =
`🎯 <b>ARBITRAGE ALERT</b>

⚽ <b>${opportunity.event}</b>
📊 ${opportunity.competition || 'Live'}
💰 <b>+${arb}% profit</b>

${legsText}

📈 Est. profit on €1000: <b>€${profit}</b>
⏰ ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST

<i>${opportunity.strategy || 'multi-bookmaker arb'}</i>`;

  sendTelegramMessage(message);
  console.log(`[Telegram] 📨 Alert sent: ${opportunity.event} +${arb}%`);
}

function isConfigured() {
  return !!(BOT_TOKEN && CHAT_ID);
}

// Clean up old dedup entries every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const key of Object.keys(lastSentAt)) {
    if (lastSentAt[key] < cutoff) delete lastSentAt[key];
  }
}, 10 * 60 * 1000);

module.exports = { notifyArb, isConfigured, sendTelegramMessage };
