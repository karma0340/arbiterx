/**
 * Extract live events from the Baywin sportsbook's React/Redux in-memory state
 * The sportsbook app maintains all current event data in its JS memory.
 * We access it via CDP Runtime.evaluate in the correct frame context.
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

function cdpCmd(ws, method, params = {}) {
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
    setTimeout(() => { ws.off('message', h); reject(new Error('Timeout')); }, 10000);
  });
}

const EXTRACT_JS = `
(function extractBaywinData() {
  const results = {
    reactFound: false,
    reduxFound: false,
    events: [],
    storeKeys: [],
    windowKeys: [],
    errors: []
  };
  
  try {
    // Window-level search
    results.windowKeys = Object.keys(window).filter(k => 
      /redux|store|state|sports|events|live|match|bet/i.test(k)
    );
    
    // Try React DevTools fiber
    // Find a non-empty DOM element and walk up the React fiber tree
    const allDivs = Array.from(document.querySelectorAll('div, span'));
    const dominated = allDivs.find(el => el.childElementCount === 0 && el.textContent.trim().length > 5);
    
    if (dominated) {
      let fiber = null;
      for (const key of Object.keys(dominated)) {
        if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
          fiber = dominated[key];
          results.reactFound = true;
          break;
        }
      }
      
      // Walk fiber tree to find Redux store
      if (fiber) {
        let node = fiber;
        let depth = 0;
        while (node && depth < 50) {
          const memoized = node.memoizedState;
          if (memoized) {
            const storeCandidate = memoized.store || memoized.getState?.() || memoized;
            if (storeCandidate && typeof storeCandidate === 'object') {
              const keys = Object.keys(storeCandidate);
              if (keys.some(k => /event|sport|live|match/i.test(k))) {
                results.reduxFound = true;
                results.storeKeys = keys.slice(0, 20);
                
                // Try to extract events
                const eventsData = storeCandidate.events || storeCandidate.live || storeCandidate.sports;
                if (eventsData && typeof eventsData === 'object') {
                  const evArr = Array.isArray(eventsData) ? eventsData : Object.values(eventsData);
                  results.events = evArr.slice(0, 10).map(e => ({
                    id: e.id,
                    name: e.name || e.eventName,
                    home: e.home || e.homeTeam?.name || e.participant1?.name,
                    away: e.away || e.awayTeam?.name || e.participant2?.name,
                  }));
                }
                break;
              }
            }
          }
          node = node.return || node.child;
          depth++;
        }
      }
    }
    
    // Try global store references
    const globalStoreKeys = ['__STORE__', 'store', 'appStore', '__redux_store__', 'ReduxStore'];
    for (const key of globalStoreKeys) {
      if (window[key]) {
        results.storeKeys.push('GLOBAL:' + key);
        try {
          const state = window[key].getState?.();
          if (state) {
            results.reduxFound = true;
            results.storeKeys = Object.keys(state).slice(0, 20);
            break;
          }
        } catch(_) {}
      }
    }
    
  } catch(e) {
    results.errors.push(e.message);
  }
  
  return JSON.stringify(results);
})()
`;

async function main() {
  const targets = await getTargets();
  const baywinTarget = targets.find(t => t.type === 'page' && t.url.includes('baywin'));
  
  if (!baywinTarget) {
    console.log('No Baywin tab found');
    return;
  }
  
  console.log('Connecting to:', baywinTarget.url.substring(0, 60));
  const ws = new WebSocket(baywinTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  // Get all execution contexts
  await cdpCmd(ws, 'Runtime.enable');
  
  const contexts = [];
  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.method === 'Runtime.executionContextCreated') {
        contexts.push(msg.params.context);
      }
    } catch(_) {}
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log(`Execution contexts: ${contexts.length}`);
  contexts.forEach(c => console.log(`  [${c.id}] ${c.origin} ${c.name}`));

  // Try extracting from each context
  for (const ctx of [{ id: undefined }, ...contexts]) {
    const label = ctx.id ? `[Context ${ctx.id}] ${ctx.origin?.substring(0,40)}` : '[Default context]';
    
    try {
      const params = {
        expression: EXTRACT_JS,
        returnByValue: true,
      };
      if (ctx.id) params.contextId = ctx.id;
      
      const { result } = await cdpCmd(ws, 'Runtime.evaluate', params);
      const data = JSON.parse(result?.value || '{}');
      
      if (data.reactFound || data.reduxFound || (data.storeKeys && data.storeKeys.length > 0)) {
        console.log(`\n✅ ${label}`);
        console.log('  React:', data.reactFound, '| Redux:', data.reduxFound);
        console.log('  Store keys:', data.storeKeys.join(', '));
        console.log('  Events:', data.events?.length);
        if (data.events?.length > 0) {
          console.log('  Sample:', JSON.stringify(data.events[0]));
        }
      } else if (data.windowKeys?.length > 0) {
        console.log(`\n${label}: window globals:`, data.windowKeys.join(', '));
      }
    } catch(e) {
      // skip failed contexts
    }
  }

  ws.close();
}

main().catch(console.error);
