import { describe, expect, test } from "vite-plus/test";
import { BOSS_MOB, MOB_BY_KEY, buildWave, wavePower, waveScore } from "./mobs";

/** Deterministic LCG so wave composition is reproducible. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("wavePower / waveScore", () => {
  test("waveScore is the kill payout of the wave budget", () => {
    for (const w of [1, 5, 10, 30]) expect(waveScore(w)).toBe(wavePower(w) * 10);
  });

  test("budget grows with the wave", () => {
    for (let w = 1; w < 40; w++) expect(wavePower(w + 1)).toBeGreaterThan(wavePower(w));
  });
});

describe("buildWave", () => {
  test("never picks a mob before its unlock wave", () => {
    for (let wave = 1; wave <= 30; wave++) {
      const picks = buildWave(wave, seededRng(wave));
      for (const m of picks.filter((p) => p !== BOSS_MOB)) {
        expect(m.unlock).toBeLessThanOrEqual(wave);
      }
    }
  });

  test("spends at most the wave budget (bosses ride on top)", () => {
    for (let wave = 1; wave <= 30; wave++) {
      const picks = buildWave(wave, seededRng(wave * 7));
      const spent = picks.filter((p) => p !== BOSS_MOB).reduce((a, m) => a + m.power, 0);
      expect(spent).toBeGreaterThan(0);
      expect(spent).toBeLessThanOrEqual(wavePower(wave));
    }
  });

  test("caps regular mobs at 400 no matter the budget", () => {
    const picks = buildWave(200, seededRng(1));
    expect(picks.filter((p) => p !== BOSS_MOB).length).toBeLessThanOrEqual(400);
  });

  test("boss waves bring wave/10 cyberdemons, others none", () => {
    for (let wave = 1; wave <= 40; wave++) {
      const bosses = buildWave(wave, seededRng(wave)).filter((m) => m.key === "cybr").length;
      expect(bosses).toBe(wave % 10 === 0 ? wave / 10 : 0);
    }
  });

  test("only known mobs are picked", () => {
    for (const m of buildWave(25, seededRng(9))) {
      expect(MOB_BY_KEY.get(m.key)).toBe(m);
    }
  });
});
