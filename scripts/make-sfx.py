#!/usr/bin/env python3
"""Build the game's sound effects: clean and level the source sounds, and synthesize the rest.

usage: python3 -I scripts/make-sfx.py   (needs numpy and scipy)

Reads  assets/audio/sfx-src/*.wav (the original recordings and generations)
Writes assets/audio/sfx/*.wav     (44.1 kHz mono 16-bit, what the game loads)

Every sound gets: DC and sub-rumble removed, a short fade in and out (no clicks), its tail trimmed
where it falls silent, and a level for its kind (UI quiet, hits loud) with peaks held under -1 dBFS,
so sounds that overlap in a combo don't clip. Swings, hits and blocks are layered with synthesized
transients so they read on laptop speakers, and the new powers get their own sounds.
"""
import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 44100
ROOT = Path(__file__).resolve().parent.parent / 'assets' / 'audio'
SRC, OUT = ROOT / 'sfx-src', ROOT / 'sfx'
rng = np.random.default_rng(7)


def load(name):
    w = wave.open(str(SRC / f'{name}.wav'))
    n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
    a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64).reshape(-1, ch).mean(1) / 32768
    if sr != SR:
        a = signal.resample_poly(a, SR, sr)
    return a


def save(name, a):
    a = np.clip(a, -1, 1)
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def t_(sec):
    return np.arange(int(SR * sec)) / SR


def env(sec, attack, decay):
    t = t_(sec)
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def bp(a, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), a)


def hp(a, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'highpass', fs=SR, output='sos'), a)


def lp(a, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'lowpass', fs=SR, output='sos'), a)


def sweep(f0, f1, sec, shape=1.0):
    """A sine whose pitch glides from f0 to f1."""
    t = t_(sec)
    f = f0 + (f1 - f0) * (t / sec) ** shape
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def sweep_bp(a, f0, f1, q=2.5, steps=48):
    """Band-pass with a moving centre: chunked, crossfaded."""
    out = np.zeros_like(a)
    n = len(a)
    edges = np.linspace(0, n, steps + 1).astype(int)
    for k in range(steps):
        c = f0 * (f1 / f0) ** (k / max(1, steps - 1))
        lo, hi = c / (1 + 1 / q), min(SR / 2 - 100, c * (1 + 1 / q))
        seg = bp(a, lo, hi)
        s, e = edges[k], edges[k + 1]
        out[s:e] = seg[s:e]
    return out


