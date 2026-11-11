#!/usr/bin/env python3
"""Import a PixelLab character download into assets/heroes/<id>/: feet-aligned frames, the east base
sprite and art.json (draw scale, cell, feet anchor, face box and which frames play when).

Usage: python3 -I scripts/import-hero.py <unzipped character dir> <heroId> <world height>

<unzipped character dir> holds <State>/animations/<name>/east/*.png and <State>/rotations/east.png.
<world height> is how tall the standing fighter is drawn in world pixels (match the hero's hurtbox).

Every frame is moved so the feet sit on one anchor (measured per canvas size on a standing frame),
grounded frames are snapped to the floor, and the cell is the tightest box that holds every frame.
Attack timing is picked by measuring each frame: the frame that reaches furthest (or highest, for
uppercuts) is the hit; frames before it are startup and frames after it recovery. Then run
scripts/pack-hero-atlas.py <heroId>. Re-running overwrites frames/ and art.json.
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

AIRBORNE = {'jump', 'jump_attack'}
STANDING = ['idle', 'block', 'special', 'win', 'walk', 'crouch_light', 'jab6', 'power_up', 'light_punch', 'heavy_punch']


def opaque_points(im):
    px = im.load()
    return [(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3] > 0]


def anchor(im):
    pts = opaque_points(im)
    bottom = max(y for _, y in pts)
    feet = [x for x, y in pts if y >= bottom - 6]
    return round(sum(feet) / len(feet)), bottom + 1


def main() -> None:
    src, hero, world_h = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3])
    repo = Path(__file__).resolve().parent.parent
    state = next(p for p in src.iterdir() if p.is_dir() and (p / 'animations').exists())
    anim_dir = state / 'animations'
    anims = {d.name: sorted((d / 'east').glob('*.png')) for d in anim_dir.iterdir() if (d / 'east').exists()}

    # Feet anchor for each canvas size, from a standing frame of that size.
    anchors = {}
    for name in STANDING + sorted(anims):
        if name not in anims:
            continue
        im = Image.open(anims[name][0]).convert('RGBA')
        if im.size not in anchors:
            anchors[im.size] = anchor(im)

    # Align every frame on the feet, in a big scratch canvas, then crop to the shared box.
    big, fx, fy = 640, 320, 520
    aligned = {}
    union = None
    for name, files in anims.items():
        out = []
        for f in files:
            im = Image.open(f).convert('RGBA')
            ax, ay = anchors[im.size]
            canvas = Image.new('RGBA', (big, big), (0, 0, 0, 0))
            canvas.paste(im, (fx - ax, fy - ay), im)
            box = canvas.getbbox()
            if box and name not in AIRBORNE and box[3] != fy:
                moved = Image.new('RGBA', (big, big), (0, 0, 0, 0))
                moved.paste(canvas, (0, fy - box[3]), canvas)
                canvas, box = moved, moved.getbbox()
            if box:
                union = box if union is None else (min(union[0], box[0]), min(union[1], box[1]), max(union[2], box[2]), max(union[3], box[3]))
            out.append(canvas)
        aligned[name] = out
    left, top, right, bottom = union[0] - 2, union[1] - 2, union[2] + 2, union[3] + 2
    cell_w, cell_h = right - left, bottom - top
    feet_x, feet_y = fx - left, fy - top

    dest = repo / 'assets' / 'heroes' / hero
    frames_dir = dest / 'frames'
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    metrics = {}
    for name, ims in aligned.items():
        (frames_dir / name).mkdir(parents=True)
        metrics[name] = []
        for n, canvas in enumerate(ims):
            cell = canvas.crop((left, top, right, bottom))
            cell.save(frames_dir / name / f'{n:02d}.png')
            pts = opaque_points(cell)
            low = [x for x, y in pts if y > feet_y - 80]
            metrics[name].append({
                'reach': max(x for x, _ in pts) - feet_x,
                'low': (max(low) - feet_x) if low else 0,
                'top': feet_y - min(y for _, y in pts),
                'air': feet_y - max(y for _, y in pts),
            })

    def count(name):
        return len(anims.get(name, []))

    def split(name, key, loop=False):
        m = [f[key] for f in metrics[name]]
        n = len(m)
        start = 1 if n > 3 else 0  # frame 0 is the rest pose
        peak = max(range(start, n), key=lambda i: m[i])
        active = [peak] + [i for i in (peak + 1,) if i < n and m[i] >= 0.92 * m[peak]]
        startup = list(range(start, peak)) or [peak]
        recovery = list(range(active[-1] + 1, n)) or [active[-1]]
        if loop:
            lo = max(start, peak - 1)
            active = list(range(lo, min(n, peak + 2)))
        return {'anim': name, 'startup': startup, 'active': active, 'recovery': recovery, **({'loopActive': True} if loop else {})}

    idle_h = sum(f['top'] for f in metrics['idle']) / len(metrics['idle'])
    scale = round(world_h / idle_h, 3)

    jump = [i for i, f in enumerate(metrics['jump']) if f['air'] > 6] or list(range(2, max(3, count('jump') - 1)))
    block_n = count('block')
    light = 'jab6' if 'jab6' in anims else 'light_punch'
    heavy = split('heavy_punch', 'reach')
    art = {
        'scale': scale,
        'cellW': cell_w,
        'cellH': cell_h,
        'feetX': feet_x,
        'feetY': feet_y,
        'idle': list(range(count('idle'))),
        'walk': list(range(count('walk'))),
        'jump': jump,
        'crouch': list(range(1, count('crouch'))),
        'block': list(range(max(1, block_n // 2), block_n)),
        'hit': list(range(2, count('hit'))),
        'fall': [2, 3, 4],
        'lying': list(range(5, count('knockout'))),
        'getup': list(range(count('getup'))),
        'win': list(range(1, count('win'))),
        'powerUp': list(range(1, count('power_up'))) if 'power_up' in anims else [],
        'attacks': {
            'light': split(light, 'reach'),
            'heavy': heavy,
            'kick': split('kick', 'reach'),
            'crouchLight': split('crouch_light', 'reach'),
            'sweep': split('sweep', 'low'),
            'jumpAttack': split('jump_attack', 'reach'),
            'throw': {'anim': 'heavy_punch', 'startup': heavy['startup'][-1:], 'active': heavy['active'][:1],
                      'recovery': list(range(heavy['active'][0] - 1, -1, -1)) or [0]},
            'special': split('special', 'reach'),
            'projectile': split('projectile', 'reach'),
            'rising': split('uppercut', 'top'),
            'super': split('special', 'reach', loop=True),
        },
        'metrics': {k: [f['reach'] for f in v] for k, v in metrics.items()},
    }

    # Face box on the east base, for the pixel portrait.
    base = Image.open(state / 'rotations' / 'east.png').convert('RGBA')
    (dest / 'base').mkdir(parents=True, exist_ok=True)
    base.save(dest / 'base' / 'east.png')
    bpts = opaque_points(base)
    btop = min(y for _, y in bpts)
    bbottom = max(y for _, y in bpts)
    side = round((bbottom - btop) * 0.2)
    head = [x for x, y in bpts if y < btop + side]
    cx = round(sum(head) / len(head))
    art['face'] = {'x': cx - side // 2, 'y': max(0, btop - 2), 'w': side, 'h': side}

    (dest / 'art.json').write_text(json.dumps(art, indent=1) + '\n')
    print(hero, f'cell {cell_w}x{cell_h} feet ({feet_x},{feet_y}) scale {scale} idle height {idle_h:.0f}')
    for k, v in art['attacks'].items():
        print(f"  {k:12s} {v['anim']:12s} startup {v['startup']} active {v['active']} recovery {v['recovery']}")


if __name__ == '__main__':
    main()
