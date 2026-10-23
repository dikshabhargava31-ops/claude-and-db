"""Write assets/bgm/track.m4a: an original lo-fi music bed for the reel, made from scratch with numpy.

96 BPM, warm keys over a Cmaj7-Am7-Fmaj7-G progression, soft bass and drums. Every shot cut gets a
transition: the drums drop out for the last beat, a filtered riser swells into the cut and a soft hit
lands on it. The bed ducks under the voice (raw/voice.m4a) and swells after the last word.
Run after tools/voice.py and tools/build.py (it reads the timing from index.html).
"""
import json, re, subprocess
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
T = json.loads(re.search(r"const T = (\{.*?\});\n", (ROOT / "index.html").read_text()).group(1))
END = T["end"]
CUTS = [s["a"] for s in T["shots"][1:]]
ENDCARD = T["ev"]["endcard"]
N = int((END + 0.5) * SR)
rng = np.random.default_rng(7)  # fixed seed: the same track every build
BEAT = 60 / 96
t_all = np.arange(N) / SR

def env(n, a, d):  # attack, exponential decay
    e = np.exp(-np.arange(n) / SR / d)
    k = max(1, int(a * SR)); e[:k] *= np.linspace(0, 1, k)
    return e

def add(buf, start, sig):
    i = int(start * SR)
    if i >= len(buf): return
    sig = sig[: len(buf) - i]; buf[i:i + len(sig)] += sig

def lowpass(x, cutoff):  # one-pole, cheap and warm
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y

midi = lambda m: 440 * 2 ** ((m - 69) / 12)
CHORDS = [[48, 55, 59, 64, 67], [45, 52, 55, 60, 64], [41, 48, 52, 57, 64], [43, 50, 55, 59, 62]]  # Cmaj7 Am7 Fmaj7 G6
BAR = 4 * BEAT

keys, pad, bass, drums, fx = (np.zeros(N) for _ in range(5))
nbars = int(np.ceil(END / BAR)) + 1
for b in range(nbars):
    t0 = b * BAR; ch = CHORDS[b % 4]
    # pad: soft detuned sines across the bar
    n = int(BAR * SR); tt = np.arange(n) / SR
    e = np.minimum(1, tt / 0.6) * np.minimum(1, (BAR - tt) / 0.5)
    add(pad, t0, sum(np.sin(2 * np.pi * midi(m + 12) * (1 + d) * tt) for m in ch[1:] for d in (-0.003, 0.003)) * e * 0.035)
    # keys: an eighth-note arpeggio, electric-piano-ish (fundamental + soft 2nd and 3rd harmonics)
    for k in range(8):
        m = ch[1:][[0, 1, 2, 3, 2, 1, 3, 2][k]] + 12
        n = int(1.2 * SR); tt = np.arange(n) / SR; f = midi(m)
        tone = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) + 0.12 * np.sin(6 * np.pi * f * tt)
        swing = 0.04 if k % 2 else 0
        add(keys, t0 + k * BEAT / 2 + swing, tone * env(n, 0.004, 0.32) * (0.11 if k % 2 == 0 else 0.08))
    # bass: root on 1 and 3, a pickup on the "and" of 4
    for at, mm in ((0, ch[0]), (2 * BEAT, ch[0]), (3.5 * BEAT, ch[0] + 7)):
        n = int(0.9 * SR); tt = np.arange(n) / SR; f = midi(mm - 12)
        add(bass, t0 + at, (np.sin(2 * np.pi * f * tt) + 0.2 * np.sin(4 * np.pi * f * tt)) * env(n, 0.01, 0.35) * 0.28)
    # drums
    for k in range(4):
        tb = t0 + k * BEAT
        if k in (0, 2):  # kick
            n = int(0.35 * SR); tt = np.arange(n) / SR
            ph = 2 * np.pi * np.cumsum(45 + 75 * np.exp(-tt / 0.04)) / SR
            add(drums, tb, np.sin(ph) * env(n, 0.002, 0.12) * 0.55)
        else:  # soft snare / clap
            n = int(0.25 * SR)
            nz = rng.standard_normal(n); nz = nz - lowpass(nz, 900)
            add(drums, tb, nz * env(n, 0.002, 0.07) * 0.12)
        for h in range(2):  # hats on eighths
            n = int(0.06 * SR); nz = rng.standard_normal(n); nz = nz - lowpass(nz, 6000)
            add(drums, tb + h * BEAT / 2 + (0.035 if h else 0), nz * env(n, 0.001, 0.018) * (0.07 if h else 0.05))

