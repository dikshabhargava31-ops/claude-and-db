"""Build one CUET-tip reel (a HyperFrames project) from tips.json.

usage: python3 build_reel.py <tips.json> <tip number> <keyed.webm> <source.mp4> <out dir>

Every reel shares the same opener, layout, caption style and end card so the
ten shorts read as one series; only the copy, callouts and timing change.
Times in tips.json are seconds in the source video; the reel's clock is
INTRO + (source time - segment start).
"""
import html
import json
import os
import shutil
import subprocess
import sys

INTRO = 1.5  # series opener before the presenter speaks
OUTRO = 2.2  # end card after the last word
PRE, POST = 0.55, 0.45  # presenter footage kept around the speech, for the rise-in and the exit
W, H = 1080, 1920
SFX_DIR = os.path.join(os.path.dirname(__file__), "..", "..", ".claude", "skills", "media-use", "audio", "assets", "sfx")

cfg_path, num, keyed, source, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5]
cfg = json.load(open(cfg_path))
total_tips = len(cfg["tips"])
tip = next(t for t in cfg["tips"] if t["n"] == num)
a, b = tip["start"], tip["end"]
body = round(b - a, 3)
D = round(INTRO + body + OUTRO, 3)


def rt(src_t):
    return round(INTRO + src_t - a, 3)


def esc(s):
    return html.escape(s, quote=True)


os.makedirs(os.path.join(out, "assets", "sfx"), exist_ok=True)
os.makedirs(os.path.join(out, "compositions"), exist_ok=True)
os.makedirs(os.path.join(out, "assets", "vendor"), exist_ok=True)
# GSAP ships with the project: renders never fetch
shutil.copy(os.path.join(os.path.dirname(__file__), "vendor", "gsap.min.js"), os.path.join(out, "assets", "vendor", "gsap.min.js"))

# ---------- media ----------
pres = os.path.join(out, "assets", "presenter.webm")
voice = os.path.join(out, "assets", "voice.m4a")
if not os.path.exists(pres):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-c:v", "libvpx-vp9", "-ss", str(max(0, a - PRE)), "-to", str(b + POST), "-i", keyed,
                    "-vf", "fps=30", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-crf", "26", "-b:v", "0",
                    "-row-mt", "1", "-cpu-used", "4", "-g", "30", "-auto-alt-ref", "0", "-an", pres], check=True)
if not os.path.exists(voice):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a), "-to", str(b), "-i", source, "-vn",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=9,afade=t=in:d=0.04,afade=t=out:st=%.3f:d=0.12" % (body - 0.12),
                    "-c:a", "aac", "-b:a", "192k", voice], check=True)
for s in ["impact-bass-1.mp3", "whoosh-cinematic.mp3", "whoosh-short.mp3", "pop.mp3", "chime.mp3"]:
    shutil.copy(os.path.join(SFX_DIR, s), os.path.join(out, "assets", "sfx", s))

nn = "%02d" % num
nxt = "%02d" % (num + 1) if num < total_tips else None

# ---------- index.html ----------
pops = []
for i, c in enumerate(tip["cards"]):
    pops.append('      <audio id="sfx-pop-%d" class="clip" src="assets/sfx/pop.mp3" data-start="%.3f" data-duration="0.6" data-track-index="9" data-volume="0.35"></audio>'
                % (i, rt(c["t"])))
pops = "\n".join(pops)

