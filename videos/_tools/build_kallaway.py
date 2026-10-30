"""Build a CUET reel in the Kallaway style (see the style guide the team shared).

usage: python3 build_kallaway.py <reel key> <words_rom.json> <keyed.webm> <source.mp4> <out dir>

The reel opens on the presenter mid-sentence with the hook above his head
(no title card), and ends by holding his face through the pause after the
last word before the CTA frame settles over it.

The look: near-black grain background with a vignette, white heavy all-caps
Inter, one red italic Instrument Serif hero word per frame with a glow, red-
outlined step pills, neon green only for data. Layout alternates every 2-4 s
between a full-frame face and a split screen (slide on the top 60 %, face in a
rounded card below). Captions are one lowercase word at a time on the seam.
"""
import html
import json
import os
import shutil
import subprocess
import sys

W, H = 1080, 1920
INTRO = 0.0  # no title card: frame 0 is the face with the hook over it
HOLD = 0.35  # face held after the last word before the CTA starts
CTA = 3.0  # "Comment MENTOR" end frame
TAIL = 1.2  # footage kept after the last word, under the CTA's fade
RED, GREEN = "#E3161B", "#3DFF8A"
LEFT, TOP = -132, 664  # presenter rig box: 1320 x 1296, rig-local face centre below
FACE_X, FACE_Y = 672, 276
CARD = (1210, 70, 130, 70)  # face card inset: top right bottom left
CAP_Y = 1210  # caption baseline band: the seam between slide and face card

HERE = os.path.dirname(os.path.abspath(__file__))


def esc(s):
    return html.escape(s, quote=True)


def rig(s, cx, cy):
    """GSAP x/y/scale (origin 0 0) that put the face centre at (cx, cy) at scale s."""
    return {"x": round(cx - LEFT - s * FACE_X, 1), "y": round(cy - TOP - s * FACE_Y, 1), "scale": s}


FULL = rig(1.0, 540, 860)
SPLIT = rig(0.62, 540, 1462)
CAP_SPLIT_DY = -96  # in split view the word sits above the face card, never on his head


def punch(state, k=1.14, pivot_y=CAP_Y - 90):
    # scale about a point just above the caption, so the face grows upward and the chin never slides under the word
    s = state["scale"] * k
    cx = LEFT + state["x"] + state["scale"] * FACE_X
    cy = TOP + state["y"] + state["scale"] * FACE_Y
    return rig(round(s, 3), cx, round(pivot_y + (cy - pivot_y) * k, 1))


def js(o):
    return "{ " + ", ".join(f"{k}: {json.dumps(v)}" for k, v in o.items()) + " }"


