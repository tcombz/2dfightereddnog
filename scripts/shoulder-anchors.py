#!/usr/bin/env python3
"""Where a hero's back shoulder is in every frame, for a companion that rides on it (Quincy's cat).

Usage: python3 -I scripts/shoulder-anchors.py <heroId>

Reads assets/heroes/<heroId>/frames/<anim>/<nn>.png (cell-sized, feet-aligned, facing right) and
writes assets/heroes/<heroId>/anchors.json: {"anim/nn": [x, y]} in cell pixels. The point is on the
shoulder line (a fifth of the way down from the top of the head) towards the back of the body.
"""
import json
import sys
from pathlib import Path

from PIL import Image


def anchor(im):
    a = im.getchannel('A')
    w, h = im.size
    px = a.load()
    rows = [y for y in range(h) if any(px[x, y] > 40 for x in range(w))]
    if not rows:
        return [w // 2, h // 2]
    top, bottom = rows[0], rows[-1]
    y = top + round((bottom - top) * 0.25)
    xs = [x for x in range(w) if px[x, y] > 40]
    if not xs:
        return [w // 2, y]
    lo, hi = min(xs), max(xs)
    return [round(lo + (hi - lo) * 0.16), y]


def main():
    hero = sys.argv[1]
    root = Path(__file__).resolve().parent.parent / 'assets' / 'heroes' / hero
    out = {}
    for anim in sorted((root / 'frames').iterdir()):
        if not anim.is_dir():
            continue
        for f in sorted(anim.glob('*.png')):
            out[f'{anim.name}/{f.stem}'] = anchor(Image.open(f).convert('RGBA'))
    (root / 'anchors.json').write_text(json.dumps(out, separators=(',', ':')) + '\n')
    print(hero, len(out), 'anchors')


if __name__ == '__main__':
    main()
