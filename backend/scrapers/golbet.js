const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
const fs   = require('fs');
const path = require('path');
const { getLaunchConfig, sleep, PROXY_LIST, parseProxy, solveCloudflare } = require('../proxy-config');

puppeteerExtra.use(StealthPlugin());

const OUT_FILE   = path.join(__dirname, '..', 'golbet_odds.json');
const TARGET_URL = 'https://golbet724.com/tr/live';

async function scrapeDom(page) {
  try {
    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(btn => {
        const t = btn.textContent?.toLowerCase() || '';
        if (t.includes('kabul') || t.includes('accept') || t.includes('kapat') || t.includes('close')) btn.click();
      });
    });
  } catch {}
  await sleep(4000);

  return await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    const selectors = [
      '[class*="event-row"]', '[class*="match-row"]',
      '[class*="sport-event"]', '[class*="EventRow"]',
      '[class*="live-event"]', '[class*="match-item"]',
    ];
    const rows = selectors.flatMap(s => [...document.querySelectorAll(s)]);

    rows.forEach(row => {
      const teams = row.querySelectorAll('[class*="team"], [class*="participant"], [class*="home"], [class*="away"]');
      let eventName = '';
      if (teams.length >= 2) {
        eventName = `${teams[0].textContent?.trim()} vs ${teams[teams.length - 1].textContent?.trim()}`;
      } else {
        const match = (row.textContent || '').match(/([A-Za-zÀ-ÿ\s\u00C0-\u024F]{3,30})\s+[-–v]\s+([A-Za-zÀ-ÿ\s\u00C0-\u024F]{3,30})/);
        if (match) eventName = `${match[1].trim()} vs ${match[2].trim()}`;
      }
      if (!eventName || seen.has(eventName) || eventName.length < 6) return;
      seen.add(eventName);

      const oddEls = row.querySelectorAll('[class*="odd"], [class*="price"], [class*="coef"], [class*="rate"]');
      const odds = Array.from(oddEls)
        .map(o => parseFloat(o.textContent?.replace(',', '.') || ''))
        .filter(o => !isNaN(o) && o > 1.01 && o < 50);

      const league = row.closest('[class*="league"], [class*="category"]')
        ?.querySelector('[class*="name"], [class*="title"]')?.textContent?.trim() || 'Live';

      if (odds.length >= 2) results.push({ name: eventName, odds, league });
    });
    return results;
  }).catch(() => []);
}

function saveEvents(events) {
  const output = events.map((ev, i) => ({
    id: 'golbet-' + i, sport: 'Soccer', competition: ev.league,
    event: ev.name, odds: ev.odds.slice(0, 3), bookmaker: 'Golbet',
    isLive: true, link: TARGET_URL, scrapedAt: new Date().toISOString(),
  }));
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`[Golbet] ✅ Saved ${output.length} events. Waiting 3 minutes...`);
}

async function tryWithConfig(serverArg = null, credentials = null) {
  const browser = await puppeteerExtra.launch(getLaunchConfig(serverArg));
  try {
    const page = await browser.newPage();
    if (credentials) {
      await page.authenticate(credentials);
      console.log('[Golbet] Proxy auth set for:', credentials.username);
    }

    console.log(`[Golbet] Testing config: ${serverArg || 'Direct'}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await solveCloudflare(page);
    await sleep(4000);

    const initialEvents = await scrapeDom(page);
    if (initialEvents.length === 0) throw new Error("No events found on initial load");

    console.log(`[Golbet] 🚀 Working connection established! Entering continuous loop.`);
    saveEvents(initialEvents);

    while (true) {
      await sleep(3 * 60 * 1000);
      console.log(`[Golbet] 🔄 Refreshing data...`);
      try {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await solveCloudflare(page);
        await sleep(5000);
        const events = await scrapeDom(page);
        
        if (events.length > 0) saveEvents(events);
        else console.log(`[Golbet] ⚠️ 0 events on refresh. Keeping old data.`);
      } catch (e) {
        console.log(`[Golbet] ⚠️ Loop error: ${e.message.slice(0, 80)}`);
      }
    }
  } finally {
    await browser.close();
  }
}

async function scrapeGolbet() {
  try {
    console.log('[Golbet] Trying direct connection...');
    await tryWithConfig(null, null);
  } catch (e) {
    console.log('[Golbet] Direct failed:', e.message.slice(0, 80));
  }

  for (const raw of PROXY_LIST) {
    const { serverArg, credentials } = parseProxy(raw);
    try {
      console.log('[Golbet] Trying proxy:', serverArg);
      await tryWithConfig(serverArg, credentials);
    } catch (e) {
      console.log('[Golbet] Proxy failed:', e.message.slice(0, 60));
    }
  }

  console.log('[Golbet] ❌ All configs failed. Exiting scraper.');
  process.exit(1);
}

scrapeGolbet();
