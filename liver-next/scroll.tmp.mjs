import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 800 } });
await p.goto('http://127.0.0.1:3000/accessibility', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);

const y = () => p.evaluate(() => window.scrollY || document.documentElement.scrollTop || document.body.scrollTop);
const h = await p.evaluate(() => ({ doc: document.documentElement.scrollHeight, vp: window.innerHeight,
  bodyZoom: getComputedStyle(document.body).zoom, htmlOverflow: getComputedStyle(document.documentElement).overflowY }));
console.log('page:', JSON.stringify(h));
console.log('scrollY before wheel:', await y());
await p.mouse.move(700, 400);
await p.mouse.wheel(0, 600);
await p.waitForTimeout(400);
console.log('scrollY after wheel :', await y());
