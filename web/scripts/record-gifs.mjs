// Records demo GIFs of the CodySQL NUI (dev-preview mock mode).
// Usage: npm run preview (in another shell), then: npm run gifs
// Output: ../media/*.gif
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import gifenc from 'gifenc';
import pngjs from 'pngjs';
const { GIFEncoder, quantize, applyPalette } = gifenc;
const { PNG } = pngjs;

const URL = 'http://localhost:4173';
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../media');
const BROWSER_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- fake cursor so viewers can follow the action ------------ */

async function installCursor(page) {
  await page.evaluate(() => {
    const c = document.createElement('div');
    c.id = '__cursor';
    c.style.cssText =
      'position:fixed;width:16px;height:16px;border-radius:50%;z-index:99999;' +
      'background:rgba(255,255,255,.85);border:2px solid rgba(0,0,0,.6);' +
      'box-shadow:0 1px 6px rgba(0,0,0,.5);pointer-events:none;left:-40px;top:-40px;' +
      'transform:translate(-50%,-50%)';
    document.body.appendChild(c);
  });
}

let cx = 0, cy = 0;

async function moveTo(page, x, y, ms = 350) {
  const steps = Math.max(2, Math.round(ms / 40));
  for (let i = 1; i <= steps; i++) {
    const xi = cx + ((x - cx) * i) / steps;
    const yi = cy + ((y - cy) * i) / steps;
    await page.mouse.move(xi, yi);
    await page.evaluate((px, py) => {
      const c = document.getElementById('__cursor');
      if (c) { c.style.left = px + 'px'; c.style.top = py + 'px'; }
    }, xi, yi);
    await sleep(40);
  }
  cx = x; cy = y;
}

async function rectOf(page, fn) {
  // fn runs in the page and must return an element
  const rect = await page.evaluate(f => {
    const el = new Function('return ' + f)()();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, fn.toString());
  if (!rect) throw new Error('element not found: ' + fn.toString().slice(0, 80));
  return rect;
}

async function clickEl(page, fn, pause = 250) {
  const { x, y } = await rectOf(page, fn);
  await moveTo(page, x, y);
  await page.mouse.down(); await sleep(60); await page.mouse.up();
  await sleep(pause);
}

/* ---------------- frame capture + gif encoding ---------------------------- */

async function record(page, name, scenario) {
  const frames = [];
  let stop = false;
  const t0 = Date.now();
  const capture = (async () => {
    while (!stop) {
      // Capture the full 1512x900 viewport scaled to 72% so the UI renders at
      // its natural size but the GIF stays a reasonable width (~1088px).
      const buf = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: 1512, height: 900, scale: 0.72 },
      });
      frames.push({ buf, t: Date.now() - t0 });
      await sleep(50);
    }
  })();

  await scenario();
  await sleep(400);
  stop = true;
  await capture;

  const gif = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const png = PNG.sync.read(frames[i].buf);
    const delay = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 600;
    const palette = quantize(png.data, 256);
    const index = applyPalette(png.data, palette);
    gif.writeFrame(index, png.width, png.height, { palette, delay });
  }
  gif.finish();
  const out = path.join(OUT_DIR, name);
  fs.writeFileSync(out, gif.bytes());
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`${name}: ${frames.length} frames, ${kb} KB`);
}

/* ---------------- scenarios ----------------------------------------------- */

