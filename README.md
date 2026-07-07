# Endless Mob Shooter

A web-based, Mob Control-style endless mob shooter using Freedoom monster
sprites. Built with Phaser 4 + Vite+ (TypeScript).

Drag/move the pointer to steer the cannon. It auto-fires a stream of marines
up the arena. Route the stream through blue multiplier gates (`x2`, `x3`,
`+1` ladders) and away from red `-1` gates. Doom mobs teleport in at the top
and march on your base — anything that reaches the red zone chews through
your base HP. Waves scale forever; a cyberdemon shows up every 10th wave.

The arena cycles through wall layouts every 3 waves (`src/levels.ts`):

- **Solid walls** (grey metal) block ground units; both sides slide along
  them toward the nearest opening. Cacodemons fly straight over.
- **Crate walls** (brown, HP counter) are smashed open — marines deal 1 each
  and die, enemies gnaw through with their power as DPS.
- **Upgrade pods** (yellow rings with a counter) soak marine hits; empty one
  to earn fire-rate, double/triple-shot, or base-repair upgrades. A fresh pod
  appears each wave.
- A pair of **moving gates** drifts across a fixed row per layout.

Some mobs shoot back: imps and cacodemons lob fireballs aimed at your
marines, revenants fire fast tracers, mancubi a two-shot spread, and the
cyberdemon launches three-rocket bursts whose splash wipes out whole squads
(and dents crates). Meanwhile every cannon shot fills the **GIANT meter** at
the bottom — when full, the next shot is a giant marine that trades 3 damage
per hit, shrugs off fireballs, and punches straight through crate walls.

Scoring also earns **nukes** — one per ~1.5 waves' worth of points, stocking
up to three; the button fills to show progress toward the next one and the
game flashes NUKE READY when it lands. Click the NUKE button (or press
Space/N) to wipe every enemy
and projectile on screen; upgrade pods caught in the blast pop too, and
their upgrades are collected. Only the cyberdemon shrugs a nuke off (it
ignores knockback, too).

## Run

```sh
vp install
vp dev
```

Production build: `vp build`, then `vp preview`.

Escape pauses (Escape or tap resumes).

Debug/tuning URL params: `?wave=10` starts at wave 10, `?hp=3` weakens the
base.

## Assets

All art and sound comes from [Freedoom](https://freedoom.github.io/) (BSD
license), extracted from `freedoom2.wad`:

- `tools/extract_assets.py` decodes monster sprites (walk + death animations,
  aligned on their Doom sprite offsets) into strip PNGs under
  `public/assets/sprites/`, a `src/manifest.json` describing frames/origins,
  floor textures, and DMX sounds converted to WAV under
  `public/assets/sounds/`.
- It needs the Freedoom checkout and wadlib from the sibling `potato-ai`
  project (paths are constants at the top of the script) and a Python with
  Pillow:

  ```sh
  ../potato-ai/.venv/bin/python tools/extract_assets.py
  ```

The `tools/drive*.mjs` scripts are headless-Chrome smoke tests
(Playwright): start `vp dev --port 5199`, then run them with `SHOT_DIR` set
to where screenshots should go.

## Licensing

- **Code**: MIT (see `LICENSE`).
- **Art & sounds** (`public/assets/`): derived from
  [Freedoom](https://freedoom.github.io/), BSD 3-clause. The full notice is
  in `public/FREEDOOM-LICENSE.txt` and ships with every build, as its
  redistribution terms require.
- **Engine**: [Phaser](https://phaser.io/), MIT.

## Tuning

Mob stats (hp, speed, unlock wave, wave budget) live in `src/mobs.ts`;
arena/cannon/gate constants at the top of `src/GameScene.ts`.
