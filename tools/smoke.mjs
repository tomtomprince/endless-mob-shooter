// Boot smoke test for the production build. Serves dist/ via `vp preview`,
// loads the game headless, and asserts the first wave actually gets underway
// with no console errors. Requires a prior `vp build`.
//
//   vp build && node tools/smoke.mjs
//
// Set PW_CHANNEL=chrome to drive a system Chrome instead of playwright's
// downloaded chromium (handy locally; CI installs chromium).
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4199;
const failures = [];
const consoleErrors = [];

const server = spawn("vp", ["preview", "--port", String(PORT), "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
});
try {
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    try {
      up = (await fetch(`http://localhost:${PORT}/`)).ok;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!up) throw new Error(`vp preview did not come up on :${PORT}`);

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });

  const state = () =>
    page.evaluate(() => {
      const s = window.__scene;
      return s
        ? {
            wave: s.wave,
            enemies: s.enemies.length,
            marines: s.marines.length,
            score: s.score,
            over: s.over,
          }
        : null;
    });

  const check = async (desc, pred, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const s = await state();
      if (pred(s)) {
        console.log(`ok: ${desc}`);
        return s;
      }
      if (Date.now() > deadline) {
        failures.push(`${desc} (state: ${JSON.stringify(s)})`);
        console.log(`FAIL: ${desc}`);
        return s;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  await check("game scene boots", (s) => s !== null, 20000);
  await check("wave 1 starts", (s) => s !== null && s.wave >= 1, 15000);
  await check("cannon fires marines", (s) => s !== null && s.marines > 0, 15000);
  await check("enemies spawn", (s) => s !== null && s.enemies > 0, 20000);
  const last = await check("combat scores points", (s) => s !== null && s.score > 0, 45000);
  if (last?.over) failures.push("game over during the smoke window");
  if (consoleErrors.length > 0) {
    failures.push(`console errors: ${consoleErrors.slice(0, 5).join(" | ")}`);
  }
  await browser.close();
} finally {
  server.kill();
}

if (failures.length > 0) {
  console.error(`\nSMOKE TEST FAILED:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nsmoke test passed");