index = f"""<!doctype html>
<html lang="hi" data-resolution="portrait"
  data-composition-variables='[{{"id":"accent","type":"color","label":"Accent","default":"#FFC93C"}},{{"id":"ground","type":"color","label":"Background","default":"#0A0F2C"}}]'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      :root {{ --accent: #FFC93C; --ground: #0A0F2C; --ink: #ffffff; }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: var(--ground); }}
      #root {{ position: relative; width: 100%; height: 100%; background: var(--ground); overflow: hidden; }}
      #presenter-stage {{ position: absolute; inset: 0; z-index: 3; }}
      #presenter-rig {{ position: absolute; left: -132px; top: 624px; width: 1320px; height: 1296px; transform-origin: 50% 100%; }}
      #presenter {{ position: absolute; left: 0; top: 0; width: 1320px; height: 1296px; object-fit: contain; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="1080" data-height="1920">
      <div id="bg" class="clip" data-composition-id="bg" data-composition-src="compositions/bg.html"
        data-start="0" data-duration="{D}" data-track-index="0" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:1"></div>

      <div id="presenter-stage">
        <div id="presenter-rig">
          <video id="presenter" class="clip" src="assets/presenter.webm" data-start="{INTRO - PRE:.3f}" data-media-start="0" data-duration="{round(body + PRE + POST, 3)}" data-track-index="1" muted playsinline></video>
        </div>
      </div>

      <div id="graphics" class="clip" data-composition-id="graphics" data-composition-src="compositions/graphics.html"
        data-start="0" data-duration="{D}" data-track-index="2" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:4"></div>

      <div id="captions" class="clip" data-composition-id="captions" data-composition-src="compositions/captions.html"
        data-start="0" data-duration="{D}" data-track-index="3" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index:5"></div>

      <div id="intro" class="clip" data-composition-id="intro" data-composition-src="compositions/intro.html"
        data-start="0" data-duration="{INTRO + 0.4:.3f}" data-track-index="4" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:6"></div>

      <div id="outro" class="clip" data-composition-id="outro" data-composition-src="compositions/outro.html"
        data-start="{round(INTRO + body - 0.3, 3)}" data-duration="{round(OUTRO + 0.3, 3)}" data-track-index="5" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:7"></div>

      <audio id="voice" class="clip" src="assets/voice.m4a" data-start="{INTRO}" data-duration="{body}" data-track-index="6" data-volume="1"></audio>
      <audio id="sfx-impact" class="clip" src="assets/sfx/impact-bass-1.mp3" data-start="0" data-duration="1.4" data-track-index="7" data-volume="0.5"></audio>
      <audio id="sfx-whoosh-in" class="clip" src="assets/sfx/whoosh-cinematic.mp3" data-start="{INTRO - 0.6:.3f}" data-duration="1.2" data-track-index="8" data-volume="0.4"></audio>
{pops}
      <audio id="sfx-whoosh-out" class="clip" src="assets/sfx/whoosh-short.mp3" data-start="{round(INTRO + body - 0.15, 3)}" data-duration="0.57" data-track-index="10" data-volume="0.45"></audio>
      <audio id="sfx-chime" class="clip" src="assets/sfx/chime.mp3" data-start="{round(INTRO + body + 0.35, 3)}" data-duration="1.4" data-track-index="11" data-volume="0.3"></audio>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      // presenter rises in under the opener, punches in on emphasis, eases out under the end card
      tl.fromTo("#presenter-rig", {{ y: 420, scale: 0.92 }}, {{ y: 0, scale: 1, duration: 0.7, ease: "expo.out" }}, {INTRO - 0.55:.3f});
"""

for p in tip.get("punches", []):
    t0 = rt(p["t"])
    t1 = rt(p.get("until", p["t"] + 1.6))
    s = p.get("scale", 1.12)
    index += f'      tl.to("#presenter-rig", {{ scale: {s}, duration: 0.28, ease: "power3.out" }}, {t0});\n'
    index += f'      tl.to("#presenter-rig", {{ scale: 1, duration: 0.45, ease: "power2.inOut" }}, {t1});\n'
