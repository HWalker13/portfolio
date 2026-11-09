/*
  Renders scripts/og/card.html to public/og.jpg (1200 × 630) in headless Chrome.
  JPEG, not PNG: the rug's fiber noise makes a PNG ~640 KB.
  Why a browser: the card uses the site's web fonts (Fraunces with its SOFT axis),
  which SVG rasterizers like sharp/librsvg can't load.
  Needs a local Chrome. Set CHROME_PATH if it isn't in the default macOS location.
  Run: npm run og
*/
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const card = new URL('./og/card.html', import.meta.url).href;
const out = fileURLToPath(new URL('../public/og.jpg', import.meta.url));

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(card, { waitUntil: 'networkidle0' });
const fonts = await page.evaluate(async () => {
  await document.fonts.ready;
  return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
});
if (!fonts.includes('Fraunces')) throw new Error(`Fraunces didn't load (loaded: ${fonts.join(', ') || 'none'})`);
await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
await browser.close();
console.log(`${out}  (fonts: ${[...new Set(fonts)].join(', ')})`);
