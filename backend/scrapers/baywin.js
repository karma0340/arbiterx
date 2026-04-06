const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
const fs   = require('fs');
const path = require('path');
const { getLaunchConfig, sleep, solveCloudflare } = require('../proxy-config');

puppeteerExtra.use(StealthPlugin());

const OUT_FILE     = path.join(__dirname, '..', 'baywin_odds.json');
const COOKIES_FILE = path.join(__dirname, '..', 'baywin_cookies.json');
const TARGET_URL   = 'https://355baywin.com/tr/sports/inplay';

async function scrapeBaywin() {
  const browser = await puppeteerExtra.launch(getLaunchConfig(null)); // Works direct in India
  try {
    const page = await browser.newPage();
    if (fs.existsSync(COOKIES_FILE)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
      await page.setCookie(...cookies);
      console.log('[Baywin] Loaded', cookies.length, 'cookies');
    }

    let firstLoad = true;
    while (true) {
      try {
        console.log(`[Baywin] ${firstLoad ? 'Initial load...' : '🔄 Refreshing data...'}`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await solveCloudflare(page);
        await sleep(5000);

        const events = await page.evaluate(() => {
          const results = [];
          const seen = new Set();
          const matchEls = document.querySelectorAll('[class*="event"], [class*="match"], [class*="game"]');
          matchEls.forEach(el => {
            const name = el.querySelector('[class*="team"], [class*="name"], [class*="event-name"]')?.textContent?.trim();
            if (!name || name.length < 6 || seen.has(name)) return;
            seen.add(name);

            const oddsEls = el.querySelectorAll('[class*="odd"], [class*="price"], button span');
            const odds = Array.from(oddsEls)
              .map(o => parseFloat(o.textContent?.replace(',', '.') || ''))
              .filter(o => !isNaN(o) && o > 1.01 && o < 50);

            const league = el.closest('[class*="league"], [class*="competition"]')
              ?.querySelector('[class*="name"]')?.textContent?.trim() || 'Live';

            if (name && odds.length >= 2) {
              results.push({
                id: 'baywin-' + Date.now() + '-' + results.length,
                sport: 'Soccer', competition: league, event: name,
                odds: odds.slice(0, 3), bookmaker: 'Baywin', isLive: true,
                link: TARGET_URL, scrapedAt: new Date().toISOString(),
              });
            }
          });
          return results;
        });

        if (events.length > 0) {
          fs.writeFileSync(OUT_FILE, JSON.stringify(events, null, 2));
          console.log(`[Baywin] ✅ Saved ${events.length} events. Waiting 3 minutes...`);
        } else {
          if (firstLoad) throw new Error("Initial load found 0 events");
          console.log('[Baywin] ⚠️  No events found on refresh, keeping old data. Waiting 3 minutes...');
        }
      } catch (e) {
        if (firstLoad) throw e;
        console.log(`[Baywin] ⚠️ Loop error: ${e.message.slice(0, 80)}. Retrying next cycle...`);
      }
      
      firstLoad = false;
      await sleep(3 * 60 * 1000);
    }
  } catch (err) {
    console.error('[Baywin] ❌ Fatal error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

scrapeBaywin();
