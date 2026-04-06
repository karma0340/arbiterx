const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const fs = require('fs');
const path = require('path');

const OUT_FILE = path.join(__dirname, '..', 'kolay40_odds.json');
const TARGET_URLS = [
  'https://kolay40.com/canli-bahis',
  'https://kolay40.net/canli-bahis',
  'https://www.kolay40.com/live',
];

const PROXY_LIST = (process.env.PROXY_LIST || '')
  .split(',')
  .map(p => p.trim())
  .filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scrapeDom(page) {
  try {
    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(btn => {
        const t = (btn.textContent || '').toLowerCase();
        if (t.includes('kabul') || t.includes('accept') || t.includes('close')) btn.click();
      });
    });
  } catch {}

  await sleep(3000);

  return await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    document.querySelectorAll(
      '[class*="event"],[class*="match"],[class*="fixture"],[class*="live-item"],[class*="game-row"]'
    ).forEach(row => {
      const teams = row.querySelectorAll('[class*="team"],[class*="participant"],[class*="home"],[class*="away"]');
      let eventName = '';
      if (teams.length >= 2) eventName = `${teams[0].textContent?.trim()} vs ${teams[teams.length - 1].textContent?.trim()}`;
      if (!eventName || eventName.length < 6 || seen.has(eventName)) return;
      seen.add(eventName);

      const oddEls = row.querySelectorAll('[class*="odd"],[class*="price"],[class*="rate"],[class*="coeff"]');
      const odds = Array.from(oddEls)
        .map(o => parseFloat(o.textContent?.replace(',', '.') || ''))
        .filter(o => !isNaN(o) && o > 1.01 && o < 50);

      const league = row.closest('[class*="league"],[class*="category"]')
        ?.querySelector('[class*="name"],[class*="title"]')?.textContent?.trim() || 'Live';

      if (odds.length >= 2) results.push({ name: eventName, odds, league });
    });

    return results;
  }).catch(() => []);
}

function saveEvents(events, url) {
  const output = events.map((ev, i) => ({
    id: 'kolay40-' + i, sport: 'Soccer', competition: ev.league,
    event: ev.name, odds: ev.odds.slice(0, 3), bookmaker: 'Kolay40',
    isLive: true, link: url, scrapedAt: new Date().toISOString(),
  }));
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`[Kolay40] ✅ Saved ${output.length} events. Waiting 3 minutes...`);
}

async function tryWithProxy(proxyStr = null) {
  const launchOptions = {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  };

  if (proxyStr) {
    // Playwright supports standard URL format for HTTP/SOCKS proxies directly
    launchOptions.proxy = { server: proxyStr };
    console.log('[Kolay40] Launching with proxy:', proxyStr);
  } else {
    console.log('[Kolay40] Launching direct (no proxy)');
  }

  // Use persistent context for Cloudflare clearance
  const userDataDir = path.join(__dirname, '..', '.browser_data_pw_kolay40');
  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);
  
  try {
    const page = context.pages()[0] || await context.newPage();
    let workingUrl = null;
    let initialEvents = [];

    for (const url of TARGET_URLS) {
      console.log('[Kolay40] Testing:', url);
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 35000 });
        
      // Wait for Turnstile auto-solve or require manual click
      console.log('[Kolay40] Waiting for Cloudflare verification...');
      let isBlocked = true;
      for (let i = 0; i < 45; i++) { // Wait up to 90 seconds
        const html = await page.content();
        if (!html.includes('Just a moment') && !html.includes('Güvenlik doğrulaması')) {
          isBlocked = false;
          break; // Challenge passed!
        }
        await sleep(2000);
      }

      if (isBlocked) {
        console.log('[Kolay40] ⚠️ Manual Turnstile click failed or timed out.');
      } else {

          console.log('[Kolay40] ✅ Passed Cloudflare check');
        }

        await sleep(5000);
        const events = await scrapeDom(page);
        if (events.length > 0) {
          workingUrl = url;
          initialEvents = events;
          break;
        }
      } catch (e) {
        console.log(`[Kolay40] ⚠️  ${url} failed: ${e.message.slice(0, 60)}`);
      }
    }

    if (workingUrl) {
      console.log(`[Kolay40] 🚀 Working connection established! Continuous loop on ${workingUrl}`);
      saveEvents(initialEvents, workingUrl);

      while (true) {
        await sleep(3 * 60 * 1000);
        console.log(`[Kolay40] 🔄 Refreshing data...`);
        try {
          await page.goto(workingUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
          await sleep(8000);
          const events = await scrapeDom(page);
          if (events.length > 0) saveEvents(events, workingUrl);
        } catch (e) {
          console.log(`[Kolay40] ⚠️ Loop error: ${e.message.slice(0, 80)}`);
        }
      }
    }
    throw new Error("No URL returned events with this config");
  } finally {
    await context.close();
  }
}

async function main() {
  try {
    await tryWithProxy(null);
  } catch (e) {
    console.log('[Kolay40] Direct failed:', e.message.slice(0, 80));
  }

  for (const proxy of PROXY_LIST) {
    try {
      await tryWithProxy(proxy);
    } catch (e) {
      console.log('[Kolay40] Proxy failed:', e.message.slice(0, 60));
    }
  }

  console.log('[Kolay40] ❌ All configs failed. Exiting scraper.');
  process.exit(1);
}

main();
