/**
 * Baywin Auth Token Extractor
 * 
 * Connects to your open Baywin Chrome tab and extracts:
 * 1. All cookies (including httpOnly via Network.getAllCookies)
 * 2. AuthToken / accessToken from localStorage
 * 3. IndexedDB / sessionStorage auth data
 * 
 * Run: node extract_baywin_auth.js
 */

const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const CDP_PORT = 9222;

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function cdpCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const handler = (msg) => {
      const data = JSON.parse(msg);
      if (data.id === id) {
        ws.off('message', handler);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  console.log('🔍 Connecting to Chrome on port 9222...');
  
  let targets;
  try {
    targets = await getTargets();
  } catch (e) {
    console.error('❌ Chrome remote debugging not available on port 9222');
    return;
  }

  // Find Baywin tab
  const tab = targets.find(t => t.type === 'page' && t.url.includes('baywin'));
  if (!tab) {
    console.log('❌ No Baywin tab found. Open tabs:', targets.map(t => `${t.title}: ${t.url}`));
    return;
  }
  console.log(`✅ Found tab: ${tab.title} (${tab.url})`);

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  try {
    // Enable Network to get full cookies
    await cdpCommand(ws, 'Network.enable');

    // Get ALL network-level cookies (includes httpOnly)
    const { cookies: allCookies } = await cdpCommand(ws, 'Network.getAllCookies');
    const baywinCookies = allCookies.filter(c => c.domain.includes('baywin') || c.domain.includes('api3kut'));
    
    console.log(`\n🍪 All Baywin cookies (${baywinCookies.length}):`);
    baywinCookies.forEach(c => {
      const val = c.httpOnly ? '[HTTPONLY - HIDDEN IN BROWSER]' : c.value.substring(0, 50);
      console.log(`  ${c.httpOnly ? '🔒' : '🔓'} ${c.name} (domain: ${c.domain})`);
      console.log(`     value: "${val}"`);
    });

    // Extract localStorage
    const { result: lsResult } = await cdpCommand(ws, 'Runtime.evaluate', {
      expression: `JSON.stringify(Object.fromEntries(
        Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])
      ))`
    });
    const localStorage = JSON.parse(lsResult.value || '{}');
    
    const authKeys = Object.keys(localStorage).filter(k => 
      /auth|token|session|user|account|jwt|login/i.test(k)
    );
    
    console.log(`\n💾 LocalStorage auth keys (${authKeys.length}):`);
    if (authKeys.length === 0) {
      console.log('  (none found)');
      console.log('  All keys:', Object.keys(localStorage).join(', '));
    } else {
      authKeys.forEach(k => {
        const v = localStorage[k];
        console.log(`  ${k}: "${v?.substring(0, 100)}${v?.length > 100 ? '...' : ''}"`);
      });
    }

    // Also check sessionStorage
    const { result: ssResult } = await cdpCommand(ws, 'Runtime.evaluate', {
      expression: `JSON.stringify(Object.fromEntries(
        Object.keys(sessionStorage).map(k => [k, sessionStorage.getItem(k)])
      ))`
    });
    const sessionStorage = JSON.parse(ssResult.value || '{}');
    const ssAuthKeys = Object.keys(sessionStorage).filter(k => 
      /auth|token|session|user|account|jwt|login/i.test(k)
    );
    
    if (ssAuthKeys.length > 0) {
      console.log(`\n📦 SessionStorage auth keys (${ssAuthKeys.length}):`);
      ssAuthKeys.forEach(k => {
        console.log(`  ${k}: "${sessionStorage[k]?.substring(0, 100)}"`);
      });
    }

    // Save the full cookie set
    const puppeteerCookies = baywinCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain.startsWith('.') ? c.domain : c.domain,
      path: c.path || '/',
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      expires: c.expires > 0 ? c.expires : undefined,
    }));

    fs.writeFileSync('baywin_cookies.json', JSON.stringify(puppeteerCookies, null, 2));
    console.log(`\n✅ Saved ${puppeteerCookies.length} cookies to baywin_cookies.json`);

    // Save auth data
    const authData = {
      cookies: puppeteerCookies,
      localStorage: Object.fromEntries(authKeys.map(k => [k, localStorage[k]])),
      sessionStorage: Object.fromEntries(ssAuthKeys.map(k => [k, sessionStorage[k]])),
      url: tab.url,
      extractedAt: new Date().toISOString()
    };
    fs.writeFileSync('baywin_auth.json', JSON.stringify(authData, null, 2));
    console.log('✅ Full auth data saved to baywin_auth.json');
    console.log('\n🚀 Now run: node scrapers/baywin.js');

  } finally {
    ws.close();
  }
}

main().catch(console.error);
