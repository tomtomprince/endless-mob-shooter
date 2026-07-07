import { chromium } from "playwright";

const SHOT = process.env.SHOT_DIR;
const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

// FIT scaling: 540x960 game in 600x1000 viewport
const S = Math.min(600 / 540, 1000 / 960);
const OX = (600 - 540 * S) / 2;
const gx = (x) => OX + x * S;
const gy = (y) => y * S;

// wave 2 start: first nuke lands at waveScore(2)*1.5 = 4500 points
await page.goto("http://localhost:5199/?wave=2&hp=99999", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
for (let i = 0; i < 300; i++) {
  const x = 270 + Math.sin(i / 2.6) * 200;
  await page.mouse.move(gx(x), gy(690), { steps: 4 });
  await page.waitForTimeout(400);
  if (i === 60) await page.screenshot({ path: `${SHOT}/ready-1-progress.png` });
  if (i === 150) await page.screenshot({ path: `${SHOT}/ready-2-later.png` });
}
await page.screenshot({ path: `${SHOT}/ready-3-end.png` });

console.log("CONSOLE ERRORS:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
