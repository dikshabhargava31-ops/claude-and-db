"""Write reels.json: the ten CUET shorts cut from "CUET 10 TIPS 2ND PART".

Each reel is one complete thought from the source, so it makes sense on its own.
Segments are given as (first word start, last word start) in source seconds and
resolved to cut points from the transcript's word timings.

usage: python3 make_reels.py <words_rom.json> <out reels.json>
"""
import json
import os
import sys

words = json.load(open(sys.argv[1]))
by_start = {round(w["start"], 2): w for w in words}


def seg(first, last):
    w0, w1 = by_start[first], by_start[last]
    nxt = [w["start"] for w in words if w["start"] > w1["start"] + 0.01]
    end = min(w1["end"] + 0.18, (nxt[0] - 0.03) if nxt else w1["end"] + 0.18)
    return [round(max(0, w0["start"] - 0.06), 3), round(end, 3)]


def card(t, text, sub=None, icon="check", tone="accent", until=None, side=None):
    c = {"t": t, "text": text, "icon": icon, "tone": tone}
    if sub:
        c["sub"] = sub
    if until:
        c["until"] = until
    if side:
        c["side"] = side
    return c


CUTOFF = {"37.96": "cut-off", "38.1": "", "47.58": "cut-off", "47.77": "", "50.93": "cut-off", "51.12": ""}

