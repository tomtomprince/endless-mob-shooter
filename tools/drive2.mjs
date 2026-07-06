import { chromium } from "playwright";

const SHOT = process.env.SHOT_DIR;
const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

// 1. weakened base, cannon parked in a corner -> expect leaks + game over
await page.goto("http://localhost:5199/?hp=2", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.mouse.click(40, 700);
await page.waitForTimeout(45000);
await page.screenshot({ path: `${SHOT}/t3-gameover.png` });

// 2. wave 10 boss check
await page.goto("http://localhost:5199/?wave=10", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.mouse.click(300, 700);
for (let i = 0; i < 50; i++) {
  const x = 300 + Math.sin(i / 2.5) * 230;
  await page.mouse.move(x, 680, { steps: 4 });
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${SHOT}/t4-boss.png` });

console.log("CONSOLE ERRORS:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
