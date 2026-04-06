/**
 * Find the actual iframe/widget URL that serves Baywin live odds
 * The sportsbook widget is embedded from a different subdomain (api3kut, etc.)
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function main() {
  console.log('🔍 Finding Baywin sportsbook widget URL...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  const client = await page.createCDPSession();
  await client.send('Network.enable');

  const wsConnections = [];
  const iframeUrls = [];
  const apiRequests = [];

  // Track ALL WebSocket connections (not just frames)
  client.on('Network.webSocketCreated', (event) => {
    console.log(`🔌 WS Created: ${event.url}`);
    wsConnections.push(event.url);
  });

  // Track all XHR/Fetch requests  
  client.on('Network.requestWillBeSent', (event) => {
    const url = event.request.url;
    if (url.includes('api') || url.includes('sports') || url.includes('live') || url.includes('bet')) {
      console.log(`📡 Request: ${url.substring(0, 100)}`);
      apiRequests.push(url);
    }
  });

  await page.goto('https://355baywin.com/tr-tr/live', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Find all iframes
  await new Promise(r => setTimeout(r, 5000));
  
  const frames = page.frames();
  for (const frame of frames) {
    const url = frame.url();
    if (url && url !== 'about:blank' && !url.includes('355baywin.com')) {
      console.log(`\n🖼️ Iframe found: ${url}`);
      iframeUrls.push(url);
    }
  }

  // Also get iframe elements from DOM
  const iframeSrcs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe')).map(f => f.src || f.getAttribute('src'));
  });
  console.log('\n📋 Iframe elements:', iframeSrcs);

  await new Promise(r => setTimeout(r, 8000));

  await browser.close();

  const result = {
    wsConnections,
    iframeUrls: [...new Set([...iframeUrls, ...iframeSrcs.filter(Boolean)])],
    apiRequests: [...new Set(apiRequests)].slice(0, 20),
  };

  fs.writeFileSync('baywin_widget_urls.json', JSON.stringify(result, null, 2));
  
  console.log('\n\n===== RESULTS =====');
  console.log('WebSocket URLs:', wsConnections.length);
  wsConnections.forEach(u => console.log('  WS:', u));
  console.log('\nIframe URLs:', result.iframeUrls.length);
  result.iframeUrls.forEach(u => console.log('  iframe:', u));
  console.log('\nAPI Requests:', result.apiRequests.length);
  result.apiRequests.slice(0, 10).forEach(u => console.log('  api:', u.substring(0, 80)));
  
  console.log('\n✅ Saved to baywin_widget_urls.json');
}

main().catch(console.error);