def finish(a, rms_db, fade_out=0.03, keep_tail=False):
    """DC, rumble, trim, fades, level and peak limit."""
    a = a - a.mean()
    a = hp(a, 38)
    if not keep_tail:
        e = np.convolve(np.abs(a), np.ones(441) / 441, 'same')
        above = np.where(e > e.max() * 10 ** (-48 / 20))[0]
        if len(above):
            a = a[: min(len(a), above[-1] + int(SR * 0.02))]
    fi = int(SR * 0.002)
    a[:fi] *= np.linspace(0, 1, fi)
    fo = min(len(a) // 3, int(SR * fade_out))
    a[-fo:] *= np.linspace(1, 0, fo) ** 2
    # Level by the loud part of the sound (the top 40% of its envelope), not its silent tail.
    e = np.convolve(a ** 2, np.ones(882) / 882, 'same')
    loud = e[e >= np.quantile(e, 0.6)]
    rms = np.sqrt(loud.mean()) + 1e-9
    a = a * (10 ** (rms_db / 20) / rms)
    # Soft limit: tanh above -6 dBFS, then a hard ceiling of -1 dBFS.
    k = 10 ** (-6 / 20)
    over = np.abs(a) > k
    a[over] = np.sign(a[over]) * (k + (1 - k) * np.tanh((np.abs(a[over]) - k) / (1 - k)))
    peak = np.abs(a).max()
    ceiling = 10 ** (-1 / 20)
    if peak > ceiling:
        a *= ceiling / peak
    return a


# ---------- synthesized layers ----------

def snap(sec, lo, hi, decay):
    """The crack of a hit: a filtered noise burst."""
    return bp(noise(sec), lo, hi, 2) * env(sec, 0.0005, decay)


def thump(sec, f0, f1, decay):
    return sweep(f0, f1, sec, 0.5) * env(sec, 0.001, decay)


def whoosh(sec, f0, f1, peak_at):
    t = t_(sec)
    shape = np.sin(np.pi * np.clip(t / sec, 0, 1)) ** 2
    shape *= np.exp(-((t / sec - peak_at) ** 2) / 0.08)
    return sweep_bp(noise(sec), f0, f1, q=1.6) * shape


def chime(freqs, gap, sec, decay):
    out = np.zeros(int(SR * (sec + gap * len(freqs))))
    for k, f in enumerate(freqs):
        t = t_(sec)
        vib = 1 + 0.004 * np.sin(2 * np.pi * 6 * t)
        tone = (np.sin(2 * np.pi * f * vib * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3.01 * f * t))
        s = int(SR * gap * k)
        out[s : s + len(t)] += tone * env(sec, 0.002, decay)
    return out


def layered(name, layer, gain_src=1.0, hp_src=0, rms_db=-14):
    a = load(name)
    if hp_src:
        a = hp(a, hp_src, 4)
    a = a / (np.abs(a).max() + 1e-9)
    return finish(mix(a * gain_src, layer), rms_db)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = {}

    # Swings: the old ones were mostly sub-bass. Proper air: noise swept through a band.
    made['whoosh_light'] = finish(whoosh(0.2, 700, 2600, 0.45), -19)
    made['whoosh_heavy'] = finish(mix(whoosh(0.32, 380, 1500, 0.5), 0.3 * whoosh(0.32, 1200, 3200, 0.55)), -16)

    # Hits: the source thud (rumble cut) with a crack on top and a pitched body.
    made['hit_light'] = layered('hit_light', mix(0.9 * snap(0.09, 1800, 6500, 0.012), 0.5 * thump(0.08, 220, 110, 0.03)), 0.6, 110, -14)
    made['hit_kick'] = layered('hit_kick', mix(1.0 * snap(0.12, 1200, 5000, 0.02), 0.7 * thump(0.14, 180, 70, 0.05)), 0.7, 90, -12.5)
    made['hit_heavy'] = layered('hit_heavy', mix(1.1 * snap(0.16, 900, 4200, 0.028), 0.9 * thump(0.22, 150, 50, 0.08)), 0.8, 70, -11.5)
    made['hit_crunch'] = layered('hit_crunch', mix(1.0 * snap(0.2, 700, 3800, 0.04), 0.9 * thump(0.25, 130, 45, 0.1)), 0.8, 60, -11)
    made['counter'] = layered('counter', mix(0.8 * snap(0.1, 2500, 8000, 0.015), 0.4 * chime([1568, 2093], 0.03, 0.25, 0.08)), 0.8, 80, -13)

    # Block: a hard, bright clack, clearly not a hit.
    clack = mix(0.8 * hp(noise(0.05), 2500) * env(0.05, 0.0003, 0.006),
                0.5 * np.sin(2 * np.pi * 1850 * t_(0.12)) * env(0.12, 0.0005, 0.03),
                0.35 * np.sin(2 * np.pi * 2730 * t_(0.12)) * env(0.12, 0.0005, 0.022),
                0.6 * thump(0.06, 260, 140, 0.02))
    made['block'] = layered('block', clack, 0.5, 150, -15)

    # New powers.
    flutter = 1 + 0.45 * np.sin(2 * np.pi * 21 * t_(0.75) + 3 * np.sin(2 * np.pi * 5 * t_(0.75)))
    roar = lp(noise(0.75), 1800, 4) * flutter * env(0.75, 0.04, 0.3)
    crackle = np.zeros(int(SR * 0.75))
    for at in rng.uniform(0.02, 0.6, 26):
        s = int(at * SR)
        crackle[s : s + 120] += rng.uniform(0.3, 0.9) * hp(rng.standard_normal(120), 3000) * np.exp(-np.arange(120) / 25)
    made['fire'] = finish(mix(roar, 0.5 * crackle, 0.4 * thump(0.3, 120, 55, 0.12)), -15)

    star = mix(chime([1318.5, 1760, 2217.5, 2637], 0.045, 0.45, 0.16), 0.25 * hp(noise(0.5), 7000) * env(0.5, 0.01, 0.12))
    made['star'] = finish(star, -17)

    wub_t = t_(0.5)
    wub = np.sin(2 * np.pi * np.cumsum(70 + 160 * np.exp(-wub_t / 0.08)) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * wub_t)) * env(0.5, 0.005, 0.22)
    saw = lp(signal.sawtooth(2 * np.pi * np.cumsum(110 + 40 * np.sin(2 * np.pi * 9 * wub_t)) / SR), 900) * env(0.5, 0.005, 0.18)
    made['sonic'] = finish(mix(wub, 0.5 * saw), -14)

    zap_t = t_(0.36)
    zap = bp(signal.sawtooth(2 * np.pi * np.cumsum(260 + 1200 * (zap_t / 0.36) ** 1.5) / SR), 400, 5000) * env(0.36, 0.004, 0.14)
    made['plasma'] = finish(mix(zap, 0.35 * hp(noise(0.36), 5000) * env(0.36, 0.002, 0.06), 0.4 * snap(0.12, 2000, 7000, 0.02)), -16)

    # Everything else: cleaned and levelled from the source.
    levels = {'ui_move': -24, 'ui_confirm': -19, 'round': -15, 'ko': -13, 'ko_boom': -13, 'super': -14, 'crowd': -18,
              'cards': -16, 'zap': -15, 'blink': -16, 'scratch': -16, 'slam': -13, 'squad': -15, 'tracer': -16,
              'throw': -15, 'fall': -14, 'dash': -19, 'armor': -15, 'meow': -18}
    for name, db in levels.items():
        a = load(name)
        made[name] = finish(a, db, fade_out=0.06, keep_tail=name in ('crowd', 'ko_boom'))

    for name, a in made.items():
        save(name, a)
    print(f'{len(made)} sounds written to {OUT}')


if __name__ == '__main__':
    main()
