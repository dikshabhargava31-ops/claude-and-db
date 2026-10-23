# Video studio

Besides the websites in the README, this repo is where videos get made. Each video is its own HyperFrames project in `videos/<name>/` (`npx hyperframes init videos/<name>`). Raw footage goes in `videos/<name>/raw/` and finished files in `videos/<name>/renders/`; both are git-ignored, so large media never lands in this public repository.

## Tools

- **HyperFrames skills** (`.claude/skills/`): start every video with `/hyperframes`. It routes to `/hyperframes-cli`, `/hyperframes-registry` (≈450 ready-made transitions, captions, titles, charts), `/media-use` (music, SFX, voiceover, transcripts, grades), `/figma`, `/slideshow` and `/remotion-to-hyperframes`.
- **Command-line tools** in `.venv-video/bin/` (installed by `scripts/setup-video-tools.sh`; cloud sessions get them from the SessionStart hook):
  - `auto-editor`: cut silences and dead air from talking-head footage; `--export resolve` or `--export premiere` hands a timeline to an editor.
  - `scenedetect`: find the cuts in existing footage (`detect-adaptive list-scenes`, `split-video`).
  - `yt-dlp`: download the person's own uploads, or footage they have rights to. Never use downloaded videos from others in a render; use them only to study pacing and style.
  - `demucs` (only after `--full`): split voice, music and noise.
  - `ffmpeg` / `ffprobe`: everything else.
- **DaVinci Resolve MCP**: only on the person's own computer (`docs/local-video-setup.md`). Use it for long-form timeline edits, multicam and colour work in Resolve.

## Trending styles and where each comes from

Read `.claude/skills/hyperframes/references/types/vertical.md` before any short-form clip.

| Style | How |
| --- | --- |
| Reels / TikTok / Shorts talking head | `auto-editor` jump cuts → 1080×1920 HyperFrames project, punch-ins on emphasis, B-roll on the sentence (`vertical.md`) |
| Word-by-word "karaoke" captions | `npx hyperframes transcribe` → caption style from `npx hyperframes catalog --tag caption-style --json` (`references/captions.md`), 2–3 words per group for high energy |
| Hook-first openings | Frame 0 is the hook: a face, the result or one bold line, never a logo (`vertical.md`) |
| Kinetic typography / text-only reels | `/hyperframes-registry` kinetic type blocks |
| Beat-synced edits and music videos | `references/types/music.md`; music from `/media-use` (`--type bgm`) |
| Faceless explainers / listicles | `references/types/explainer.md`, voiceover from `/media-use` (`--type voice`) |
| Product launch / app promo | `references/types/launch.md`; capture a site with `npx hyperframes capture <url> --json` |
| Data stories, animated charts, maps | `references/types/data.md` and registry charts and map overlays |
| 3D, character and mascot clips | `references/types/3d.md`, `references/types/character.md` |
| Film looks: grain, LUTs, cinematic grades | `npx hyperframes media-treatment` via `/media-use`, never CSS filters |
| Podcast clips / repurposing long videos | `auto-editor` + `scenedetect` to find the moments, then the vertical recipe |
| Stem-separated remixes, dialogue cleanup | `demucs` (needs `--full`, run on the person's own computer) |

## Cloud session limits

The cloud environment's network policy blocks `huggingface.co` (Whisper/Parakeet transcription models) and `dl.fbaipublicfiles.com` (Demucs models). Until the person allows those hosts in the environment's Network access settings, run transcription and stem separation on their own computer, and say so rather than inventing transcripts.
