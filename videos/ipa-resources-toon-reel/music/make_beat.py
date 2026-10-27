#!/usr/bin/env python3
"""Original fast-paced beat for the IPA resources toon reel (200 bpm double-time, 23 s).

    python3 music/make_beat.py raw/beat_raw.wav

The reel changes scene every 2.4 s, which is exactly two bars at 200 bpm, so
every scene change lands on a downbeat. Scene map: 0-2.4 s intro (filtered arp,
riser, snare roll), drop at 2.4 s when the website appears, full groove to
16.8 s, a dead stop for "wait... it's free?" with one rising pluck per star
(17.25-18.69 s), a roll into the second drop at 19.2 s for the fist bump, then
a last stab. Everything is synthesised here, so the track is ours to use.
"""
import sys
import wave

import numpy as np

SR = 44100
SCENE = 2.4
STEP = SCENE / 32          # a 16th note at 200 bpm
LENGTH = 23.0
N = int(LENGTH * SR)
rng = np.random.default_rng(11)
drums = np.zeros(N)
bass = np.zeros(N)
music = np.zeros(N)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def place(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= N or i < 0:
        return
    j = min(N, i + len(sig))
    buf[i:j] += gain * sig[: j - i]


def ts(length):
    return np.arange(int(length * SR)) / SR


def lp(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for k in range(len(x)):
        acc = (1 - a) * x[k] + a * acc
        y[k] = acc
    return y


def kick():
    t = ts(0.32)
    f = 48 + 140 * np.exp(-t / 0.025)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.0015) * 0.5
    return np.tanh(2.2 * (body + click))


def clap():
    t = ts(0.28)
    n = rng.standard_normal(len(t))
    band = lp(n - lp(n, 900), 4200)
    env = np.zeros(len(t))
    for d in (0.0, 0.011, 0.022):
        env += np.where(t >= d, np.exp(-(t - d) / (0.012 if d < 0.02 else 0.09)), 0)
    return band * env * 1.4


def hat(length=0.05, decay=0.012):
    t = ts(length)
    n = rng.standard_normal(len(t))
    return (n - lp(n, 7500)) * np.exp(-t / decay)


def b808(note, length, glide_to=None):
    t = ts(length)
    f = midi(note) * (1 + 0.5 * np.exp(-t / 0.02))
    if glide_to is not None:
        g = np.clip((t - length * 0.6) / (length * 0.3), 0, 1)
        f = f * (1 - g) + midi(glide_to) * g
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return np.tanh(2.5 * s) * np.exp(-t / 0.45) * np.minimum(1, t / 0.004)


def pluck(note, length=0.22, decay=0.09, bright=1.0):
    t = ts(length)
    f = midi(note)
    s = sum((0.9 ** h) * np.sin(2 * np.pi * f * h * t) * np.exp(-t * h * 6 / bright) for h in range(1, 8))
    return s * np.exp(-t / decay) * np.minimum(1, t / 0.002)


def stab(notes, length=0.5):
    t = ts(length)
    s = sum(np.sign(np.sin(2 * np.pi * midi(n) * t * (1 + 0.003 * k))) for k, n in enumerate(notes))
    return lp(s * np.exp(-t / 0.16), 3200) * 0.35


def riser(length):
    t = ts(length)
    n = rng.standard_normal(len(t))
    out = np.empty_like(n)
    acc, chunk = 0.0, 512
    for i in range(0, len(n), chunk):                      # noise sweeping up
        c = 300 + 9000 * (i / len(n)) ** 2
        a = np.exp(-2 * np.pi * c / SR)
        for k in range(i, min(len(n), i + chunk)):
            acc = (1 - a) * n[k] + a * acc
            out[k] = acc
    return out * (t / length) ** 2 * 1.8


CHORDS = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]]   # Am F C G
ROOTS = [33, 29, 36, 31]
KICKS = [0, 6, 10, 16, 22, 26]
CLAPS = [4, 12, 20, 28]
ARP = [0, 1, 2, 3, 2, 1, 0, 1]
K, C = kick(), clap()


