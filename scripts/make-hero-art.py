"""Portrait and super-art banner for a hero from one pixel sprite (front view or bust).

usage: python3 -I scripts/make-hero-art.py <sprite.png> <hero id> <accent hex> <dark hex>
writes assets/heroes/<id>/sheet_portrait.png (the sprite, cropped and scaled up crisp) and
assets/heroes/<id>/super_art.png (a 608x244 cut-in banner: speed lines in the hero's colours behind them).
"""
import math, random, sys
from pathlib import Path
from PIL import Image, ImageDraw

src, hero, accent, dark = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
dest = Path(__file__).resolve().parent.parent / 'assets' / 'heroes' / hero
img = Image.open(src).convert('RGBA')
img = img.crop(img.getbbox())
k = max(2, math.ceil(320 / img.height))
big = img.resize((img.width * k, img.height * k), Image.NEAREST)
big.save(dest / 'sheet_portrait.png')

def rgb(h): return tuple(int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
W, H = 608, 244
a, d = rgb(accent), rgb(dark)
banner = Image.new('RGBA', (W, H), d + (255,))
draw = ImageDraw.Draw(banner)
for y in range(H):  # dark at the edges, bright through the middle
    t = 1 - abs(y - H / 2) / (H / 2)
    c = tuple(int(d[i] + (a[i] - d[i]) * t * 0.55) for i in range(3))
    draw.line([(0, y), (W, y)], fill=c + (255,))
rnd = random.Random(hero)
for _ in range(70):  # speed lines
    y = rnd.randrange(H)
    x = rnd.randrange(-200, W)
    ln = rnd.randrange(80, 320)
    c = tuple(min(255, v + 90) for v in a)
    draw.line([(x, y), (x + ln, y)], fill=c + (rnd.randrange(60, 170),), width=rnd.choice([1, 2, 3]))
# The hero, upper body filling the banner height, on the right.
s = (H * 1.7) / img.height
fig = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.NEAREST)
banner.alpha_composite(fig, (W - fig.width - 30, 6))
banner.convert('RGB').save(dest / 'super_art.png')
print(hero, 'portrait', big.size, 'banner', banner.size)