index += f"""      tl.to("#presenter-rig", {{ y: 160, scale: 0.9, opacity: 0, duration: 0.45, ease: "power3.in" }}, {round(INTRO + body - 0.1, 3)});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""

# ---------- bg ----------
bg = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: hidden; background: var(--ground, #0A0F2C); }}
    #bg-glow-a, #bg-glow-b {{ position: absolute; border-radius: 50%; }}
    #bg-glow-a {{ width: 1400px; height: 1400px; left: -520px; top: -260px;
      background: radial-gradient(circle, rgba(61,123,255,0.55) 0%, rgba(61,123,255,0) 62%); }}
    #bg-glow-b {{ width: 1300px; height: 1300px; left: 300px; top: 900px;
      background: radial-gradient(circle, rgba(255,201,60,0.30) 0%, rgba(255,201,60,0) 60%); }}
    #bg-grid {{ position: absolute; inset: -120px;
      background-image: linear-gradient(rgba(255,255,255,0.055) 2px, transparent 2px),
        linear-gradient(90deg, rgba(255,255,255,0.055) 2px, transparent 2px);
      background-size: 120px 120px; }}
    #bg-num {{ position: absolute; left: 0; right: 0; top: 330px; text-align: center;
      font-family: "League Gothic"; font-size: 1150px; line-height: 1; color: rgba(255,255,255,0.06);
      letter-spacing: -0.02em; }}
    #bg-vignette {{ position: absolute; inset: 0;
      background: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%); }}
  </style>
  <div id="root" data-composition-id="bg" data-width="1080" data-height="1920">
    <div id="bg-glow-a" data-layout-ignore></div>
    <div id="bg-glow-b" data-layout-ignore></div>
    <div id="bg-grid" data-layout-ignore></div>
    <div id="bg-num" data-layout-ignore>{nn}</div>
    <div id="bg-vignette"></div>
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    // slow drift of the stage: the ground is alive, the type on it never is
    tl.fromTo("#bg-glow-a", {{ x: 0, y: 0 }}, {{ x: 260, y: 180, duration: {D}, ease: "sine.inOut" }}, 0);
    tl.fromTo("#bg-glow-b", {{ x: 0, y: 0 }}, {{ x: -320, y: -260, duration: {D}, ease: "sine.inOut" }}, 0);
    tl.fromTo("#bg-grid", {{ y: 0 }}, {{ y: 120, duration: {D}, ease: "none" }}, 0);
    tl.fromTo("#bg-num", {{ scale: 1.25, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 1.1, ease: "expo.out" }}, {INTRO - 0.4:.3f});
    window.__timelines["bg"] = tl;
  </script>
</template>
"""

# ---------- intro (series opener, identical layout on every reel) ----------
hl = tip["headline"]  # list of words; words in "*" are accent
hl_html = []
for i, w in enumerate(hl):
    acc = w.startswith("*")
    hl_html.append(f'<span class="intro-w{" intro-acc" if acc else ""}" id="intro-w{i}">{esc(w.strip("*"))}</span>')