def scene(i, full=True, filt=False):
    t0 = i * SCENE
    ch, root = CHORDS[i % 4], ROOTS[i % 4]
    tones = ch + [ch[0] + 12]
    arp_buf = np.zeros(N)
    for s in range(0, 32, 2):                                # 8th-note arp at 200 bpm
        note = tones[ARP[(s // 2) % 8]] + 12
        place(arp_buf, pluck(note, bright=0.6 if filt else 1.0), t0 + s * STEP, 0.28)
    music[:] += lp(arp_buf, 1100) * 1.8 if filt else arp_buf
    for s in range(0, 32, 2):                                # hats, accented off-beats
        place(drums, hat(), t0 + s * STEP, 0.22 if s % 4 else 0.13)
    if i % 2:
        for s in (28, 29, 30, 31):                           # 16th roll into the next scene
            place(drums, hat(0.04, 0.01), t0 + s * STEP, 0.16)
    if not full:
        return
    place(music, stab(ch), t0, 0.9)
    place(music, stab(ch), t0 + 16 * STEP, 0.6)
    for s in KICKS:
        place(drums, K, t0 + s * STEP, 0.95)
    for s in CLAPS:
        place(drums, C, t0 + s * STEP, 0.7)
    nxt = ROOTS[(i + 1) % 4]
    for k, s in enumerate(KICKS):
        length = ((KICKS[k + 1] if k + 1 < len(KICKS) else 32) - s) * STEP
        place(bass, b808(root, length, glide_to=nxt if s == 26 else None), t0 + s * STEP, 0.75)


# 0-2.4 s: intro (filtered arp, hats), riser and snare roll into the drop
scene(0, full=False, filt=True)
place(music, riser(1.2), 1.2, 0.35)
for k, s in enumerate([16, 20, 24, 26, 28, 29, 30, 31]):
    place(drums, C, s * STEP, 0.18 + 0.05 * k)
# 2.4-16.8 s: full groove, six scenes
for i in range(1, 7):
    scene(i)
# 16.8-19.2 s: dead stop, one rising pluck per star, then a roll into the drop
for k, n in enumerate([72, 74, 76, 79, 84]):
    place(music, pluck(n, 0.6, 0.25), 17.25 + 0.36 * k, 0.55)
place(music, riser(0.5), 18.7, 0.3)
for k, d in enumerate([0.0, 0.075, 0.15, 0.2, 0.25, 0.2875, 0.325, 0.3625]):
    place(drums, C, 18.8 + d, 0.2 + 0.06 * k)
# 19.2-21.6 s: second drop for the fist bump
scene(8)
# tail: final stab and 808
place(music, stab(CHORDS[0], 1.0), 9 * SCENE, 1.0)
place(bass, b808(ROOTS[0], 1.2), 9 * SCENE, 0.8)
place(drums, K, 9 * SCENE, 1.0)

# sidechain pump on music and bass from every kick
duck = np.ones(N)
for i in list(range(1, 7)) + [8, 9]:
    for s in KICKS:
        a = int((i * SCENE + s * STEP) * SR)
        if a >= N:
            continue
        e = np.exp(-ts(0.18) / 0.06)
        b = min(N, a + len(e))
        duck[a:b] = np.minimum(duck[a:b], 1 - 0.5 * e[: b - a])

mix = drums + (music + bass) * duck
fade = int(0.8 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
mix = np.tanh(1.6 * mix / np.max(np.abs(mix)))
left = mix + 0.08 * np.roll(music, 220)
right = mix + 0.08 * np.roll(music, -220)
st = np.stack([left, right], 1)
st = st / np.max(np.abs(st)) * 0.95
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
print("wrote", sys.argv[1], f"{LENGTH} s")
