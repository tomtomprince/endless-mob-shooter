import Phaser from "phaser";
import { SPRITES } from "./BootScene";
import { buildWave, waveScore, type MobDef } from "./mobs";
import { LEVELS, levelForWave, type GateKind, type LevelDef } from "./levels";

export const W = 540;
export const H = 960;

const CANNON_Y = 855;
const BASE_Y = 830; // enemies crossing this line damage the base
const GATE_HALF_W = 82;
const GATE_GAP = 12;
const MARINE_SPEED = 160;
const MARINE_RADIUS = 9; // physical radius against walls
const BASE_FIRE_INTERVAL = 320; // ms
const MIN_FIRE_INTERVAL = 160;
const MAX_VOLLEY = 3;
const MAX_MARINES = 300;
const BASE_HP = 20;
const CHARGE_MAX = 40; // cannon shots to charge a giant
const GIANT_HP = 12;
const GIANT_SPEED = 120;
const NUKE_START = 0;
const NUKE_MAX = 3;
const NUKE_REGEN_WAVES = 1.5; // ~1.5 waves' worth of score buys a nuke

interface Gate {
  id: number;
  kind: GateKind;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  moving: boolean;
}

interface Marine {
  spr: Phaser.GameObjects.Sprite;
  vx: number;
  usedGates: number; // bitmask of gate ids already triggered
  giant: boolean;
  hp: number;
  nextHitAt: number; // giant hit-rate limiter (combat and crates)
}

interface Enemy {
  spr: Phaser.GameObjects.Sprite;
  def: MobDef;
  hp: number;
  baseX: number;
  phase: number;
  nextAtkAt: number;
  attacking: boolean;
}

interface Proj {
  spr: Phaser.GameObjects.Sprite;
  key: string;
  vx: number;
  vy: number;
  splash: number;
  dead: boolean;
}

interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  breakable: boolean;
  spr: Phaser.GameObjects.TileSprite;
  label?: Phaser.GameObjects.Text;
}

interface Pod {
  x: number;
  y: number;
  hp: number;
  bg: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  text: Phaser.GameObjects.Text;
}

export class GameScene extends Phaser.Scene {
  private marines: Marine[] = [];
  private enemies: Enemy[] = [];
  private movingGates: Gate[] = [];
  private staticGates: Gate[] = [];
  private walls: Wall[] = [];
  private pods: Pod[] = [];
  private projs: Proj[] = [];
  private charge = 0;
  private nukes = NUKE_START;
  private nextNukeScore = 0;
  private spawnQueue: { at: number; def: MobDef }[] = [];

  private cannon!: Phaser.GameObjects.Container;
  private targetX = W / 2;
  private fireAt = 0;
  private fireInterval = BASE_FIRE_INTERVAL;
  private volley = 1;
  private upgradeToggle = false;
  private wave = 0;
  private levelIndex = -1;
  private nextWaveAt = 0;
  private score = 0;
  private baseHp = BASE_HP;
  private over = false;

  private hpBar!: Phaser.GameObjects.Rectangle;
  private chargeBar!: Phaser.GameObjects.Rectangle;
  private chargeText!: Phaser.GameObjects.Text;
  private nukeBtn!: Phaser.GameObjects.Rectangle;
  private nukeText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private lastSound: Record<string, number> = {};

  constructor() {
    super("game");
  }

