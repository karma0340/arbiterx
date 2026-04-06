/**
 * Baywin Full Event Tapper v2
 * 
 * Captures ALL WS frames from the live Baywin tab (including large ones)
 * and extracts match events from the ErisGaming sumstats protocol.
 * 
 * Protocol structure:
 * { type: 'event', uri: 'sumstats.frontserver.events_updates.erisgaming',
 *   payload: { versions: [...], sports: { [sportId]: { events: {...} } } } }
 * 
 * Run: node tap_baywin_v2.js
 */

const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const CDP_PORT = 9222;
const CAPTURE_DURATION_MS = 30000;

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

/**
 * Parse ErisGaming sumstats payload to extract live events
 */
function extractFromSumstats(raw) {
  const events = [];
  try {
    const msg = JSON.parse(raw);
    
    // Handle ErisGaming protocol
    if (msg.type === 'event' && msg.payload) {
      const sports = msg.payload.sports || {};
      
      // Each sport key has events
      for (const [sportId, sportData] of Object.entries(sports)) {
        if (!sportData || !sportData.events) continue;
        
        for (const [eventId, ev] of Object.entries(sportData.events)) {
          const home = ev.homeName || ev.home || ev.homeTeam || ev.name?.split(' - ')[0];
          const away = ev.awayName || ev.away || ev.awayTeam || ev.name?.split(' - ')[1];
          
          if (!home || !away) continue;
          
          // Extract odds from markets
          let homeOdds = null, drawOdds = null, awayOdds = null;
          const markets = ev.markets || ev.odds || {};
          for (const [mId, market] of Object.entries(markets)) {
            const outcomes = market.outcomes || market.selections || {};
            const vals = Object.values(outcomes);
            if (vals.length >= 2) {
              homeOdds = homeOdds || vals[0]?.odds || vals[0]?.price || vals[0]?.coeff;
              drawOdds = drawOdds || (vals.length >= 3 ? vals[1]?.odds || vals[1]?.price : null);
              awayOdds = awayOdds || vals[vals.length - 1]?.odds || vals[vals.length - 1]?.price;
            }
          }
          
          events.push({
            id: String(eventId),
            sport: ev.sportName || ev.sport || sportId || 'Soccer',
            competition: ev.categoryName || ev.competition || ev.league || ev.tournamentName || 'Live',
            event: `${home} vs ${away}`,
            odds: [homeOdds, drawOdds, awayOdds].filter(Boolean).map(Number),
            bookmaker: 'Baywin',
            scrapedAt: new Date().toISOString()
          });
        }
      }
    }
    
    // Also try plain array format
    if (Array.isArray(msg)) {
      for (const ev of msg) {
        const home = ev.homeName || ev.home || ev.homeTeam;
        const away = ev.awayName || ev.away || ev.awayTeam;
        if (home && away) {
          events.push({
            id: String(ev.id || ''),
            sport: ev.sportName || ev.sport || 'Soccer',
            competition: ev.categoryName || ev.league || 'Live',
            event: `${home} vs ${away}`,
            odds: [ev.coeff1, ev.coeffX, ev.coeff2].filter(Boolean).map(Number),
            bookmaker: 'Baywin',
            scrapedAt: new Date().toISOString()
          });
        }
      }
    }
  } catch (_) {}
  return events;
}

async function main() {
  const targets = await getTargets();
  const tab = targets.find(t => t.type === 'page' && t.url.includes('baywin'));
  
  if (!tab) {
    console.log('❌ No Baywin tab found');
    return;
  }
  
  console.log(`✅ Tapping: ${tab.url}`);
  
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.once('open', resolve));
  
  ws.send(JSON.stringify({ id: 1, method: 'Network.enable' }));

  const allEvents = [];
  const rawFrames = [];  // Save ALL frames
  let frameCount = 0;
  let bigFrameCount = 0;
  
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      
      if (msg.method === 'Network.webSocketFrameReceived') {
        const payload = msg.params?.response?.payloadData || '';
        frameCount++;
        
        if (payload.length > 10) {
          // Save ALL frames (not just small ones)
          if (rawFrames.length < 50) {
            rawFrames.push({ 
              len: payload.length, 
              preview: payload.substring(0, 300) 
            });
          }

          if (payload.length > 100) {
            bigFrameCount++;
            process.stdout.write(`\r📡 Frames: ${frameCount} (${bigFrameCount} large)  `);
            
            const events = extractFromSumstats(payload);
            if (events.length > 0) {
              allEvents.push(...events);
              console.log(`\n🎯 Got ${events.length} events from ${bigFrameCount}th large frame!`);
              events.slice(0, 3).forEach(e => console.log(`   ${e.event}`));
            }
          }
        }
      }
    } catch (_) {}
  });

  console.log(`⏳ Capturing for ${CAPTURE_DURATION_MS / 1000}s...\n`);
  await new Promise(r => setTimeout(r, CAPTURE_DURATION_MS));
  ws.close();

  console.log(`\n\n📊 Results:`);
  console.log(`   Total frames: ${frameCount}`);
  console.log(`   Large frames: ${bigFrameCount}`);
  console.log(`   Events found: ${allEvents.length}`);

  // Save raw frames for inspection  
  fs.writeFileSync('baywin_all_frames.json', JSON.stringify(rawFrames, null, 2));
  console.log(`\n📋 Saved ${rawFrames.length} frames to baywin_all_frames.json`);

  if (allEvents.length > 0) {
    fs.writeFileSync('baywin_odds.json', JSON.stringify(allEvents, null, 2));
    console.log(`✅ Saved ${allEvents.length} events to baywin_odds.json!`);
    console.log('\nSample events:');
    allEvents.slice(0, 5).forEach(e => console.log(`  ${e.event} - odds: ${e.odds.join(', ')}`));
  } else {
    console.log('\n💡 No events extracted. Check baywin_all_frames.json for the data structure.');
    console.log('   Hint: Look for the frame that is MUCH larger than the others.');
    
    // Show frame size distribution
    const sizes = rawFrames.map(f => f.len).sort((a,b) => b-a);
    console.log(`   Frame sizes (largest first): ${sizes.slice(0, 10).join(', ')}`);
    
    // Show the largest frame preview
    const largest = rawFrames.sort((a,b) => b.len - a.len)[0];
    if (largest) {
      console.log(`\n   Largest frame (${largest.len} bytes):`);
      console.log(`   ${largest.preview}`);
    }
  }
}

main().catch(console.error);
