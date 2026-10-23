# REVIEW: Day 001, Vox-style collage (storyline D), draft 1

## What it is
57.6 s, 1080×1920. The same voice cut as `../day001-reel` (the person's own voice, picked over the AI voices), retold as a paper explainer:
an enquiry register (15 names, 12 struck out, 3 highlighted) → slips stamped HOT/WARM/COLD → papa and teacher on the phone with the 3 questions written on a notepad → Rohan's slip stamped HOT with ticks → the phone crossed out, then papa and Rohan walk from "ghar" to the centre photo → calendar with the trial date circled → contacts: H flips to ADM with an ADMISSION stamp → recap diagram → end card.

## Creative calls
- **Characters are moving cutouts** of the original clay figures (`npx hyperframes remove-background`). Heads are split at the neck for nods and talking, with hops, sways, entrances and a walk cycle. Real body acting (arms, legs, lips) needs an image-to-video tool.
- **Paper texture, torn photos and puppet parts** are generated locally (`raw/`). They come from the person's footage, so they stay out of the repository.
- The register names and calendar dates are illustrative props. Rohan, Priya and Aman come from the original's contact example.
- **No music**, as in the original. The effects are whooshes on the paper slides, pops on stamps, writing clicks and an impact on ADM.

## Measured vs looked at
- `check`: passes. One warning kept: the ADM tag is scaled to 0 until it flips in.
- Snapshots looked at: 0.2, 4.3, 7, 7.6, 9.5, 13.5, 19.5, 22.5, 24.8, 27, 27.5, 30.5, 32, 36.6, 40.5, 43.4, 46, 50, 53, 55.9 and 56.5 s.
- Sound: measured, not heard. Caption word timings are estimated from the measured pauses.

## Next, with more time
- The walkers in the centre scene are small. A closer framing of the walk would read better on a phone.
- There's no pen-scratch or paper-rustle sound (none in the bundled library).
- A mouth-flap or blink layer on the puppets would make them feel more alive.
