/**
 * ArbiterX Scraper Manager
 *
 * Orchestrates all bookmaker + exchange scrapers:
 * - Baywin  (every 15 min)
 * - Golbet  (every 20 min)
 * - Papa    (every 20 min)
 * - Kolay40 (every 20 min)
 * - Orbit   (every 10 min, exchange)
 *
 * Each scraper saves its data to a *_odds.json file.
 * The backend (index.js) reads these files every 30s.
 * The manager runs independently alongside index.js.
 *
 * Start with: node scrapers/manager.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRAPERS = [
  { name: 'Baywin',  file: 'baywin.js',  intervalMin: 15, type: 'bookmaker' },
  { name: 'Golbet',  file: 'golbet.js',  intervalMin: 20, type: 'bookmaker', delayMin: 2 },
  { name: 'Papa',    file: 'papa.js',    intervalMin: 20, type: 'bookmaker', delayMin: 4 },
  { name: 'Kolay40', file: 'kolay40.js', intervalMin: 20, type: 'bookmaker', delayMin: 6 },
  { name: 'Oddspedia', file: 'oddspedia.js', intervalMin: 5, type: 'bookmaker', delayMin: 0 },
  { name: 'Orbit',   file: 'orbit.js',   intervalMin: 10, type: 'exchange',  delayMin: 1 },
];

const runningProcesses = new Map();

function runScraper(scraper) {
  if (runningProcesses.has(scraper.name)) {
    console.log(`[Manager] ${scraper.name} already running, skipping`);
    return;
  }

  const scriptPath = path.join(__dirname, scraper.file);
  if (!fs.existsSync(scriptPath)) {
    console.log(`[Manager] Script not found: ${scriptPath}`);
    return;
  }

  console.log(`\n[Manager] 🚀 Starting ${scraper.name}...`);
  const child = spawn('node', [scriptPath], {
    cwd: path.join(__dirname, '..'),
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PUPPETEER_NO_SANDBOX: '1' },
  });

  runningProcesses.set(scraper.name, child);

  child.stdout.on('data', d => process.stdout.write(`[${scraper.name}] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[${scraper.name} ERR] ${d}`));

  child.on('close', (code) => {
    runningProcesses.delete(scraper.name);
    const status = code === 0 ? '✅' : `⚠️ (exit ${code})`;
    console.log(`\n[Manager] ${status} ${scraper.name} finished`);

    // Signal backend to reload data
    notifyBackend();
  });

  child.on('error', (err) => {
    runningProcesses.delete(scraper.name);
    console.error(`[Manager] ${scraper.name} spawn error:`, err.message);
  });
}

async function notifyBackend() {
  try {
    await fetch('http://localhost:4000/api/scraper/reload', { method: 'POST' });
    console.log('[Manager] 📡 Notified backend to reload data');
  } catch (_) {
    // Backend may not be running yet
  }
}

function scheduleScraper(scraper) {
  const delayMs = (scraper.delayMin || 0) * 60 * 1000;
  const intervalMs = scraper.intervalMin * 60 * 1000;

  // Initial run with optional delay
  setTimeout(() => {
    runScraper(scraper);
    // Recurring run
    setInterval(() => runScraper(scraper), intervalMs);
  }, delayMs);

  console.log(`[Manager] Scheduled ${scraper.name}: every ${scraper.intervalMin}min (delay: ${scraper.delayMin || 0}min)`);
}

function printStatus() {
  console.log('\n[Manager] ── Status ──────────────────────────────');
  for (const s of SCRAPERS) {
    const running = runningProcesses.has(s.name) ? '🔄 RUNNING' : '⏸  idle';
    console.log(`  ${s.name.padEnd(10)} ${running}  (every ${s.intervalMin}min)`);
  }
  console.log('[Manager] ──────────────────────────────────────\n');
}

// ─── Start ────────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════╗');
console.log('║   ArbiterX Scraper Manager           ║');
console.log('║   Controlling all data sources       ║');
console.log('╚══════════════════════════════════════╝\n');

for (const scraper of SCRAPERS) {
  scheduleScraper(scraper);
}

// Print status every 5 minutes
setInterval(printStatus, 5 * 60 * 1000);

console.log('\n[Manager] All scrapers scheduled. Waiting...\n');
console.log('[Manager] First runs will start within:', SCRAPERS.map(s => `${s.name}@${s.delayMin || 0}min`).join(', '));
console.log('[Manager] Press Ctrl+C to stop\n');
