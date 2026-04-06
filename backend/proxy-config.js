/**
 * ArbiterX Proxy Configuration
 *
 * Strategy:
 * 1. Scrapers try DIRECT connection first (Turkish bookmakers don't block Indian IPs)
 * 2. If direct fails, they retry with proxy as fallback
 * 3. Proxies use SOCKS5 format for better HTTPS tunneling (no CONNECT method issues)
 *
 * webshare.io free proxies show ERR_TUNNEL_CONNECTION_FAILED for gambling sites on HTTP.
 * Adding SOCKS5 format: socks5://user:pass@host:port (Chromium supports this natively).
 *
 * Format PROXY_LIST entries as:
 *   socks5://user:pass@host:port   ← best for HTTPS sites
 *   http://user:pass@host:port     ← fallback (may not tunnel gambling sites)
 */

const PROXY_LIST = (process.env.PROXY_LIST || '')
  .split(',')
  .map(p => p.trim())
  .filter(Boolean);

let proxyIndex = 0;

/**
 * Parse proxy URL → { serverArg, credentials }
 * serverArg is the full string passed to --proxy-server flag
 * For SOCKS5: socks5://host:port  (no auth in flag — auth embedded differently)
 * For HTTP:   http://host:port
 * Credentials returned separately for page.authenticate()
 */
function parseProxy(proxyUrl) {
  if (!proxyUrl) return { serverArg: null, credentials: null };

  try {
    const url = new URL(proxyUrl);
    const protocol = url.protocol.replace(':', ''); // 'http' or 'socks5'
    const serverArg = `${protocol}://${url.hostname}:${url.port}`;
    const credentials = (url.username && url.password)
      ? { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) }
      : null;
    return { serverArg, credentials };
  } catch {
    return { serverArg: proxyUrl, credentials: null };
  }
}

/**
 * Get next proxy in rotation (round-robin).
 * Returns { serverArg, credentials } or { serverArg: null, credentials: null } for direct.
 */
function getNextProxy() {
  if (PROXY_LIST.length === 0) return { serverArg: null, credentials: null };
  const raw = PROXY_LIST[proxyIndex % PROXY_LIST.length];
  proxyIndex++;
  return parseProxy(raw);
}

/**
 * Puppeteer launch config.
 * Uses a persistent userDataDir so Cloudflare clearance cookies are saved!
 */
function getLaunchConfig(serverArg = null) {
  const path = require('path');
  
  const args = [

    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--no-first-run',
    '--no-zygote',
    '--window-size=1920,1080',
    '--lang=tr-TR,tr',
  ];

  if (serverArg) {
    args.push(`--proxy-server=${serverArg}`);
    console.log(`[Proxy] Using proxy: ${serverArg}`);
  } else {
    console.log('[Proxy] Direct connection (no proxy)');
  }

  return {
    headless: "new", // Run headlessly using the new stealth renderer
    defaultViewport: { width: 1366, height: 768 },
    userDataDir: path.join(__dirname, '..', '.browser_data'),
    args
  };
}

/** Replacement for page.waitForTimeout (removed in Puppeteer v22+) */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** Cloudflare Turnstile helper */
async function solveCloudflare(page) {
  console.log('[CF] Checking for Cloudflare Anti-Bot challenge...');
  try {
    await page.waitForFunction(() => {
      const html = document.body.innerHTML;
      const isCF = document.title.includes('Just a moment') || html.includes('cf-turnstile') || html.includes('challenges.cloudflare.com') || html.includes('Güvenlik doğrulaması');
      return !isCF;
    }, { timeout: 15000 });
    console.log('[CF] Passed automatically.');
  } catch {
    console.log('[CF] ⚠️ Still blocked. Checking for iframe click...');
    try {
      const frames = page.frames();
      for (const frame of frames) {
        if (frame.url().includes('cloudflare')) await frame.click('.ctp-checkbox-label').catch(()=>null);
      }
      await sleep(6000);
    } catch {}
  }
}

module.exports = { getNextProxy, getLaunchConfig, sleep, PROXY_LIST, parseProxy, solveCloudflare };