# ---------------------------------------------------------------- reel specs
REELS = {
    "tip6-cutoff": {
        "segment": [32.45, 55.40],  # first word to the end of "farak." (silence 55.36-55.76)
        "fix": {"36.16": "zyadatar", "36.51": "", "37.75": "", "37.96": "cut-off", "38.1": "",
                "44.8": "ba", "45.0": "honours", "47.58": "cut-off", "47.77": "",
                "49.46": "b.com", "49.66": "", "49.95": "honours", "50.93": "cut-off", "51.12": "",
                "55.23": ""},  # "toh" opens the next sentence (spoken after 55.76)
        "stops": [34.91, 37.55, 40.09, 48.96, 52.30, 54.84],  # sentence ends get a full stop
        "beats": [
            {"t": 32.45, "mode": "full", "overlay": "o-hook"},
            {"t": 35.05, "mode": "split", "slide": "s-title"},
            {"t": 37.75, "mode": "split", "slide": "s-premise"},
            {"t": 40.23, "mode": "full", "overlay": "o-example"},
            {"t": 43.51, "mode": "split", "slide": "s-data"},
            {"t": 52.49, "mode": "full", "overlay": "o-hero"},
        ],
        "punches": [{"t": 34.15, "until": 35.0}, {"t": 53.96, "until": 54.7}],
        "slides": {
            "s-title": """
        <div class="pill pill-step">TIP 6</div>
        <div class="h1">NOT JUST COLLEGE,</div>
        <div class="h1">COLLEGE + <span class="serif hero">Course</span></div>
        <div class="body">A <span class="red">simple tip</span> that most<br>students ignore</div>""",
            "s-premise": """
        <div class="pill">THE CUT-OFF TRUTH</div>
        <div class="h1 big">CUT-OFF ISN'T</div>
        <div class="h1 big">PER COLLEGE.</div>
        <div class="h1 big red reveal" id="s-premise-red">IT'S PER COURSE.</div>""",
            "s-data": """
        <div class="pill">HINDU COLLEGE · 2026 ROUND 1</div>
        <div class="h1">SAME COLLEGE, <span class="serif hero">different</span> CUT-OFFS</div>
        <div class="bars">
          <div class="bar-row" id="row-a">
            <div class="bar-label">BA (H) POLITICAL SCIENCE</div>
            <div class="bar-track"><div class="bar-fill" id="bar-a"></div></div>
            <div class="bar-num" id="num-a">0.00</div>
          </div>
          <div class="bar-row" id="row-b">
            <div class="bar-label">B.COM (H)</div>
            <div class="bar-track"><div class="bar-fill" id="bar-b"></div></div>
            <div class="bar-num" id="num-b">0.00</div>
          </div>
          <div class="bar-axis"><span>0</span><span>1000</span></div>
        </div>""",
        },
        # slide-local animation, times in source seconds; {T(x)} is replaced with reel time
        "slide_js": """
    tl.fromTo("#bld [pathLength]", { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, stagger: 0.04, ease: "power2.out" }, {T(41.5)});
    tl.fromTo("#s-premise-red", { opacity: 0, y: 30, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.3, ease: "expo.out" }, {T(39.27)});
    tl.set("#row-a, #row-b", { opacity: 0 }, {T(43.4)});
    tl.fromTo("#row-a", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.4, ease: "expo.out" }, {T(44.8)});
    tl.fromTo("#bar-a", { scaleX: 0 }, { scaleX: 0.9587, duration: 1.4, ease: "power3.out" }, {T(47.2)});
    tl.fromTo(numA, { v: 0 }, { v: 958.71, duration: 1.4, ease: "power3.out", onUpdate: () => { elA.textContent = numA.v.toFixed(2); } }, {T(47.2)});
    tl.fromTo("#row-b", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.4, ease: "expo.out" }, {T(49.46)});
    tl.fromTo("#bar-b", { scaleX: 0 }, { scaleX: 0.9199, duration: 1.4, ease: "power3.out" }, {T(50.6)});
    tl.fromTo(numB, { v: 0 }, { v: 919.87, duration: 1.4, ease: "power3.out", onUpdate: () => { elB.textContent = numB.v.toFixed(2); } }, {T(50.6)});""",
        "slide_js_head": """
    const numA = { v: 0 }, numB = { v: 0 };
    const elA = document.querySelector("#num-a"), elB = document.querySelector("#num-b");""",
        "overlays": {
            "o-hook": {"at": 32.45, "static": True, "html": """<div class="pill pill-step">CUET 2027 · TIP 6</div>
        <div class="sans-small">CUT-OFF DEPENDS ON THE</div>
        <div class="serif hero hero-l">Course</div>
        <div class="sans-small">NOT THE COLLEGE</div>"""},
            "o-example": {"at": 41.4, "html": """<svg id="bld" class="bld" viewBox="0 0 400 230" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
          <path pathLength="1" d="M40 78 L200 18 L360 78 Z" />
          <path pathLength="1" d="M168 62 a32 32 0 0 1 64 0" stroke="#E3161B" />
          <rect pathLength="1" x="40" y="78" width="320" height="18" />
          <line pathLength="1" x1="70" y1="96" x2="70" y2="186" /><line pathLength="1" x1="122" y1="96" x2="122" y2="186" />
          <line pathLength="1" x1="174" y1="96" x2="174" y2="186" /><line pathLength="1" x1="226" y1="96" x2="226" y2="186" />
          <line pathLength="1" x1="278" y1="96" x2="278" y2="186" /><line pathLength="1" x1="330" y1="96" x2="330" y2="186" />
          <path pathLength="1" d="M185 186 V146 a15 15 0 0 1 30 0 V186" stroke="#E3161B" />
          <rect pathLength="1" x="28" y="186" width="344" height="14" /><rect pathLength="1" x="12" y="200" width="376" height="16" />
        </svg>
        <div class="sans-mid bld-name">HINDU COLLEGE</div>
        <div class="bld-sub">UNIVERSITY OF DELHI</div>"""},
            "o-hero": {"at": 53.57, "html": """<div class="sans-small">SAME COLLEGE, NEARLY</div>
        <div class="serif hero hero-xl">39 marks</div>
        <div class="sans-small">APART.</div>"""},
        },
        "cta": {"top": "COMMENT", "hero": "MENTOR", "line": "for 1:1 help with your CUET college list"},
    },
}