  create() {
    // debug/tuning helpers: ?wave=9 starts at wave 9, ?hp=3 weakens the base
    const params = new URLSearchParams(location.search);
    this.marines = [];
    this.enemies = [];
    this.movingGates = [];
    this.staticGates = [];
    this.walls = [];
    this.pods = [];
    this.projs = [];
    this.charge = 0;
    this.nukes = NUKE_START;
    this.spawnQueue = [];
    this.wave = Number(params.get("wave") ?? 1) - 1;
    this.nextNukeScore = waveScore(this.wave + 1) * NUKE_REGEN_WAVES;
    this.levelIndex = -1;
    this.score = 0;
    this.baseHp = Number(params.get("hp") ?? BASE_HP);
    this.fireInterval = BASE_FIRE_INTERVAL;
    this.volley = 1;
    this.upgradeToggle = false;
    this.over = false;
    this.nextWaveAt = this.time.now + 1500;

    this.buildArena();
    this.buildMovingGates();
    this.buildCannon();
    this.buildHud();
    this.loadLevel(levelForWave(this.wave + 1));

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.targetX = p.worldX;
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.targetX = p.worldX;
    });
    this.input.keyboard?.on("keydown-SPACE", () => this.detonateNuke());
    this.input.keyboard?.on("keydown-N", () => this.detonateNuke());
  }

  // ------------------------------------------------------------- setup

  private buildArena() {
    this.add.tileSprite(0, 0, W, H, "floor").setOrigin(0).setDepth(-30);
    this.add.tileSprite(0, 0, W, 110, "floor2").setOrigin(0).setDepth(-20);
    this.add
      .tileSprite(0, H - 100, W, 100, "base")
      .setOrigin(0)
      .setDepth(-20);
    this.add.rectangle(W / 2, 110, W, 4, 0x000000, 0.6).setDepth(-19);
    this.add.rectangle(W / 2, H - 100, W, 4, 0x000000, 0.6).setDepth(-19);
    // darken the arena slightly for contrast
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.25).setDepth(-10);
  }

  private makeGateVisual(kind: GateKind, w: number, h: number, fontSize: number) {
    const rect = this.add
      .rectangle(0, 0, w, h, 0x2266ff, 0.28)
      .setDepth(-5)
      .setStrokeStyle(2, 0x66aaff, 0.9);
    const label = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: `${fontSize}px`,
        fontStyle: "bold",
        color: "#aaddff",
      })
      .setOrigin(0.5)
      .setDepth(-4);
    const gate = { kind, rect, label };
    this.styleGate(gate);
    return gate;
  }

  private styleGate(g: {
    kind: GateKind;
    rect: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }) {
    const bad = g.kind === "-1";
    g.label.setText(g.kind).setColor(bad ? "#ff8888" : "#aaddff");
    g.rect.setFillStyle(bad ? 0xcc2222 : 0x2266ff, 0.28);
    g.rect.setStrokeStyle(2, bad ? 0xff6666 : 0x66aaff, 0.9);
  }

  private buildMovingGates() {
    for (let i = 0; i < 2; i++) {
      const v = this.makeGateVisual("x2", GATE_HALF_W * 2, 64, 34);
      this.movingGates.push({ id: 30 + i, moving: true, ...v });
    }
    this.rollMovingGates();
  }

  private rollMovingGates() {
    const goodPool: GateKind[] = ["x2", "x2", "x3"];
    const otherPool: GateKind[] = ["-1", "-1", "-1", "x2", "+1"];
    const kinds = [
      goodPool[Math.floor(Math.random() * goodPool.length)],
      otherPool[Math.floor(Math.random() * otherPool.length)],
    ];
    if (Math.random() < 0.5) kinds.reverse();
    for (let i = 0; i < 2; i++) {
      this.movingGates[i].kind = kinds[i];
      this.styleGate(this.movingGates[i]);
    }
  }

  // ------------------------------------------------------------- level

  private loadLevel(idx: number) {
    this.levelIndex = idx;
    const lvl: LevelDef = LEVELS[idx];

    for (const w of this.walls) {
      w.spr.destroy();
      w.label?.destroy();
    }
    this.walls = [];
    for (const g of this.staticGates) {
      g.rect.destroy();
      g.label.destroy();
    }
    this.staticGates = [];
    for (const p of this.pods) this.removePodVisual(p);
    this.pods = [];

    for (const def of lvl.walls) {
      const breakable = def.hp !== undefined;
      const spr = this.add
        .tileSprite(def.x, def.y, def.w, def.h, breakable ? "crate" : "wall")
        .setOrigin(0)
        .setDepth(def.y + def.h);
      const wall: Wall = {
        ...def,
        hp: def.hp ?? Infinity,
        maxHp: def.hp ?? Infinity,
        breakable,
        spr,
      };
      if (breakable) {
        wall.label = this.add
          .text(def.x + def.w / 2, def.y + def.h / 2, `${def.hp}`, {
            fontFamily: "monospace",
            fontSize: "20px",
            fontStyle: "bold",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(def.y + def.h + 1);
      }
      this.walls.push(wall);
    }

    lvl.gates.forEach((def, i) => {
      const v = this.makeGateVisual(
        def.kind,
        def.w,
        44,
        def.kind === "+1" || def.kind === "-1" ? 22 : 30,
      );
      v.rect.setPosition(def.x, def.y);
      v.label.setPosition(def.x, def.y);
      this.staticGates.push({ id: i, moving: false, ...v });
    });

    for (const def of lvl.pods) this.spawnPod(def.x, def.y);

    for (const g of this.movingGates) {
      g.rect.y = lvl.movingGateY;
      g.label.y = lvl.movingGateY;
    }
  }

  // ------------------------------------------------------------- pods

  private spawnPod(x: number, y: number) {
    const hp = 20 + Math.max(this.wave, 1) * 3;
    const bg = this.add.circle(x, y, 24, 0x1a1a22, 0.9).setDepth(y + 40);
    const ring = this.add
      .circle(x, y, 24)
      .setStrokeStyle(4, 0xffcc33, 1)
      .setDepth(y + 41);
    const text = this.add
      .text(x, y, `${hp}`, {
        fontFamily: "monospace",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#ffcc33",
      })
      .setOrigin(0.5)
      .setDepth(y + 42);
    this.pods.push({ x, y, hp, bg, ring, text });
  }

  private removePodVisual(p: Pod) {
    p.bg.destroy();
    p.ring.destroy();
    p.text.destroy();
  }

  private hitPod(p: Pod, m: Marine) {
    this.killMarine(m, true);
    p.hp--;
    this.playSound("podhit", 150, 0.3);
    p.text.setText(`${p.hp}`);
    this.tweens.add({
      targets: [p.ring, p.text],
      scale: { from: 1.25, to: 1 },
      duration: 120,
    });
    if (p.hp <= 0) this.popPod(p);
  }

  /** Burst a pod open and collect its upgrade. */
  private popPod(p: Pod) {
    const i = this.pods.indexOf(p);
    if (i >= 0) this.pods.splice(i, 1);
    const flash = this.add.circle(p.x, p.y, 30, 0xffcc33, 0.8).setDepth(1200);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 3,
      duration: 400,
      onComplete: () => flash.destroy(),
    });
    this.removePodVisual(p);
    this.grantUpgrade();
  }

  private grantUpgrade() {
    const canFire = this.fireInterval > MIN_FIRE_INTERVAL;
    const canVolley = this.volley < MAX_VOLLEY;
    let msg: string;
    if (canVolley && (this.upgradeToggle || !canFire)) {
      this.volley++;
      msg = this.volley === 2 ? "DOUBLE SHOT!" : "TRIPLE SHOT!";
    } else if (canFire) {
      this.fireInterval = Math.max(MIN_FIRE_INTERVAL, this.fireInterval * 0.85);
      msg = "FIRE RATE UP!";
    } else {
      this.baseHp = Math.min(BASE_HP, this.baseHp + 5);
      msg = "BASE REPAIRED!";
    }
    this.upgradeToggle = !this.upgradeToggle;
    this.playSound("upgrade", 100, 0.6);
    this.showBanner(msg, "#ffcc33");
  }

  // ------------------------------------------------------------- walls

  /**
   * Push a unit out of every wall it overlaps. Solid walls deflect head-on
   * traffic sideways toward the nearest open end (units "follow" the wall);
   * a breakable wall blocking head-on is returned so the caller can damage
   * it instead.
   */
  private resolveWalls(
    spr: Phaser.GameObjects.Sprite,
    r: number,
    movingUp: boolean,
    speed: number,
    dt: number,
  ): Wall | null {
    let blockedBreakable: Wall | null = null;
    for (let pass = 0; pass < 2; pass++) {
      for (const wall of this.walls) {
        const ux = spr.x;
        const uy = spr.y;
        if (
          ux <= wall.x - r ||
          ux >= wall.x + wall.w + r ||
          uy <= wall.y - r ||
          uy >= wall.y + wall.h + r
        ) {
          continue;
        }
        const pushLeft = ux - (wall.x - r);
        const pushRight = wall.x + wall.w + r - ux;
        const pushUp = uy - (wall.y - r);
        const pushDown = wall.y + wall.h + r - uy;
        if (Math.min(pushLeft, pushRight) < Math.min(pushUp, pushDown)) {
          spr.x += pushLeft < pushRight ? -pushLeft : pushRight;
          continue;
        }
        const resolvedDown = pushDown < pushUp;
        spr.y += resolvedDown ? pushDown : -pushUp;
        const headOn = movingUp ? resolvedDown : !resolvedDown;
        if (!headOn) continue;
        if (wall.breakable) {
          blockedBreakable = wall;
          continue;
        }
        // slide along the wall toward the nearest end that isn't the
        // screen edge
        let dir = ux < wall.x + wall.w / 2 ? -1 : 1;
        if (wall.x <= 4) dir = 1;
        if (wall.x + wall.w >= W - 4) dir = -1;
        spr.x = Phaser.Math.Clamp(spr.x + dir * speed * dt, 16, W - 16);
      }
    }
    return blockedBreakable;
  }

  private damageWall(wall: Wall, dmg: number) {
    wall.hp -= dmg;
    if (wall.hp <= 0) {
      this.smashWall(wall);
      return;
    }
    wall.label?.setText(`${Math.ceil(wall.hp)}`);
    const shade = Math.round(120 + 135 * (wall.hp / wall.maxHp));
    wall.spr.setTint(Phaser.Display.Color.GetColor(shade, shade, shade));
  }

  private smashWall(wall: Wall) {
    const i = this.walls.indexOf(wall);
    if (i >= 0) this.walls.splice(i, 1);
    this.playSound("smash", 150, 0.5);
    this.cameras.main.shake(120, 0.005);
    for (let d = 0; d < 8; d++) {
      const chip = this.add
        .rectangle(
          wall.x + Math.random() * wall.w,
          wall.y + wall.h / 2,
          Phaser.Math.Between(6, 14),
          Phaser.Math.Between(6, 14),
          0xb9743c,
        )
        .setDepth(wall.y + wall.h + 2);
      this.tweens.add({
        targets: chip,
        x: chip.x + Phaser.Math.Between(-50, 50),
        y: chip.y + Phaser.Math.Between(-40, 40),
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: 450,
        onComplete: () => chip.destroy(),
      });
    }
    wall.spr.destroy();
    wall.label?.destroy();
    this.score += 20;
  }

  // ------------------------------------------------------------- cannon/hud

  private buildCannon() {
    const g = this.add.graphics();
    g.fillStyle(0x333a44).fillRoundedRect(6, 30, 52, 30, 8);
    g.fillStyle(0x59636f).fillRoundedRect(10, 34, 44, 22, 6);
    g.fillStyle(0x222222).fillRect(26, 0, 12, 36);
    g.fillStyle(0x888888).fillRect(28, 2, 3, 34);
    g.generateTexture("cannon", 64, 64);
    g.destroy();
    const spr = this.add.image(0, 0, "cannon");
    this.cannon = this.add.container(W / 2, CANNON_Y, [spr]).setDepth(900);
  }

  private buildHud() {
    const pad = 10;
    this.add.rectangle(pad, pad, 160, 18, 0x330000, 0.8).setOrigin(0).setDepth(1000);
    this.hpBar = this.add
      .rectangle(pad + 2, pad + 2, 156, 14, 0xcc2222)
      .setOrigin(0)
      .setDepth(1001);
    this.hpText = this.add
      .text(pad + 80, pad + 9, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(1002);
    this.scoreText = this.add
      .text(W - pad, pad, "0", {
        fontFamily: "monospace",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#ffcc66",
      })
      .setOrigin(1, 0)
      .setDepth(1000);
    this.waveText = this.add
      .text(W / 2, pad, "", {
        fontFamily: "monospace",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0)
      .setDepth(1000);
    // nuke button, bottom-left of the base strip; clicking anywhere else
    // steers the cannon, so the detonate tap gets its own target
    this.nukeBtn = this.add
      .rectangle(70, H - 28, 112, 34, 0x331111, 0.9)
      .setDepth(1000)
      .setStrokeStyle(2, 0xff6644, 0.9)
      .setInteractive({ useHandCursor: true });
    this.nukeText = this.add
      .text(70, H - 28, `NUKE x${this.nukes}`, {
        fontFamily: "monospace",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ff8866",
      })
      .setOrigin(0.5)
      .setDepth(1001);
    this.nukeBtn.on(
      "pointerdown",
      (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.detonateNuke();
      },
    );
    // giant charge meter, down in the base strip
    this.add
      .rectangle(W / 2, H - 28, 224, 18, 0x001122, 0.85)
      .setDepth(1000)
      .setStrokeStyle(2, 0x336688, 0.9);
    this.chargeBar = this.add
      .rectangle(W / 2 - 110, H - 28, 0, 12, 0x55ccff)
      .setOrigin(0, 0.5)
      .setDepth(1001);
    this.chargeText = this.add
      .text(W / 2, H - 28, "GIANT", {
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#88bbdd",
      })
      .setOrigin(0.5)
      .setDepth(1002);
  }

  private showBanner(text: string, color: string) {
    const banner = this.add
      .text(W / 2, 300, text, {
        fontFamily: "monospace",
        fontSize: "52px",
        fontStyle: "bold",
        color,
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(1100)
      .setAlpha(0);
    this.tweens.add({
      targets: banner,
      alpha: { from: 0, to: 1 },
      scale: { from: 1.6, to: 1 },
      duration: 350,
      yoyo: true,
      hold: 700,
      onComplete: () => banner.destroy(),
    });
  }

  // ------------------------------------------------------------- waves

  private startWave() {
    this.wave++;
    const li = levelForWave(this.wave);
    if (li !== this.levelIndex) this.loadLevel(li);
    else if (this.pods.length === 0 && this.wave % 2 === 0) {
      // spent pods only respawn every other wave
      for (const def of LEVELS[li].pods) this.spawnPod(def.x, def.y);
    }
    this.rollMovingGates();
    const picks = buildWave(this.wave, Math.random);
    // spawn the whole wave inside a fixed window: big waves spawn faster
    // instead of lasting longer
    const span = Math.min(45000, picks.length * 250);
    const now = this.time.now;
    this.spawnQueue = picks.map((def, i) => ({
      at: now + 500 + ((i + Phaser.Math.FloatBetween(0, 0.8)) * span) / picks.length,
      def,
    }));
    // the next wave comes on a deadline whether or not the field is clear
    const lastAt = this.spawnQueue[this.spawnQueue.length - 1]?.at ?? now;
    this.nextWaveAt = lastAt + 8000;
    this.waveText.setText(`WAVE ${this.wave}`);
    this.showBanner(`WAVE ${this.wave}`, "#ff4422");
  }

  private spawnEnemy(def: MobDef) {
    const x = Phaser.Math.Between(50, W - 50);
    const spr = this.add
      .sprite(x, 90, def.key)
      .setScale(def.scale * 1.15)
      .setOrigin(SPRITES[def.key].originX, SPRITES[def.key].originY);
    spr.play(`${def.key}-walk`);
    this.enemies.push({
      spr,
      def,
      hp: def.hp,
      baseX: x,
      phase: Math.random() * 6,
      nextAtkAt: this.time.now + (def.attack?.cooldown ?? 0) * Phaser.Math.FloatBetween(0.5, 1.1),
      attacking: false,
    });
    this.playSound("spawn", 400, 0.25);
    const flash = this.add.circle(x, 90, 26, 0x44ff88, 0.7).setDepth(500);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  // ------------------------------------------------------------- units

  private fireMarine(x: number, y: number, usedGates: number): Marine | null {
    if (this.marines.length >= MAX_MARINES) return null;
    const spr = this.add
      .sprite(x, y, "play")
      .setScale(0.62)
      .setOrigin(SPRITES.play.originX, SPRITES.play.originY);
    spr.play({ key: "play-walk", startFrame: Phaser.Math.Between(0, 3) });
    const m: Marine = {
      spr,
      vx: Phaser.Math.FloatBetween(-16, 16),
      usedGates,
      giant: false,
      hp: 1,
      nextHitAt: 0,
    };
    this.marines.push(m);
    return m;
  }

  private fireGiant(x: number) {
    const m = this.fireMarine(x, CANNON_Y - 28, 0);
    if (!m) return;
    m.giant = true;
    m.hp = GIANT_HP;
    m.vx = 0;
    m.spr.setScale(1.5).setTint(0x99ddff);
    this.playSound("giant", 100, 0.6);
    this.cameras.main.shake(120, 0.004);
    const flash = this.add.circle(x, CANNON_Y - 30, 34, 0x55ccff, 0.7).setDepth(950);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.2,
      duration: 350,
      onComplete: () => flash.destroy(),
    });
  }

  private killMarine(m: Marine, silent = false) {
    const i = this.marines.indexOf(m);
    if (i >= 0) this.marines.splice(i, 1);
    if (!silent) this.playSound("die_play", 300, 0.15);
    m.spr.setDepth(-8); // corpse under everyone's feet
    m.spr.play("play-death");
    m.spr.once("animationcomplete", () => {
      this.tweens.add({
        targets: m.spr,
        alpha: 0,
        delay: 600,
        duration: 500,
        onComplete: () => m.spr.destroy(),
      });
    });
  }

  private killEnemy(e: Enemy) {
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    this.score += e.def.power * 10;
    this.playSound(`die_${e.def.key}`, 120, 0.4);
    e.spr.setDepth(-8);
    e.spr.play(`${e.def.key}-death`);
    e.spr.once("animationcomplete", () => {
      this.tweens.add({
        targets: e.spr,
        alpha: 0,
        delay: 900,
        duration: 600,
        onComplete: () => e.spr.destroy(),
      });
    });
  }

  private leakEnemy(e: Enemy) {
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    this.baseHp = Math.max(0, this.baseHp - e.def.power);
    this.playSound("basehit", 100, 0.6);
    this.cameras.main.shake(180, 0.012);
    this.cameras.main.flash(200, 120, 0, 0);
    e.spr.destroy();
    if (this.baseHp <= 0) this.gameOver();
  }

  // ------------------------------------------------------------- nukes

  /** Wipe the screen: every enemy and projectile dies, pods pop (and their
   *  upgrades are collected). Nuke-proof mobs — the cyberdemon — ride it out. */
  private detonateNuke() {
    if (this.over || this.nukes <= 0) return;
    this.nukes--;
    this.playSound("boom", 0, 0.7);
    this.cameras.main.shake(350, 0.02);
    this.cameras.main.flash(350, 255, 200, 80);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.def.nukeProof) continue;
      e.hp = 0;
      this.killEnemy(e);
    }
    // in-flight fireballs fizzle without splashing marines
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.splash = 0;
      this.explodeProj(p);
    }
    // popPod removes from this.pods, so drain from the back
    while (this.pods.length > 0) this.popPod(this.pods[this.pods.length - 1]);
  }

  // ------------------------------------------------------------- attacks

  private startAttack(e: Enemy, now: number) {
    const atk = e.def.attack!;
    e.attacking = true;
    e.nextAtkAt = now + atk.cooldown * Phaser.Math.FloatBetween(0.8, 1.3);
    e.spr.play(`${e.def.key}-attack`);
    e.spr.once(`animationcomplete-${e.def.key}-attack`, () => {
      if (!e.spr.active || e.hp <= 0) return;
      const burst = atk.burst ?? 1;
      if (atk.pattern === "seq") {
        for (let i = 0; i < burst; i++) {
          this.time.delayedCall(i * 260, () => {
            if (e.spr.active && e.hp > 0) this.fireProjectile(e, 0);
          });
        }
      } else if (atk.pattern === "spread") {
        for (let i = 0; i < burst; i++) {
          this.fireProjectile(e, (i - (burst - 1) / 2) * 0.35);
        }
      } else {
        this.fireProjectile(e, 0);
      }
      e.attacking = false;
      e.spr.play(`${e.def.key}-walk`);
    });
  }

  private fireProjectile(e: Enemy, angleOffset: number) {
    const atk = e.def.attack!;
    const ox = e.spr.x;
    const oy = e.spr.y - 26 * e.def.scale;
    // aim at the nearest marine, else straight down the lane
    let best: Marine | null = null;
    let bestD = Infinity;
    for (const m of this.marines) {
      const d = Math.abs(m.spr.x - ox) + Math.abs(m.spr.y - oy);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    let angle = Math.PI / 2; // straight down
    if (best) angle = Math.atan2(best.spr.y - oy, best.spr.x - ox);
    angle += angleOffset;
    this.playSound(atk.proj === "misl" || atk.proj === "fatb" ? "rlaunch" : "fireball", 100, 0.3);
    const spr = this.add.sprite(ox, oy, `proj_${atk.proj}`).setDepth(oy);
    spr.play(`proj_${atk.proj}-fly`);
    this.projs.push({
      spr,
      key: atk.proj,
      vx: Math.cos(angle) * atk.speed,
      vy: Math.sin(angle) * atk.speed,
      splash: atk.splash ?? 0,
      dead: false,
    });
  }

  private explodeProj(p: Proj) {
    if (p.dead) return;
    p.dead = true;
    p.vx = 0;
    p.vy = 0;
    if (p.splash > 0) {
      this.playSound("boom", 100, 0.45);
      this.cameras.main.shake(100, 0.004);
      for (let i = this.marines.length - 1; i >= 0; i--) {
        const m = this.marines[i];
        const dx = m.spr.x - p.spr.x;
        const dy = m.spr.y - p.spr.y;
        if (dx * dx + dy * dy <= p.splash * p.splash) {
          if (m.giant) {
            m.hp -= 3;
            if (m.hp <= 0) this.killMarine(m);
          } else {
            this.killMarine(m);
          }
        }
      }
    } else {
      this.playSound("fireexp", 100, 0.25);
    }
    p.spr.play(`proj_${p.key}-boom`);
    p.spr.once(`animationcomplete-proj_${p.key}-boom`, () => {
      const i = this.projs.indexOf(p);
      if (i >= 0) this.projs.splice(i, 1);
      p.spr.destroy();
    });
  }

  private updateProjs(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      if (p.dead) continue;
      p.spr.x += p.vx * dt;
      p.spr.y += p.vy * dt;
      p.spr.setDepth(p.spr.y);

      if (p.spr.x < -20 || p.spr.x > W + 20 || p.spr.y < 40 || p.spr.y > 805) {
        this.explodeProj(p);
        continue;
      }

      let hitWall = false;
      for (const wall of this.walls) {
        if (
          p.spr.x > wall.x - 4 &&
          p.spr.x < wall.x + wall.w + 4 &&
          p.spr.y > wall.y - 4 &&
          p.spr.y < wall.y + wall.h + 4
        ) {
          if (wall.breakable) this.damageWall(wall, p.splash > 0 ? 4 : 2);
          this.explodeProj(p);
          hitWall = true;
          break;
        }
      }
      if (hitWall) continue;

      if (p.splash === 0) {
        for (const m of this.marines) {
          if (Math.abs(m.spr.x - p.spr.x) <= 16 && Math.abs(m.spr.y - p.spr.y) <= 16) {
            if (m.giant) {
              m.hp -= 2;
              if (m.hp <= 0) this.killMarine(m);
            } else {
              this.killMarine(m);
            }
            this.explodeProj(p);
            break;
          }
        }
      } else {
        // rockets detonate on proximity, splash handles the killing
        for (const m of this.marines) {
          if (Math.abs(m.spr.x - p.spr.x) <= 20 && Math.abs(m.spr.y - p.spr.y) <= 20) {
            this.explodeProj(p);
            break;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------- gates

  private applyGate(gate: Gate, m: Marine): boolean {
    m.usedGates |= 1 << gate.id;
    this.playSound("gate", 120, 0.3);
    this.tweens.add({
      targets: [gate.rect, gate.label],
      alpha: { from: 1, to: 0.55 },
      duration: 90,
      yoyo: true,
    });
    if (gate.kind === "-1") {
      this.killMarine(m);
      return true;
    }
    const clones = gate.kind === "x3" ? 2 : 1;
    for (let i = 0; i < clones; i++) {
      const c = this.fireMarine(
        Phaser.Math.Clamp(m.spr.x + Phaser.Math.Between(-18, 18), 20, W - 20),
        m.spr.y + Phaser.Math.Between(4, 16),
        m.usedGates,
      );
      if (!c) break;
    }
    return false;
  }

  // ------------------------------------------------------------- loop

  update(now: number, deltaMs: number) {
    if (this.over) return;
    const dt = Math.min(deltaMs, 50) / 1000;

    // cannon follows pointer
    const cx = Phaser.Math.Linear(
      this.cannon.x,
      Phaser.Math.Clamp(this.targetX, 34, W - 34),
      Math.min(1, dt * 14),
    );
    this.cannon.x = cx;

    // auto-fire (volley upgrades fire several side by side); a full charge
    // meter turns the next shot into a giant
    if (now >= this.fireAt) {
      this.fireAt = now + this.fireInterval;
      if (this.charge >= CHARGE_MAX) {
        this.charge = 0;
        this.fireGiant(cx);
      } else {
        let fired = false;
        for (let v = 0; v < this.volley; v++) {
          const off = (v - (this.volley - 1) / 2) * 16;
          if (this.fireMarine(cx + off + Phaser.Math.Between(-3, 3), CANNON_Y - 28, 0)) {
            fired = true;
          }
        }
        if (fired) {
          this.charge++;
          this.playSound("shoot", 180, 0.12);
        }
      }
    }

    // moving gates drift side to side as a pair
    const lvl = LEVELS[this.levelIndex];
    const gcx = W / 2 + Math.sin(now / 4200) * 75;
    const xs = [gcx - GATE_HALF_W - GATE_GAP, gcx + GATE_HALF_W + GATE_GAP];
    for (let i = 0; i < 2; i++) {
      this.movingGates[i].rect.setPosition(xs[i], lvl.movingGateY);
      this.movingGates[i].label.setPosition(xs[i], lvl.movingGateY);
    }

    this.updateMarines(now, dt);
    this.updateEnemies(now, dt);
    this.updateProjs(dt);
    this.resolveCombat(now);
    this.updateWaves(now);
    this.updateHud();
  }

  private updateMarines(now: number, dt: number) {
    const gates = [...this.staticGates, ...this.movingGates];
    for (let i = this.marines.length - 1; i >= 0; i--) {
      const m = this.marines[i];
      const speed = m.giant ? GIANT_SPEED : MARINE_SPEED;
      m.spr.y -= speed * dt;
      m.spr.x = Phaser.Math.Clamp(m.spr.x + m.vx * dt, 16, W - 16);
      m.spr.setDepth(m.spr.y);

      const crate = this.resolveWalls(m.spr, m.giant ? 16 : MARINE_RADIUS, true, speed, dt);
      if (crate) {
        if (m.giant) {
          // giants punch through crates instead of dying
          if (now >= m.nextHitAt) {
            m.nextHitAt = now + 350;
            this.damageWall(crate, 10);
            m.hp -= 2;
            if (m.hp <= 0) this.killMarine(m);
          }
        } else {
          this.damageWall(crate, 1);
          this.killMarine(m, true);
          continue;
        }
      }

      // giants don't multiply through gates or feed pods
      if (!m.giant) {
        let died = false;
        for (const g of gates) {
          if (m.usedGates & (1 << g.id)) continue;
          if (
            Math.abs(m.spr.x - g.rect.x) <= g.rect.width / 2 &&
            Math.abs(m.spr.y - g.rect.y) <= g.rect.height / 2
          ) {
            died = this.applyGate(g, m);
            if (died) break;
          }
        }
        if (died) continue;

        let hitPod = false;
        for (const p of this.pods) {
          if (Math.abs(m.spr.x - p.x) <= 30 && Math.abs(m.spr.y - p.y) <= 30) {
            this.hitPod(p, m);
            hitPod = true;
            break;
          }
        }
        if (hitPod) continue;
      }

      if (m.spr.y < 60) {
        // marched through the portal — small bonus
        this.score += m.giant ? 10 : 1;
        this.marines.splice(i, 1);
        m.spr.destroy();
      }
    }
  }

  private updateEnemies(now: number, dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      // shooters pause to attack when on the battlefield
      if (e.def.attack && !e.attacking && now >= e.nextAtkAt && e.spr.y > 120 && e.spr.y < 700) {
        this.startAttack(e, now);
      }
      if (e.attacking) {
        e.spr.setDepth(e.spr.y);
        continue;
      }

      e.spr.y += e.def.speed * dt;
      if (e.def.floats) {
        // fliers bob and sail straight over the walls
        e.spr.x = e.baseX + Math.sin(now / 700 + e.phase) * 26;
        e.spr.y += Math.sin(now / 300 + e.phase) * 8 * dt;
      } else {
        const crate = this.resolveWalls(e.spr, 6 + 8 * e.def.scale, false, e.def.speed, dt);
        if (crate) this.damageWall(crate, e.def.power * 1.2 * dt);
      }
      e.spr.setDepth(e.spr.y);
      if (e.spr.y >= BASE_Y) this.leakEnemy(e);
    }
  }

  private resolveCombat(now: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const r = 20 * e.def.scale + 14;
      for (let j = this.marines.length - 1; j >= 0; j--) {
        const m = this.marines[j];
        const dy = m.spr.y - e.spr.y;
        if (dy < -r || dy > r) continue;
        const dx = m.spr.x - e.spr.x;
        if (dx < -r || dx > r) continue;

        if (m.giant) {
          // giants trade repeatedly at a capped rate and hit hard
          if (now < m.nextHitAt) continue;
          m.nextHitAt = now + 120;
          m.hp -= 1;
          if (m.hp <= 0) this.killMarine(m);
          e.hp -= 3;
          if (!e.def.immovable) e.spr.y -= 420 / (e.def.power + 3);
        } else {
          this.killMarine(m);
          e.hp -= 1;
          // knockback, heavies budge less
          if (!e.def.immovable) e.spr.y -= 220 / (e.def.power + 3);
        }
        e.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        this.time.delayedCall(60, () => {
          if (e.spr.active) {
            e.spr.clearTint();
            e.spr.setTintMode(Phaser.TintModes.MULTIPLY);
          }
        });
        if (e.hp <= 0) {
          this.killEnemy(e);
          break;
        }
      }
    }
  }

  private updateWaves(now: number) {
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].at <= now) {
      this.spawnEnemy(this.spawnQueue.shift()!.def);
    }
    // clearing the field early pulls the next wave in sooner
    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.nextWaveAt = Math.min(this.nextWaveAt, now + 2500);
    }
    if (now >= this.nextWaveAt) this.startWave();
  }

  private updateHud() {
    // nukes regenerate on a score ladder pegged to the current wave's
    // payout, so they stay equally rare as scoring accelerates
    while (this.score >= this.nextNukeScore) {
      this.nextNukeScore += waveScore(Math.max(1, this.wave)) * NUKE_REGEN_WAVES;
      if (this.nukes < NUKE_MAX) {
        this.nukes++;
        this.playSound("upgrade", 100, 0.5);
        this.tweens.add({
          targets: [this.nukeBtn, this.nukeText],
          scale: { from: 1.25, to: 1 },
          duration: 160,
        });
      }
    }
    this.nukeText.setText(`NUKE x${this.nukes}`);
    if (this.nukes > 0) {
      this.nukeText.setColor("#ff8866");
      this.nukeBtn.setStrokeStyle(2, 0xff6644, 0.9);
    } else {
      this.nukeText.setColor("#665555");
      this.nukeBtn.setStrokeStyle(2, 0x554444, 0.7);
    }
    this.hpBar.width = 156 * Math.min(1, this.baseHp / BASE_HP);
    this.hpText.setText(`${this.baseHp}/${BASE_HP}`);
    this.scoreText.setText(`${this.score}`);
    const frac = Math.min(1, this.charge / CHARGE_MAX);
    this.chargeBar.width = 220 * frac;
    if (frac >= 1) {
      this.chargeText.setText("GIANT READY").setColor("#ffffff");
      this.chargeBar.setFillStyle(0xaaeeff);
    } else {
      this.chargeText.setText("GIANT").setColor("#88bbdd");
      this.chargeBar.setFillStyle(0x55ccff);
    }
  }

  // ------------------------------------------------------------- misc

  private playSound(key: string, throttleMs: number, volume = 1) {
    const now = this.time.now;
    if (now - (this.lastSound[key] ?? -1e9) < throttleMs) return;
    this.lastSound[key] = now;
    this.sound.play(key, { volume, detune: Phaser.Math.Between(-60, 60) });
  }

  private gameOver() {
    this.over = true;
    this.nukeBtn.disableInteractive(); // don't swallow the restart tap
    this.sound.play("gameover", { volume: 0.7 });
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(2000);
    this.add
      .text(W / 2, H / 2 - 80, "GAME OVER", {
        fontFamily: "monospace",
        fontSize: "56px",
        fontStyle: "bold",
        color: "#ff3311",
        stroke: "#000000",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(2001);
    this.add
      .text(W / 2, H / 2, `score ${this.score}  ·  wave ${this.wave}`, {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffcc66",
      })
      .setOrigin(0.5)
      .setDepth(2001);
    this.add
      .text(W / 2, H / 2 + 70, "tap to restart", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5)
      .setDepth(2001);
    this.time.delayedCall(600, () => {
      this.input.once("pointerdown", () => this.scene.restart());
    });
  }
}
