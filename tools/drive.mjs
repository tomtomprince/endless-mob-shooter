import { chromium } from "playwright";

const SHOT = process.env.SHOT_DIR;
const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:5199", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOT}/t0-boot.png` });

// click to unlock audio + steer cannon around while waves spawn
await page.mouse.click(300, 700);
for (let i = 0; i < 24; i++) {
  const x = 300 + Math.sin(i / 3) * 220;
  await page.mouse.move(x, 700, { steps: 5 });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${SHOT}/t1-wave.png` });
for (let i = 0; i < 30; i++) {
  const x = 300 + Math.sin(i / 2.2) * 230;
  await page.mouse.move(x, 650, { steps: 5 });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${SHOT}/t2-later.png` });

console.log("CONSOLE ERRORS:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
