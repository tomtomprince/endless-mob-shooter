import { chromium } from "playwright";

const SHOT = process.env.SHOT_DIR;
const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

// wave 2+ has imps (fireballs); play ~70s to also fill the giant meter twice
await page.goto("http://localhost:5199/?wave=2", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.mouse.click(300, 700);
for (let i = 0; i < 60; i++) {
  const x = 300 + Math.sin(i / 2.8) * 220;
  await page.mouse.move(x, 700, { steps: 5 });
  await page.waitForTimeout(450);
  if (i === 24) await page.screenshot({ path: `${SHOT}/proj-early.png` });
  if (i === 44) await page.screenshot({ path: `${SHOT}/proj-mid.png` });
}
await page.screenshot({ path: `${SHOT}/proj-late.png` });

// wave 12: mancubus spread + revenant rockets; wave 10 boss burst
await page.goto("http://localhost:5199/?wave=10", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.mouse.click(300, 700);
for (let i = 0; i < 40; i++) {
  const x = 300 + Math.sin(i / 2.2) * 230;
  await page.mouse.move(x, 660, { steps: 5 });
  await page.waitForTimeout(450);
  if (i === 25) await page.screenshot({ path: `${SHOT}/boss-mid.png` });
}
await page.screenshot({ path: `${SHOT}/boss-late.png` });

console.log("CONSOLE ERRORS:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
