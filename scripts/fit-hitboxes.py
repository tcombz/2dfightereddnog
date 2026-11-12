#!/usr/bin/env python3
"""Measure every hero's art and write scripts/hitbox-fit.json: hurtbox heights that match the standing
and crouching sprites, and attack hitboxes whose far edge (and, for jabs, height) match the striking
limb on the move's active frames. scripts/gen-heroes.mjs applies the file; rerun this after re-importing
a hero's art, then `npm run gen:heroes` (this script regenerates the hand-made boxes first and measures against them).

usage: python3 -I scripts/fit-hitboxes.py

World units: x forward from the feet centre, y up from the floor (sprite px x the art's draw scale).
A limb pixel is one further forward than the idle stance at that height. Each move looks only in a
height band (a sweep below 60 px, a kick 60-230 px), so a lean or a coat flap is not counted as reach.
"""
import json
import os
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HEROES = ['rogue', 'jetsetter', 'chris', 'leader', 'eddnog', 'malcolm']
# move -> (lowest, highest) limb height in world px, and whether the hitbox height is refit too.
BANDS = {
    'light': ((110, 240), True),
    'heavy': ((90, 240), False),
    'kick': ((60, 230), False),
    'crouchLight': ((30, 200), False),
    'sweep': ((0, 60), False),
}
# Keep fitted reach near the hand-made value, so one stray pixel cannot wreck a move: it may grow by
# up to MAX_GROW (a jab that visibly lands should connect) but shrink by at most MAX_SHRINK (spins and
# sweeps measure short on single frames but read long in motion).
MAX_GROW = 20
MAX_SHRINK = 20
PAD = 6


def pixels(hero, anim, idx):
    im = Image.open(ROOT / 'assets' / 'heroes' / hero / 'frames' / anim / f'{idx:02d}.png').convert('RGBA')
    px = im.load()
    return [(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3] > 40]


def main():
    # Measure against the hand-made boxes, not a previous fit.
    subprocess.run(['node', str(ROOT / 'scripts' / 'gen-heroes.mjs')], check=True, capture_output=True, env={**os.environ, 'HITBOX_FIT': 'off'})
    out = {}
    # The shortest crouch in the cast: every jab must still clip that head.
    lowest = 999
    for h in HEROES:
        art = json.loads((ROOT / 'assets' / 'heroes' / h / 'art.json').read_text())
        pts = pixels(h, 'crouch', art['crouch'][-1])
        lowest = min(lowest, round((art['feetY'] - min(y for _, y in pts)) * art['scale']))
    for h in HEROES:
        art = json.loads((ROOT / 'assets' / 'heroes' / h / 'art.json').read_text())
        data = json.loads((ROOT / 'src' / 'heroes' / f'{h}.json').read_text())
        s, fx, fy = art['scale'], art['feetX'], art['feetY']
        world = lambda pts: [((x - fx) * s, (fy - y) * s) for x, y in pts]

        idle = world(pixels(h, 'idle', art['idle'][0]))
        front = {}
        for x, y in idle:
            b = int(y) // 8
            front[b] = max(front.get(b, -999), x)
        stand_h = round(max(y for _, y in idle))
        crouch = world(pixels(h, 'crouch', art['crouch'][-1]))
        crouch_h = round(max(y for _, y in crouch))

        fit = {'height': stand_h + 4, 'crouchHeight': crouch_h + 2, 'moves': {}}
        for key, ((lo, hi), refit_y) in BANDS.items():
            a = art['attacks'][key]
            m = data['moves'][key]
            box = next(b for f in m['frames'] for b in f['hitboxes'])
            limb = []
            for idx in a['active']:
                for x, y in world(pixels(h, a['anim'], idx)):
                    if lo <= y <= hi and x > max(front.get(int(y) // 8 + d, -999) for d in (-1, 0, 1)) + 8:
                        limb.append((x, y))
            if not limb:
                continue
            reach = round(max(x for x, _ in limb)) + PAD
            old_far = box['x'] + box['w']
            shrink = 0 if key == 'sweep' else MAX_SHRINK  # a low spin sweeps through the arc, not one frame
            grow = MAX_GROW
            reach = max(old_far - shrink, min(old_far + grow, reach))
            move = {'w': max(30, reach - box['x'])}
            if refit_y:
                ys = [y for x, y in limb if x > reach - 50]
                y0, y1 = round(min(ys)) - PAD, round(max(ys)) + PAD
                # A jab should still clip the shortest crouching head in the cast.
                y0 = min(y0, lowest - 25)
                move.update({'y': y0, 'h': y1 - y0})
            fit['moves'][key] = move
            print(f'{h:10s} {key:12s} far {old_far} -> {box["x"] + move["w"]}' + (f'  y {box["y"]}..{box["y"] + box["h"]} -> {move["y"]}..{move["y"] + move["h"]}' if refit_y else ''))
        print(f'{h:10s} hurtbox height {data["stats"]["height"]} -> {fit["height"]}, crouch {data["stats"]["crouchHeight"]} -> {fit["crouchHeight"]}')
        out[h] = fit
    (ROOT / 'scripts' / 'hitbox-fit.json').write_text(json.dumps(out, indent=1) + '\n')


if __name__ == '__main__':
    main()
