import { chromium } from "playwright";

const SHOT = process.env.SHOT_DIR;
const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

// FIT scaling: 540x960 game in 600x1000 viewport -> scale 1.0417, x offset 18.75
const S = Math.min(600 / 540, 1000 / 960);
const OX = (600 - 540 * S) / 2;
const gx = (x) => OX + x * S;
const gy = (y) => y * S;

// wave 10 so a cyberdemon shows up (it spawns at the tail of the queue,
// ~46s in); debug hp keeps the base alive that long unattended
await page.goto("http://localhost:5199/?wave=10&hp=99999", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.mouse.move(gx(270), gy(690));
await page.waitForTimeout(50000);
await page.screenshot({ path: `${SHOT}/nuke-1-before.png` });

// click the NUKE button (game coords 70, 932): everything but the cyberdemon dies
await page.mouse.click(gx(70), gy(932));
await page.waitForTimeout(1800);
await page.screenshot({ path: `${SHOT}/nuke-2-after-click.png` });

// keyboard trigger still works
await page.waitForTimeout(6000);
await page.keyboard.press("n");
await page.waitForTimeout(1800);
await page.screenshot({ path: `${SHOT}/nuke-3-after-key.png` });

console.log("CONSOLE ERRORS:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
