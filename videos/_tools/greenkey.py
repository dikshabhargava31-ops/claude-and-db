"""Green-screen keyer: raw rgb24 frames on stdin -> rgba frames on stdout.

alpha from green dominance d = g - max(r, b): d <= LO is opaque, d >= HI is clear.
Spill is suppressed by clamping g to max(r, b) + a little, scaled by how green the pixel is.
"""
import sys
import numpy as np

W, H = int(sys.argv[1]), int(sys.argv[2])
LO, HI = float(sys.argv[3]) if len(sys.argv) > 3 else 28.0, float(sys.argv[4]) if len(sys.argv) > 4 else 75.0
size = W * H * 3
inp, out = sys.stdin.buffer, sys.stdout.buffer


def box(a, r):
    # separable box blur, used to soften the matte edge and hide chroma blocks
    k = 2 * r + 1
    c = np.cumsum(np.pad(a, ((r + 1, r), (0, 0)), mode="edge"), axis=0)
    a = (c[k:] - c[:-k]) / k
    c = np.cumsum(np.pad(a, ((0, 0), (r + 1, r)), mode="edge"), axis=1)
    return (c[:, k:] - c[:, :-k]) / k


while True:
    buf = inp.read(size)
    if len(buf) < size:
        break
    f = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    m = np.maximum(r, b)
    d = g - m
    a = 1.0 - np.clip((d - LO) / (HI - LO), 0, 1)
    a = box(a, 2)
    a = np.clip((a - 0.15) / 0.8, 0, 1)  # choke slightly, keep a soft edge
    g2 = np.where(d > 4, m + 4, g)  # despill
    o = np.empty((H, W, 4), np.uint8)
    o[..., 0] = r
    o[..., 1] = np.clip(g2, 0, 255)
    o[..., 2] = b
    o[..., 3] = (a * 255).astype(np.uint8)
    out.write(o.tobytes())
