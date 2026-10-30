"""Build a CUET reel in the Kallaway style (see the style guide the team shared).

usage: python3 build_kallaway.py <reel key> <words_rom.json> <media dir> <out dir>

<media dir> is an already-built cuet-reel-NN project: its presenter.webm and
voice.m4a (same segment, same pre-roll) are reused.

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
import sys

W, H = 1080, 1920
INTRO = 1.8  # hook card before the presenter speaks
CTA = 2.8  # "Comment MENTOR" end frame
PRE = 0.55  # pre-roll baked into presenter.webm by build_reel.py
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
SPLIT = rig(0.62, 540, 1440)


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
        "segment": [32.275, 55.201],
        "hook": {"pill": "CUET 2027 · TIP 6", "top": "CUT-OFF", "hero": "Course", "bottom": "KA HOTA HAI,|COLLEGE KA NAHI"},
        "fix": {"36.16": "zyadatar", "36.51": "", "37.75": "", "37.96": "cut-off", "38.1": "",
                "44.8": "ba", "45.0": "honours", "47.58": "cut-off", "47.77": "",
                "49.46": "b.com", "49.66": "", "49.95": "honours", "50.93": "cut-off", "51.12": ""},
        "stops": [34.91, 37.55, 40.09, 48.96, 52.30, 54.84],  # sentence ends get a full stop
        "beats": [
            {"t": 32.275, "mode": "full"},
            {"t": 35.05, "mode": "split", "slide": "s-title"},
            {"t": 37.75, "mode": "split", "slide": "s-premise"},
            {"t": 40.23, "mode": "full", "overlay": "o-example"},
            {"t": 43.51, "mode": "split", "slide": "s-data"},
            {"t": 52.49, "mode": "full", "overlay": "o-hero"},
        ],
        "punches": [{"t": 34.15, "until": 35.0}, {"t": 41.68, "until": 43.3}, {"t": 53.96, "until": 55.1}],
        "slides": {
            "s-title": """
        <div class="pill pill-step">TIP 6</div>
        <div class="h1">COLLEGE NAHI,</div>
        <div class="h1">COLLEGE + <span class="serif hero">Course</span></div>
        <div class="body">Ye <span class="red">simple tip</span> zyadatar log<br>ignore karte hain</div>""",
            "s-premise": """
        <div class="pill">CUT-OFF KA SACH</div>
        <div class="h1 big">CUT-OFF COLLEGE</div>
        <div class="h1 big">KA NAHI HOTA.</div>
        <div class="h1 big red reveal" id="s-premise-red">COURSE KA HOTA HAI.</div>""",
            "s-data": """
        <div class="pill">HINDU COLLEGE · 2026 ROUND 1</div>
        <div class="h1">EK COLLEGE, <span class="serif hero">alag</span> CUT-OFF</div>
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
    tl.fromTo("#s-premise-red", { opacity: 0, y: 30, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.3, ease: "expo.out" }, {T(39.27)});
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
            "o-example": {"at": 41.68, "html": '<div class="pill">EXAMPLE · HINDU COLLEGE</div>'},
            "o-hero": {"at": 53.57, "html": """<div class="sans-small">EK HI COLLEGE, LAGBHAG</div>
        <div class="serif hero hero-xl">39 marks</div>
        <div class="sans-small">KA FARAK.</div>"""},
        },
        "cta": {"top": "COMMENT", "hero": "MENTOR", "line": "CUET college list mentorship ke liye"},
    },
}

# ---------------------------------------------------------------- build
key, words_path, media_dir, out = sys.argv[1:5]
R = REELS[key]
a, b = R["segment"]
body = round(b - a, 3)
D = round(INTRO + body + CTA, 3)


def T(src):
    return round(INTRO + min(max(src, a), b) - a, 3)


for d in ["assets/fonts", "assets/vendor", "assets/sfx", "compositions"]:
    os.makedirs(os.path.join(out, d), exist_ok=True)
for f in ["presenter.webm", "voice.m4a"]:
    shutil.copy(os.path.join(media_dir, "assets", f), os.path.join(out, "assets", f))
