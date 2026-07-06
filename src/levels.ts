export type GateKind = "x2" | "x3" | "+1" | "-1";

export interface WallDef {
  x: number;
  y: number;
  w: number;
  h: number;
  hp?: number; // present -> breakable crate wall
}

export interface GateDef {
  x: number; // center
  y: number; // center
  w: number;
  kind: GateKind;
}

export interface PodDef {
  x: number;
  y: number;
}

export interface LevelDef {
  name: string;
  movingGateY: number;
  walls: WallDef[];
  gates: GateDef[];
  pods: PodDef[];
}

// Arena is 540x960: enemies spawn around y=90, the base line is y=830.
// Keep every gap at least ~70px wide so even the cyberdemon fits through.
export const LEVELS: LevelDef[] = [
  {
    // Side corridors with +1 ladders, breakable barricade across the middle.
    name: "corridors",
    movingGateY: 560,
    walls: [
      { x: 95, y: 210, w: 26, h: 260 },
      { x: 419, y: 210, w: 26, h: 260 },
      { x: 190, y: 320, w: 160, h: 34, hp: 25 },
    ],
    gates: [
      { x: 47, y: 250, w: 78, kind: "+1" },
      { x: 47, y: 310, w: 78, kind: "+1" },
      { x: 47, y: 370, w: 78, kind: "+1" },
      { x: 493, y: 250, w: 78, kind: "+1" },
      { x: 493, y: 310, w: 78, kind: "+1" },
      { x: 493, y: 370, w: 78, kind: "+1" },
    ],
    pods: [{ x: 108, y: 495 }],
  },
  {
    // Central divider: stacked multipliers on one lane, traps on the other,
    // crate walls capping both lane entrances.
    name: "split",
    movingGateY: 650,
    walls: [
      { x: 257, y: 230, w: 26, h: 330 },
      { x: 10, y: 230, w: 200, h: 34, hp: 20 },
      { x: 330, y: 230, w: 200, h: 34, hp: 20 },
    ],
    gates: [
      { x: 128, y: 470, w: 170, kind: "+1" },
      { x: 128, y: 400, w: 170, kind: "x3" },
      { x: 412, y: 470, w: 170, kind: "-1" },
      { x: 412, y: 400, w: 170, kind: "+1" },
    ],
    pods: [{ x: 270, y: 585 }],
  },
  {
    // Chicane: staggered walls force an S-path; smashing the crates opens
    // shortcuts.
    name: "chicane",
    movingGateY: 600,
    walls: [
      { x: 0, y: 270, w: 220, h: 34 },
      { x: 220, y: 270, w: 120, h: 34, hp: 30 },
      { x: 320, y: 430, w: 220, h: 34 },
      { x: 200, y: 430, w: 120, h: 34, hp: 30 },
    ],
    gates: [
      { x: 440, y: 292, w: 170, kind: "x2" },
      { x: 100, y: 452, w: 170, kind: "x2" },
    ],
    pods: [{ x: 430, y: 485 }],
  },
];

export function levelForWave(wave: number): number {
  return Math.floor((wave - 1) / 3) % LEVELS.length;
}
