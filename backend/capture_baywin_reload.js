/**
 * Baywin Full Snapshot Capture
 *
 * Key insight: The full event snapshot (with team names) is ONLY sent after
 * the WebSocket first connects. All subsequent messages are differential updates.
 *
 * Strategy: 
 * 1. Connect to the open Baywin Chrome tab via CDP
 * 2. Use Page.reload() to trigger a page refresh
 * 3. Immediately start capturing WS frames from the reload
 * 4. The first large frames after refresh will contain the full snapshot
 *
 * The tab remains open and visible in Chrome throughout.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CDP_PORT = 9222;

const SPORT_NAMES = {
  'd693645e-cf1d-11e9-82b4-0242ac13000a': 'Soccer',
  'd69250c8-cf1d-11e9-b1d7-0242ac13000a': 'Basketball',
  'd6934640-cf1d-11e9-864b-0242ac13000a': 'Tennis',
  'd6935a54-cf1d-11e9-978e-0242ac13000a': 'Ice Hockey',
  'd6929204-cf1d-11e9-aed5-0242ac13000a': 'American Football',
  'fb6d3b06-0c0d-4a9e-b612-2c41bf08807f': 'Boxing',
};

const eventState = new Map();
let frameCount = 0;
let namedCount = 0;

function processPayload(payload) {
  try {
    const msg = JSON.parse(payload);
    if (msg.type !== 'event' || !msg.payload?.sports) return;
    for (const [sportId, sport] of Object.entries(msg.payload.sports)) {
      if (!sport) continue;
      const sportName = SPORT_NAMES[sportId] || 'Soccer';
      for (const [, cat] of Object.entries(sport.categories || {})) {
        const catName = cat?.name || '';
        for (const [, tourn] of Object.entries(cat?.tournaments || {})) {
          const tournName = tourn?.name || '';
          const competition = [catName, tournName].filter(Boolean).join(' – ') || 'Live';
          for (const [eventId, ev] of Object.entries(tourn?.events || {})) {
            if (!ev) continue;
            const s = eventState.get(eventId) || {
              id: eventId, sport: sportName, competition, home: null, away: null, odds: {},
            };
            const parts = ev.diff?.participants;
            if (Array.isArray(parts) && parts.length >= 2) {
              if (parts[0]?.name) s.home = parts[0].name;
              if (parts[1]?.name) s.away = parts[1].name;
            }
            const evName = ev.diff?.extraInfo?.eventName;
            if (evName && !s.home && evName.includes(' - ')) {
              const [h, a] = evName.split(' - ');
              s.home = h?.trim();
              s.away = a?.trim();
            }
            if (competition !== 'Live') s.competition = competition;
            for (const scope of Object.values(ev.scopes || {})) {
              for (const market of Object.values(scope?.markets || {})) {
                const entries = Object.entries(market?.outcomes || {});
                if (entries.length < 2 || entries.length > 3) continue;
                for (const [oKey, o] of entries) {
                  const c = o?.coefficient;
                  if (!c) continue;
                  if (oKey.includes('p1') || oKey.endsWith('::1')) s.odds.home = c;
                  else if (oKey.includes('::x') || oKey.includes('draw')) s.odds.draw = c;
                  else if (oKey.includes('p2') || oKey.endsWith('::2')) s.odds.away = c;
                }
              }
            }
            eventState.set(eventId, s);
          }
        }
      }
    }
    frameCount++;
    namedCount = [...eventState.values()].filter(e => e.home && e.away).length;
    process.stdout.write(`\r[Baywin] Frames: ${frameCount} | 🔴 REAL events: ${namedCount}/${eventState.size}  `);
  } catch (_) {}
}

async function main() {
  console.log('[Baywin] Connecting to Chrome CDP...');
  
  const targets = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  // Get all Baywin page targets
  const baywinTargets = targets.filter(t => 
    t.type === 'page' && (t.url.includes('baywin') || t.url.includes('api3kut'))
  );
  
  console.log(`[Baywin] Baywin page targets: ${baywinTargets.length}`);
  baywinTargets.forEach(t => console.log(`  [${t.id?.substring(0, 12)}] ${t.url?.substring(0, 80)}`));

  if (baywinTargets.length === 0) {
    console.log('[Baywin] No Baywin tab found! Please open https://355baywin.com/tr-tr/live in Chrome.');
    return;
  }

  // Use the first Baywin tab
  const target = baywinTargets[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  // Enable Network monitoring first
  const sendCmd = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 1e7);
      const h = (msg) => {
        const d = JSON.parse(msg);
        if (d.id === id) { ws.off('message', h); resolve(d.result); }
      };
      ws.on('message', h);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await sendCmd('Network.enable');
  await sendCmd('Page.enable');

  // Set up WS frame listener BEFORE reload
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.method === 'Network.webSocketFrameReceived') {
        const payload = msg.params?.response?.payloadData || '';
        if (payload.length > 100) processPayload(payload);
      }
    } catch (_) {}
  });

  // RELOAD the page to get the initial snapshot
  console.log('\n[Baywin] 🔄 Reloading Baywin tab to capture initial WS snapshot...');
  await sendCmd('Page.reload', { ignoreCache: true });
  
  console.log('[Baywin] Waiting 20s for initial snapshot frames...');
  
  // Wait in stages
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 4000));
    console.log(`\n[Baywin] ${4*(i+1)}s: frames=${frameCount}, named=${namedCount}/${eventState.size}`);
    if (namedCount >= 5) {
      console.log('[Baywin] ✅ Got enough real events!');
      break;
    }
  }

  ws.close();

  const output = [...eventState.values()]
    .filter(e => e.home && e.away)
    .map(e => ({
      id: e.id, sport: e.sport, competition: e.competition,
      event: `${e.home} vs ${e.away}`,
      odds: [e.odds.home, e.odds.draw, e.odds.away]
        .filter(v => v != null && !isNaN(v)).map(Number),
      bookmaker: 'Baywin', isLive: true,
      link: `https://355baywin.com/tr-tr/live/event/${e.id}`,
      scrapedAt: new Date().toISOString(),
    }));

  console.log(`\n\n===== BAYWIN RESULTS =====`);
  console.log(`Total frames: ${frameCount}, Events tracked: ${eventState.size}, Named: ${output.length}`);

  if (output.length > 0) {
    const outPath = path.join(__dirname, '..', 'baywin_odds.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\n✅ REAL DATA: ${output.length} events saved!`);
    output.slice(0, 8).forEach(e =>
      console.log(`  ⚽ ${e.event} [${e.sport}] (${e.competition}) odds: ${e.odds.map(o=>o.toFixed(2)).join(', ')}`)
    );
  } else {
    // Save the raw state for inspection even without names
    const debug = {
      frameCount, eventCount: eventState.size,
      sample: [...eventState.values()].slice(0, 3),
      allIds: [...eventState.keys()].slice(0, 10),
    };
    fs.writeFileSync(path.join(__dirname, '..', 'baywin_debug.json'), JSON.stringify(debug, null, 2));
    console.log(`⚠️ 0 named. Debug saved to baywin_debug.json`);
  }
}

main().catch(e => { console.error('[Baywin] Fatal:', e.message); process.exit(1); });