for f in ["impact-bass-1.mp3", "whoosh-short.mp3", "pop.mp3", "click-soft.mp3"]:
    shutil.copy(os.path.join(HERE, "..", "..", ".claude", "skills", "media-use", "audio", "assets", "sfx", f), os.path.join(out, "assets", "sfx", f))
shutil.copy(os.path.join(HERE, "vendor", "gsap.min.js"), os.path.join(out, "assets", "vendor", "gsap.min.js"))
shutil.copy(os.path.join(HERE, "fonts", "InstrumentSerif-Italic.woff2"), os.path.join(out, "assets", "fonts", "InstrumentSerif-Italic.woff2"))
shutil.copy(os.path.join(HERE, "grain.png"), os.path.join(out, "assets", "grain.png"))
for f in ["hyperframes.json", "package.json"]:
    src = os.path.join(media_dir, f)
    if os.path.exists(src) and not os.path.exists(os.path.join(out, f)):
        shutil.copy(src, os.path.join(out, f))

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
# presenter leaves under the CTA
layout_js.append(f'    tl.to("#stage", {{ opacity: 0, duration: 0.35, ease: "power2.in" }}, {INTRO + body - 0.1:.3f});')

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
            <video id="presenter" class="clip" src="assets/presenter.webm" data-start="{INTRO - PRE:.3f}" data-media-start="0" data-duration="{round(body + PRE + 0.45, 3)}" data-track-index="1" muted playsinline></video>
          </div>
        </div>
      </div>
      <div id="slides" class="clip" data-composition-id="slides" data-composition-src="compositions/slides.html"
        data-start="0" data-duration="{D}" data-track-index="2" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:3"></div>
      <div id="captions" class="clip" data-composition-id="captions" data-composition-src="compositions/captions.html"
        data-start="0" data-duration="{D}" data-track-index="3" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index:4"></div>
      <div id="hook" class="clip" data-composition-id="hook" data-composition-src="compositions/hook.html"
        data-start="0" data-duration="{INTRO + 0.35:.3f}" data-track-index="4" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:5"></div>
      <div id="cta" class="clip" data-composition-id="cta" data-composition-src="compositions/cta.html"
        data-start="{INTRO + body - 0.25:.3f}" data-duration="{CTA + 0.25:.3f}" data-track-index="5" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:6"></div>
      <div id="fx" class="clip" data-composition-id="fx" data-composition-src="compositions/fx.html"
        data-start="0" data-duration="{D}" data-track-index="6" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:7"></div>

      <audio id="voice" class="clip" src="assets/voice.m4a" data-start="{INTRO}" data-duration="{body}" data-track-index="7" data-volume="1"></audio>
      <audio id="sfx-hit" class="clip" src="assets/sfx/impact-bass-1.mp3" data-start="0" data-duration="1.4" data-track-index="10" data-volume="0.35"></audio>
{sfx}
      <audio id="sfx-cta" class="clip" src="assets/sfx/impact-bass-1.mp3" data-start="{INTRO + body + 0.2:.3f}" data-duration="1.4" data-track-index="11" data-volume="0.3"></audio>
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
        o0 = T(o["at"]) - 0.05
        panels.append(f"""    <div id="{oid}" class="clip overlay" data-start="{o0:.3f}" data-duration="{t1 - o0:.3f}" data-track-index="2">
      <div id="{oid}-in" class="overlay-in">{o["html"]}
      </div>
    </div>""")
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
    .panel-in {{ position: absolute; left: 70px; right: 70px; top: 190px; bottom: 30px; display: flex; flex-direction: column;
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
    .overlay-in {{ position: absolute; left: 60px; right: 60px; top: 230px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }}
    .sans-small {{ font-family: Inter; font-weight: 900; font-size: 50px; letter-spacing: -0.01em; color: #fff; text-transform: uppercase; }}
    .hero-xl {{ font-size: 230px; line-height: 0.95; }}
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
    if not (a - 0.02 <= w["start"] < b):
        continue
    t = fix.get(round(w["start"], 2), w["text"])
    if not t:
        continue
    t = t.strip(".,?!").lower()
    if round(w["start"], 2) in stops:
        t += "."
    words.append((t, w["start"]))
cap_html, cap_js = [], []
for i, (t, s) in enumerate(words):
    t0 = T(s)
    t1 = T(words[i + 1][1]) if i + 1 < len(words) else min(T(s) + 0.6, INTRO + body)
    cap_html.append(f'    <div id="w{i}" class="w">{esc(t)}</div>')
    cap_js.append(f'    tl.fromTo("#w{i}", {{ opacity: 1, scale: 1.12 }}, {{ opacity: 1, scale: 1, duration: 0.08, ease: "power2.out", immediateRender: false }}, {t0:.3f});')
    cap_js.append(f'    tl.set("#w{i}", {{ opacity: 0 }}, {t1:.3f});')
captions = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: visible; pointer-events: none; }}
    .w {{ position: absolute; left: 0; width: 1080px; top: {CAP_Y - 40}px; text-align: center; opacity: 0;
      font-family: Inter; font-weight: 800; font-size: 64px; line-height: 80px; letter-spacing: -0.01em; color: #fff;
      -webkit-text-stroke: 12px #0E0E0E; paint-order: stroke fill; text-shadow: 0 6px 24px rgba(0,0,0,0.6); }}
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

# ---- hook card (frame 0 = thumbnail)
hk = R["hook"]
hook = f"""<template>
  <style>
    {FONT_FACE}
    #root {{ position: absolute; inset: 0; overflow: hidden; }}
    {SHARED_CSS}
    #hook-plate {{ position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 46%, #2a0b0c 0%, #121212 48%, #0B0B0B 100%); }}
    #hook-box {{ position: absolute; left: 60px; right: 60px; top: 520px; display: flex; flex-direction: column; align-items: center; text-align: center; }}
    #hook-top, #hook-bottom {{ font-family: Inter; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing: -0.02em; }}
    #hook-top {{ font-size: 120px; line-height: 1; margin-top: 46px; }}
    #hook-hero {{ font-size: 330px; line-height: 0.86; margin: 4px 0 16px; }}
    #hook-bottom {{ font-size: 58px; line-height: 1.06; max-width: 900px; }}
  </style>
  <div id="root" data-composition-id="hook" data-width="1080" data-height="1920">
    <div id="hook-plate"></div>
    <div id="hook-box">
      <div id="hook-pill" class="pill pill-step">{esc(hk["pill"])}</div>
      <div id="hook-top">{esc(hk["top"])}</div>
      <div id="hook-hero" class="serif hero">{esc(hk["hero"])}</div>
      <div id="hook-bottom">{"<br>".join(esc(x) for x in hk["bottom"].split("|"))}</div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    // readable at frame 0; the hero word settles, then everything blur-swaps into the face
    tl.fromTo("#hook-hero", {{ scale: 1.12 }}, {{ scale: 1, duration: 0.6, ease: "expo.out" }}, 0);
    tl.fromTo("#hook-top, #hook-bottom", {{ y: 18 }}, {{ y: 0, duration: 0.5, ease: "expo.out" }}, 0);
    tl.to("#hook-box", {{ opacity: 0, scale: 0.94, filter: "blur(12px)", duration: 0.24, ease: "power2.in" }}, {INTRO - 0.3:.3f});
    tl.to("#hook-plate", {{ opacity: 0, duration: 0.35, ease: "power2.inOut" }}, {INTRO - 0.2:.3f});
    window.__timelines["hook"] = tl;
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
    #cta-plate {{ position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 48%, #2a0b0c 0%, #121212 50%, #0B0B0B 100%); }}
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
    tl.fromTo("#cta-plate", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3, ease: "power2.inOut" }}, 0);
    tl.fromTo("#cta-top", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.4, ease: "expo.out" }}, 0.3);
    tl.fromTo("#cta-hero", {{ opacity: 0, scale: 1.3, filter: "blur(12px)" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }}, 0.42);
    tl.fromTo("#cta-line", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3, ease: "power2.out" }}, 0.8);
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
                      ("compositions/hook.html", hook), ("compositions/cta.html", cta), ("compositions/fx.html", fx)]:
    with open(os.path.join(out, name), "w") as f:
        f.write(content)
print(json.dumps({"out": out, "duration": D, "words": len(words)}))
