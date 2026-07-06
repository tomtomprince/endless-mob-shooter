"""Extract Freedoom monster sprites + sounds into web-game assets.

For each monster we build one horizontal strip PNG containing its walk
frames followed by its death frames, all anchored on a shared origin so
animation doesn't jitter. A manifest.json describes frame sizes, origins
and animation index ranges. Sounds are converted from Doom's DMX format
to 8-bit PCM WAV.

Run with a python that has Pillow (potato-ai's venv works):
    /Users/tomprince/dev/sandbox/potato-ai/.venv/bin/python tools/extract_assets.py
"""

import json
import os
import re
import struct
import sys
import wave

POTATO = "/Users/tomprince/dev/sandbox/potato-ai"
WAD = f"{POTATO}/vendor/freedoom-0.13.0/freedoom2.wad"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets")

sys.path.insert(0, f"{POTATO}/tools")
from wadlib import Palette, WadReader, decode_picture  # noqa: E402

from PIL import Image  # noqa: E402

# sprite prefix -> walk rotation + how many rotation-0 frames form the normal
# death (frames beyond that are the separate "gib" death, which we skip).
# Walk cycle is frames A-D at the given rotation unless overridden; "attack"
# letters are the monster's shooting pose (at the same rotation).
MONSTERS = {
    "PLAY": {"rot": "5", "deaths": 7},  # marine, seen from behind (walks up)
    "POSS": {"rot": "1", "deaths": 5},
    "TROO": {"rot": "1", "deaths": 5, "attack": "EFG"},
    "SARG": {"rot": "1", "deaths": 6},
    "CPOS": {"rot": "1", "deaths": 7},
    "HEAD": {"rot": "1", "deaths": 6, "walk": "A", "attack": "BCD"},
    "SKEL": {"rot": "1", "deaths": 5, "attack": "JK"},
    "FATT": {"rot": "1", "deaths": 10, "attack": "GH"},
    "BOSS": {"rot": "1", "deaths": 7},
    "CYBR": {"rot": "1", "deaths": 9, "attack": "EF"},
}

# projectile key -> anim -> (sprite prefix, frame letters, rotation)
# Rotation 1 = flying toward the viewer; symmetric fireballs only have rot 0.
PROJECTILES = {
    "proj_bal1": {"fly": ("BAL1", "AB", "0"), "boom": ("BAL1", "CDE", "0")},
    "proj_bal2": {"fly": ("BAL2", "AB", "0"), "boom": ("BAL2", "CDE", "0")},
    "proj_fatb": {"fly": ("FATB", "AB", "1"), "boom": ("FBXP", "ABC", "0")},
    "proj_manf": {"fly": ("MANF", "AB", "1"), "boom": ("MISL", "BCD", "0")},
    "proj_misl": {"fly": ("MISL", "A", "1"), "boom": ("MISL", "BCD", "0")},
}

SOUNDS = {
    "shoot": "DSPISTOL",
    "gate": "DSITEMUP",
    "spawn": "DSTELEPT",
    "basehit": "DSOOF",
    "gameover": "DSSLOP",
    "die_play": "DSPLDETH",
    "die_poss": "DSPODTH1",
    "die_troo": "DSBGDTH1",
    "die_sarg": "DSSGTDTH",
    "die_cpos": "DSPODTH2",
    "die_head": "DSCACDTH",
    "die_skel": "DSSKEDTH",
    "die_fatt": "DSMANDTH",
    "die_boss": "DSBRSDTH",
    "die_cybr": "DSCYBDTH",
    "smash": "DSBAREXP",
    "podhit": "DSSWTCHN",
    "upgrade": "DSGETPOW",
    "fireball": "DSFIRSHT",
    "fireexp": "DSFIRXPL",
    "rlaunch": "DSRLAUNC",
    "boom": "DSRXPLOD",
    "giant": "DSSGCOCK",
}

LUMP_RE = re.compile(r"^(....)([A-Z\[\\\]])([0-8])(?:([A-Z\[\\\]])([0-8]))?$")


def sprite_table(wad, prefix):
    """frame letter -> rotation -> (lumpname, mirrored)"""
    table = {}
    for name in wad.order:
        if not name.startswith(prefix):
            continue
        m = LUMP_RE.match(name)
        if not m or m.group(1) != prefix:
            continue
        pairs = [(m.group(2), m.group(3), False)]
        if m.group(4):
            pairs.append((m.group(4), m.group(5), True))
        for frame, rot, mirrored in pairs:
            table.setdefault(frame, {})[rot] = (name, mirrored)
    return table


