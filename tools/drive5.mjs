import { chromium } from "playwright";

const SHOT = process.env.SHOT_DIR;
const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.mouse.click(300, 700);
for (let i = 0; i < 220; i++) {
  const x = 300 + Math.sin(i / 2.6) * 225;
  await page.mouse.move(x, 690, { steps: 5 });
  await page.waitForTimeout(450);
  if (i === 70) await page.screenshot({ path: `${SHOT}/hard-30s.png` });
  if (i === 150) await page.screenshot({ path: `${SHOT}/hard-70s.png` });
}
await page.screenshot({ path: `${SHOT}/hard-100s.png` });

console.log("CONSOLE ERRORS:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
