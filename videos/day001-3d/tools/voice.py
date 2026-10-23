"""Build raw/voice.m4a from the two recordings and fit the 14 script lines to it.

Recording 1 up to 91.8 s holds lines 1-13 (its old ending is replaced); recording 2 holds the
new line 14 (Excel tracking sheet CTA). Every pause longer than 0.35 s is shortened to 0.3 s.
Prints VOICE_LEN and SPANS for build.py. Run with the .venv-video python (needs numpy).
"""
import re, subprocess, numpy as np
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SR, HOP = 44100, 441  # 10 ms frames
PAUSE_MIN, PAUSE_KEEP = 0.35, 0.30

def load(f, a, b):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(a), "-t", str(b - a), "-i", str(ROOT / f), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def segments(x, pmin=PAUSE_MIN):
    n = len(x) // HOP
    e = 20 * np.log10(np.sqrt((x[: n * HOP].reshape(n, HOP) ** 2).mean(1)) + 1e-9)
    q = e < np.percentile(e, 10) + 10
    segs, i, start = [], 0, None
    while i < n:
        if q[i]:
            j = i
            while j < n and q[j]: j += 1
            if (j - i) / 100 >= pmin and start is not None: segs.append([start, i]); start = None
            i = j
        else:
            if start is None: start = i
            i += 1
    if start is not None: segs.append([start, n])
    return [[a / 100, b / 100] for a, b in segs]

out, speech = [], []  # audio pieces; speech segments in output time
t = 0.15
out.append(np.zeros(int(SR * 0.15), np.float32))
for f, a, b in [("raw/vo-part1.wav", 0, 91.8), ("raw/vo-part2.wav", 0, 11.6)]:
    x = load(f, a, b)
    for s0, s1 in segments(x):
        s0, s1 = max(0, s0 - 0.06), min(len(x) / SR, s1 + 0.08)  # keep breath edges soft
        piece = x[int(s0 * SR): int(s1 * SR)].copy()
        fade = int(0.01 * SR); piece[:fade] *= np.linspace(0, 1, fade); piece[-fade:] *= np.linspace(1, 0, fade)
        out.append(piece)
        # finer speech runs (pauses >= 0.15 s) are the candidate line boundaries
        for u0, u1 in segments(piece, 0.15) if len(piece) > SR else [[0, len(piece) / SR]]:
            speech.append([t + u0, t + u1, f.endswith("part2.wav")])
        t += len(piece) / SR
        gap = PAUSE_KEEP - 0.14
        out.append(np.zeros(int(SR * gap), np.float32)); t += gap
y = np.concatenate(out)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "160k", str(ROOT / "raw/voice.m4a")], input=y.tobytes(), check=True)
VOICE_LEN = round(len(y) / SR, 2)

# fit lines 1-13 to recording-1 segments, line 14 to recording 2: boundaries fall at pauses,
# chosen so each line's speaking rate stays closest to the overall rate
text = [re.sub(r"^\d+\.\s*", "", l) for l in (ROOT / "SCRIPT.md").read_text().splitlines() if re.match(r"^\d+\.", l)]
words = [len(l.split()) for l in text]
s1 = [s for s in speech if not s[2]]; s2 = [s for s in speech if s[2]]
dur = lambda a, b: s1[b - 1][1] - s1[a][0]
rate = sum(words[:13]) / sum(s[1] - s[0] for s in s1)
N, K = len(s1), 13
INF = float("inf"); best = [[INF] * (N + 1) for _ in range(K + 1)]; back = [[0] * (N + 1) for _ in range(K + 1)]
best[0][0] = 0
for k in range(1, K + 1):
    for j in range(k, N + 1):
        for i in range(k - 1, j):
            if best[k - 1][i] == INF: continue
            c = best[k - 1][i] + np.log(words[k - 1] / dur(i, j) / rate) ** 2
            if c < best[k][j]: best[k][j], back[k][j] = c, i
cuts, j = [], N
for k in range(K, 0, -1): i = back[k][j]; cuts.append((i, j)); j = i
spans = [[round(s1[i][0], 2), round(s1[j - 1][1], 2)] for i, j in reversed(cuts)]
spans.append([round(s2[0][0], 2), round(s2[-1][1], 2)])
for n, (sp, l) in enumerate(zip(spans, text), 1):
    print(f"{n:2d} {sp[0]:6.2f}-{sp[1]:6.2f} {words[n-1]/(sp[1]-sp[0]):.2f} w/s  {l[:50]}")
print(f"VOICE_LEN = {VOICE_LEN}")
print("SPANS =", spans)
