#!/usr/bin/env python3
"""Build an "Expectation vs reality" reel (HyperFrames project) from a reel.json spec.

    python3 scripts/make_ipa_evr_reel.py videos/<name>/reel.json

Each pair is a grey typewriter card (expectation) followed by colour footage
with a yellow REALITY sticker and a caption. Shots are cut with cut_shot from
make_ipa_reel.py into videos/<name>/raw/shots/ (git-ignored).
"""
import html
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_ipa_reel import GSAP, ROOT, cut_shot  # noqa: E402


def esc(s):
    return html.escape(s, quote=True)


def lines(text):
    return "<br />".join(esc(p) for p in text.split("|"))


def build(spec_path):
    spec = json.load(open(spec_path))
    proj = os.path.dirname(os.path.abspath(spec_path))
    src_dir = os.path.join(ROOT, spec.get("src_dir", "videos/ipa-reels/raw/src"))
    shots_dir = os.path.join(proj, "raw", "shots")
    os.makedirs(shots_dir, exist_ok=True)
    os.makedirs(os.path.join(proj, "assets"), exist_ok=True)
    dst = os.path.join(proj, "assets", "gsap.min.js")
    if not os.path.exists(dst):
        shutil.copy(GSAP, dst)

    n = 0
    t = 0.0
    media, overlays, js = [], [], []

    def add_shot(s, start):
        nonlocal n
        n += 1
        out = os.path.join(shots_dir, f"s{n:02d}.mp4")
        cut_shot(os.path.join(src_dir, s["src"] + ".mp4"), out, s["at"], s["len"], s.get("speed", 1.0))
        media.append(
            f'      <div id="w{n:02d}" class="frame"><video id="v{n:02d}" class="clip shot" '
            f'src="raw/shots/s{n:02d}.mp4" data-start="{start:g}" data-duration="{s["len"]:g}" '
            f'data-track-index="1" muted playsinline></video></div>')
        z0, z1 = (1.0, 1.06) if n % 2 else (1.06, 1.0)
        js.append(f'      tl.fromTo("#w{n:02d}", {{ scale: {z0} }}, {{ scale: {z1}, duration: {s["len"]:g}, ease: "none" }}, {start:g});')
        return start + s["len"]

    # Hook: the title is on screen at frame 0, over the first shot
    hook = spec["hook"]
    end_hook = add_shot(hook["shot"], 0.0)
    overlays.append(f'''      <div id="hook" class="clip hook" data-start="0" data-duration="{end_hook:g}" data-track-index="3">
        <span class="hook-small">{esc(hook["small"])}</span>
        <span class="hook-big">{lines(hook["big"])}</span>
      </div>''')
    js.append('      tl.fromTo("#hook .hook-big", { scale: 1 }, { scale: 1.06, duration: 0.25, ease: "power2.out", yoyo: true, repeat: 1 }, 0.5);')
    t = end_hook

    for i, p in enumerate(spec["pairs"], 1):
        # Expectation: grey card, text types on
        e_len = p.get("exp_len", 2.0)
        chars = max(8, len(p["exp"]))
        overlays.append(f'''      <div id="exp-{i}" class="clip exp" data-start="{t:g}" data-duration="{e_len:g}" data-track-index="2">
        <span class="exp-label">expectation</span>
        <span class="exp-text" id="exp-{i}-t">{lines(p["exp"])}</span>
      </div>''')
        js.append(f'      tl.fromTo("#exp-{i}-t", {{ clipPath: "inset(0 100% 0 0)" }}, '
                  f'{{ clipPath: "inset(0 0% 0 0)", duration: {min(0.7, e_len - 0.5):g}, ease: "steps({chars})" }}, {t + 0.1:g});')
        t += e_len
        # Reality: footage, flash, sticker, caption
        r_start = t
        for s in p["shots"]:
            t = add_shot(s, t)
        r_len = t - r_start
        overlays.append(f'''      <div id="flash-{i}" class="clip flash" data-start="{r_start:g}" data-duration="0.25" data-track-index="4"></div>
      <div id="real-{i}" class="clip real" data-start="{r_start:g}" data-duration="{r_len:g}" data-track-index="3">
        <span class="sticker" id="real-{i}-s">reality</span>
        <span class="real-text" id="real-{i}-t">{lines(p["real"])}</span>
      </div>''')
        js.append(f'      tl.fromTo("#flash-{i}", {{ opacity: 0.85 }}, {{ opacity: 0, duration: 0.22, ease: "power2.out" }}, {r_start:g});')
        js.append(f'      tl.fromTo("#real-{i}-s", {{ scale: 1.7, rotation: -4, opacity: 0 }}, '
                  f'{{ scale: 1, rotation: -4, opacity: 1, duration: 0.28, ease: "back.out(2.2)" }}, {r_start + 0.05:g});')
        js.append(f'      tl.fromTo("#real-{i}-t", {{ y: 40, opacity: 0 }}, '
                  f'{{ y: 0, opacity: 1, duration: 0.3, ease: "power3.out" }}, {r_start + 0.25:g});')

    end = spec["end"]
    end_at = t
    t = add_shot(end["shot"], t)
    total = round(t, 3)
    overlays.append(f'''      <div id="endshade" class="clip endshade" data-start="{end_at:g}" data-duration="{total - end_at:g}" data-track-index="2"></div>
      <div id="end" class="clip endcard" data-start="{end_at:g}" data-duration="{total - end_at:g}" data-track-index="3">
        <span class="end-small" id="end-s">{esc(end["small"])}</span>
        <span class="end-big" id="end-b">{esc(end["big"])}</span>
        <span class="end-place" id="end-p">{esc(end["place"])}</span>
        <span class="end-cta" id="end-c">{esc(end["cta"])}</span>
      </div>''')
    for k, (sel, dt) in enumerate((("#end-s", 0.2), ("#end-b", 0.45), ("#end-p", 0.7), ("#end-c", 1.1))):
        js.append(f'      tl.fromTo("{sel}", {{ y: 50, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }}, {end_at + dt:g});')

    page = TEMPLATE.format(total=f"{total:g}", media="\n".join(media), overlays="\n".join(overlays),
                           js="\n".join(js), accent=spec.get("accent", "#FFD21F"))
    open(os.path.join(proj, "index.html"), "w").write(page)
    print(f"{proj}: {n} shots, {total:g} s")


