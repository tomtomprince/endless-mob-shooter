import { chromium } from "playwright";

const SHOT = process.env.SHOT_DIR;
const errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

// one visit per layout; steer around so marines hit ladders/pods/crates
for (const [wave, name, xs] of [
  [1, "corridors", [60, 60, 300, 540, 540, 300, 120, 120]],
  [4, "split", [140, 140, 140, 300, 420, 300, 140, 140]],
  [7, "chicane", [480, 480, 110, 110, 480, 260, 110, 480]],
]) {
  await page.goto(`http://localhost:5199/?wave=${wave}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(2000);
  await page.mouse.click(300, 700);
  for (let i = 0; i < xs.length * 4; i++) {
    await page.mouse.move(xs[i % xs.length], 700, { steps: 6 });
    await page.waitForTimeout(450);
  }
  await page.screenshot({ path: `${SHOT}/layout-${name}.png` });
}

console.log("CONSOLE ERRORS:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
