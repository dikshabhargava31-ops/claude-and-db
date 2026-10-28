# Fonts and lessons from the Suspense Account ad

These are notes from building the 15-second Reels ad in this folder. Use them for the next video in this style.

## Fonts

Both fonts are loaded with `@remotion/google-fonts` in `src/ui.tsx`. Only the Latin subset and the weights listed below are loaded, which keeps the render fast.

| Font | Role | Weights | Where it's used |
|---|---|---|---|
| **Caveat** (`hand`) | Handwriting: everything a student would write in the notebook | 500 (regular entries), 700 (headings, totals, notes) | Ledger rows and amounts, "Difference ₹12,500 !!", "(tallied… for now)", "My Career Suspense A/c", the questions and green answers, "Difference = 0", "Class 11 & 12 Commerce" and "with CA Mahendra Shekhawat" on the end card |
| **Bricolage Grotesque** (`display`) | Bold printed text: headlines, stamp, button | 800 (headlines, stamp, CTA, "Mentorship Program"), 600 (₹ sign, "IPA Institute") | Every headline, the TALLIED stamp, the red **?** marks, the ₹ symbol, the IPA monogram and the "Apply now → link in bio" button |

### Sizes that worked at 1080×1920

| Element | Font | Size |
|---|---|---|
| Headlines | Bricolage 800 | 104px (96px for the longer "Your CAREER is / in suspense too.") |
| End-card title "Mentorship Program" | Bricolage 800 | 150px |
| CTA button | Bricolage 800 | 62px |
| TALLIED stamp | Bricolage 800 | 120px |
| Ledger entries | Caveat 500 | 70–72px |
| Totals, notes, "Difference = 0" | Caveat 700 | 72–96px |

Text much smaller than about 60px was hard to read in a phone-sized preview. The first draft used 54–64px and looked too small, with half the screen left empty.

### Font gotchas

- **Caveat's "?" looks like "¿" or "!"** at large sizes. The red question marks are set in Bricolage Grotesque instead.
- **Caveat has no ₹ glyph you can rely on.** The ₹ is drawn in Bricolage Grotesque at 0.72em so it sits with the handwriting (the `Rupee` component).
- **Caveat's last letter overhangs its box.** A clip-path reveal cut off the final glyph, so "0" looked like "C" and "solid" like "solia". The fix is to pad the right side of the clipped span: `paddingRight: 0.25em; marginRight: -0.25em`.

## Visual style

- **Paper is CSS only.** It is layered gradients on one `div`: an off-white base (`#fbf8ef`), a soft vignette, two pale "age" blotches, a red double margin line at x=150, faint blue ruled lines every 88px, and three dot grids with co-prime sizes (7, 11×13, 17×19px) for paper grain without a visible pattern.
- **Text sits on the ruled lines.** Everything is placed by line number (`OnLine line={n}`) instead of free y-coordinates, so the handwriting always rests on a ruled line. A pitch of 88px gave enough lines to fill the safe area with large text.
- **Ink colours carry meaning.** Navy ink is for headlines, blue pen for normal entries, grey pencil for the "fix" (the Suspense A/c entry), red for errors, and green for answers.
- **Small physical details sell the notebook look.** A CSS pencil rides the edge of the handwriting as it appears, an eraser leaves crumbs, a red circle draws itself on, a highlighter swipes behind key words, and the rubber stamp uses a multiply blend with a speckle mask to look worn.

## Reels and short-form lessons

- **Frame 0 must already say something.** The hook headline and the wrong totals are fully visible on the very first frame, with only a slight zoom-in for motion. Nothing fades in from blank.
- **Keep key content in the safe area.** The top ~200px (Reels header) and the bottom ~350px (caption, buttons) get covered. Content was kept between about y=200 and y=1540.
- **Design for mute.** With no voiceover, the headline must carry the story alone. Each scene has one short, bold headline of two lines at most; the ledger is supporting detail.
- **Shake and flash work as "sound" when muted.** The red flash and screen shake on the error, and the shake on the stamp, read as impact even without audio.
- **Hold the end card.** The end card needs at least 2 seconds, with its elements appearing one after another and the CTA pulsing.

## Remotion lessons

- **Keep all timings in one file.** `src/timeline.ts` holds every beat as a frame number, and both the animation and the sound effects read from it. Retiming the ad means editing one file.
- **Optional assets are found automatically.** `getStaticFiles()` lists what is in the public folder at render time, so the logo, SFX and music are used when present and skipped when not. `Config.setPublicDir('./assets')` makes `./assets` that folder.
- **Duck the music with a volume function.** The music `volume` is a function of the frame that drops from 22% to 7% around each SFX hit and fades in and out at the ends.
- **Cut long sound files.** Each SFX sits in a `Sequence` with a fixed length and a short fade, so a long file can't bleed into the next beat.
- **Encoding settings for Instagram.** H.264, CRF 18, `setColorSpace('bt709')` and `setEnforceAudioTrack(true)`. Without bt709, the JPEG frames produced a full-range `yuvj420p` video, which can shift colours on Instagram. The enforced audio track gives a normal audio+video file even when the ad is silent.
- **Check with stills before rendering.** `npx remotion still … --frame=N --scale=0.5` renders single frames quickly. Putting several side by side caught overlaps, clipped letters and empty space before the full render.

## Cloud sandbox gotcha (not needed on a normal computer)

Remotion starts Chromium with the proxy turned off (`--no-proxy-server`). In the Claude Code cloud sandbox, internet traffic only works through the sandbox's proxy, so Google Fonts failed with `ERR_CERT_AUTHORITY_INVALID`.

The fix was a small wrapper script around the headless browser. It removes Remotion's proxy flags, adds the sandbox proxy, and is pointed to with `REMOTION_BROWSER=/path/to/wrapper.sh`. Certificate checks stay on. The wrapper lived only in the session's scratch folder and is not in this repo. On your own computer, `npm run render` works without it.

## Licence

Remotion is free for individuals and companies with up to 3 employees. Larger organisations need a [company licence](https://www.remotion.dev/license).
