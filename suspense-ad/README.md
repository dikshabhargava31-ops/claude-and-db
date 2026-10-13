# Suspense Account ad (Remotion)

A 15-second vertical ad (1080×1920, 30fps, H.264 MP4) for the Class 11 & 12 Commerce mentorship program by CA Mahendra Shekhawat / IPA Institute. It has animation and text only, with no voiceover. It is drawn as a student's ruled accounts notebook.

The rendered file is **`out/suspense-account-ad.mp4`**.

## Storyboard

| Time | Frames | On screen |
|---|---|---|
| 0.0–3.0s | 0–90 | **Hook, fully visible on frame 0:** "Trial Balance **not tallying?**" over a trial balance where Dr 1,00,000 ≠ Cr 87,500. A red circle, red flash and shake hit at 0.27s, then "Difference ₹12,500 !!" |
| 2.8–6.0s | 84–180 | An eraser rubs out 87,500. A pencil writes "Suspense A/c … 12,500" and the new total 1,00,000 ✓. The headline becomes "Just park it in a **Suspense A/c.**" and the page adds "(tallied… *for now*)" |
| 6.0–10.0s | 180–300 | The page turns: "Your **CAREER** is in **suspense too.**" The heading "My Career Suspense A/c" is followed by 4 entries: *CA, CS or B.Com? / Accounts concepts? / 2-year study plan? / Who guides me?*, each with a red **?** |
| 10.0–12.5s | 300–375 | "We help you **tally it.**" Each ? is struck out and answered in green. "Difference = 0" appears, then a **TALLIED** rubber stamp slams down |
| 12.5–15.0s | 375–450 | End card: logo, "Class 11 & 12 Commerce", **Mentorship Program**, "with CA Mahendra Shekhawat", a pulsing **Apply now → link in bio** button, and "Clear your career's suspense account." |

All beat timings are in `src/timeline.ts`. Change them there and the visuals and sounds move together.

## Assets to add

`./assets` (this folder's `assets/`) is the Remotion public dir. **The folder is currently empty, so the current render is silent and uses a placeholder "IPA" monogram.** Drop in the files below and run the render again. Each file is picked up automatically; no code changes are needed. Audio can be `.mp3`, `.wav`, `.m4a`, `.aac` or `.ogg`.

| File | Used at | Notes |
|---|---|---|
| `assets/logo.png` | 12.8s → end (end card, top) | Transparent PNG, about 600px wide. It replaces the "IPA" monogram. `.svg`, `.webp` and `.jpg` also work |
| `assets/sfx/error-buzz.mp3` | **0.27s** (f8) | Red circle and shake on the wrong total. Cut at 1.0s |
| `assets/sfx/eraser.mp3` | **2.80s** (f84) | Eraser rubbing out 87,500 and the red note. Cut at 1.0s |
| `assets/sfx/pencil.mp3` | **3.73s** (f112), **6.40s** (f192), **10.00s** (f300) | Writing the Suspense A/c row, the career ledger, and the answers. Cut at 1.3s, 2.7s and 1.4s |
| `assets/sfx/whoosh.mp3` | **5.87s** (f176), **12.37s** (f371) | Page turns into scene 3 and into the end card |
| `assets/sfx/ding.mp3` | **11.47s** (f344) | "Difference = 0" |
| `assets/sfx/stamp-thud.mp3` | **11.73s** (f352) | TALLIED stamp lands, with a shake |
| `assets/music.mp3` | 0s → 15s | Background bed at about 22% volume. It ducks to about 7% under every SFX hit and fades in and out |

The volumes and cut lengths are in the `SFX` list in `src/timeline.ts`.

## Run it

```bash
npm install
npm run studio      # live preview in the browser
npm run render      # writes out/suspense-account-ad.mp4
```

Fonts (Caveat and Bricolage Grotesque) come from `@remotion/google-fonts`, so rendering needs internet access. The paper texture uses CSS gradients only. To use a specific Chrome or headless-shell binary, set `REMOTION_BROWSER=/path/to/binary`.

Remotion is free for individuals and companies with up to 3 employees. Larger organisations need a [company license](https://www.remotion.dev/license).