async function freshPage(browser) {
  const page = await browser.newPage();
  // Big enough that the window renders at its natural 1440px width with margin
  await page.setViewport({ width: 1512, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.window');
  await installCursor(page);
  cx = 756; cy = 880;
  await sleep(300);
  return page;
}

const tabByName = name => `() => [...document.querySelectorAll('.tab')].find(t => t.textContent.trim() === '${name}')`;
const tableByName = name => `() => [...document.querySelectorAll('.table-item')].find(t => t.textContent.includes('${name}'))`;
const btnByText = text => `() => [...document.querySelectorAll('.btn')].find(b => b.textContent.includes('${text}'))`;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const executablePath = BROWSER_CANDIDATES.find(p => fs.existsSync(p));
  if (!executablePath) throw new Error('No Edge/Chrome found');
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
  });

  const only = process.argv[2]; // e.g. `node record-gifs.mjs editing` reruns one scenario
  const want = name => !only || only === name;

  // 1 — themes: hover previews + commit
  if (want('themes')) {
    const page = await freshPage(browser);
    await clickEl(page, tabByName('Settings'), 400);
    await record(page, 'themes.gif', async () => {
      for (const theme of ['Carbon', 'Ocean', 'Synthwave', 'Daylight']) {
        const { x, y } = await rectOf(page,
          `() => [...document.querySelectorAll('.theme-card')].find(c => c.textContent.includes('${theme}'))`);
        await moveTo(page, x, y, 400);
        await sleep(1100);
      }
      const { x, y } = await rectOf(page,
        `() => [...document.querySelectorAll('.theme-card')].find(c => c.textContent.includes('Midnight'))`);
      await moveTo(page, x, y, 400);
      await sleep(400);
      await page.mouse.down(); await page.mouse.up();
      await sleep(900);
    });
    await page.close();
  }

  // 2 — sidebar resize
  if (want('sidebar')) {
    const page = await freshPage(browser);
    await clickEl(page, tableByName('player_vehicles'), 500);
    await record(page, 'sidebar.gif', async () => {
      const { x, y } = await rectOf(page, `() => document.querySelector('.sb-resize')`);
      await moveTo(page, x, 360, 400);
      await sleep(200);
      await page.mouse.down();
      await moveTo(page, x + 150, 360, 700);
      await sleep(300);
      await moveTo(page, x - 40, 360, 600);
      await page.mouse.up();
      await sleep(500);
    });
    await page.close();
  }

  // 3 — editing: cell edit with SQL preview
  if (want('editing')) {
    const page = await freshPage(browser);
    await clickEl(page, tableByName('players'), 500);
    await record(page, 'editing.gif', async () => {
      const cell = `() => [...document.querySelectorAll('table.grid tbody td')].find(td => td.textContent === '15000')`;
      const { x, y } = await rectOf(page, cell);
      await moveTo(page, x, y, 400);
      await page.evaluate(f => {
        const el = new Function('return ' + f)()();
        el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      }, cell);
      await page.waitForSelector('.overlay input', { timeout: 5000 });
      await sleep(700);
      await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
      await page.keyboard.type('25000', { delay: 90 });
      await sleep(900);
      await clickEl(page, `() => [...document.querySelectorAll('.modal-foot .btn')].find(b => b.textContent === 'Save')`, 200);
      await sleep(1000);
    });
    await page.close();
  }

  // 4 — drop table with typed confirmation
  if (want('drop-table')) {
    const page = await freshPage(browser);
    await clickEl(page, tableByName('jobs'), 500);
    await clickEl(page, tabByName('Structure'), 400);
    await record(page, 'drop-table.gif', async () => {
      await clickEl(page, btnByText('Drop'), 600);
      await clickEl(page, `() => document.querySelector('.overlay input')`, 200);
      await page.keyboard.type('jobs', { delay: 140 });
      await sleep(700);
      await clickEl(page, `() => [...document.querySelectorAll('.modal-foot .btn')].find(b => b.textContent.includes('Drop'))`, 200);
      await sleep(1100);
    });
    await page.close();
  }

  // 5 — query: type SQL (live syntax highlight) + run
  if (want('query')) {
    const page = await freshPage(browser);
    await clickEl(page, tabByName('Query'), 400);
    await record(page, 'query.gif', async () => {
      await clickEl(page, `() => document.querySelector('.editor-input')`, 150);
      await page.keyboard.type(
        "SELECT v.plate, v.vehicle, v.garage\nFROM `player_vehicles` v\nWHERE v.garage = 'impound';",
        { delay: 26 }
      );
      await sleep(500);
      await clickEl(page, btnByText('Run'), 200);
      await sleep(1300);
    });
    await page.close();
  }

  await browser.close();
  console.log('done → ' + OUT_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