# ---------------------------------------------------------------- build
key, words_path, keyed, source, out = sys.argv[1:6]
R = REELS[key]
a, b = R["segment"]
body = round(b - a, 3)
D = round(INTRO + body + HOLD + CTA, 3)


def T(src):
    return round(INTRO + min(max(src, a), b) - a, 3)


for d in ["assets/fonts", "assets/vendor", "assets/sfx", "compositions"]:
    os.makedirs(os.path.join(out, d), exist_ok=True)
pres, voice = os.path.join(out, "assets", "presenter.webm"), os.path.join(out, "assets", "voice.m4a")
seg_key = os.path.join(out, "assets", ".segment")
if not (os.path.exists(seg_key) and open(seg_key).read() == f"{a} {b}"):
    # key straight from the 1080p source at the rig's final size: light denoise, Lanczos upscale and a
    # gentle sharpen before the key, then a high-quality encode, so the face stays crisp on a phone
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-t", f"{body + TAIL:.3f}", "-i", source,
                            "-vf", "crop=1100:1080:280:0,hqdn3d=1.2:1.2:4:4,scale=1320:1296:flags=lanczos,"
                                   "unsharp=5:5:0.7:5:5:0,fps=30",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    key = subprocess.Popen(["python3", "-I", os.path.join(HERE, "greenkey.py"), "1320", "1296", "48", "92"],
                           stdin=dec.stdout, stdout=subprocess.PIPE)
    dec.stdout.close()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "1320x1296", "-r", "30", "-i", "-",
                    "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-crf", "18", "-b:v", "0", "-row-mt", "1",
                    "-cpu-used", "2", "-g", "30", "-auto-alt-ref", "0", "-an", pres], stdin=key.stdout, check=True)
    key.stdout.close()
    assert dec.wait() == 0 and key.wait() == 0
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-t", f"{body + 0.3:.3f}", "-i", source, "-vn",
                    "-af", f"afade=t=in:d=0.03,afade=t=out:st={body:.3f}:d=0.3,loudnorm=I=-14:TP=-1.5:LRA=9",
                    "-ar", "48000", "-c:a", "aac", "-b:a", "192k", voice], check=True)
    open(seg_key, "w").write(f"{a} {b}")
for f in ["impact-bass-1.mp3", "whoosh-short.mp3", "whoosh-cinematic.mp3", "pop.mp3", "click-soft.mp3"]:
    shutil.copy(os.path.join(HERE, "..", "..", ".claude", "skills", "media-use", "audio", "assets", "sfx", f), os.path.join(out, "assets", "sfx", f))
shutil.copy(os.path.join(HERE, "vendor", "gsap.min.js"), os.path.join(out, "assets", "vendor", "gsap.min.js"))
shutil.copy(os.path.join(HERE, "fonts", "InstrumentSerif-Italic.woff2"), os.path.join(out, "assets", "fonts", "InstrumentSerif-Italic.woff2"))
shutil.copy(os.path.join(HERE, "grain.png"), os.path.join(out, "assets", "grain.png"))

