import { describe, expect, test } from "vite-plus/test";
import { LEVELS, levelForWave } from "./levels";

// Arena bounds (GameScene exports W/H, but importing it drags in Phaser,
// which needs a browser — keep these tests plain-node.)
const W = 540;
const SPAWN_Y = 110; // enemies materialize above this line
const BASE_Y = 830;

describe("levelForWave", () => {
  test("cycles layouts every 3 waves", () => {
    expect(levelForWave(1)).toBe(0);
    expect(levelForWave(3)).toBe(0);
    expect(levelForWave(4)).toBe(1);
    expect(levelForWave(6)).toBe(1);
    expect(levelForWave(7)).toBe(2);
    expect(levelForWave(9)).toBe(2);
    expect(levelForWave(10)).toBe(0);
  });

  test("always yields a valid index", () => {
    for (let w = 1; w <= 100; w++) {
      const i = levelForWave(w);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(LEVELS.length);
    }
  });
});

describe("LEVELS sanity", () => {
  test("walls stay inside the arena and crates have hp", () => {
    for (const lvl of LEVELS) {
      for (const wall of lvl.walls) {
        expect(wall.x).toBeGreaterThanOrEqual(0);
        expect(wall.x + wall.w).toBeLessThanOrEqual(W);
        if (wall.hp !== undefined) expect(wall.hp).toBeGreaterThan(0);
      }
    }
  });

  test("gates and pods sit inside the playfield", () => {
    for (const lvl of LEVELS) {
      expect(lvl.movingGateY).toBeGreaterThan(SPAWN_Y);
      expect(lvl.movingGateY).toBeLessThan(BASE_Y);
      for (const g of lvl.gates) {
        expect(g.x - g.w / 2).toBeGreaterThanOrEqual(0);
        expect(g.x + g.w / 2).toBeLessThanOrEqual(W);
        expect(g.y).toBeGreaterThan(SPAWN_Y);
        expect(g.y).toBeLessThan(BASE_Y);
      }
      for (const p of lvl.pods) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(W);
        expect(p.y).toBeGreaterThan(SPAWN_Y);
        expect(p.y).toBeLessThan(BASE_Y);
      }
    }
  });
});