TEMPLATE = """<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/gsap.min.js"></script>
    <style>
      :root {{
        --ground: #0b1430;
        --accent: {accent};
        --grey: #1c1c1e;
        --mono: "IBM Plex Mono", monospace;
        --display: "Archivo Black", sans-serif;
        --body: "Inter", sans-serif;
      }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: var(--ground); }}
      #root {{ position: relative; width: 100%; height: 100%; background: var(--ground); }}
      .frame {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; overflow: hidden; }}
      .shot {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover; }}
      .hook, .real, .endcard {{ position: absolute; left: 0; width: 1080px; text-align: center; color: #fff; z-index: 30; }}
      .hook {{ top: 0; height: 1920px; padding-top: 560px; background: rgba(5, 10, 30, 0.55); }}
      .hook span, .real span, .endcard span {{ display: block; }}
      .hook-small {{ font-family: var(--mono); font-size: 46px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-bottom: 26px; }}
      .hook-big {{ font-family: var(--display); font-size: 132px; line-height: 1.0; text-transform: uppercase; padding: 0 50px; }}
      .exp {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; z-index: 25; background: var(--grey); padding: 700px 90px 0; }}
      .exp span {{ display: block; }}
      .exp-label {{ font-family: var(--mono); font-size: 40px; letter-spacing: 0.35em; text-transform: uppercase; color: #8e8e93; margin-bottom: 40px; }}
      .exp-text {{ font-family: var(--mono); font-size: 74px; line-height: 1.2; color: #d1d1d6; }}
      .flash {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; z-index: 40; background: #fff; }}
      .real {{ top: 0; height: 900px; padding-top: 250px;
        background: linear-gradient(to bottom, rgba(5, 10, 30, 0.78) 0%, rgba(5, 10, 30, 0.5) 50%, rgba(5, 10, 30, 0) 100%); }}
      .sticker {{ display: inline-block !important; font-family: var(--display); font-size: 54px; text-transform: uppercase;
        color: #111; background: var(--accent); padding: 8px 30px 12px; letter-spacing: 0.04em; }}
      .real-text {{ font-family: var(--body); font-weight: 800; font-size: 78px; line-height: 1.08; margin-top: 34px; padding: 0 70px;
        text-shadow: 0 6px 30px rgba(0, 0, 0, 0.45); }}
      .endshade {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; z-index: 25;
        background: linear-gradient(to bottom, rgba(8, 14, 40, 0.1) 25%, rgba(8, 14, 40, 0.65) 50%, rgba(8, 14, 40, 0.92) 100%); }}
      .endcard {{ top: 960px; }}
      .end-small {{ font-family: var(--mono); font-size: 40px; letter-spacing: 0.12em; color: var(--accent); }}
      .end-big {{ font-family: var(--display); font-size: 120px; margin-top: 16px; }}
      .end-place {{ font-family: var(--display); font-size: 40px; letter-spacing: 0.5em; color: var(--accent); margin-top: 14px; }}
      .end-cta {{ font-family: var(--body); font-weight: 700; font-size: 44px; margin-top: 70px; color: #fff; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1080" data-height="1920">
{media}

{overlays}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{js}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""

if __name__ == "__main__":
    build(sys.argv[1])
