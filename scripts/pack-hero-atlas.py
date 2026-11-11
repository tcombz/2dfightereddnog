#!/usr/bin/env python3
"""Pack a hero's animation frames into a Phaser 3 JSON-hash sprite atlas.

Usage: python3 scripts/pack-hero-atlas.py <heroId>

Reads   assets/heroes/<heroId>/frames/<animation>/<NN>.png
Writes  assets/heroes/<heroId>/atlas.png and atlas.json

Every frame is placed on a common logical cell (the largest source canvas),
centred, so frames from different animations line up when played back. The
atlas stores only each frame's trimmed pixels; `spriteSourceSize` restores the
offset inside the cell. `meta.animations` lists the frame names per animation.
"""
import json
import sys
from pathlib import Path

from PIL import Image

PAD = 2
MAX_WIDTH = 1024


def main() -> None:
    hero = sys.argv[1]
    root = Path(__file__).resolve().parent.parent / "assets" / "heroes" / hero
    frames_dir = root / "frames"

    entries = []  # (name, anim, image)
    for anim_dir in sorted(p for p in frames_dir.iterdir() if p.is_dir()):
        for png in sorted(anim_dir.glob("*.png")):
            entries.append((f"{anim_dir.name}/{png.stem}", anim_dir.name, Image.open(png).convert("RGBA")))
    if not entries:
        sys.exit(f"no frames under {frames_dir}")

    cell_w = max(im.width for _, _, im in entries)
    cell_h = max(im.height for _, _, im in entries)

    placed = []  # (name, anim, trimmed image, offset x, offset y)
    for name, anim, im in entries:
        box = im.getbbox() or (0, 0, 1, 1)
        off_x = (cell_w - im.width) // 2 + box[0]
        off_y = (cell_h - im.height) // 2 + box[1]
        placed.append((name, anim, im.crop(box), off_x, off_y))

    # Shelf packing, in animation order so the sheet stays readable.
    x = y = PAD
    row_h = 0
    positions = []
    for _, _, im, _, _ in placed:
        if x + im.width + PAD > MAX_WIDTH:
            x = PAD
            y += row_h + PAD
            row_h = 0
        positions.append((x, y))
        x += im.width + PAD
        row_h = max(row_h, im.height)
    atlas_w = max(px + im.width for (px, _), (_, _, im, _, _) in zip(positions, placed)) + PAD
    atlas_h = y + row_h + PAD

    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    frames = {}
    animations = {}
    for (px, py), (name, anim, im, off_x, off_y) in zip(positions, placed):
        atlas.paste(im, (px, py))
        frames[name] = {
            "frame": {"x": px, "y": py, "w": im.width, "h": im.height},
            "rotated": False,
            "trimmed": True,
            "spriteSourceSize": {"x": off_x, "y": off_y, "w": im.width, "h": im.height},
            "sourceSize": {"w": cell_w, "h": cell_h},
        }
        animations.setdefault(anim, []).append(name)

    atlas.save(root / "atlas.png", optimize=True)
    meta = {
        "app": "scripts/pack-hero-atlas.py",
        "image": "atlas.png",
        "format": "RGBA8888",
        "size": {"w": atlas_w, "h": atlas_h},
        "scale": "1",
        "animations": animations,
    }
    (root / "atlas.json").write_text(json.dumps({"frames": frames, "meta": meta}, indent=2) + "\n")
    print(f"{len(frames)} frames, {len(animations)} animations, cell {cell_w}x{cell_h}, atlas {atlas_w}x{atlas_h}")


if __name__ == "__main__":
    main()
