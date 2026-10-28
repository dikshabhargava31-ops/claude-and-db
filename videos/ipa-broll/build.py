#!/usr/bin/env python3
"""Build the IPA B-roll reels from reels.json.

  python3 videos/ipa-broll/build.py fetch            # download source clips into videos/ipa-broll/raw/
  python3 videos/ipa-broll/build.py cut [project]    # cut 1080x1920 shots into <project>/assets/footage/
  python3 videos/ipa-broll/build.py html [project]   # write <project>/index.html and compositions/text.html

Raw clips and cut footage are git-ignored; the HTML is the editable source.
"""
import html
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIDEOS = HERE.parent
RAW = HERE / "raw"
CONFIG = json.loads((HERE / "reels.json").read_text())
FPS = 30
W, H = 1080, 1920


def drive_url(file_id):
    return f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t"


def raw_path(file_id):
    return RAW / f"{file_id}.mp4"


def selected(name):
    return [r for r in CONFIG["reels"] if name in (None, r["project"])]


def fetch():
    RAW.mkdir(parents=True, exist_ok=True)
    ids = sorted({s["src"] for r in CONFIG["reels"] for s in r["shots"]})
    for file_id in ids:
        out = raw_path(file_id)
        if out.exists() and out.stat().st_size > 100_000:
            continue
        tmp = out.with_suffix(".part")
        source = CONFIG.get("copies", {}).get(file_id, file_id)
        subprocess.run(["curl", "-sS", "--retry", "3", "-o", str(tmp), drive_url(source)], check=True)
        if tmp.read_bytes()[:15].startswith(b"<!DOCTYPE"):
            tmp.unlink()
            print("Drive refused", file_id, "(quota exceeded); run fetch again later")
            continue
        tmp.rename(out)
        print("fetched", file_id, out.stat().st_size)


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height:stream_side_data=rotation", "-of", "json", str(path)],
        capture_output=True, text=True, check=True).stdout
    st = json.loads(out)["streams"][0]
    rot = 0
    for sd in st.get("side_data_list", []):
        rot = int(sd.get("rotation", 0))
    w, h = st["width"], st["height"]
    if abs(rot) == 90:
        w, h = h, w
    return w, h


def shot_filter(shot, src_w, src_h):
    """Rotate (for clips filmed sideways without metadata), crop to 9:16, scale to 1080x1920."""
    chain = []
    rot = shot.get("rot", "none")
    if rot == "cw":
        chain.append("transpose=1")
        src_w, src_h = src_h, src_w
    elif rot == "ccw":
        chain.append("transpose=2")
        src_w, src_h = src_h, src_w
    if src_w / src_h > W / H:
        cw = round(src_h * W / H / 2) * 2
        cx = shot.get("cx", 0.5)
        x = min(max(round(src_w * cx - cw / 2), 0), src_w - cw)
        chain.append(f"crop={cw}:{src_h}:{x}:0")
    else:
        ch = round(src_w * H / W / 2) * 2
        y = round((src_h - ch) * shot.get("cy", 0.5))
        chain.append(f"crop={src_w}:{ch}:0:{y}")
    zoom = shot.get("zoom", 1)
    if zoom > 1:
        # Punch in to lose something at the frame edge; zx/zy place the window (0..1).
        zx, zy = shot.get("zx", 0.5), shot.get("zy", 0.5)
        chain.append(f"crop=iw/{zoom}:ih/{zoom}:(iw-iw/{zoom})*{zx}:(ih-ih/{zoom})*{zy}")
    chain += [f"scale={W}:{H}:flags=lanczos", f"fps={FPS}", "format=yuv420p"]
    return ",".join(chain)


def cut(name=None):
    for reel in selected(name):
        out_dir = VIDEOS / reel["project"] / "assets" / "footage"
        out_dir.mkdir(parents=True, exist_ok=True)
        for i, shot in enumerate(reel["shots"], 1):
            src = raw_path(shot["src"])
            w, h = probe(src)
            out = out_dir / f"shot{i:02d}.mp4"
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-ss", str(shot["in"]), "-i", str(src),
                 "-t", f"{shot['dur'] + 0.2:.2f}", "-vf", shot_filter(shot, w, h), "-an",
                 "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", str(out)],
                check=True)
            print(reel["project"], out.name)


def marked(text):
    """*word* becomes a highlighted span; everything else is escaped."""
    parts = re.split(r"(\*[^*]+\*)", text)
    return "".join(
        f'<em>{html.escape(p[1:-1])}</em>' if p.startswith("*") else html.escape(p) for p in parts)


