/**
 * Full Chrome Target Scanner + Sportsbook Context WS Tapper
 *
 * Connects to Chrome CDP and:
 * 1. Lists ALL targets (pages, workers, iframes, service workers)
 * 2. Finds the api.355baywin.com sportsbook target
 * 3. Creates a CDP session for that specific target
 * 4. Enables Network monitoring on that session to capture WS frames
 * 5. Extracts live event data from the captured frames
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CDP_PORT = 9222;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

const SPORT_NAMES = {
  'd693645e-cf1d-11e9-82b4-0242ac13000a': 'Soccer',
  'd69250c8-cf1d-11e9-b1d7-0242ac13000a': 'Basketball',
  'd6934640-cf1d-11e9-864b-0242ac13000a': 'Tennis',
  'd6935a54-cf1d-11e9-978e-0242ac13000a': 'Ice Hockey',
  'd6929204-cf1d-11e9-aed5-0242ac13000a': 'American Football',
};

const eventState = new Map();

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
            const s = eventState.get(eventId) || { id: eventId, sport: sportName, competition, home: null, away: null, odds: {} };
            const parts = ev.diff?.participants;
            if (Array.isArray(parts) && parts.length >= 2) {
              if (parts[0]?.name) s.home = parts[0].name;
              if (parts[1]?.name) s.away = parts[1].name;
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
  } catch (_) {}
}

async function tapTarget(target, durationMs = 20000) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let frames = 0;

    ws.once('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Network.enable' }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.method === 'Network.webSocketFrameReceived') {
          const payload = msg.params?.response?.payloadData || '';
          if (payload.length > 100) {
            frames++;
            processPayload(payload);
            const named = [...eventState.values()].filter(e => e.home && e.away).length;
            process.stdout.write(`\r  [${target.type}] Frames: ${frames} | Named events: ${named}/${eventState.size}  `);
          }
        }
      } catch (_) {}
    });

    setTimeout(() => { ws.close(); resolve(frames); }, durationMs);
    ws.on('error', () => resolve(0));
  });
}

async function main() {
  // Get ALL targets
  const targets = await httpGet(`http://localhost:${CDP_PORT}/json/list`).catch(() =>
    httpGet(`http://localhost:${CDP_PORT}/json`)
  );

  console.log(`\n📋 ALL Chrome Targets (${targets.length}):`);
  targets.forEach(t => {
    console.log(`  [${t.type}] ${t.url?.substring(0, 80) || t.title || '?'}`);
  });

  // Filter for sportsbook-related targets
  const sportsbookTargets = targets.filter(t =>
    t.webSocketDebuggerUrl && (
      t.url?.includes('355baywin') ||
      t.url?.includes('api3kut') ||
      t.url?.includes('baywin') ||
      t.url?.includes('sportsbook')
    )
  );

  console.log(`\n🎯 Sportsbook targets: ${sportsbookTargets.length}`);
  sportsbookTargets.forEach(t => console.log(`  [${t.type}] ${t.url?.substring(0, 80)}`));

  if (sportsbookTargets.length === 0) {
    console.log('\n⚠️ No sportsbook targets found.');
    console.log('Trying ALL targets with webSocketDebuggerUrl...');
    
    // Try every target
    const allTappable = targets.filter(t => t.webSocketDebuggerUrl && t.type !== 'browser');
    for (const target of allTappable) {
      console.log(`\n  Tapping [${target.type}] ${target.url?.substring(0, 60) || '?'}...`);
      const frames = await tapTarget(target, 5000);
      const named = [...eventState.values()].filter(e => e.home && e.away).length;
      console.log(`  → ${frames} frames, ${named} named events`);
      if (named > 0) break;
    }
  } else {
    for (const target of sportsbookTargets) {
      console.log(`\n🔌 Tapping: [${target.type}] ${target.url?.substring(0, 70)}`);
      const frames = await tapTarget(target, 20000);
      const named = [...eventState.values()].filter(e => e.home && e.away).length;
      console.log(`\n  Done: ${frames} frames, ${named} named events`);
      if (named >= 3) break;
    }
  }

  const output = [...eventState.values()]
    .filter(e => e.home && e.away)
    .map(e => ({
      id: e.id, sport: e.sport, competition: e.competition,
      event: `${e.home} vs ${e.away}`,
      odds: [e.odds.home, e.odds.draw, e.odds.away]
        .filter(v => v != null && !isNaN(v)).map(Number),
      bookmaker: 'Baywin', isLive: true,
      scrapedAt: new Date().toISOString(),
    }));

  console.log(`\n\n===== BAYWIN RESULTS =====`);
  console.log(`Events: ${output.length}`);
  
  if (output.length > 0) {
    fs.writeFileSync(path.join(__dirname, '..', 'baywin_odds.json'), JSON.stringify(output, null, 2));
    console.log(`✅ SAVED to baywin_odds.json!`);
    output.slice(0, 5).forEach(e => console.log(`  ${e.event} | ${e.sport} | [${e.odds.join(', ')}]`));
  }
}

main().catch(console.error);