FONT_FACE = """@font-face { font-family: "Instrument Serif"; font-style: italic; font-weight: 400; src: url("assets/fonts/InstrumentSerif-Italic.woff2") format("woff2"); }"""
SHARED_CSS = f"""
    .pill {{ display: inline-block; padding: 14px 30px; border-radius: 60px; background: #1c1c1c; border: 2px solid rgba(255,255,255,0.16);
      font-family: Inter; font-weight: 600; font-size: 30px; letter-spacing: 0.14em; color: #fff; }}
    .pill-step {{ background: rgba(227,22,27,0.08); border-color: {RED}; color: #fff; }}
    .serif {{ font-family: "Instrument Serif"; font-style: italic; font-weight: 400; text-transform: none; letter-spacing: -0.01em; }}
    .hero {{ color: {RED}; text-shadow: 0 0 28px rgba(227,22,27,0.75), 0 0 70px rgba(227,22,27,0.45); }}
    .red {{ color: {RED}; }}
"""

# ---- index.html: stage (presenter, face card, background), scene hosts, audio
layout_js = []
state = None
for i, bt in enumerate(R["beats"]):
    t = T(bt["t"])
    st = FULL if bt["mode"] == "full" else SPLIT
    clip = "inset(0px 0px 0px 0px round 0px)" if bt["mode"] == "full" else "inset(%dpx %dpx %dpx %dpx round 44px)" % CARD
    if i == 0:
        layout_js.append(f'    tl.set("#rig", {js(st)}, 0);')
        layout_js.append(f'    tl.set("#mask", {{ clipPath: "{clip}" }}, 0);')
    else:
        layout_js.append(f'    tl.to("#rig", {{ ...{js(st)}, duration: 0.42, ease: "power3.inOut" }}, {t - 0.21:.3f});')
        layout_js.append(f'    tl.to("#mask", {{ clipPath: "{clip}", duration: 0.42, ease: "power3.inOut" }}, {t - 0.21:.3f});')
        layout_js.append(f'    tl.to("#face-card", {{ opacity: {1 if bt["mode"] == "split" else 0}, duration: 0.3, ease: "power2.inOut" }}, {t - 0.21:.3f});')
        layout_js.append(f'    tl.to("#full-glow", {{ opacity: {0 if bt["mode"] == "split" else 1}, duration: 0.4, ease: "power2.inOut" }}, {t - 0.21:.3f});')
    for p in R["punches"]:
        if bt["t"] <= p["t"] < (R["beats"][i + 1]["t"] if i + 1 < len(R["beats"]) else b):
            layout_js.append(f'    tl.to("#rig", {{ ...{js(punch(st))}, duration: 0.25, ease: "power3.out" }}, {T(p["t"]):.3f});')
            layout_js.append(f'    tl.to("#rig", {{ ...{js(st)}, duration: 0.4, ease: "power2.inOut" }}, {min(T(p["until"]), T(R["beats"][i + 1]["t"]) - 0.5 if i + 1 < len(R["beats"]) else T(p["until"])):.3f});')
# hold the face through the pause, then a slow push while the CTA settles over it
END = INTRO + body
layout_js.append(f'    tl.to("#rig", {{ ...{js(rig(1.08, 540, 860))}, duration: {HOLD + 1.0:.2f}, ease: "power2.inOut" }}, {END - 0.2:.3f});')

whooshes = [T(bt["t"]) - 0.25 for bt in R["beats"][1:]]
sfx = "\n".join(
    f'      <audio id="sfx-sw-{i}" class="clip" src="assets/sfx/whoosh-short.mp3" data-start="{t:.3f}" data-duration="0.57" data-track-index="{8 + i % 2}" data-volume="0.16"></audio>'
    for i, t in enumerate(whooshes))

