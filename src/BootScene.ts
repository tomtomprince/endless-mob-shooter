import Phaser from "phaser";
import manifest from "./manifest.json";

export const SOUND_KEYS = [
  "shoot",
  "gate",
  "spawn",
  "basehit",
  "gameover",
  "die_play",
  "die_poss",
  "die_troo",
  "die_sarg",
  "die_cpos",
  "die_head",
  "die_skel",
  "die_fatt",
  "die_boss",
  "die_cybr",
  "smash",
  "podhit",
  "upgrade",
  "fireball",
  "fireexp",
  "rlaunch",
  "boom",
  "giant",
];

export interface SpriteMeta {
  frameWidth: number;
  frameHeight: number;
  originX: number;
  originY: number;
  anims: Record<string, { start: number; end: number }>;
}

export const SPRITES: Record<string, SpriteMeta> = manifest;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    for (const [key, meta] of Object.entries(SPRITES)) {
      this.load.spritesheet(key, `assets/sprites/${key}.png`, {
        frameWidth: meta.frameWidth,
        frameHeight: meta.frameHeight,
      });
    }
    for (const key of ["floor", "floor2", "base", "wall", "crate"]) {
      this.load.image(key, `assets/sprites/${key}.png`);
    }
    for (const key of SOUND_KEYS) {
      this.load.audio(key, `assets/sounds/${key}.wav`);
    }
  }

  create() {
    const cfg: Record<string, { frameRate: number; repeat: number }> = {
      walk: { frameRate: 6, repeat: -1 },
      fly: { frameRate: 10, repeat: -1 },
      attack: { frameRate: 5, repeat: 0 },
      death: { frameRate: 10, repeat: 0 },
      boom: { frameRate: 14, repeat: 0 },
    };
    for (const [key, meta] of Object.entries(SPRITES)) {
      for (const [name, range] of Object.entries(meta.anims)) {
        this.anims.create({
          key: `${key}-${name}`,
          frames: this.anims.generateFrameNumbers(key, range),
          ...cfg[name],
        });
      }
    }
    this.scene.start("game");
  }
}
