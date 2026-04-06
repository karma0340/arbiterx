const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
const fs   = require('fs');
const path = require('path');
const { getLaunchConfig, sleep, PROXY_LIST, parseProxy, solveCloudflare } = require('../proxy-config');

puppeteerExtra.use(StealthPlugin());

const OUT_FILE = path.join(__dirname, '..', 'papa_odds.json');
const TARGET_URLS = [
  'https://papa.live/tr/live',
  'https://papa1.com/tr/live',
  'https://papawin.com/tr/live',
  'https://www.papawin.co/tr/sports/live',
];

async function scrapeDom(page) {
  try {
    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(btn => {
        const t = btn.textContent?.toLowerCase() || '';
        if (t.includes('kabul') || t.includes('accept') || t.includes('close') || t.includes('kapat')) btn.click();
      });
    });
  } catch {}

  await sleep(3000);

  return await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    document.querySelectorAll(
      '[class*="event"],[class*="match"],[class*="fixture"],[class*="game-row"],[class*="live-match"]'
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

      const league = row.closest('[class*="league"],[class*="category"],[class*="competition"]')
        ?.querySelector('[class*="name"],[class*="title"]')?.textContent?.trim() || 'Live';

      if (odds.length >= 2) results.push({ name: eventName, odds, league });
    });
    return results;
  }).catch(() => []);
}

function saveEvents(events, url) {
  const output = events.map((ev, i) => ({
    id: 'papa-' + i, sport: 'Soccer', competition: ev.league,
    event: ev.name, odds: ev.odds.slice(0, 3), bookmaker: 'Papa',
    isLive: true, link: url, scrapedAt: new Date().toISOString(),
  }));
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`[Papa] ✅ Saved ${output.length} events. Waiting 3 minutes...`);
}

async function tryWithConfig(serverArg = null, credentials = null) {
  const browser = await puppeteerExtra.launch(getLaunchConfig(serverArg));
  try {
    const page = await browser.newPage();
    if (credentials) {
      await page.authenticate(credentials);
      console.log('[Papa] Proxy auth set for:', credentials.username);
    }

    let workingUrl = null;
    let initialEvents = [];

    // 1. Find working URL
    for (const url of TARGET_URLS) {
      console.log('[Papa] Testing:', url);
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (!response || response.status() >= 400) continue;
        await solveCloudflare(page);
        await sleep(2000);
        await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
        await sleep(2000);

        const events = await scrapeDom(page);
        if (events.length > 0) {
          workingUrl = url;
          initialEvents = events;
          break;
        }
      } catch (e) {
        console.log(`[Papa] ⚠️  ${url}: ${e.message.slice(0, 60)}`);
      }
    }

    // 2. Continuous Loop
    if (workingUrl) {
      console.log(`[Papa] 🚀 Working connection established! Continuous loop on ${workingUrl}`);
      saveEvents(initialEvents, workingUrl);

      while (true) {
        await sleep(3 * 60 * 1000);
        console.log(`[Papa] 🔄 Refreshing data...`);
        try {
          await page.goto(workingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await solveCloudflare(page);
          await sleep(5000);
          const events = await scrapeDom(page);
          
          if (events.length > 0) saveEvents(events, workingUrl);
          else console.log(`[Papa] ⚠️ 0 events on refresh. Keeping old data.`);
        } catch (e) {
          console.log(`[Papa] ⚠️ Loop error: ${e.message.slice(0, 80)}`);
        }
      }
    }
    throw new Error("No URL returned events with this config");
  } finally {
    await browser.close();
  }
}

async function scrapePapa() {
  try {
    console.log('[Papa] Trying direct connection...');
    await tryWithConfig(null, null);
  } catch (e) {
    console.log('[Papa] Direct failed:', e.message.slice(0, 80));
  }

  for (const raw of PROXY_LIST) {
    const { serverArg, credentials } = parseProxy(raw);
    try {
      console.log('[Papa] Trying proxy:', serverArg);
      await tryWithConfig(serverArg, credentials);
    } catch (e) {
      console.log('[Papa] Proxy failed:', e.message.slice(0, 60));
    }
  }

  console.log('[Papa] ❌ All configs failed. Exiting scraper.');
  process.exit(1);
}

scrapePapa();