intro = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: hidden; }}
    #intro-plate {{ position: absolute; inset: 0; background: linear-gradient(160deg, #101a4d 0%, #0A0F2C 55%, #1b1240 100%); }}
    #intro-streaks {{ position: absolute; inset: -200px; opacity: 0.55;
      background: repeating-linear-gradient(115deg, rgba(255,201,60,0) 0 90px, rgba(255,201,60,0.16) 90px 96px); }}
    #intro-kicker {{ position: absolute; left: 0; right: 0; top: 380px; text-align: center;
      font-family: Montserrat; font-weight: 800; font-size: 44px; letter-spacing: 0.32em; color: #fff; opacity: 0.85; }}
    #intro-badge {{ position: absolute; left: 0; right: 0; top: 470px; text-align: center; }}
    #intro-tip {{ display: inline-block; font-family: "League Gothic"; font-size: 420px; line-height: 0.9; color: var(--accent, #FFC93C);
      letter-spacing: 0.01em; }}
    #intro-of {{ display: inline-block; font-family: Montserrat; font-weight: 800; font-size: 64px; color: #fff; opacity: 0.6; margin-left: 12px; }}
    #intro-head {{ position: absolute; left: 80px; right: 80px; top: 930px; text-align: center;
      font-family: Montserrat; font-weight: 900; font-size: 92px; line-height: 1.08; color: #fff; text-transform: uppercase; }}
    .intro-w {{ display: inline-block; margin: 0 12px; }}
    .intro-acc {{ color: var(--accent, #FFC93C); }}
  </style>
  <div id="root" data-composition-id="intro" data-width="1080" data-height="1920">
    <div id="intro-plate"></div>
    <div id="intro-streaks" data-layout-ignore></div>
    <div id="intro-kicker">{esc(cfg["series"])}</div>
    <div id="intro-badge"><span id="intro-tip">TIP {nn}</span><span id="intro-of">/{total_tips:02d}</span></div>
    <div id="intro-head">{"".join(hl_html)}</div>
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    // frame 0 is already the thumbnail: number and hook line on screen, then it all moves
    tl.fromTo("#intro-tip", {{ scale: 1.18 }}, {{ scale: 1, duration: 0.5, ease: "expo.out" }}, 0);
    tl.fromTo("#intro-streaks", {{ x: -160 }}, {{ x: 120, duration: {INTRO + 0.4:.2f}, ease: "none" }}, 0);
    tl.fromTo(".intro-w", {{ opacity: 0.25, filter: "blur(4px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.14, stagger: 0.07, ease: "power2.out" }}, 0.02);
    // exit: the plate lifts away like a shutter while the presenter rises under it
    tl.to("#intro-head", {{ y: -60, opacity: 0, filter: "blur(10px)", duration: 0.3, ease: "power3.in" }}, {INTRO - 0.5:.3f});
    tl.to("#intro-badge, #intro-kicker", {{ y: -380, scale: 0.5, opacity: 0, duration: 0.42, ease: "power3.in" }}, {INTRO - 0.48:.3f});
    tl.fromTo(["#intro-plate", "#intro-streaks"], {{ clipPath: "inset(0% 0% 0% 0%)" }}, {{ clipPath: "inset(0% 0% 100% 0%)", duration: 0.5, ease: "power3.inOut" }}, {INTRO - 0.45:.3f});
    window.__timelines["intro"] = tl;
  </script>
</template>
"""

# ---------- graphics: header chip, title, progress bar, callout cards ----------
ICONS = {
    "check": '<path d="M5 13l4 4L19 7" />',
    "alert": '<path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17v.5" />',
    "book": '<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z" /><path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />',
    "target": '<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" />',
    "clock": '<circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" />',
    "cross": '<path d="M6 6l12 12" /><path d="M18 6L6 18" />',
    "star": '<path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z" />',
    "chart": '<path d="M5 19V9" /><path d="M12 19V5" /><path d="M19 19v-7" />',
    "list": '<path d="M9 7h11" /><path d="M9 12h11" /><path d="M9 17h11" /><path d="M4 7h.5" /><path d="M4 12h.5" /><path d="M4 17h.5" />',
    "college": '<path d="M3 9l9-5 9 5-9 5z" /><path d="M7 11.5V16c3 2 7 2 10 0v-4.5" />',
}
cards_html, cards_js = [], []
for i, c in enumerate(tip["cards"]):
    t0 = rt(c["t"])
    t1 = min(rt(c.get("until", c["t"] + 3.2)), INTRO + body - 0.2)
    side = c.get("side", "left" if i % 2 == 0 else "right")
    tone = c.get("tone", "accent")
    icon = ICONS.get(c.get("icon", "check"), ICONS["check"])
    sub = f'<div class="card-sub">{esc(c["sub"])}</div>' if c.get("sub") else ""
    cards_html.append(f"""    <div id="card-{i}" class="clip card card-{side} card-{tone}" data-start="{t0}" data-duration="{round(t1 - t0, 3)}" data-track-index="{2 + i % 2}">
      <div id="card-{i}-in" class="card-in">
        <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">{icon}</svg></div>
        <div class="card-txt"><div class="card-main">{esc(c["text"])}</div>{sub}</div>
      </div>
    </div>""")
    dx = -620 if side == "left" else 620
    cards_js.append(f'    tl.fromTo("#card-{i}-in", {{ x: {dx}, rotation: {-6 if side == "left" else 6}, opacity: 0 }}, {{ x: 0, rotation: 0, opacity: 1, duration: 0.55, ease: "back.out(1.5)" }}, {t0});')
    cards_js.append(f'    tl.fromTo("#card-{i}-in .card-icon", {{ scale: 0.3 }}, {{ scale: 1, duration: 0.4, ease: "back.out(2.2)" }}, {round(t0 + 0.15, 3)});')
    cards_js.append(f'    tl.to("#card-{i}-in", {{ x: {dx // 2}, opacity: 0, filter: "blur(8px)", duration: 0.28, ease: "power3.in" }}, {round(t1 - 0.3, 3)});')

title_words = tip["title"]
tw_html = "".join(f'<span class="tt-w{" tt-acc" if w.startswith("*") else ""}">{esc(w.strip("*"))}</span>' for w in title_words)
dots = "".join(f'<span class="dot{" dot-on" if k < num else ""}{" dot-now" if k == num - 1 else ""}"></span>' for k in range(total_tips))

graphics = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: hidden; pointer-events: none; }}
    #g-progress {{ position: absolute; left: 0; top: 0; height: 12px; width: 1080px; background: rgba(255,255,255,0.12); }}
    #g-progress-fill {{ position: absolute; left: 0; top: 0; height: 12px; width: 1080px; background: var(--accent, #FFC93C); transform-origin: 0 50%; }}
    #g-top {{ position: absolute; left: 60px; right: 60px; top: 190px; }}
    #g-chip {{ display: inline-flex; align-items: center; gap: 18px; padding: 14px 28px 14px 16px; border-radius: 60px;
      background: rgba(10,15,44,0.72); border: 2px solid rgba(255,201,60,0.6); }}
    #g-chip-num {{ font-family: "League Gothic"; font-size: 64px; line-height: 1; color: #0A0F2C; background: var(--accent, #FFC93C);
      border-radius: 40px; padding: 4px 20px 0; }}
    #g-chip-txt {{ font-family: Montserrat; font-weight: 800; font-size: 34px; letter-spacing: 0.14em; color: #fff; }}
    #g-dots {{ display: flex; gap: 10px; margin-top: 22px; margin-left: 8px; }}
    .dot {{ width: 30px; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.22); }}
    .dot-on {{ background: rgba(255,201,60,0.55); }}
    .dot-now {{ background: var(--accent, #FFC93C); width: 56px; }}
    #g-title {{ position: absolute; left: 60px; right: 60px; top: 362px; font-family: Montserrat; font-weight: 900;
      font-size: 78px; line-height: 1.04; color: #fff; text-transform: uppercase; }}
    .tt-w {{ display: inline-block; margin-right: 20px; }}
    .tt-acc {{ color: var(--accent, #FFC93C); }}
    .card {{ position: absolute; top: 560px; width: 560px; }}
    .card-left {{ left: 44px; }}
    .card-right {{ right: 44px; }}
    .card-in {{ display: flex; align-items: center; gap: 22px; padding: 24px 28px; border-radius: 30px;
      background: rgba(255,255,255,0.96); box-shadow: 0 24px 60px rgba(0,0,0,0.45); }}
    .card-icon {{ flex: 0 0 auto; width: 84px; height: 84px; border-radius: 24px; display: flex; align-items: center; justify-content: center; }}
    .card-icon svg {{ width: 52px; height: 52px; }}
    .card-accent .card-icon {{ background: var(--accent, #FFC93C); color: #0A0F2C; }}
    .card-good .card-icon {{ background: #22C55E; color: #fff; }}
    .card-bad .card-icon {{ background: #EF4444; color: #fff; }}
    .card-blue .card-icon {{ background: #3D7BFF; color: #fff; }}
    .card-main {{ font-family: Montserrat; font-weight: 900; font-size: 44px; line-height: 1.05; color: #0A0F2C; }}
    .card-sub {{ font-family: Poppins; font-weight: 600; font-size: 30px; line-height: 1.15; color: #4B5563; margin-top: 6px; }}
  </style>
  <div id="root" data-composition-id="graphics" data-width="1080" data-height="1920">
    <div id="g-progress" data-layout-ignore><div id="g-progress-fill"></div></div>
    <div id="g-top" class="clip" data-start="{INTRO - 0.25:.3f}" data-duration="{round(body + 0.2, 3)}" data-track-index="0">
      <div id="g-top-in">
        <div id="g-chip"><span id="g-chip-num">TIP {nn}</span><span id="g-chip-txt">{esc(cfg["chip"])}</span></div>
        <div id="g-dots">{dots}</div>
      </div>
    </div>
    <div id="g-title" class="clip" data-start="{INTRO - 0.1:.3f}" data-duration="{round(body + 0.05, 3)}" data-track-index="1">
      <div id="g-title-in">{tw_html}</div>
    </div>
{chr(10).join(cards_html)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    tl.fromTo("#g-progress-fill", {{ scaleX: 0 }}, {{ scaleX: 1, duration: {D}, ease: "none" }}, 0);
    // the opener's badge lands here as the chip (carry across)
    tl.fromTo("#g-top-in", {{ y: 160, scale: 1.5, opacity: 0 }}, {{ y: 0, scale: 1, opacity: 1, duration: 0.55, ease: "expo.out" }}, {INTRO - 0.25:.3f});
    tl.fromTo("#g-title-in .tt-w", {{ opacity: 0, y: 40, filter: "blur(6px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.35, stagger: 0.08, ease: "power4.out" }}, {INTRO - 0.1:.3f});
    tl.to("#g-title-in, #g-top-in", {{ opacity: 0, y: -40, filter: "blur(8px)", duration: 0.3, ease: "power3.in" }}, {round(INTRO + body - 0.35, 3)});
{chr(10).join(cards_js)}
    window.__timelines["graphics"] = tl;
  </script>
</template>
"""

# ---------- captions ----------
words = tip["words"]  # [{text, start, end, hi?}] source times, romanised
groups, cur = [], []
for w in words:
    if cur and (len(cur) >= 3 or w["start"] - cur[-1]["end"] >= 0.25 or cur[-1]["text"][-1:] in ".?!,"):
        groups.append(cur)
        cur = []
    cur.append(w)
if cur:
    groups.append(cur)
cap_html, cap_js = [], []
for gi, g in enumerate(groups):
    g0 = rt(g[0]["start"]) - 0.05
    nxt_start = rt(groups[gi + 1][0]["start"]) - 0.05 if gi + 1 < len(groups) else rt(g[-1]["end"]) + 0.4
    g1 = min(max(rt(g[-1]["end"]) + 0.1, g0 + 0.3), nxt_start, INTRO + body)
    spans = "".join(f'<span id="cw-{gi}-{k}" class="cw{" cw-hi" if w.get("hi") else ""}">{esc(w["text"].strip(".,?!"))}</span>' for k, w in enumerate(g))
    cap_html.append(f'    <div id="cg-{gi}" class="cg" data-gs="{g0:.3f}">{spans}</div>')
    cap_js.append(f'    tl.fromTo("#cg-{gi}", {{ opacity: 0, scale: 0.8, y: 20 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.16, ease: "back.out(2)" }}, {g0:.3f});')
    for k, w in enumerate(g):
        ws = rt(w["start"])
        cap_js.append(f'    tl.fromTo("#cw-{gi}-{k}", {{ color: "#ffffff", backgroundColor: "rgba(255,201,60,0)" }}, {{ color: "#0A0F2C", backgroundColor: "rgba(255,201,60,1)", duration: 0.08 }}, {max(ws, g0):.3f});')
        if k < len(g) - 1:
            cap_js.append(f'    tl.to("#cw-{gi}-{k}", {{ color: "{"#FFC93C" if w.get("hi") else "#ffffff"}", backgroundColor: "rgba(255,201,60,0)", duration: 0.08 }}, {rt(g[k + 1]["start"]):.3f});')
    cap_js.append(f'    tl.to("#cg-{gi}", {{ opacity: 0, duration: 0.1, ease: "power2.in" }}, {g1 - 0.1:.3f});')
    cap_js.append(f'    tl.set("#cg-{gi}", {{ opacity: 0, visibility: "hidden" }}, {g1:.3f});')

captions = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: visible; pointer-events: none; }}
    .cg {{ position: absolute; left: 0; width: 1080px; top: 1244px; text-align: center; opacity: 0; overflow: visible;
      font-family: Montserrat; font-weight: 900; font-size: 74px; line-height: 1.1; text-transform: uppercase; }}
    .cw {{ display: inline-block; margin: 0 6px; padding: 2px 16px 4px; border-radius: 16px; color: #fff;
      text-shadow: 0 4px 0 rgba(0,0,0,0.35), 0 0 24px rgba(0,0,0,0.5); }}
  </style>
  <div id="root" data-composition-id="captions" data-width="1080" data-height="1920" data-layout-allow-overlap>
{chr(10).join(cap_html)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
{chr(10).join(cap_js)}
    window.__timelines["captions"] = tl;
  </script>
</template>
"""

# ---------- outro (end card that hands over to the next reel) ----------
if nxt:
    o_kicker, o_main, o_sub = "NEXT", f"TIP {nxt}", tip.get("next_tease", "Follow karo, agla tip miss mat karna")
else:
    o_kicker, o_main, o_sub = "ALL 10 TIPS", "SAVE KARO", "Follow karo aur dosto ko share karo"
O0 = 0.3
outro = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: hidden; }}
    #o-plate {{ position: absolute; inset: 0; background: linear-gradient(200deg, #1b1240 0%, #0A0F2C 50%, #101a4d 100%); }}
    #o-streaks {{ position: absolute; inset: -200px; opacity: 0.5;
      background: repeating-linear-gradient(65deg, rgba(61,123,255,0) 0 90px, rgba(61,123,255,0.18) 90px 96px); }}
    #o-box {{ position: absolute; left: 80px; right: 80px; top: 520px; text-align: center; }}
    #o-kicker {{ font-family: Montserrat; font-weight: 800; font-size: 48px; letter-spacing: 0.3em; color: #fff; opacity: 0.8; }}
    #o-main {{ font-family: "League Gothic"; font-size: 300px; line-height: 0.95; color: var(--accent, #FFC93C); margin-top: 10px; }}
    #o-sub {{ font-family: Montserrat; font-weight: 800; font-size: 50px; line-height: 1.15; color: #fff; margin-top: 30px; }}
    #o-follow {{ display: inline-block; margin-top: 56px; padding: 26px 56px; border-radius: 60px; background: var(--accent, #FFC93C);
      font-family: Montserrat; font-weight: 900; font-size: 46px; letter-spacing: 0.08em; color: #0A0F2C; }}
  </style>
  <div id="root" data-composition-id="outro" data-width="1080" data-height="1920">
    <div id="o-plate"></div>
    <div id="o-streaks" data-layout-ignore></div>
    <div id="o-box">
      <div id="o-kicker">{o_kicker}</div>
      <div id="o-main">{o_main}</div>
      <div id="o-sub">{esc(o_sub)}</div>
      <div id="o-follow">FOLLOW +</div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    tl.fromTo(["#o-plate", "#o-streaks"], {{ clipPath: "inset(100% 0% 0% 0%)" }}, {{ clipPath: "inset(0% 0% 0% 0%)", duration: 0.5, ease: "power3.inOut" }}, 0);
    tl.fromTo("#o-streaks", {{ x: 0 }}, {{ x: 200, duration: {OUTRO + O0:.2f}, ease: "none" }}, 0);
    tl.fromTo("#o-kicker", {{ opacity: 0, y: 30 }}, {{ opacity: 0.8, y: 0, duration: 0.5, ease: "expo.out" }}, {O0 + 0.1});
    tl.fromTo("#o-main", {{ scale: 1.4, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.5, ease: "expo.out" }}, {O0 + 0.2});
    tl.fromTo("#o-sub", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power2.out" }}, {O0 + 0.45});
    tl.fromTo("#o-follow", {{ scale: 0.4, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" }}, {O0 + 0.65});
    window.__timelines["outro"] = tl;
  </script>
</template>
"""

for name, content in [("index.html", index), ("compositions/bg.html", bg), ("compositions/intro.html", intro),
                      ("compositions/graphics.html", graphics), ("compositions/captions.html", captions),
                      ("compositions/outro.html", outro)]:
    with open(os.path.join(out, name), "w") as f:
        f.write(content)
print(json.dumps({"out": out, "duration": D, "body": body, "groups": len(groups), "cards": len(tip["cards"])}))
