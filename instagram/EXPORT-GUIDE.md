# Exporting reels for Instagram

Follow this guide when editing a video that will be posted through the Instagram Planner, so the sound comes out right.

## The problem this prevents

Every CUET reel up to 31 Oct 2026 had a hidden fault in its sound. The reels were cut and joined from clips, and the audio was copied instead of re-encoded at each cut. That leaves wrongly numbered timing labels on the audio: about 2.3 seconds' worth near the start were all labelled as the same moment.

- **Phones and computers** play the sound in order and ignore those labels, so the file sounds perfect.
- **The Instagram app** re-encodes the video before uploading, which also hides the fault.
- **The scheduler** posts your exact file, and Instagram's servers follow the labels. The result was garbled sound at the start, then about 2 seconds of silence.

The planner now warns about this, and the scheduler repairs it automatically. It's still better to export cleanly in the first place.

## Export settings

| Setting | Use |
| --- | --- |
| File | MP4, H.264 (High profile) |
| Size | 1080 × 1920 (9:16) |
| Frame rate | 30 fps, **constant** (not "variable" or "match source") |
| Video bitrate | 6–8 Mbps. A 60 s reel then comes out around 50 MB. Instagram compresses to well under 1 Mbps anyway, so more only makes uploads slower. |
| Audio | AAC, 48 kHz, stereo, 192 kbps |
| Loudness | Around −14 LUFS, with peaks below −1 dB. Louder exports get turned down by Instagram and can sound crushed. |
| Re-encoding | Always render a fresh file. Turn **off** "smart rendering", "pass-through", "bypass re-encode", "copy streams" and "lossless" export options. |

## In common editors

- **CapCut:** *Export* → Resolution **1080p**, Frame rate **30 fps**, Codec **H.264**, Format **MP4**, Bit rate **Recommended**. Export the whole timeline. Don't use "export clips" and then join the clips in another tool.
- **Premiere Pro:** *Export* → Format **H.264**. Under *Video*, set *Bitrate encoding* to **VBR, 1 pass** with a target of **8 Mbps**. Under *Audio*, choose **AAC, 48 kHz, stereo, 192 kbps**. Leave *Use Previews* and *Smart Rendering* **unticked**.
- **DaVinci Resolve:** *Deliver* → **MP4**, **H.264**, 1080 × 1920, 30 fps. Untick **"Bypass re-encode when possible"**. Audio: **AAC, 192 kbps**.
- **Final Cut Pro:** *Share* → *Export File* → Format **Video and Audio**, Video codec **H.264**, Audio format **AAC**.
- **LosslessCut, `ffmpeg -c copy` and other quick "lossless" trimmers:** these cause exactly this fault. After trimming or joining, re-export in an editor, or run the command below.
- **Claude Code renders (HyperFrames, auto-editor):** before handing over a finished video, run `python3 instagram/ig_scheduler.py check-video <file>`.

## Checking a video before you schedule it

- **In the planner:** drop the video in. A yellow note saying *"This video's sound has timing glitches…"* means it has the fault. It will still post correctly, because the scheduler repairs it, but please fix the export for next time.
- **On a computer with Python and ffmpeg:**

  ```
  python3 instagram/ig_scheduler.py check-video my-reel.mp4          # OK or FAULT
  python3 instagram/ig_scheduler.py check-video --fix my-reel.mp4    # writes my-reel-fixed.mp4
  ```

- **With ffmpeg only:** this rebuilds the audio timing and leaves the picture untouched.

  ```
  ffmpeg -i my-reel.mp4 -map 0:v:0 -map 0:a:0 -c:v copy -af asetpts=N/SR/TB -c:a aac -b:a 192k -ar 48000 -movflags +faststart my-reel-fixed.mp4
  ```
