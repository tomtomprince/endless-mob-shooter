import { chromium } from "playwright";

const SHOT = process.env.SHOT_DIR;
const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:5199/?wave=3", { waitUntil: "networkidle" });
await page.waitForTimeout(6000);

await page.keyboard.press("Escape");
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOT}/pause-1-paused.png` });
// stay paused: this shot must be identical under the overlay
await page.waitForTimeout(4000);
await page.screenshot({ path: `${SHOT}/pause-2-still-paused.png` });

await page.keyboard.press("Escape");
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOT}/pause-3-resumed.png` });

console.log("CONSOLE ERRORS:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
