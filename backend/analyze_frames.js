/**
 * Analyze the large WS frames captured from Baywin to find the exact data structure
 * Reads baywin_all_frames.json and shows the deep structure of the events
 */

const fs = require('fs');

// Read raw frames
const frames = JSON.parse(fs.readFileSync('baywin_all_frames.json', 'utf-8'));

// Find the largest frames (most likely to have event data)
const bigFrames = frames
  .filter(f => f.len > 500)
  .sort((a, b) => b.len - a.len)
  .slice(0, 5);

console.log(`Analyzing ${bigFrames.length} largest frames (of ${frames.length} total)...\n`);

for (const frame of bigFrames) {
  try {
    const msg = JSON.parse(frame.preview + '...'.repeat(0)); // may be truncated
    
    if (msg.payload?.sports) {
      for (const [sportId, sport] of Object.entries(msg.payload.sports)) {
        console.log(`\n=== Sport: ${sportId.substring(0, 8)}... ===`);
        
        if (sport?.categories) {
          for (const [catId, cat] of Object.entries(sport.categories)) {
            console.log(`  Category: ${catId.substring(0, 8)}... name="${cat?.name || '?'}"`);
            
            if (cat?.tournaments) {
              for (const [tId, tourn] of Object.entries(cat.tournaments)) {
                console.log(`    Tournament: name="${tourn?.name || '?'}"`);
                
                if (tourn?.events) {
                  for (const [eId, ev] of Object.entries(tourn.events)) {
                    console.log(`      Event ${eId.substring(0, 8)}: keys=${Object.keys(ev || {}).join(',')}`);
                    if (ev) {
                      // Show all keys and their value previews
                      for (const [k, v] of Object.entries(ev)) {
                        const preview = typeof v === 'object' 
                          ? (Array.isArray(v) ? `[${v.length}]` : `{${Object.keys(v || {}).join(',')}}`)
                          : String(v).substring(0, 50);
                        console.log(`        .${k} = ${preview}`);
                      }
                    }
                    break; // Just show first event
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    // Frame preview might be truncated at 300 chars — try to parse what we have
    console.log(`Frame (${frame.len} bytes) - preview truncated, structure: ${frame.preview.substring(0, 150)}`);
  }
}
