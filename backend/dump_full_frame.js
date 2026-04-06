/**
 * Capture ONE complete full WS frame (no truncation) and deeply inspect its structure
 * to find where team names are stored
 */
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const CDP_PORT = 9222;

function getTargets() {
  return new Promise((res, rej) => {
    http.get(`http://localhost:${CDP_PORT}/json`, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

async function main() {
  const targets = await getTargets();
  const target = targets.find(t => t.type === 'page' && t.url.includes('baywin'));
  if (!target) { console.log('No Baywin tab'); return; }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));
  ws.send(JSON.stringify({ id: 1, method: 'Network.enable' }));

  console.log('Waiting for 1 large WS frame...');
  
  const largeFrames = [];
  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.method === 'Network.webSocketFrameReceived') {
        const payload = msg.params?.response?.payloadData || '';
        if (payload.length > 1000) {
          largeFrames.push(payload);
          process.stdout.write(`\r  Got ${largeFrames.length} large frames (${payload.length} bytes)  `);
        }
      }
    } catch(_) {}
  });

  await new Promise(r => setTimeout(r, 10000));
  ws.close();

  if (largeFrames.length === 0) { console.log('\nNo large frames!'); return; }
  
  // Deep inspect the largest one
  const largest = largeFrames.sort((a, b) => b.length - a.length)[0];
  console.log(`\n\nLargest frame: ${largest.length} bytes`);
  
  // Save full raw
  fs.writeFileSync('baywin_full_frame.json', largest);
  console.log('Full frame saved to baywin_full_frame.json');
  
  // Parse and find team names deep in the tree
  const msg = JSON.parse(largest);
  const sports = msg?.payload?.sports || {};
  
  for (const [sportId, sport] of Object.entries(sports)) {
    console.log(`\nSport: ${sportId.substring(0,8)}`);
    for (const [catId, cat] of Object.entries(sport?.categories || {})) {
      for (const [tId, tourn] of Object.entries(cat?.tournaments || {})) {
        const events = tourn?.events || {};
        const eventCount = Object.keys(events).length;
        if (eventCount === 0) continue;
        
        // Show first event's full structure
        const [eId, ev] = Object.entries(events)[0];
        console.log(`  Tournament "${tourn?.name}" → ${eventCount} events`);
        console.log(`  First event [${eId.substring(0,8)}]:`);
        
        // Print the diff object in detail
        if (ev?.diff) {
          console.log(`    diff.participants: ${JSON.stringify(ev.diff.participants)}`);
          console.log(`    diff.status: ${JSON.stringify(ev.diff.status)}`);
          console.log(`    diff.startTime: ${JSON.stringify(ev.diff.startTime)}`);
          console.log(`    diff.extraInfo.eventName: ${JSON.stringify(ev.diff.extraInfo?.eventName)}`);
          console.log(`    diff.changeType: ${JSON.stringify(ev.diff.changeType)}`);
          console.log(`    diff keys: ${Object.keys(ev.diff).join(', ')}`);
        }
        
        // Look for strings that look like team names in the entire event object
        const allStrings = [];
        function findStrings(obj, depth = 0) {
          if (depth > 8 || !obj) return;
          if (typeof obj === 'string' && obj.length > 3 && obj.length < 60 && /[a-zA-ZğüişöçĞÜİŞÖÇ]/.test(obj)) {
            allStrings.push(obj);
            return;
          }
          if (typeof obj === 'object') {
            for (const v of Object.values(obj)) findStrings(v, depth + 1);
          }
        }
        findStrings(ev);
        
        console.log(`    All strings in event:`, allStrings.slice(0, 20));
        
        break; // Just first event
      }
      break; // Just first cat
    }
  }
}

main().catch(console.error);