ROOT_TEMPLATE = """<!doctype html>
<html lang="hi" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>{title}</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1080px; height: 1920px; overflow: hidden; background: #0b0b0b; }}
      #root {{ position: relative; width: 100%; height: 100%; }}
      #root video {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover; }}
    </style>
  </head>
  <body>
    <!-- {idea} -->
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1080" data-height="1920">
{videos}
      <div id="text" data-composition-id="text" data-composition-src="compositions/text.html"
        data-start="0" data-duration="{total}" data-track-index="1" data-track-kind="graphics"
        data-width="1080" data-height="1920" style="z-index: 50"></div>
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""

TEXT_TEMPLATE = """<template>
  <style>
    #root {{ position: absolute; inset: 0; font-family: "Montserrat", sans-serif; }}
    /* Cards sit in the 168-1330 px band Instagram leaves clear, away from the right-hand action rail. */
    #root .card {{
      position: absolute; left: 70px; right: 150px; top: 560px; height: 640px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; text-align: center;
    }}
    #root .line {{
      display: inline-block; background: #ffffff; color: #111111; white-space: nowrap;
      font-weight: 800; font-size: 66px; line-height: 1.12; letter-spacing: -0.01em;
      padding: 12px 26px 14px; border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
    }}
    #root .line em {{ font-style: normal; background: #ffd400; border-radius: 10px; padding: 0 10px; }}
    #root .chip {{
      display: inline-block; background: #111111; color: #ffd400;
      font-weight: 800; font-size: 40px; letter-spacing: 0.04em;
      padding: 10px 24px; border-radius: 999px; margin-bottom: 6px;
    }}
    #root .chip.num {{
      width: 120px; height: 120px; padding: 0; display: flex; align-items: center; justify-content: center;
      background: #ffd400; color: #111111; font-size: 72px; font-weight: 900; letter-spacing: 0;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
    }}
    #root .hook .line {{ font-size: 78px; }}
    #root .hook .line:first-of-type {{ background: #ffd400; }}
    #root .hook .line:first-of-type em {{ background: #ffffff; }}
    #root .good .line {{ background: #0b8a4c; color: #ffffff; font-size: 92px; }}
    #root .bad .line {{ background: #e0202e; color: #ffffff; font-size: 92px; }}
    #root .count .big {{
      font-weight: 900; font-size: 300px; line-height: 0.9; color: #ffd400;
      -webkit-text-stroke: 6px #111111; paint-order: stroke fill; letter-spacing: -0.04em;
      text-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
    }}
    #root .end .line:last-of-type {{ margin-bottom: 10px; }}
    #root .handle {{
      display: inline-block; color: #ffffff; font-weight: 700; font-size: 34px;
      background: rgba(0, 0, 0, 0.55); padding: 8px 20px; border-radius: 999px;
    }}
  </style>
  <div id="root" data-composition-id="text" data-width="1080" data-height="1920">
{cards}
  </div>
  <script>
    // Shrink any line wider than the card (860 px) so every line stays one box.
    document.querySelectorAll("#root .card .line").forEach((el) => {{
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.offsetWidth > 860 && size > 40) {{
        size -= 2;
        el.style.fontSize = size + "px";
      }}
    }});
    const tl = gsap.timeline({{ paused: true }});
    // Each card pops in on its cut; lines follow 0.07 s apart. The hook (card 1) is already on screen at frame 0.
{tweens}
    window.__timelines["text"] = tl;
  </script>
</template>
"""


def build_html(name=None):
    for reel in selected(name):
        proj = VIDEOS / reel["project"]
        (proj / "compositions").mkdir(parents=True, exist_ok=True)
        t = 0.0
        videos, cards, tweens = [], [], []
        for i, shot in enumerate(reel["shots"], 1):
            d = shot["dur"]
            videos.append(
                f'      <video id="shot{i:02d}" class="clip" src="assets/footage/shot{i:02d}.mp4" muted playsinline\n'
                f'        data-start="{t:.2f}" data-duration="{d:.2f}" data-track-index="0" style="z-index: {i}"></video>')
            c = shot["card"]
            style = c.get("style", "plain")
            inner = []
            if c.get("big"):
                inner.append(f'<div id="c{i}-big" class="big">{html.escape(c["big"])}</div>')
            if c.get("chip"):
                num = " num" if c["chip"].isdigit() else ""
                inner.append(f'<div id="c{i}-chip" class="chip{num}">{html.escape(c["chip"])}</div>')
            for k, line in enumerate(c["lines"], 1):
                inner.append(f'<div id="c{i}-l{k}" class="line">{marked(line)}</div>')
            if style == "end":
                inner.append(f'<div id="c{i}-handle" class="handle">{html.escape(CONFIG["handle"])}</div>')
            body = "\n        ".join(inner)
            cards.append(
                f'    <div id="card{i}" class="clip card {style}" data-start="{t:.2f}" data-duration="{d:.2f}"'
                f' data-track-index="{i}" data-layout-allow-overlap>\n        {body}\n    </div>')
            ids = [s.split('"')[1] for s in inner]
            if i == 1:
                # Frame 0 is the thumbnail: the hook is fully visible, with a slow settle only.
                tweens.append(f'    tl.fromTo("#{ids[0]}", {{ scale: 1.04 }}, {{ scale: 1, duration: 0.8, ease: "power2.out" }}, 0);')
            else:
                for k, el in enumerate(ids):
                    at = t + 0.04 + k * 0.07
                    tweens.append(
                        f'    tl.fromTo("#{el}", {{ opacity: 0, y: 26, scale: 0.94 }}, '
                        f'{{ opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "back.out(1.6)" }}, {at:.2f});')
            t += d
        total = round(t, 2)
        (proj / "index.html").write_text(ROOT_TEMPLATE.format(
            title=reel["project"], idea=html.escape(reel["idea"]), total=f"{total:.2f}",
            videos="\n".join(videos)))
        (proj / "compositions" / "text.html").write_text(TEXT_TEMPLATE.format(
            cards="\n".join(cards), tweens="\n".join(tweens)))
        print(reel["project"], f"{total:.2f}s")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "html"
    arg = sys.argv[2] if len(sys.argv) > 2 else None
    {"fetch": fetch, "cut": lambda: cut(arg), "html": lambda: build_html(arg)}[cmd]()
