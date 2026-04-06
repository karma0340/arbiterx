/**
 * Baywin Sumstats API Direct Caller
 *
 * Discovery: Baywin uses the sumstats ErisGaming WebSocket protocol.
 * Live data URI: sumstats.frontserver.events_updates.erisgaming
 * API endpoint pattern: api.355baywin.com + sportsbookread__api
 *
 * This script:
 * 1. Connects directly to the Baywin sumstats WebSocket
 * 2. Sends the same subscription message the browser sends
 * 3. Captures the initial full events snapshot
 */

const WebSocket = require('ws');
const fs = require('fs');

// The actual WS endpoint used by Baywin (from network intercept)
// The browser connects to this after loading the SPA
const BAYWIN_WS_ENDPOINTS = [
  'wss://api.355baywin.com/sportsbookread__api/ws',
  'wss://api.355baywin.com/sportsbookread__api/wss',
  'wss://api-baywin-tr--prd--pl-sb.api3kut.com/sportsbookread__api/ws',
  'wss://api3kut.com/sportsbookread__api/ws',
];

const SUBSCRIPTION_MSG = {
  type: 'subscribe',
  correlationId: 'arb-scanner-1',
  uri: 'sumstats.sportsbookread.live.get_live_events',
  payload: {
    sportId: null,        // null = all sports
    lang: 'en_US',
    currency: 'TRY',
    clientType: 'WEB'
  }
};

async function tryEndpoint(url) {
  return new Promise((resolve) => {
    console.log(`  Trying: ${url}`);
    const ws = new WebSocket(url, {
      headers: {
        'Origin': 'https://355baywin.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      handshakeTimeout: 5000,
    });

    const messages = [];
    const timeout = setTimeout(() => {
      ws.close();
      resolve({ url, messages, error: 'timeout' });
    }, 8000);

    ws.on('open', () => {
      console.log(`  ✅ Connected to ${url}`);
      // Send subscription request
      ws.send(JSON.stringify(SUBSCRIPTION_MSG));
      // Also try the events_updates URI
      ws.send(JSON.stringify({
        type: 'subscribe',
        correlationId: 'arb-scanner-2',
        uri: 'sumstats.frontserver.events_updates.erisgaming',
        payload: { sportIds: null }
      }));
    });

    ws.on('message', (data) => {
      const payload = data.toString();
      messages.push(payload.substring(0, 2000));
      if (payload.length > 500) {
        console.log(`  📬 Large message (${payload.length} bytes): ${payload.substring(0, 100)}...`);
      } else {
        console.log(`  📩 Small message: ${payload.substring(0, 80)}`);
      }
      
      // Got data — stop after 5 messages
      if (messages.length >= 5) {
        clearTimeout(timeout);
        ws.close();
        resolve({ url, messages, error: null });
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`  ❌ ${url}: ${err.message}`);
      resolve({ url, messages, error: err.message });
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (messages.length === 0) {
        resolve({ url, messages, error: 'closed with no data' });
      } else {
        resolve({ url, messages, error: null });
      }
    });
  });
}

// Also try calling the REST API directly
async function tryRestAPI() {
  const endpoints = [
    'https://api.355baywin.com/sportsbookread__api/rpc/sumstats.sportsbookread.query.live_events_count',
    'https://api.355baywin.com/sportsbookread__api/rpc/sumstats.sportsbookread.live.get_live_events',
    'https://api-baywin-tr--prd--pl-sb.api3kut.com/sportsbookread__api/rpc/sumstats.sportsbookread.live.get_live_events',
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://355baywin.com',
          'Referer': 'https://355baywin.com/tr-tr/live',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({ sportId: null, lang: 'en_US' })
      });
      
      const text = await resp.text();
      console.log(`\nREST ${url.split('/').pop()}: ${resp.status} - ${text.substring(0, 200)}`);
      
      if (resp.ok) {
        fs.writeFileSync('baywin_rest_response.json', text);
      }
    } catch (e) {
      console.log(`REST ${url}: FAILED - ${e.message}`);
    }
  }
}

async function main() {
  console.log('🔍 Testing Baywin sumstats WebSocket endpoints...\n');
  
  let gotData = false;
  for (const endpoint of BAYWIN_WS_ENDPOINTS) {
    const result = await tryEndpoint(endpoint);
    if (result.messages.length > 0) {
      console.log(`\n✅ Got ${result.messages.length} messages from ${result.url}`);
      fs.writeFileSync('baywin_ws_messages.json', JSON.stringify(result.messages, null, 2));
      gotData = true;
      break;
    }
  }

  console.log('\n🌐 Testing REST APIs...');
  await tryRestAPI();

  if (!gotData) {
    console.log('\n❌ Direct WS connection failed - using browser tapping instead.');
    console.log('💡 Run: node tap_baywin_live.js (with Baywin open in Chrome)');
  }
}

main().catch(console.error);
