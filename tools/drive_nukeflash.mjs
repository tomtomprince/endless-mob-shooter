import { chromium } from "playwright";

const SHOT = process.env.SHOT_DIR;
const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

const S = Math.min(600 / 540, 1000 / 960);
const OX = (600 - 540 * S) / 2;
const gx = (x) => OX + x * S;
const gy = (y) => y * S;

await page.goto("http://localhost:5199/?wave=2&hp=99999", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
// sweep ~95s to close in on the 4500-point threshold, then burst-capture
let shot = 0;
for (let i = 0; i < 340; i++) {
  const x = 270 + Math.sin(i / 2.6) * 200;
  await page.mouse.move(gx(x), gy(690), { steps: 4 });
  await page.waitForTimeout(400);
  if (i > 210 && i % 3 === 0) {
    await page.screenshot({ path: `${SHOT}/burst-${String(shot++).padStart(2, "0")}.png` });
  }
}
await page.screenshot({ path: `${SHOT}/burst-final.png` });

console.log(`CONSOLE ERRORS: ${errors.length ? errors.slice(0, 10) : "none"}, shots: ${shot}`);
await browser.close();
