/**
 * Baywin Cookie Dumper
 * 
 * Connects to your already-open Chrome/Brave browser via CDP remote debugging
 * and extracts ALL cookies from 355baywin.com (including httpOnly ones that 
 * Cookie Editor cannot see).
 *
 * SETUP:
 * 1. Close Chrome completely
 * 2. Reopen Chrome with remote debugging enabled:
 *    Windows: "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 * 3. Navigate to https://355baywin.com and log in
 * 4. Run this script: node dump_baywin_cookies.js
 * 5. It creates baywin_cookies.json with ALL cookies
 */

const http = require('http');
const fs = require('fs');

const CDP_PORT = 9222;
const TARGET_DOMAIN = '355baywin.com';

async function getTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', (e) => {
      console.error(`\n❌ Cannot connect to Chrome debugger on port ${CDP_PORT}`);
      console.error('   Make sure Chrome is running with: --remote-debugging-port=9222');
      reject(e);
    });
  });
}

async function getCookiesViaWS(wsUrl) {
  const WebSocket = require('ws');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.once('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Network.getAllCookies' }));
    });
    ws.once('message', (data) => {
      const msg = JSON.parse(data);
      ws.close();
      if (msg.result?.cookies) {
        resolve(msg.result.cookies);
      } else {
        reject(new Error('No cookies in response: ' + JSON.stringify(msg)));
      }
    });
    ws.once('error', reject);
    setTimeout(() => reject(new Error('Timeout')), 10000);
  });
}

async function main() {
  console.log(`🔍 Connecting to Chrome debugger on port ${CDP_PORT}...`);
  
  let targets;
  try {
    targets = await getTargets();
  } catch (e) {
    console.log('\n📋 Alternative method: Manual cookie export');
    console.log('Since you have Cookie Editor installed:');
    console.log('1. Go to https://355baywin.com/tr-tr/live while LOGGED IN');
    console.log('2. Press F12 → Application tab → Cookies → 355baywin.com');
    console.log('3. Look for cookies named: accessToken, authToken, token, session, sid, _auth, jwt');
    console.log('4. Copy those cookie names + values into baywin_cookies.json');
    return;
  }

  // Find tabs with baywin.com
  const baywinTabs = targets.filter(t => 
    t.type === 'page' && (t.url.includes('baywin') || t.url.includes('355bay'))
  );

  if (baywinTabs.length === 0) {
    console.log('❌ No Baywin tabs found. Open https://355baywin.com in Chrome first.');
    console.log('Available tabs:', targets.map(t => t.url).join('\n      '));
    return;
  }

  console.log(`✅ Found ${baywinTabs.length} Baywin tab(s):`);
  baywinTabs.forEach(t => console.log(`   - ${t.url}`));

  const tab = baywinTabs[0];
  console.log(`\n🍪 Extracting cookies from: ${tab.url}`);

  let allCookies;
  try {
    allCookies = await getCookiesViaWS(tab.webSocketDebuggerUrl);
  } catch (e) {
    console.error('Failed to get cookies via WS:', e.message);
    console.log('\nTry the manual method instead (see above).');
    return;
  }

  // Filter to just baywin.com cookies
  const baywinCookies = allCookies.filter(c => 
    c.domain.includes('baywin') || c.domain.includes('355bay')
  );

  console.log(`\n✅ Found ${baywinCookies.length} Baywin cookies:`);
  baywinCookies.forEach(c => {
    const preview = c.httpOnly ? '[httpOnly]' : `"${c.value.substring(0, 30)}${c.value.length > 30 ? '...' : ''}"`;
    console.log(`   ${c.name} = ${preview}`);
  });

  // Format for Puppeteer's page.setCookie()
  const puppeteerFormat = baywinCookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: c.sameSite || undefined,
    expires: c.expires > 0 ? c.expires : undefined,
  }));

  fs.writeFileSync('baywin_cookies.json', JSON.stringify(puppeteerFormat, null, 2));
  console.log(`\n✅ Saved ${puppeteerFormat.length} cookies to baywin_cookies.json`);
  console.log('🚀 Now run: node scrapers/baywin.js');
}

main().catch(console.error);
