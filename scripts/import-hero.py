#!/usr/bin/env python3
"""Import a PixelLab character download into assets/heroes/<id>/: feet-aligned frames, the east base
sprite and art.json (draw scale, cell, feet anchor, face box and which frames play when).

Usage: python3 -I scripts/import-hero.py <unzipped character dir> <heroId> <world height>

Optional assets/heroes/<heroId>/art-overrides.json: "skip" lists animations to leave out, "rename"
maps a downloaded animation onto another name (a re-roll replacing the original), "clean" lists
animations whose specks (tiny clusters apart from the body) are erased, "recolor"
maps an animation to a hue in degrees (warm fire baked into a template becomes that colour), and any
other key replaces the measured value in art.json ("attacks" entries are replaced one by one).

<unzipped character dir> holds <State>/animations/<name>/east/*.png and <State>/rotations/east.png.
<world height> is how tall the standing fighter is drawn in world pixels (match the hero's hurtbox).

Every frame is moved so the feet sit on one anchor (measured per canvas size on a standing frame),
grounded frames are snapped to the floor, and the cell is the tightest box that holds every frame.
Attack timing is picked by measuring each frame: the frame that reaches furthest (or highest, for
uppercuts) is the hit; frames before it are startup and frames after it recovery. Then run
scripts/pack-hero-atlas.py <heroId>. Re-running overwrites frames/ and art.json.
"""
import colorsys
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


def recolor(im, hue):
    """Shift saturated warm pixels (template fire: red, orange, yellow) to another hue."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.62 and v > 0.74 and (h < 0.17 or h > 0.96):
                nr, ng, nb = colorsys.hsv_to_rgb(hue / 360, s, min(1, v * 1.05))
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return im


def clean(im, min_size=220):
    """Erase translucent haze and small clusters of pixels not connected to anything bigger (generation specks)."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if 0 < px[x, y][3] < 100:
                px[x, y] = (0, 0, 0, 0)
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] == 0:
                continue
            stack, comp = [(sx, sy)], []
            seen[sy * w + sx] = 1
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for nx in range(x - 1, x + 2):
                    for ny in range(y - 1, y + 2):
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] > 0:
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
            if len(comp) < min_size:
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)
    return im


def anchor(im):
    pts = opaque_points(im)
    bottom = max(y for _, y in pts)
    feet = [x for x, y in pts if y >= bottom - 6]
    return round(sum(feet) / len(feet)), bottom + 1


def main() -> None:
    src, hero, world_h = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3])
    repo = Path(__file__).resolve().parent.parent
    dest = repo / 'assets' / 'heroes' / hero
    over_path = dest / 'art-overrides.json'
    overrides = json.loads(over_path.read_text()) if over_path.exists() else {}
    skip = set(overrides.pop('skip', ['jab6']))
    recolors = overrides.pop('recolor', {})
    renames = overrides.pop('rename', {})
    cleans = set(overrides.pop('clean', []))
    state = next(p for p in src.iterdir() if p.is_dir() and (p / 'animations').exists())
    anim_dir = state / 'animations'
    anims = {d.name: sorted((d / 'east').glob('*.png')) for d in anim_dir.iterdir() if (d / 'east').exists() and d.name not in skip}
    for old, new in renames.items():
        if old in anims:
            anims[new] = anims.pop(old)

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
            if name in recolors:
                im = recolor(im, recolors[name])
            if name in cleans:
                im = clean(im)
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
        # A clip that ends on the hit rewinds through its wind-up to recover.
        recovery = list(range(active[-1] + 1, n)) or (list(reversed(startup))[:3] if startup != [peak] else [active[-1]])
        if loop:
            lo = max(start, peak - 1)
            active = list(range(lo, min(n, peak + 2)))
        return {'anim': name, 'startup': startup, 'active': active, 'recovery': recovery, **({'loopActive': True} if loop else {})}

    idle_h = sum(f['top'] for f in metrics['idle']) / len(metrics['idle'])
    scale = round(world_h / idle_h, 3)

    jump = [i for i, f in enumerate(metrics['jump']) if f['air'] > 6] or list(range(2, max(3, count('jump') - 1)))
    block_n = count('block')
    light = 'light_punch'
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
        'powerUp': list(range(1, count('power_up') - 1)) if 'power_up' in anims else [],
        'dash': list(range(count('dash'))),
        'backdash': list(range(1, count('backdash'))),
        'attacks': {
            'light': split(light, 'reach'),
            'heavy': heavy,
            'kick': split('kick', 'reach'),
            'crouchLight': split('crouch_light', 'reach'),
            'sweep': split('sweep', 'low'),
            'jumpAttack': split('jump_attack', 'reach'),
            'throw': split('grab', 'reach') if 'grab' in anims else {
                'anim': 'heavy_punch', 'startup': heavy['startup'][-1:], 'active': heavy['active'][:1],
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

    for key, value in overrides.items():
        if key == 'attacks':
            art['attacks'].update(value)
        else:
            art[key] = value
    (dest / 'art.json').write_text(json.dumps(art, indent=1) + '\n')
    print(hero, f'cell {cell_w}x{cell_h} feet ({feet_x},{feet_y}) scale {scale} idle height {idle_h:.0f}')
    for k, v in art['attacks'].items():
        print(f"  {k:12s} {v['anim']:12s} startup {v['startup']} active {v['active']} recovery {v['recovery']}")


if __name__ == '__main__':
    main()
