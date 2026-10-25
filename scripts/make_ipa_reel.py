#!/usr/bin/env python3
"""Build an IPA-style vertical reel (HyperFrames project) from a reel.json spec.

    python3 scripts/make_ipa_reel.py videos/<name>/reel.json

The spec lists shots (source clip, in-point, length on screen, optional speed),
captions (small italic line over a heavy caps word) and the end card. The script
cuts each shot to 1080x1920 with a slow punch-in into videos/<name>/raw/shots/
(git-ignored) and writes videos/<name>/index.html. Render with
`npx hyperframes render` inside the project.
"""
import html
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GSAP = os.path.join(ROOT, "videos", "ipa-study-reel", "assets", "gsap.min.js")

# Camera clips recorded sideways (vertical framing stored as landscape) need a
# clockwise turn; everything else is cropped to the centre.
UPRIGHT = ("V1_C0371", "V1_C0376", "V1_C0377", "V1_C0378", "V1_C0379", "V1_C0381",
           "V1_C0388", "V1_C0413", "A_C0038", "A_C013", "A_C014", "A_C015", "A_2026", "S_")


def needs_turn(name):
    return not name.startswith(UPRIGHT)


def cut_shot(src, out, at, length, speed):
    # The punch-in is animated in the page (sub-pixel smooth); baking it here
    # with ffmpeg's whole-pixel resizes made the frame shake.
    name = os.path.splitext(os.path.basename(src))[0]
    span = length * speed
    turn = "transpose=1," if needs_turn(name) else ""
    vf = (f"{turn}scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
          f"setpts={1 / speed}*(PTS-STARTPTS),fps=30")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(at), "-t", str(span),
                    "-i", src, "-vf", vf, "-t", str(length), "-an", "-c:v", "libx264",
                    "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", out], check=True)


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

    t = 0.0
    videos = []
    zooms = []
    for i, s in enumerate(spec["shots"], 1):
        out = os.path.join(shots_dir, f"s{i:02d}.mp4")
        cut_shot(os.path.join(src_dir, s["src"] + ".mp4"), out, s["at"], s["len"],
                 s.get("speed", 1.0))
        videos.append(
            f'      <div id="w{i:02d}" class="frame"><video id="v{i:02d}" class="clip shot" '
            f'src="raw/shots/s{i:02d}.mp4" data-start="{t:g}" data-duration="{s["len"]:g}" '
            f'data-track-index="1" muted playsinline></video></div>')
        z0, z1 = (1.0, 1.07) if i % 2 else (1.07, 1.0)
        zooms.append(f'      tl.fromTo("#w{i:02d}", {{ scale: {z0} }}, '
                     f'{{ scale: {z1}, duration: {s["len"]:g}, ease: "none" }}, {t:g});')
        t += s["len"]
    total = round(t, 3)
    end_at = spec["end"]["at"]

    hook = spec["hook"]
    caps = [f'''      <div id="cap-hook" class="cap clip" data-start="0" data-duration="{hook["len"]:g}" data-track-index="3">
        <span class="line small" id="hook-s" data-var-text="hook-small">{esc(hook["small"])}</span>
        <span class="line big" id="hook-b" data-var-text="hook-big">{lines(hook["big"])}</span>
      </div>''']
    tweens = []
    for i, c in enumerate(spec["captions"], 1):
        caps.append(f'''      <div id="cap-{i}" class="cap clip" data-start="{c["at"]:g}" data-duration="{c["len"]:g}" data-track-index="3">
        <span class="line small">{esc(c["small"])}</span><span class="line big">{lines(c["big"])}</span>
      </div>''')
        tweens.append(f'["#cap-{i}", {c["at"]:g}]')
    end = spec["end"]
    caps.append(f'''      <div id="cap-end" class="cap clip" data-start="{end_at:g}" data-duration="{total - end_at:g}" data-track-index="3">
        <span class="line small" id="end-s" data-var-text="end-small">{esc(end["small"])}</span>
        <span class="line big" id="end-b" data-var-text="end-big">{esc(end["big"])}</span>
        <span class="line place" id="end-p" data-var-text="end-place">{esc(end["place"])}</span>
        <span id="rule"></span>
      </div>''')

    variables = json.dumps([
        {"id": "hook-small", "type": "string", "label": "Hook, small line", "default": hook["small"]},
        {"id": "hook-big", "type": "string", "label": "Hook, big line", "default": hook["big"].replace("|", " ")},
        {"id": "end-small", "type": "string", "label": "End, small line", "default": end["small"]},
        {"id": "end-big", "type": "string", "label": "End, big line", "default": end["big"]},
        {"id": "end-place", "type": "string", "label": "End, place", "default": end["place"]},
        {"id": "accent", "type": "color", "label": "Accent", "default": spec.get("accent", "#FFD21F")},
    ]).replace("'", "&apos;")

    page = TEMPLATE.format(
        variables=variables, total=f"{total:g}", videos="\n".join(videos),
        scrim_len=f"{end_at:g}", end_at=f"{end_at:g}", end_len=f"{total - end_at:g}",
        caps="\n".join(caps), zooms="\n".join(zooms), steps=", ".join(tweens), hook_size=spec.get("hook_size", 200),
        accent=spec.get("accent", "#FFD21F"),
        e1=f"{end_at + 0.25:g}", e2=f"{end_at + 0.55:g}", e3=f"{end_at + 0.85:g}", e4=f"{end_at + 1.05:g}")
    open(os.path.join(proj, "index.html"), "w").write(page)
    print(f"{proj}: {len(videos)} shots, {total:g} s")