index = f"""<!doctype html>
<html lang="hi" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      {FONT_FACE}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #0E0E0E; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #0E0E0E; overflow: hidden; }}
      #stage {{ position: absolute; inset: 0; z-index: 2; }}
      #full-glow {{ position: absolute; left: -260px; top: 360px; width: 1600px; height: 1300px;
        background: radial-gradient(ellipse at 50% 45%, rgba(227,22,27,0.30) 0%, rgba(227,22,27,0.08) 38%, rgba(227,22,27,0) 62%); }}
      #face-card {{ position: absolute; left: {CARD[3]}px; top: {CARD[0]}px; width: {W - CARD[1] - CARD[3]}px; height: {H - CARD[0] - CARD[2]}px;
        border-radius: 44px; background: radial-gradient(ellipse at 50% 70%, rgba(227,22,27,0.38) 0%, rgba(30,10,10,1) 55%, #151515 100%);
        border: 2px solid rgba(255,255,255,0.14); opacity: {1 if R["beats"][0]["mode"] == "split" else 0}; }}
      #mask {{ position: absolute; inset: 0; }}
      #rig {{ position: absolute; left: {LEFT}px; top: {TOP}px; width: 1320px; height: 1296px; transform-origin: 0 0; }}
      #presenter {{ position: absolute; left: 0; top: 0; width: 1320px; height: 1296px; object-fit: contain; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="1080" data-height="1920">
      <div id="stage">
        <div id="full-glow" data-layout-ignore></div>
        <div id="face-card" data-layout-ignore></div>
        <div id="mask">
          <div id="rig">
            <video id="presenter" class="clip" src="assets/presenter.webm" data-start="{INTRO:.3f}" data-media-start="0" data-duration="{round(body + TAIL, 3)}" data-track-index="1" muted playsinline></video>
          </div>
        </div>
      </div>
      <div id="slides" class="clip" data-composition-id="slides" data-composition-src="compositions/slides.html"
        data-start="0" data-duration="{D}" data-track-index="2" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:3"></div>
      <div id="captions" class="clip" data-composition-id="captions" data-composition-src="compositions/captions.html"
        data-start="0" data-duration="{D}" data-track-index="3" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index:4"></div>
      <div id="cta" class="clip" data-composition-id="cta" data-composition-src="compositions/cta.html"
        data-start="{INTRO + body + HOLD:.3f}" data-duration="{CTA:.3f}" data-track-index="5" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:6"></div>
      <div id="fx" class="clip" data-composition-id="fx" data-composition-src="compositions/fx.html"
        data-start="0" data-duration="{D}" data-track-index="6" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:7"></div>

      <audio id="voice" class="clip" src="assets/voice.m4a" data-start="{INTRO}" data-duration="{round(body + 0.3, 3)}" data-track-index="7" data-volume="1"></audio>
      <audio id="sfx-cta-in" class="clip" src="assets/sfx/whoosh-cinematic.mp3" data-start="{INTRO + body + HOLD - 0.35:.3f}" data-duration="1.2" data-track-index="12" data-volume="0.3"></audio>
{sfx}
      <audio id="sfx-cta" class="clip" src="assets/sfx/impact-bass-1.mp3" data-start="{INTRO + body + HOLD + 0.45:.3f}" data-duration="1.4" data-track-index="11" data-volume="0.38"></audio>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(layout_js)}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""

# ---- slides: split-screen panels (top 60 %) and full-frame overlays
panels, pjs = [], []
beats = R["beats"]
for i, bt in enumerate(beats):
    end = beats[i + 1]["t"] if i + 1 < len(beats) else b
    t0, t1 = T(bt["t"]) - 0.1, T(end) + 0.05
    if "slide" in bt:
        sid = bt["slide"]
        panels.append(f"""    <div id="{sid}" class="clip panel" data-start="{t0:.3f}" data-duration="{t1 - t0:.3f}" data-track-index="{i % 2}">
      <div class="dots" data-layout-ignore></div>
      <div id="{sid}-in" class="panel-in">{R["slides"][sid]}
      </div>
    </div>""")
        pjs.append(f'    tl.fromTo("#{sid}-in > *:not(.reveal)", {{ opacity: 0, y: 26, filter: "blur(8px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.32, stagger: 0.07, ease: "expo.out" }}, {t0 + 0.05:.3f});')
        pjs.append(f'    tl.to("#{sid}-in", {{ opacity: 0, filter: "blur(10px)", duration: 0.18, ease: "power2.in" }}, {t1 - 0.2:.3f});')
    if "overlay" in bt:
        oid = bt["overlay"]
        o = R["overlays"][oid]
        o0 = max(T(o["at"]) - 0.05, 0)
        panels.append(f"""    <div id="{oid}" class="clip overlay" data-start="{o0:.3f}" data-duration="{t1 - o0:.3f}" data-track-index="2">
      <div id="{oid}-in" class="overlay-in">{o["html"]}
      </div>
    </div>""")
        if o.get("static"):
            # on screen from frame 0 (the thumbnail): only the hero word settles
            pjs.append(f'    tl.fromTo("#{oid}-in .hero", {{ scale: 1.1 }}, {{ scale: 1, duration: 0.6, ease: "expo.out" }}, {max(o0, 0):.3f});')
        else:
            pjs.append(f'    tl.fromTo("#{oid}-in > *", {{ opacity: 0, scale: 1.25, filter: "blur(10px)" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.35, stagger: 0.08, ease: "expo.out" }}, {o0 + 0.05:.3f});')
        pjs.append(f'    tl.to("#{oid}-in", {{ opacity: 0, filter: "blur(10px)", duration: 0.18, ease: "power2.in" }}, {t1 - 0.2:.3f});')

slide_js = R.get("slide_js", "")
for src in sorted({float(x) for x in __import__("re").findall(r"\{T\(([\d.]+)\)\}", slide_js)}):
    slide_js = slide_js.replace("{T(%s)}" % ("%g" % src), "%.3f" % T(src))

slides = f"""<template>
  <style>
    {FONT_FACE}
    #root {{ position: absolute; inset: 0; overflow: hidden; pointer-events: none; }}
    {SHARED_CSS}
    .panel {{ position: absolute; left: 0; top: 0; width: 1080px; height: {CARD[0] - 40}px; }}
    .panel-in {{ position: absolute; left: 70px; right: 70px; top: 190px; bottom: 120px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center; gap: 26px; }}
    .dots {{ position: absolute; inset: 0;
      background-image: radial-gradient(rgba(255,255,255,0.10) 2px, transparent 2.5px); background-size: 30px 30px;
      -webkit-mask-image: linear-gradient(#000 40%, transparent 100%); mask-image: linear-gradient(#000 40%, transparent 100%); }}
    .h1 {{ font-family: Inter; font-weight: 900; font-size: 92px; line-height: 0.98; letter-spacing: -0.02em; color: #fff; text-transform: uppercase; }}
    .h1.big {{ font-size: 80px; white-space: nowrap; }}
    .h1.red {{ color: {RED}; }}
    .h1 .serif {{ font-size: 1.32em; line-height: 0.8; }}
    .body {{ font-family: Inter; font-weight: 500; font-size: 42px; line-height: 1.3; color: rgba(255,255,255,0.86); max-width: 860px; }}
    .bars {{ width: 940px; margin-top: 36px; display: flex; flex-direction: column; gap: 34px; }}
    .bar-row {{ display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; column-gap: 24px; row-gap: 12px; text-align: left; }}
    .bar-label {{ grid-column: 1 / 3; font-family: Inter; font-weight: 700; font-size: 30px; letter-spacing: 0.06em; color: rgba(255,255,255,0.8); }}
    .bar-track {{ height: 46px; border-radius: 12px; background: rgba(255,255,255,0.08); overflow: hidden; }}
    .bar-fill {{ height: 100%; width: 100%; border-radius: 12px; background: {GREEN}; transform-origin: 0 50%; box-shadow: 0 0 24px rgba(61,255,138,0.5); }}
    .bar-num {{ font-family: Inter; font-weight: 900; font-size: 56px; line-height: 46px; color: {GREEN}; min-width: 230px; text-align: right;
      font-variant-numeric: tabular-nums; }}
    .bar-axis {{ display: flex; justify-content: space-between; width: 690px; font-family: Inter; font-weight: 600; font-size: 28px; color: rgba(255,255,255,0.5); }}
    .overlay {{ position: absolute; left: 0; top: 0; width: 1080px; height: 700px; }}
    .overlay-in {{ position: absolute; left: 60px; right: 60px; top: 196px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }}
    .sans-small {{ font-family: Inter; font-weight: 900; font-size: 44px; letter-spacing: -0.01em; color: #fff; text-transform: uppercase; }}
    .hero-xl {{ font-size: 190px; line-height: 0.95; }}
    .hero-l {{ font-size: 170px; line-height: 0.86; margin: -6px 0 4px; }}
    .bld {{ width: 270px; height: 156px; margin: 0 0 4px; filter: drop-shadow(0 0 14px rgba(227,22,27,0.55)); }}
    .bld-name {{ font-size: 64px; margin-top: 6px; }}
    .bld-sub {{ font-family: Inter; font-weight: 600; font-size: 28px; letter-spacing: 0.24em; color: rgba(255,255,255,0.6); }}
    .sans-mid {{ font-family: Inter; font-weight: 900; font-size: 80px; line-height: 1; letter-spacing: -0.02em; color: #fff; margin-top: 14px; }}
  </style>
  <div id="root" data-composition-id="slides" data-width="1080" data-height="1920">
{chr(10).join(panels)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
{R.get("slide_js_head", "")}
{chr(10).join(pjs)}
{slide_js}
    window.__timelines["slides"] = tl;
  </script>
</template>
"""

# ---- captions: one lowercase word at a time, full stop at sentence ends
all_words = json.load(open(words_path))
fix = {float(k): v for k, v in R.get("fix", {}).items()}
stops = {round(x, 2) for x in R.get("stops", [])}
words = []
for w in all_words:
    if not (a - 0.15 <= w["start"] < b):  # whisper starts the first word a little early
        continue
    t = fix.get(round(w["start"], 2), w["text"])
    if not t:
        continue
    t = t.strip(".,?!").lower()
    if round(w["start"], 2) in stops:
        t += "."
    words.append((t, w["start"]))
cap_html, cap_js = [], []
# the caption band follows the layout: on the seam in full view, lifted above the card in split view,
# moving with the same 0.42 s ease as the face so the two never cross
for i, bt in enumerate(R["beats"]):
    dy = CAP_SPLIT_DY if bt["mode"] == "split" else 0
    if i == 0:
        cap_js.append(f'    tl.set("#cap-band", {{ y: {dy} }}, 0);')
    else:
        # duck the word while the face travels between layouts, bring it back once he has landed
        t = T(bt["t"])
        cap_js.append(f'    tl.to("#cap-band", {{ opacity: 0, duration: 0.07, ease: "power1.in" }}, {t - 0.24:.3f});')
        cap_js.append(f'    tl.set("#cap-band", {{ y: {dy} }}, {t - 0.16:.3f});')
        cap_js.append(f'    tl.to("#cap-band", {{ opacity: 1, duration: 0.08, ease: "power1.out" }}, {t + 0.2:.3f});')
for i, (t, s) in enumerate(words):
    t0 = T(s)
    t1 = T(words[i + 1][1]) if i + 1 < len(words) else min(T(s) + 0.6, INTRO + body)
    cap_html.append(f'    <div id="w{i}" class="w">{esc(t)}</div>')
    cap_js.append(f'    tl.fromTo("#w{i}", {{ opacity: 1, scale: 1.12 }}, {{ opacity: 1, scale: 1, duration: 0.08, ease: "power2.out", immediateRender: false }}, {t0:.3f});')
    cap_js.append(f'    tl.set("#w{i}", {{ opacity: 0 }}, {t1:.3f});')
captions = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: visible; pointer-events: none; }}
    #cap-band {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }}
    .w {{ position: absolute; left: 0; width: 1080px; top: {CAP_Y - 40}px; text-align: center; opacity: 0;
      font-family: Inter; font-weight: 800; font-size: 64px; line-height: 80px; letter-spacing: -0.01em; color: #fff;
      -webkit-text-stroke: 12px #0E0E0E; paint-order: stroke fill; text-shadow: 0 6px 24px rgba(0,0,0,0.6); }}
  </style>
  <div id="root" data-composition-id="captions" data-width="1080" data-height="1920" data-layout-allow-overlap>
    <div id="cap-band">
{chr(10).join(cap_html)}
    </div>
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
{chr(10).join(cap_js)}
    window.__timelines["captions"] = tl;
  </script>
</template>
"""

# ---- CTA
c = R["cta"]
cta = f"""<template>
  <style>
    {FONT_FACE}
    #root {{ position: absolute; inset: 0; overflow: hidden; }}
    {SHARED_CSS}
    #cta-plate {{ position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 48%, rgba(42,11,12,0.94) 0%, rgba(18,18,18,0.9) 50%, rgba(11,11,11,0.96) 100%); }}
    #cta-box {{ position: absolute; left: 60px; right: 60px; top: 600px; display: flex; flex-direction: column; align-items: center; text-align: center; }}
    #cta-top {{ font-family: Inter; font-weight: 900; font-size: 96px; letter-spacing: -0.02em; color: #fff; }}
    #cta-hero {{ font-size: 290px; line-height: 0.9; }}
    #cta-line {{ font-family: Inter; font-weight: 500; font-size: 40px; color: rgba(255,255,255,0.85); margin-top: 24px; }}
  </style>
  <div id="root" data-composition-id="cta" data-width="1080" data-height="1920">
    <div id="cta-plate"></div>
    <div id="cta-box">
      <div id="cta-top">{esc(c["top"])}</div>
      <div id="cta-hero" class="serif hero">{esc(c["hero"])}</div>
      <div id="cta-line">{esc(c["line"])}</div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    // the face dims behind the plate rather than cutting away
    tl.fromTo("#cta-plate", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6, ease: "power2.inOut" }}, 0);
    tl.fromTo("#cta-top", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }}, 0.3);
    tl.fromTo("#cta-hero", {{ opacity: 0, scale: 1.3, filter: "blur(12px)" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "expo.out" }}, 0.45);
    tl.fromTo("#cta-line", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.35, ease: "power2.out" }}, 0.85);
    window.__timelines["cta"] = tl;
  </script>
</template>
"""

# ---- fx: grain (stepped, seeded), vignette, signature
steps = []
seed = 12345
for k in range(int(D * 15)):
    seed = (seed * 1103515245 + 12345) % 2147483648
    gx = seed % 256
    seed = (seed * 1103515245 + 12345) % 2147483648
    gy = seed % 256
    steps.append(f"tl.set('#fx-grain', {{ backgroundPosition: '{gx}px {gy}px' }}, {k / 15:.3f});")
fx = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: hidden; pointer-events: none; }}
    #fx-grain {{ position: absolute; inset: 0; background-image: url("assets/grain.png"); background-size: 256px 256px;
      opacity: 0.10; mix-blend-mode: overlay; }}
    #fx-vignette {{ position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.62) 100%); }}
    #fx-logo {{ position: absolute; left: 0; right: 0; top: 1822px; text-align: center; font-family: Inter; font-weight: 700;
      font-size: 22px; letter-spacing: 0.32em; color: rgba(255,255,255,0.55); }}
  </style>
  <div id="root" data-composition-id="fx" data-width="1080" data-height="1920">
    <div id="fx-grain" data-layout-ignore></div>
    <div id="fx-vignette" data-layout-ignore></div>
    <div id="fx-logo" data-layout-ignore>EVERYTHING CUET</div>
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    {" ".join(steps)}
    window.__timelines["fx"] = tl;
  </script>
</template>
"""

for name, content in [("index.html", index), ("compositions/slides.html", slides), ("compositions/captions.html", captions),
                      ("compositions/cta.html", cta), ("compositions/fx.html", fx)]:
    with open(os.path.join(out, name), "w") as f:
        f.write(content)
# presenter grade (lifted blacks down, cleaner whites, pink shirt cast and green edge fringe neutralised),
# persisted through HyperFrames' own media-treatment so the shader owns it, not CSS filters
subprocess.run(["npx", "hyperframes", "media-treatment", "--project", out, "--selector", "#presenter",
                "--grading", os.path.join(HERE, "presenter-grade.json"), "--apply", "--json"],
               check=True, stdout=subprocess.DEVNULL)
print(json.dumps({"out": out, "duration": D, "words": len(words)}))