reels = [
    {
        "n": 1, "badge": "MUST KNOW", "bignum": "!", "chip": "COLLEGE LIST",
        "headline": ["List", "mein", "naam", "nahi?", "*Seat*", "nahi"],
        "title": ["College", "*list*", "=", "aapki", "*seat*"],
        "tease": "Sabse important baat",
        "segments": [seg(210.75, 215.10), seg(22.97, 30.54), seg(262.30, 265.19)],
        "hi": ["important", "galti", "seat", "naam", "mehnat"],
        "fix": {"262.3": "Aur", "26.1": "counselling"},
        "cards": [
            card(211.06, "College list", "sabse important, sabse ignored", "list"),
            card(26.10, "Counselling preference", "result ke baad asli test", "target", "blue"),
            card(28.63, "1 galti = mehnat pe paani", None, "alert", "bad"),
            card(263.04, "Naam nahi = Seat nahi", None, "cross", "bad"),
        ],
        "punches": [{"t": 28.49, "until": 30.4}],
    },
    {
        "n": 2, "badge": "TIP 6", "chip": "COLLEGE + COURSE",
        "headline": ["Cut-off", "*course*", "ka", "hota", "hai"],
        "title": ["College", "nahi,", "*College", "*+", "*Course"],
        "tease": "Cut-off college ka nahi, course ka",
        "segments": [seg(32.34, 54.84)],
        "hi": ["course", "cut-off", "958.71", "919.87", "39"],
        "fix": dict(CUTOFF, **{"44.8": "BA", "45.0": "Honours", "49.46": "B.Com", "49.66": "", "49.95": "Honours",
                               "36.16": "zyadatar", "36.51": "", "35.05": "Chhatha"}),
        "cards": [
            card(34.15, "College + Course", "dono ka pair chuno", "college"),
            card(38.24, "Cut-off course ka hota hai", "college ka nahi", "alert", "bad"),
            card(45.59, "BA (H) Political Science", "Hindu College: 958.71", "chart", "blue"),
            card(49.46, "B.Com (H)", "Hindu College: 919.87", "chart", "blue"),
            card(53.57, "~39 marks ka farak", "same college!", "star"),
        ],
        "punches": [{"t": 38.24, "until": 40.0}, {"t": 53.57, "until": 55.0}],
    },
    {
        "n": 3, "badge": "TIP 6", "chip": "PEHLE COURSE",
        "headline": ["Pehle", "*course*", "phir", "college"],
        "title": ["Pehle", "*course,*", "phir", "college"],
        "tease": "Pehle course, phir college",
        "segments": [seg(58.08, 67.65)],
        "hi": ["pair", "course", "pehle", "teen"],
        "fix": {"58.08": "Har", "67.37": "lambe"},
        "cards": [
            card(58.78, "Har entry = ek pair", "College + Course", "list"),
            card(61.24, "Pehle course, phir college", "isi order mein", "check", "good"),
            card(63.92, "Famous college, galat course?", "3 saal bahut lambe lagenge", "alert", "bad"),
        ],
        "punches": [{"t": 66.66, "until": 67.7}],
    },
    {
        "n": 4, "badge": "TIP 7", "chip": "DU KE BAHAR",
        "headline": ["DU", "ke", "*bahar*", "bhi", "duniya", "hai"],
        "title": ["DU", "ke", "*bahar*", "bhi", "duniya"],
        "tease": "DU ke bahar bhi duniya hai",
        "segments": [seg(69.10, 91.74)],
        "hi": ["du", "jnu", "jamia", "bhu", "amu", "nirf", "central"],
        "fix": {"71.66": "Saatva"},
        "cards": [
            card(75.90, "NIRF 2025", "University Ranking", "chart", "blue"),
            card(78.46, "#2  JNU", "NIRF 2025", "star"),
            card(79.90, "#4  Jamia Millia Islamia", "NIRF 2025", "star"),
            card(82.70, "#5  Delhi University", "NIRF 2025", "star"),
            card(85.18, "#6  BHU", "NIRF 2025", "star"),
            card(86.54, "#10  AMU", "NIRF 2025", "star"),
            card(88.22, "Sab Central Universities", "CUET se UG admission", "college", "good"),
        ],
        "punches": [{"t": 73.90, "until": 75.6}],
    },
    {
        "n": 5, "badge": "TIP 8", "chip": "SAFE TIER",
        "headline": ["Safe", "ka", "matlab", "*kharab*", "nahi"],
        "title": ["Safe", "=", "*kharab*", "nahi"],
        "tease": "Safe ka matlab kharab nahi",
        "segments": [seg(92.06, 121.11), seg(125.03, 130.48)],
        "hi": ["safe", "backup", "saal", "cuet", "b.tech"],
        "fix": {"98.16": "Aathva", "125.03": "Ek", "129.0": "CUET", "128.38": "B.Tech"},
        "cards": [
            card(100.06, "Safe tier = sirf backup?", "halke mein mat lo", "alert", "bad"),
            card(108.06, "Yahi tier saal bachata hai", None, "star", "good"),
            card(112.78, "Central University of Rajasthan", "Bandarsindri, Ajmer", "college", "blue"),
            card(115.77, "Fully funded", "Central University", "check", "good"),
            card(119.22, "UG admission: CUET score", None, "check"),
            card(125.28, "CU Raj B.Tech: CUET UG se nahi", None, "alert", "bad"),
        ],
        "punches": [{"t": 108.06, "until": 111.4}],
    },
    {
        "n": 6, "badge": "TIP 8", "chip": "48 CENTRAL UNIS",
        "headline": ["*48*", "central", "universities"],
        "title": ["*48*", "Central", "Universities"],
        "tease": "48 central universities",
        "segments": [seg(131.10, 141.46)],
        "hi": ["48", "state", "safe", "private", "fees", "placement"],
        "fix": {"131.1": "NTA", "138.36": "ka"},
        "cards": [
            card(131.97, "48 Central Universities", "NTA ki list mein", "college", "blue"),
            card(133.66, "Apne state wali", "safe tier mein zaroor rakho", "target", "good"),
            card(136.88, "Private universities bhi", "CUET score leti hain", "check"),
            card(139.37, "Fees + placement", "khud check karo", "alert", "bad"),
        ],
        "punches": [{"t": 133.66, "until": 135.5}],
    },
    {
        "n": 7, "badge": "TIP 9", "chip": "ALAG REGISTRATION",
        "headline": ["Har", "university", "ka", "*alag*", "darwaza"],
        "title": ["Har", "university", "ka", "*alag*", "darwaza"],
        "tease": "Har university ka alag darwaza",
        "segments": [seg(143.20, 173.83)],
        "hi": ["alag", "seat", "registration", "csas", "date", "miss"],
        "fix": {"143.2": "Tip", "143.69": "9,", "145.98": "Nauvan", "150.85": "1", "151.82": "2", "160.05": "", "160.1": ""},
        "cards": [
            card(147.51, "Ye galti seat le jaati hai", None, "alert", "bad"),
            card(149.46, "Step 1: CUET do", None, "check"),
            card(151.19, "Step 2: har portal pe registration", "alag se", "list", "blue"),
            card(156.26, "DU: CSAS portal", None, "college", "blue"),
            card(158.14, "CU Raj: apna portal", None, "college", "blue"),
            card(164.33, "Registration miss?", "list mein aaoge hi nahi", "cross", "bad"),
            card(170.90, "Har university ki registration date", "list ke saath dekho", "clock"),
        ],
        "punches": [{"t": 164.33, "until": 166.4}],
    },
    {
        "n": 8, "badge": "TIP 10", "chip": "LIST 2 BAAR",
        "headline": ["List", "*do*", "baar", "banti", "hai"],
        "title": ["List", "*do*", "baar", "banao"],
        "tease": "List ek baar nahi, do baar",
        "segments": [seg(174.55, 206.05)],
        "hi": ["do", "checkpoint", "points", "result", "tiers", "update"],
        "fix": {"174.55": "Tip", "189.82": "doosra"},
        "cards": [
            card(175.72, "List x 2", "ek baar nahi, do baar", "list"),
            card(183.44, "2 checkpoints", None, "target", "blue"),
            card(184.45, "Checkpoint 1: CUET form se pehle", "subjects + universities", "check", "blue"),
            card(189.82, "Checkpoint 2: result ke baad", "counselling preferences", "check", "good"),
            card(195.56, "Tiers dobara banao", "asli score ke saath", "star"),
            card(201.81, "Har mahine update", "mock average ke saath", "clock", "blue"),
        ],
        "punches": [{"t": 195.56, "until": 197.6}],
    },
    {
        "n": 9, "badge": "RECAP", "bignum": "1-5", "chip": "CUET FORM SE PEHLE",
        "headline": ["*5*", "rules", "CUET", "form", "se", "pehle"],
        "title": ["Form", "se", "pehle:", "*5*", "rules"],
        "tease": "CUET form se pehle 5 rules",
        "segments": [seg(217.36, 239.29)],
        "hi": ["copy", "asli", "dream", "target", "safe", "data", "match"],
        "fix": {"217.36": "List", "221.91": "ki"},
        "cards": [
            card(221.18, "1. Crowd ki list copy mat karo", None, "cross", "bad"),
            card(223.44, "2. Asli score pe planning", "best case pe nahi", "target", "blue"),
            card(227.14, "3. Dream, target, safe list", "ready rakho", "list"),
            card(230.78, "4. Data pe bharosa", "reels pe nahi", "chart", "blue"),
            card(234.04, "5. Form ko list se match karo", "subject mapping", "check", "good"),
        ],
        "punches": [{"t": 230.78, "until": 232.6}],
    },
    {
        "n": 10, "badge": "RECAP", "bignum": "6-10", "chip": "RESULT KE BAAD",
        "headline": ["*5*", "rules", "result", "ke", "baad"],
        "title": ["Result", "ke", "baad:", "*5*", "rules"],
        "tease": "Result ke baad 5 rules",
        "segments": [seg(240.21, 262.14)],
        "hi": ["course", "du", "safe", "registration", "list", "aaj"],
        "fix": {"240.21": "Result"},
        "cards": [
            card(242.04, "6. College + course plan karo", None, "college"),
            card(246.12, "7. DU ke bahar bhi duniya", None, "star", "blue"),
            card(248.72, "8. Safe = kharab nahi", None, "check", "good"),
            card(251.36, "9. Har university ka alag portal", None, "list", "blue"),
            card(255.10, "10. List do baar banao", None, "clock"),
            card(257.86, "Aaj se list mein lagao", None, "target", "good"),
        ],
        "punches": [{"t": 257.86, "until": 259.6}],
    },
]

cfg = {"series": "CUET 2027  ·  COLLEGE LIST", "words": os.path.basename(sys.argv[1]), "reels": reels}
json.dump(cfg, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
for r in reels:
    print(r["n"], r["badge"], r["segments"], round(sum(b - a for a, b in r["segments"]), 1), "s")