# arrangement: soft intro (no drums for the first 2 bars), drums drop out for a beat before every cut
dmask = np.ones(N); dmask[: int(2 * BAR * SR)] = 0
for c in CUTS:
    a, b = int((c - BEAT) * SR), int(c * SR); dmask[max(0, a):b] = 0
dmask = np.convolve(dmask, np.ones(441) / 441, mode="same")
drums *= dmask

# transitions: a filtered noise riser into each cut, a soft low hit and shimmer on it
for c in CUTS + [ENDCARD]:
    n = int(0.55 * SR); tt = np.arange(n) / SR
    nz = rng.standard_normal(n); hp = nz - lowpass(nz, 1500)
    rise = (tt / tt[-1]) ** 2.2
    add(fx, c - 0.55, hp * rise * 0.10)
    n = int(1.4 * SR); tt = np.arange(n) / SR
    hit = np.sin(2 * np.pi * np.cumsum(55 + 40 * np.exp(-tt / 0.05)) / SR) * env(n, 0.002, 0.35) * 0.35
    nz = rng.standard_normal(n); sh = (nz - lowpass(nz, 5000)) * env(n, 0.002, 0.45) * 0.035
    add(fx, c, hit + sh)

music = lowpass(keys + pad, 5200) + bass + drums
music /= np.max(np.abs(music)) + 1e-9
fx /= np.max(np.abs(fx)) + 1e-9

# duck under the voice: -9 dB while speaking, smooth in and out; full level on the end card
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ROOT / "raw/voice.m4a"), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
v = np.frombuffer(raw, np.float32)[:N]; v = np.pad(v, (0, N - len(v)))
hop = 441; nfr = N // hop
lvl = 20 * np.log10(np.sqrt((v[: nfr * hop].reshape(nfr, hop) ** 2).mean(1)) + 1e-9)
talk = (lvl > np.percentile(lvl, 25) + 12).astype(float)
g = np.empty(nfr); acc = 0.0
for i in range(nfr):  # attack 60 ms, release 500 ms
    k = 1 - np.exp(-0.01 / (0.06 if talk[i] > acc else 0.5)); acc += (talk[i] - acc) * k; g[i] = acc
duck = 10 ** (-9 * np.repeat(g, hop) / 20); duck = np.pad(duck, (0, N - len(duck)), constant_values=duck[-1])
VOICE_END = T["lines"][-1]["e"]  # swell only after the last word
level = np.where(t_all < VOICE_END, 1.0, np.minimum(1.8, 1 + (t_all - VOICE_END) / 0.6 * 0.8))
fade = np.clip((END + 0.3 - t_all) / 2.0, 0, 1) * np.clip(t_all / 0.4, 0, 1)
mix = (music * duck * level * 0.9 + fx * 0.28) * fade

(ROOT / "assets/bgm").mkdir(parents=True, exist_ok=True)
stereo = np.stack([mix, mix], 1).astype(np.float32)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                "-af", "aecho=0.8:0.6:35|55:0.18|0.12,volume=1", "-ar", "48000", "-c:a", "aac", "-b:a", "128k",
                str(ROOT / "assets/bgm/track.m4a")], input=stereo.tobytes(), check=True)
print(f"music {END}s, {len(CUTS)} transitions")
