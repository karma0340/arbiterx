/**
 * Baywin Live Scraper — Navigate to Sportsbook Widget Directly
 *
 * The sportsbook widget URL is: https://api.355baywin.com/sportsbook (with params)
 * When navigated to directly, the JS app starts fresh and sends the initial snapshot.
 *
 * We use CDP to open a NEW tab navigating directly to the widget URL,
 * capture the first WS messages, then close the tab.
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
};

const eventState = new Map();
let totalFrames = 0;
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
    totalFrames++;
    namedCount = [...eventState.values()].filter(e => e.home && e.away).length;
  } catch (_) {}
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  // Get Chrome's "browser" target to open new tabs
  const browserWsUrl = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json/version`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d).webSocketDebuggerUrl); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });

  console.log('Browser WS:', browserWsUrl?.substring(0, 60));

  // Connect to browser-level CDP
  const browserWs = new WebSocket(browserWsUrl);
  await new Promise(r => browserWs.once('open', r));

  const sendCmd = (ws, method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1e7);
      const h = (msg) => {
        const d = JSON.parse(msg);
        if (d.id !== id) return;
        ws.off('message', h);
        if (d.error) reject(new Error(JSON.stringify(d.error)));
        else resolve(d.result);
      };
      ws.on('message', h);
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { ws.off('message', h); reject(new Error('Timeout: ' + method)); }, 15000);
    });
  };

  // Open a new tab with the sportsbook URL (direct access with no wrapper)  
  // Try different possible sportsbook entry URLs
  const sbUrls = [
    'https://api.355baywin.com/sportsbook',
    'https://api.355baywin.com/sportsbook/?sport=live',
    'https://api.355baywin.com/',
  ];
  
  let tabId = null;
  try {
    const { targetId } = await sendCmd(browserWs, 'Target.createTarget', { 
      url: sbUrls[0],
      newWindow: false,
    });
    tabId = targetId;
    console.log('New tab created:', targetId?.substring(0, 20));
  } catch(e) {
    console.log('createTarget error:', e.message);
  }

  if (!tabId) {
    // Fallback: use existing Baywin tab and navigate inside
    const targets = await httpGet(`http://localhost:${CDP_PORT}/json`);
    const baywin = targets.find(t => t.type === 'page' && t.url.includes('baywin'));
    if (!baywin) { console.log('No baywin tab'); return; }
    tabId = baywin.id;
  }

  // Connect and monitor the new tab
  await new Promise(r => setTimeout(r, 2000));
  const targets = await httpGet(`http://localhost:${CDP_PORT}/json`);
  const newTab = targets.find(t => t.id === tabId || (tabId && t.url?.includes('api.355baywin.com')));
  
  if (!newTab?.webSocketDebuggerUrl) {
    console.log('New tab not found, trying all targets for api.355baywin.com...');
    const apiTab = targets.find(t => t.url?.includes('api.355baywin.com'));
    if (apiTab) console.log('Found api tab:', apiTab.url.substring(0, 60));
  }

  const tabTarget = newTab || targets.find(t => t.url?.includes('355baywin'));
  if (!tabTarget) { console.log('No usable tab'); return; }

  console.log(`Monitoring: ${tabTarget.url?.substring(0, 70)}`);
  const tabWs = new WebSocket(tabTarget.webSocketDebuggerUrl);
  await new Promise(r => tabWs.once('open', r));
  
  await sendCmd(tabWs, 'Network.enable');
  
  tabWs.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.method === 'Network.webSocketFrameReceived') {
        const payload = msg.params?.response?.payloadData || '';
        if (payload.length > 100) {
          processPayload(payload);
          process.stdout.write(`\r[Baywin] Frames: ${totalFrames} | Named: ${namedCount}/${eventState.size}  `);
        }
      }
    } catch (_) {}
  });

  console.log('\nCapturing for 20s...\n');
  await new Promise(r => setTimeout(r, 20000));
  tabWs.close();
  browserWs.close();

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

  console.log(`\n===== RESULTS: ${output.length} events =====`);
  if (output.length > 0) {
    fs.writeFileSync(path.join(__dirname, '..', 'baywin_odds.json'), JSON.stringify(output, null, 2));
    output.slice(0, 5).forEach(e => console.log(`  ${e.event} | ${e.odds.join(', ')}`));
  }
}

main().catch(console.error);
