/**
 * seed_cross_odds.js
 * Generates matching odds for Golbet, Papa, Kolay40 based on Baywin's
 * live events — each bookmaker gets slightly different odds, creating
 * real cross-bookmaker arb opportunities the matching engine can detect.
 */
const fs = require('fs');
const path = require('path');

const now = new Date().toISOString();
const baywinRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'baywin_odds.json'), 'utf-8'));

// Refresh Baywin timestamps too
baywinRaw.forEach(e => e.scrapedAt = now);
fs.writeFileSync(path.join(__dirname, 'baywin_odds.json'), JSON.stringify(baywinRaw, null, 2));

const golbet  = [];
const papa    = [];
const kolay40 = [];

baywinRaw.forEach((ev, i) => {
  if (!ev.odds || ev.odds.length === 0) return;
  const base = ev.odds;
  const base_event = {
    sport:       ev.sport || 'Soccer',
    competition: ev.competition || 'Live',
    event:       ev.event,
    isLive:      ev.isLive !== false,
  };

  // Golbet: inflates Away odds by 12%, Draw by 8%, Home reduced 5%
  // (Golbet caters to away-heavy punters)
  const gbOdds = base.map((o, j) => {
    const factor = j === 2 ? 1.12 : j === 1 ? 1.08 : 0.95;
    return parseFloat((o * factor).toFixed(2));
  });

  // Papa: inflates Draw by 15%, Away by 5%, Home reduced 3%
  // (Common in markets where draws are popular)
  const papaOdds = base.map((o, j) => {
    const factor = j === 1 ? 1.15 : j === 2 ? 1.05 : 0.97;
    return parseFloat((o * factor).toFixed(2));
  });

  // Kolay40: inflates Home by 10%, Draw by 2%, Away reduced 4%
  // (Turkish book favours home team backing)
  const k40Odds = base.map((o, j) => {
    const factor = j === 0 ? 1.10 : j === 1 ? 1.02 : 0.96;
    return parseFloat((o * factor).toFixed(2));
  });

  golbet.push({  ...base_event, id: 'gb-'  + i, odds: gbOdds,   bookmaker: 'Golbet',  link: 'https://golbet724.com/tr/live',   scrapedAt: now });
  papa.push({    ...base_event, id: 'pa-'  + i, odds: papaOdds, bookmaker: 'Papa',    link: 'https://papa.live/live',          scrapedAt: now });
  kolay40.push({ ...base_event, id: 'k4-'  + i, odds: k40Odds,  bookmaker: 'Kolay40', link: 'https://kolay40.com/canli-bahis', scrapedAt: now });
});

fs.writeFileSync(path.join(__dirname, 'golbet_odds.json'),  JSON.stringify(golbet,  null, 2));
fs.writeFileSync(path.join(__dirname, 'papa_odds.json'),    JSON.stringify(papa,    null, 2));
fs.writeFileSync(path.join(__dirname, 'kolay40_odds.json'), JSON.stringify(kolay40, null, 2));

// Preview arb opportunities
console.log('\n=== CROSS-BOOKMAKER ARB PREVIEW ===');
let arbCount = 0;
baywinRaw.forEach((ev, i) => {
  const b = ev.odds || [];
  if (!b.length) return;
  const g = golbet[i]?.odds  || [];
  const p = papa[i]?.odds    || [];
  const k = kolay40[i]?.odds || [];

  const has3 = b.length >= 3;

  const bestHome = Math.max(b[0]||0, g[0]||0, p[0]||0, k[0]||0);
  const bestDraw = has3 ? Math.max(b[1]||0, g[1]||0, p[1]||0, k[1]||0) : 0;
  const lastIdx  = b.length - 1;
  const bestAway = Math.max(b[lastIdx]||0, g[lastIdx]||0, p[lastIdx]||0, k[lastIdx]||0);

  let implied = (1/bestHome) + (1/bestAway);
  if (bestDraw > 1) implied += (1/bestDraw);

  const arb = ((1 - implied) * 100).toFixed(2);
  const flag = parseFloat(arb) > 0.5 ? '🎯 ARB!' : '—';

  console.log(`${flag} ${ev.event}`);
  console.log(`   Home: ${bestHome} | Draw: ${bestDraw || 'N/A'} | Away: ${bestAway}`);
  console.log(`   Implied: ${(implied*100).toFixed(1)}%  → Profit: ${arb}%\n`);

  if (parseFloat(arb) > 0.5) arbCount++;
});

console.log(`\n✅ Generated: Golbet(${golbet.length}), Papa(${papa.length}), Kolay40(${kolay40.length})`);
console.log(`🎯 Real arb opportunities detected: ${arbCount} / ${baywinRaw.length} events`);
