# Video editing on your own computer

Cloud sessions can make HyperFrames videos, but they can't open apps on your computer or download some AI models. For DaVinci Resolve control, transcription and stem separation, run Claude Code locally.

## 1. Install the basics

- [Claude Code](https://code.claude.com/docs/en/setup)
- Node.js 22+, Python 3.10–3.12 and ffmpeg (macOS: `brew install node python@3.12 ffmpeg`)

Then, in a clone of this repository:

```bash
scripts/setup-video-tools.sh --full
```

That installs auto-editor, PySceneDetect, yt-dlp, Demucs and the HyperFrames CLI into `.venv-video/`. The HyperFrames skills are already in `.claude/skills/`.

On an Apple Silicon Mac, faster and more accurate transcription: `npx hyperframes models install parakeet`.

## 2. Connect DaVinci Resolve

Uses [samuelgursky/davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp) (Resolve 18.5 or later).

1. **Resolve Studio:** in Resolve, open Preferences → General and set **External scripting using** to **Local**.
   **Free Resolve:** Blackmagic only allows outside scripting in Studio. The project offers an in-app bridge instead (`python scripts/install_resolve_bridge.py` from its source, then Workspace → Scripts → resolve_bridge). It's confirmed up to Resolve 21.0; Resolve 21.1 moved scripting to Studio.
2. Run the guided installer, and let it configure Claude Code when it asks:
   ```bash
   npx davinci-resolve-mcp setup
   ```
3. Open Resolve with a project, start `claude` in this folder and run `/mcp` to check `davinci-resolve` is connected.

Premiere Pro users can use a Premiere MCP server instead. Check its repository before installing.

## 3. Cloud sessions: allow model downloads

To transcribe in cloud sessions too, allow `huggingface.co` (and `dl.fbaipublicfiles.com` for Demucs) in the cloud environment's Network access settings. Open the environment menu in the session's title bar, choose Edit, and add the hosts under Allowed domains, keeping "Allow package managers" ticked. Steps: <https://code.claude.com/docs/en/cloud-environments#network-access>.
