# SPEC: Day 001 re-edit, storyline B "Ek enquiry ka safar"

GOAL:    A coaching-centre owner sees one enquiry (Rohan, 9th) go from the first call to ADM, and leaves with "3 sawaal → Hot/Warm/Cold → alag follow-up".
OUTPUT:  HyperFrames, 1080×1920, 30 fps.
TIME:    57.6 s × 30 = 1728 frames. The voice is the clock (`raw/vo.m4a`, 56.1 s, cut from the original at measured pauses; see `assets/voice-timing.json`).
LOOK:    The brand's own system, from the original cards. Ground #0B1226 (navy) in a top panel only, from 0 to 470 px, fading out by 600 px; the illustration fills the rest.
         Ink #FFFFFF. Accent #FBB524 (amber) on one word or number per beat. Tags: Hot #EF4444, Warm #FACC15, Cold #22D3EE, ADM #22C55E.
         Type: Mukta 800 (Latin + Devanagari). Headline 80 px with -1% tracking; kicker tag 30 px; captions 72 px, fitted to 864 px.
         Medium: the source's clay-3D illustrations, punched in so the old burned-in card leaves the frame (scale 1.15–1.45 about the bottom centre).
OBJECTS: Rohan's contact row (tag + "Rohan · 9th"), which is the object that travels: tagged HOT, then H, then flipped to ADM. Three question rows. A trial-date stamp.
MOTION:  Arrivals expo.out 0.45 s. Stamps: scale 1.6 → 1 with back.out(1.6) in 0.35 s. Chips: scale 0 → 1 with back.out(2) in 0.3 s. Exits power3.in 0.2 s.
         Beat changes: an amber wipe (0.5 s, power3.inOut). Inside a beat: hard-cut punch-ins.
SHOTS:   (start–end, picture, panel)
         0.00–2.55   P1 classroom ×1.15→1.22 | "15 enquiry" counts 0→15
         2.55–4.50   P1 punch ×1.35          | "admission sirf 3?": the 3 lands at 3.55 (bass impact)
         4.50–7.90   P2 centre exterior       | HOT / WARM / COLD chips pop on the words (6.50 / 6.85 / 7.25)
         7.90–11.50  P3 phone at night        | PEHLA CALL · Rohan (9th) ke papa: "Fees se pehle, 3 sawaal"
         11.50–21.20 P4 on the phone, 3 punch-ins | question 1 / 2 / 3 (12.40 / 15.45 / 18.35)
         21.20–25.60 P5 laptop                | HOT stamp on Rohan's row, plus its two reasons
         25.60–32.75 P6 classroom, punch at 28.65 | "Phone pe sab mat batao" → "Centre bulao" → "10 minute mein samjhao"
         32.75–37.10 P7 handover              | "Jaane se pehle agla step" → TRIAL KI DATE stamp at 35.95
         37.10–44.35 P10 phone in hand, punch at 41.30 | "Number aise save karo" → [H] Rohan 9th → flips to [ADM] at 42.85 (the payoff)
         44.35–51.00 P11 kids walk in         | YAAD RAKHO: 3 sawaal → Hot/Warm/Cold → alag follow-up
         51.00–57.60 end card                 | Coaching Ka System, @coachingkasystem, Day 002 "Fees time pe kaise aaye?", Follow karo
         Captions: the spoken script in Devanagari, verbatim, 2–3 words a group, with an amber sweep on the active word, at 1150–1320 px. Off during the end card.
SOUND:   The original voice only (it has no music under it). SFX from the bundled library: whooshes on the wipes (rotated), pops on chips and stamps, one bass impact on ADM.
         No music source in this session (no HeyGen sign-in): delivered without a music bed.
BANNED:  The SPEC.md defaults; the old burned-in cards showing anywhere; a logo docked in a corner; emoji as icons; text below 1330 px; every element fading and sliding up.
QA:      0.3 (hook readable at frame 0), 3.6, 6.9, 13, 16, 19, 22.5, 29, 36.2, 40.5, 43.2, 49, 55: no old card visible, text inside 168–1330 px.