def get_frame(wad, pal, name, mirrored):
    img, xo, yo = decode_picture(wad.lump(name), pal)
    if mirrored:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
        xo = img.width - xo
    return img, xo, yo


def build_strip(frames):
    """frames: list of (img, xoff, yoff) -> (strip image, cellW, cellH, ox, oy)"""
    left = max(xo for _, xo, _ in frames)
    right = max(im.width - xo for im, xo, _ in frames)
    up = max(yo for _, _, yo in frames)
    down = max(im.height - yo for im, _, yo in frames)
    cw, ch = left + right, up + down
    strip = Image.new("RGBA", (cw * len(frames), ch), (0, 0, 0, 0))
    for i, (im, xo, yo) in enumerate(frames):
        strip.paste(im, (i * cw + left - xo, up - yo))
    return strip, cw, ch, left, up


def save_strip(wad, pal, key, specs, manifest):
    """specs: list of (anim name, [(prefix, frame letter, rotation), ...])."""
    frames, anims, idx = [], {}, 0
    for kind, entries in specs:
        if not entries:
            continue
        start = idx
        for pfx, f, r in entries:
            name, mirrored = sprite_table(wad, pfx)[f][r]
            frames.append(get_frame(wad, pal, name, mirrored))
            idx += 1
        anims[kind] = {"start": start, "end": idx - 1}
    strip, cw, ch, ox, oy = build_strip(frames)
    strip.save(f"{OUT}/sprites/{key}.png")
    manifest[key] = {
        "frameWidth": cw,
        "frameHeight": ch,
        "originX": ox / cw,
        "originY": oy / ch,
        "anims": anims,
    }
    print(f"  {key}: {len(frames)} frames, cell {cw}x{ch}, anims {list(anims)}")


def extract_sprites(wad, pal):
    os.makedirs(f"{OUT}/sprites", exist_ok=True)
    manifest = {}
    for prefix, cfg in MONSTERS.items():
        table = sprite_table(wad, prefix)
        rot = cfg["rot"]
        walk_letters = [
            f for f in cfg.get("walk", "ABCD") if f in table and rot in table[f]
        ]
        attack_letters = [
            f for f in cfg.get("attack", "") if f in table and rot in table[f]
        ]
        death_letters = sorted(
            f for f, rots in table.items() if "0" in rots
        )[: cfg["deaths"]]
        specs = [
            ("walk", [(prefix, f, rot) for f in walk_letters]),
            ("attack", [(prefix, f, rot) for f in attack_letters]),
            ("death", [(prefix, f, "0") for f in death_letters]),
        ]
        save_strip(wad, pal, prefix.lower(), specs, manifest)
    for key, animspec in PROJECTILES.items():
        specs = [
            (kind, [(pfx, f, r) for f in letters])
            for kind, (pfx, letters, r) in animspec.items()
        ]
        save_strip(wad, pal, key, specs, manifest)
    with open(os.path.join(os.path.dirname(__file__), "..", "src", "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)


def extract_sounds(wad):
    os.makedirs(f"{OUT}/sounds", exist_ok=True)
    for key, lumpname in SOUNDS.items():
        if lumpname not in wad.dir:
            print(f"  MISSING sound {lumpname}")
            continue
        data = wad.lump(lumpname)
        fmt, rate = struct.unpack("<HH", data[:4])
        count = struct.unpack("<I", data[4:8])[0]
        assert fmt == 3, f"{lumpname}: unexpected format {fmt}"
        samples = data[24 : 8 + count - 16]  # skip 16-byte lead/tail padding
        with wave.open(f"{OUT}/sounds/{key}.wav", "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(1)
            w.setframerate(rate)
            w.writeframes(samples)
        print(f"  {key}: {lumpname} {rate}Hz {len(samples)} samples")


FLATS = {
    "floor": "FLAT5_4",
    "floor2": "FLAT14",
    "base": "FLOOR1_6",
    "wall": "FLAT20",
    "crate": "CRATOP2",
}


def extract_flats(wad, pal):
    """Flats are raw 64x64 paletted pixels."""
    for key, lumpname in FLATS.items():
        data = wad.lump(lumpname)
        img = Image.new("RGB", (64, 64))
        img.putdata([pal.colors[b] for b in data[:4096]])
        img.save(f"{OUT}/sprites/{key}.png")
        print(f"  flat {key}: {lumpname}")


def main():
    wad = WadReader(WAD)
    pal = Palette(wad.lump("PLAYPAL"))
    extract_sprites(wad, pal)
    extract_flats(wad, pal)
    extract_sounds(wad)


if __name__ == "__main__":
    main()
