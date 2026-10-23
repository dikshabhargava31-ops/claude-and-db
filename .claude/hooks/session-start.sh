#!/bin/bash
# Cloud sessions only: install the video tools and put them on PATH.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

"$CLAUDE_PROJECT_DIR/scripts/setup-video-tools.sh"

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$CLAUDE_PROJECT_DIR/.venv-video/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi
