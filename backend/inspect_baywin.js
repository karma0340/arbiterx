/**
 * Capture ONE full large WS frame from Baywin and analyze it completely
 */
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

async function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const targets = await getTargets();
  const tab = targets.find(t => t.type === 'page' && t.url.includes('baywin'));
  if (!tab) { console.log('No Baywin tab'); return; }

  console.log('Tapping:', tab.url.substring(0, 60));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));
  ws.send(JSON.stringify({ id: 1, method: 'Network.enable' }));

  const bigFrames = [];

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.method === 'Network.webSocketFrameReceived') {
        const payload = msg.params?.response?.payloadData || '';
        // Save FULL content of large frames
        if (payload.length > 500) {
          bigFrames.push({ len: payload.length, full: payload });
          process.stdout.write(`\r  Frames > 500b: ${bigFrames.length}  `);
        }
      }
    } catch (_) {}
  });

  console.log('Waiting 15s...\n');
  await new Promise(r => setTimeout(r, 15000));
  ws.close();

  // Sort and analyze the largest frame
  bigFrames.sort((a, b) => b.len - a.len);
  console.log(`\nLargest frames: ${bigFrames.slice(0, 5).map(f => f.len).join(', ')} bytes`);

  // Parse and deep-inspect the biggest one
  const largest = bigFrames[0];
  if (!largest) { console.log('No frames'); return; }

  try {
    const msg = JSON.parse(largest.full);
    console.log('\n=== TOP LEVEL KEYS ===');
    console.log(Object.keys(msg));

    if (msg.payload?.sports) {
      const sports = msg.payload.sports;
      const [sportId, sport] = Object.entries(sports)[0];
      console.log(`\n=== SPORT: ${sportId.substr(0,8)}... ===`);
      console.log('Sport keys:', Object.keys(sport || {}));

      if (sport?.categories) {
        const [catId, cat] = Object.entries(sport.categories)[0];
        console.log(`\n=== CATEGORY ===`);
        console.log('Cat name:', cat?.name);
        console.log('Cat keys:', Object.keys(cat || {}));

        if (cat?.tournaments) {
          const [tId, tourn] = Object.entries(cat.tournaments)[0];
          console.log(`\n=== TOURNAMENT ===`);
          console.log('Tourn name:', tourn?.name);
          console.log('Tourn keys:', Object.keys(tourn || {}));

          if (tourn?.events) {
            const [eId, ev] = Object.entries(tourn.events)[0];
            console.log(`\n=== EVENT ${eId.substr(0, 8)}... ===`);
            console.log('Event keys:', Object.keys(ev || {}));
            
            // Show full event JSON (limited to 3000 chars)
            const evStr = JSON.stringify(ev, null, 2);
            console.log(evStr.substring(0, 3000));
            
            // Save full event for inspection
            fs.writeFileSync('baywin_event_sample.json', evStr);
            console.log('\n✅ Saved sample event to baywin_event_sample.json');
          }
        }
      }
    }
  } catch (e) {
    console.log('Parse error:', e.message);
    fs.writeFileSync('baywin_largest_frame.txt', largest.full);
    console.log('Saved raw to baywin_largest_frame.txt');
  }
}

main().catch(console.error);
