#!/usr/bin/env python3
"""Original lo-fi beat for the IPA resources toon reel (100 bpm, 23 s).

    python3 music/make_beat.py assets/beat.wav

Bar map (2.4 s bars) follows the reel: bar 0 intro (filtered keys + hats),
drop at 2.4 s when the website appears, full groove to 16.8 s, a stop for
"wait... it's free?" with one rising pluck per star, full again for the fist
bump at 19.2 s, then the last chord rings out. Everything is synthesised here,
so the track is ours to use.
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
LENGTH = 23.0
rng = np.random.default_rng(7)
N = int(LENGTH * SR)
mix_drums = np.zeros(N)
mix_keys = np.zeros(N)
mix_bass = np.zeros(N)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def place(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    buf[i:j] += gain * sig[: j - i]


def env(length, decay):
    t = np.arange(int(length * SR)) / SR
    return np.exp(-t / decay), t


def onepole_lp(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for k in range(len(x)):
        acc = (1 - a) * x[k] + a * acc
        y[k] = acc
    return y


def kick():
    e, t = env(0.45, 0.11)
    f = 45 + 105 * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = np.exp(-t / 0.002) * 0.4
    return np.tanh(1.6 * (np.sin(ph) * e + click))


def snare():
    e, t = env(0.3, 0.07)
    noise = rng.standard_normal(len(t))
    body = noise - onepole_lp(noise, 1800)          # high-passed noise
    body = onepole_lp(body, 7000)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04)
    return 0.55 * body * e + 0.5 * tone


def hat(open_=False):
    e, t = env(0.25 if open_ else 0.08, 0.06 if open_ else 0.018)
    noise = rng.standard_normal(len(t))
    return (noise - onepole_lp(noise, 6500)) * e


def ep_note(freq, length, decay=1.1):
    e, t = env(length, decay)
    wob = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t)
    s = (np.sin(2 * np.pi * freq * wob * t) + 0.28 * np.sin(4 * np.pi * freq * t)
         + 0.08 * np.sin(6 * np.pi * freq * t))
    attack = np.minimum(1, t / 0.006)
    return s * e * attack


def chord(notes, t0, length, gain):
    for k, n in enumerate(notes):
        place(mix_keys, ep_note(midi(n), length), t0 + k * 0.018, gain)


def bass_note(n, t0, length):
    e, t = env(length, 0.5)
    s = np.tanh(1.8 * np.sin(2 * np.pi * midi(n) * t)) * e * np.minimum(1, t / 0.01)
    place(mix_bass, s, t0, 0.55)


CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]  # Fmaj7 Em7 Dm7 Cmaj7
ROOTS = [41, 40, 38, 36]
K, S, H, HO = kick(), snare(), hat(), hat(True)


def groove_bar(b, drums=True, hats=True, bass=True, keys_gain=0.16):
    t0 = b * BAR
    c = CHORDS[b % 4]
    chord(c, t0, BAR * 0.95, keys_gain)
    chord([n + 12 for n in c[1:3]], t0 + 2.5 * BEAT, BEAT * 1.2, keys_gain * 0.45)
    if bass:
        bass_note(ROOTS[b % 4], t0, BEAT * 1.6)
        bass_note(ROOTS[b % 4], t0 + 2.5 * BEAT, BEAT * 0.9)
        bass_note(ROOTS[b % 4] + 7, t0 + 3.5 * BEAT, BEAT * 0.45)
    if drums:
        for q in (0, 2.5):
            place(mix_drums, K, t0 + q * BEAT, 0.9)
        for q in (1, 3):
            place(mix_drums, S, t0 + q * BEAT + 0.01, 0.55)
    if hats:
        for e8 in range(8):
            swing = 0.07 * BEAT if e8 % 2 else 0
            vel = 0.16 + 0.06 * ((e8 * 5) % 3) / 2
            sig = HO if (e8 == 7 and b % 2) else H
            place(mix_drums, sig, t0 + e8 * BEAT / 2 + swing, vel)


# bar 0: intro, keys filtered later, soft hats, snare pickup into the drop
groove_bar(0, drums=False, bass=False, keys_gain=0.14)
for q in (3.0, 3.25, 3.5, 3.75):
    place(mix_drums, S, q * BEAT, 0.12 + 0.08 * (q - 3) * 4)
# bars 1-6: full groove
for b in range(1, 7):
    groove_bar(b)
# bar 7: the stop, then one rising pluck per star (beats 1-4 of the bar, plus the 'and')
t7 = 7 * BAR
for k, n in enumerate([72, 74, 76, 79, 84]):
    place(mix_keys, ep_note(midi(n), 0.8, 0.35), t7 + BEAT * (0.75 + 0.6 * k), 0.22)
# bar 8: drop again for the fist bump
groove_bar(8)
# tail: last chord rings out
chord([48, 52, 55, 59, 64], 9 * BAR, 2.0, 0.17)
bass_note(36, 9 * BAR, 1.5)
place(mix_drums, K, 9 * BAR, 0.8)

# sidechain-style duck on keys and bass after each kick
duck = np.ones(N)
for b in list(range(1, 7)) + [8, 9]:
    for q in (0, 2.5):
        i = int((b * BAR + q * BEAT) * SR)
        if i >= N:
            continue
        e, _ = env(0.25, 0.08)
        j = min(N, i + len(e))
        duck[i:j] = np.minimum(duck[i:j], 1 - 0.45 * e[: j - i])

intro_end = int(BAR * SR)
mix_keys[:intro_end] = onepole_lp(mix_keys[:intro_end], 900) * 1.6   # muffled intro
keys = onepole_lp(mix_keys, 5000)
crackle = np.zeros(N)
for t in rng.uniform(0, LENGTH, 140):
    place(crackle, rng.standard_normal(30) * np.exp(-np.arange(30) / 6), t, 0.05)

mix = mix_drums + (keys + mix_bass) * duck + crackle
fade = int(1.2 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
mix = np.tanh(1.2 * mix / np.max(np.abs(mix))) * 0.85

# light stereo: keys slightly wider than drums and bass
left = mix + 0.06 * np.roll(keys, 300)
right = mix + 0.06 * np.roll(keys, -300)
st = np.stack([left, right], 1)
st = st / np.max(np.abs(st)) * 0.89
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
print("wrote", sys.argv[1], f"{LENGTH} s")
