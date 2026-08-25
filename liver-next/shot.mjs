import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const shots = [
  ['login', 'http://127.0.0.1:3000/login', 390, 844],
  ['home',  'http://127.0.0.1:3000/',      390, 844],
  ['home-wide', 'http://127.0.0.1:3000/',  1280, 900],
];
for (const [name, url, w, h] of shots) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${process.env.SP}/${name}.png`, fullPage: h === 900 });
  await p.close();
}
await b.close();
console.log('ok');
