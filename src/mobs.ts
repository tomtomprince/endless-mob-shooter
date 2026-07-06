export interface AttackDef {
  proj: "bal1" | "bal2" | "fatb" | "manf" | "misl";
  cooldown: number; // ms between attacks
  speed: number; // projectile px/s
  burst?: number; // projectiles per attack (default 1)
  pattern?: "spread" | "seq"; // simultaneous fan vs sequential volley
  splash?: number; // explosion radius killing several marines
}

export interface MobDef {
  key: string;
  hp: number;
  speed: number; // px/s marching toward the base
  power: number; // wave-budget cost and base damage on leak
  scale: number;
  unlock: number; // first wave this mob can appear in
  floats?: boolean;
  attack?: AttackDef;
}

export const MOBS: MobDef[] = [
  { key: "poss", hp: 1, speed: 66, power: 1, scale: 0.75, unlock: 1 },
  {
    key: "troo",
    hp: 2,
    speed: 60,
    power: 2,
    scale: 0.8,
    unlock: 2,
    attack: { proj: "bal1", cooldown: 3150, speed: 220 },
  },
  { key: "sarg", hp: 3, speed: 114, power: 2, scale: 0.8, unlock: 4 },
  { key: "cpos", hp: 4, speed: 54, power: 3, scale: 0.8, unlock: 6 },
  {
    key: "head",
    hp: 6,
    speed: 48,
    power: 4,
    scale: 0.9,
    unlock: 8,
    floats: true,
    attack: { proj: "bal2", cooldown: 2700, speed: 210 },
  },
  {
    key: "skel",
    hp: 8,
    speed: 72,
    power: 5,
    scale: 0.9,
    unlock: 10,
    attack: { proj: "fatb", cooldown: 2250, speed: 310 },
  },
  {
    key: "fatt",
    hp: 14,
    speed: 36,
    power: 8,
    scale: 1.0,
    unlock: 12,
    attack: { proj: "manf", cooldown: 3450, speed: 210, burst: 2, pattern: "spread" },
  },
  { key: "boss", hp: 20, speed: 42, power: 12, scale: 1.0, unlock: 15 },
];

// Cyberdemon shows up as a boss every 10th wave, on top of the normal budget.
export const BOSS_MOB: MobDef = {
  key: "cybr",
  hp: 160,
  speed: 26,
  power: 40,
  scale: 1.15,
  unlock: 10,
  attack: {
    proj: "misl",
    cooldown: 1800,
    speed: 320,
    burst: 3,
    pattern: "seq",
    splash: 46,
  },
};

export const MOB_BY_KEY = new Map([...MOBS, BOSS_MOB].map((m) => [m.key, m]));

/** Pick the mobs for a wave, cheap-heavy mix, spending a power budget. */
export function buildWave(wave: number, rng: () => number): MobDef[] {
  let budget = (10 + wave * 20) * 6;
  const pool = MOBS.filter((m) => m.unlock <= wave);
  const picks: MobDef[] = [];
  // hard cap per wave: excess budget buys density, not endless queues
  while (budget > 0 && picks.length < 400) {
    const affordable = pool.filter((m) => m.power <= budget);
    if (affordable.length === 0) break;
    // bias toward cheaper mobs so waves stay crowded
    const weights = affordable.map((m) => 1 / m.power);
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    let pick = affordable[0];
    for (let i = 0; i < affordable.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = affordable[i];
        break;
      }
    }
    picks.push(pick);
    budget -= pick.power;
  }
  // boss waves bring wave/10 cyberdemons: one at 10, two at 20, three at 30…
  if (wave % 10 === 0) {
    for (let i = 0; i < wave / 10; i++) picks.push(BOSS_MOB);
  }
  return picks;
}