TEMPLATE = """<!doctype html>
<html lang="en" data-resolution="portrait" data-composition-variables='{variables}'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/gsap.min.js"></script>
    <style>
      :root {{
        --ground: #0b1430;
        --ink: #ffffff;
        --accent: {accent};
        --font-display: "Archivo Black", sans-serif;
        --font-serif: "EB Garamond", serif;
      }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: var(--ground); }}
      #root {{ position: relative; width: 100%; height: 100%; background: var(--ground); }}
      .frame {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; overflow: hidden; }}
      .shot {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover; }}
      #scrim {{
        position: absolute; left: 0; top: 0; width: 1080px; height: 900px; z-index: 20;
        background: linear-gradient(to bottom, rgba(5, 10, 30, 0.8) 0%, rgba(5, 10, 30, 0.55) 45%, rgba(5, 10, 30, 0) 100%);
      }}
      .cap {{ position: absolute; left: 0; top: 250px; width: 1080px; z-index: 30; text-align: center; color: var(--ink); }}
      .cap .line {{ display: block; overflow: visible; }}
      .cap .small {{ font-family: var(--font-serif); font-style: italic; font-size: 64px; line-height: 1.1; color: var(--accent); }}
      .cap .big {{
        font-family: var(--font-display); font-size: 124px; line-height: 1.02; letter-spacing: -0.02em;
        text-transform: uppercase; text-shadow: 0 6px 30px rgba(0, 0, 0, 0.35); padding: 0 50px;
      }}
      #cap-hook .big {{ font-size: {hook_size}px; color: var(--accent); }}
      #endcard {{
        position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; z-index: 25;
        background: linear-gradient(to bottom, rgba(8, 14, 40, 0) 30%, rgba(8, 14, 40, 0.6) 55%, rgba(8, 14, 40, 0.9) 100%);
      }}
      #cap-end {{ top: 1000px; }}
      #cap-end .big {{ font-size: 120px; }}
      #cap-end .place {{ font-family: var(--font-display); font-size: 40px; letter-spacing: 0.5em; margin-top: 18px; color: var(--accent); }}
      #rule {{ display: block; width: 160px; height: 6px; margin: 26px auto 0; background: var(--accent); }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1080" data-height="1920">
      <!-- Footage: cuts on a 120 bpm grid (0.5 s beats) -->
{videos}

      <div id="scrim" class="clip" data-start="0" data-duration="{scrim_len}" data-track-index="2"></div>
      <div id="endcard" class="clip" data-start="{end_at}" data-duration="{end_len}" data-track-index="2"></div>

      <!-- Captions: a small italic serif line, the beat word in heavy caps -->
{caps}
    </div>
    <script>
      const vars = (window.__hyperframes && window.__hyperframes.getVariables && window.__hyperframes.getVariables()) || {{}};
      if (vars.accent) document.documentElement.style.setProperty("--accent", vars.accent);

      const tl = gsap.timeline({{ paused: true }});
      const rise = (sel, at, d = 0.32) =>
        tl.fromTo(sel, {{ y: 60, opacity: 0 }}, {{ y: 0, opacity: 1, duration: d, ease: "power3.out" }}, at);

      // Slow punch-in on every shot, alternating in and out
{zooms}

      // Hook: on screen at frame 0, the big word pulses on the second beat
      tl.fromTo("#hook-b", {{ scale: 1 }}, {{ scale: 1.1, duration: 0.25, ease: "power2.out", yoyo: true, repeat: 1 }}, 0.5);

      // Each beat: small line first, the caps word half a beat after
      [{steps}].forEach(([id, t]) => {{
        rise(`${{id}} .small`, t, 0.25);
        rise(`${{id}} .big`, t + 0.12, 0.3);
      }});

      // End card
      rise("#end-s", {e1}, 0.4);
      rise("#end-b", {e2}, 0.4);
      rise("#end-p", {e3}, 0.4);
      tl.fromTo("#rule", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.45, ease: "power2.out" }}, {e4});

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""

if __name__ == "__main__":
    build(sys.argv[1])
