/**
 * Baywin Live Data Tapper
 * 
 * Connects to your ALREADY-OPEN Baywin Chrome tab via CDP and
 * captures the WebSocket frames streaming live match data in real-time.
 * 
 * This works WITHOUT logging in — live betting data is publicly accessible.
 * 
 * Run: node tap_baywin_live.js
 */

const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const CDP_PORT = 9222;
const CAPTURE_DURATION_MS = 30000; // 30 seconds of capture

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function extractEvents(payload) {
  const events = [];
  try {
    // Strip Socket.io prefix (e.g., "42[...]" or "2", "3")
    const stripped = payload.replace(/^\d+/, '');
    if (!stripped || stripped.length < 10) return [];
    
    const data = JSON.parse(stripped);
    
    // Normalize to array for searching
    const toSearch = Array.isArray(data) ? data : [data];
    
    function searchObj(obj, depth = 0) {
      if (depth > 5 || !obj || typeof obj !== 'object') return;
      
      // Check if this object looks like a match/event
      const home = obj.homeName || obj.home || obj.homeTeam || obj.team1 || obj.participant1;
      const away = obj.awayName || obj.away || obj.awayTeam || obj.team2 || obj.participant2;
      
      if (home && away) {
        events.push({
          id: String(obj.id || obj.eventId || Math.random().toString(36).substr(2, 8)),
          event: `${home} vs ${away}`,
          sport: obj.sport || obj.sportName || obj.sportId || 'Soccer',
          competition: obj.competition || obj.league || obj.tournament || obj.category || 'Unknown',
          odds: {
            home: obj.coeff1 || obj.odds1 || obj.homeOdds,
            draw: obj.coeffX || obj.oddsX || obj.drawOdds,
            away: obj.coeff2 || obj.odds2 || obj.awayOdds,
          },
          bookmaker: 'Baywin',
          scrapedAt: new Date().toISOString()
        });
        return;
      }
      
      // Recurse into arrays and objects
      if (Array.isArray(obj)) {
        obj.slice(0, 50).forEach(item => searchObj(item, depth + 1));
      } else {
        Object.values(obj).forEach(v => {
          if (typeof v === 'object') searchObj(v, depth + 1);
        });
      }
    }
    
    toSearch.forEach(item => searchObj(item));
  } catch (_) {}
  return events;
}

async function main() {
  console.log('🔍 Connecting to Chrome on port 9222...');
  
  const targets = await getTargets();
  const tab = targets.find(t => 
    t.type === 'page' && (t.url.includes('baywin') || t.url.includes('355bay'))
  );

  if (!tab) {
    console.log('❌ No Baywin tab. Open https://355baywin.com/tr-tr/live first.');
    return;
  }

  console.log(`✅ Found: ${tab.title}`);
  console.log(`   URL: ${tab.url}`);

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  // Enable network monitoring
  const sendCmd = (method, params = {}) => {
    const id = Math.floor(Math.random() * 1e6);
    ws.send(JSON.stringify({ id, method, params }));
    return id;
  };

  sendCmd('Network.enable');

  const allFrames = [];
  const allEvents = [];
  let frameCount = 0;

  // Listen for WebSocket frames
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      
      // WebSocket frames from the page
      if (msg.method === 'Network.webSocketFrameReceived') {
        const payload = msg.params?.response?.payloadData || '';
        frameCount++;
        
        if (payload.length > 20) {
          process.stdout.write(`\r📡 WS frames: ${frameCount}  `);
          
          const events = extractEvents(payload);
          if (events.length > 0) {
            allEvents.push(...events);
            console.log(`\n🎯 MATCH DATA from frame! Got ${events.length} event(s): ${events.map(e => e.event).join(', ')}`);
          } else if (payload.length < 500) {
            // Save small frames for inspection
            allFrames.push({ payload: payload.substring(0, 200), len: payload.length });
          }
        }
      }

      // HTTP response data (XHR/Fetch)
      if (msg.method === 'Network.responseReceived') {
        const url = msg.params?.response?.url || '';
        const mime = msg.params?.response?.mimeType || '';
        if (mime.includes('json') && (url.includes('sport') || url.includes('live') || url.includes('event'))) {
          console.log(`\n📡 JSON response: ${url.substring(0, 80)}`);
        }
      }
    } catch (_) {}
  });

  console.log(`\n⏳ Capturing live data for ${CAPTURE_DURATION_MS / 1000}s...`);
  console.log('   (The page must be on the live betting section)\n');

  await new Promise(resolve => setTimeout(resolve, CAPTURE_DURATION_MS));

  ws.close();

  console.log(`\n\n📊 RESULTS:`);
  console.log(`   WS frames captured: ${frameCount}`);
  console.log(`   Events extracted: ${allEvents.length}`);

  if (allEvents.length > 0) {
    console.log('\n✅ Real live events:');
    allEvents.slice(0, 10).forEach(e => console.log(`   ${e.event} (${e.sport})`));
    
    const output = allEvents.map(e => ({
      id: e.id,
      sport: 'Soccer',
      competition: e.competition,
      event: e.event,
      odds: [e.odds.home, e.odds.draw, e.odds.away].filter(Boolean).map(Number),
      bookmaker: 'Baywin',
      scrapedAt: e.scrapedAt
    }));
    
    fs.writeFileSync('baywin_live_data.json', JSON.stringify(output, null, 2));
    fs.writeFileSync('../backend/baywin_odds.json', JSON.stringify(output, null, 2));
    console.log('\n✅ Saved to baywin_live_data.json and baywin_odds.json');
  } else {
    console.log('\n❌ No match events found in WS frames.');
    if (allFrames.length > 0) {
      console.log('\n📋 Sample raw frames for analysis:');
      allFrames.slice(0, 5).forEach((f, i) => console.log(`   [${i}] "${f.payload}"`));
      fs.writeFileSync('baywin_raw_frames.json', JSON.stringify(allFrames.slice(0, 20), null, 2));
      console.log('\n   Saved to baywin_raw_frames.json for inspection');
    }
    console.log('\n💡 Try navigating the Baywin tab to https://355baywin.com/tr-tr/live and run again');
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
