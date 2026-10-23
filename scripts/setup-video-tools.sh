#!/bin/bash
# Installs the command-line video tools this repo's video playbook (CLAUDE.md) uses.
# Safe to run again. Works on macOS and Linux; needs python3 and ffmpeg already installed.
#
#   scripts/setup-video-tools.sh          auto-editor, PySceneDetect, yt-dlp, HyperFrames CLI
#   scripts/setup-video-tools.sh --full   also Demucs (stem separation, downloads ~2 GB of PyTorch)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/.venv-video"

for tool in ffmpeg ffprobe node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing $tool. Install it first (macOS: brew install ${tool/ffprobe/ffmpeg})." >&2
    exit 1
  fi
done

# macOS ships Python 3.9 as python3; the tools need 3.10+, so prefer a newer one by name.
PYTHON=""
for candidate in python3.12 python3.11 python3.10 python3.13 python3; do
  if command -v "$candidate" >/dev/null 2>&1 &&
     "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "Need Python 3.10 or newer (macOS: brew install python@3.12)." >&2
  exit 1
fi

if [ -x "$VENV/bin/python" ] && ! "$VENV/bin/python" -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
  rm -rf "$VENV"
fi
[ -x "$VENV/bin/python" ] || "$PYTHON" -m venv "$VENV"
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q auto-editor scenedetect opencv-python-headless yt-dlp

if [ "${1:-}" = "--full" ]; then
  "$VENV/bin/pip" install -q demucs soundfile
fi

# auto-editor fetches its binary on first run; do it now so later runs work offline.
"$VENV/bin/auto-editor" --version >/dev/null

# Warm the npx cache so `npx hyperframes` starts fast.
npx -y hyperframes --version >/dev/null

echo "Video tools ready in $VENV/bin (add it to PATH, or call them by that path)."
