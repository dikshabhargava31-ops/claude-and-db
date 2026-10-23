# REVIEW: Day 001 re-edit, draft 1

## What was built
Storyline B, "Ek enquiry ka safar", picked by the person. The original 120.8 s reel was cut to 57.6 s and follows one enquiry (Rohan, 9th): hook 15 → 3, Hot/Warm/Cold, 3 questions on the first call, tagged HOT, call him to the centre, trial date, saved as H then flipped to ADM, recap, and a Day 002 end card.
The other two storylines (A "15 → 3" sorter, C "Galti vs sahi") are in `STORYLINES.md`.

## Creative calls
- **Voice cut without hearing it.** Transcription is blocked in the cloud session, so the cut points come from measured silences (the voice band drops to about −100 dB between sentences, and there is no music under it). The person's script was mapped onto those speech segments, and the mapping lined up phrase for phrase in every shot. Kept: hook, Hot/Warm/Cold, the 3 questions, the HOT definition, "phone pe sab mat batao… dus minute", "trial ki date", "Track… H Rohan 9th", "Admission ho gaya? ADM likh do", the recap and the CTA. Dropped: the mistake line, the Warm and Cold definitions and follow-ups, the "bharosa" line, and the weekly search tip.
- **Old cards removed.** Each shot is scaled 1.15–1.45 about the bottom centre, so the burned-in card leaves the frame under a brand-navy top panel. That panel holds the new Hinglish type.
- **Captions** are the person's Devanagari script, verbatim, with an amber sweep on the active word (adapted from the registry's `caption-highlight`). Word times are **estimated** by spreading each measured phrase span by word length, so a word's highlight can be off by about 0.1–0.2 s.
- **"Rohan, 9th"** comes from the original's save example and is used as the worked example's name. The answers shown for him ("2 hafte mein join", "centre aane ko haan") are the script's HOT definition.
- **No music.** The original had none under the voice, and there is no music source in this session (no HeyGen sign-in). There are sound effects on the wipes, chips, stamps and the ADM payoff (bundled Pixabay library, `assets/sfx/CREDITS.md`).

## Measured vs looked at
- `hyperframes check`: passes. One warning kept: caption contrast at about 16 s, a word sampled mid-highlight.
- Snapshots looked at: 0.3, 3.9, 4.5, 6.9, 9.5, 13, 16, 19, 22.5, 24.5, 27, 29.5, 32, 36.2, 40.5, 43.2, 46, 49.5, 53.5, 55.9 and 57 s. No old card is visible, and all text sits inside 168–1330 px.
- Sound: measured, not heard.

## Weakest spots / next changes
- 9.5 s: "Fees se pehle" plays over the centre exterior (the source's shot 3 is the exterior, not the phone call).
- The top panel is a flat navy field. A textured or partly transparent panel would feel less like a template.
- 44–46 s: the recap opens with a near-empty panel for about 1 s.
- Captions would be tighter with real word timings: run `npx hyperframes transcribe raw/vo.m4a --model small --language hi` on a machine that can reach huggingface.co.
