#!/usr/bin/env python3
"""Copy finished photos and videos into the instagram-media repository, ready to schedule.

  python3 instagram/prepare_media.py --repo ../instagram-media --type reel videos/promo/renders/promo.mp4

Photos become JPEGs (Instagram accepts nothing else) at most 1440 px wide; videos get a
.poster.jpg beside them for the planner's thumbnails. Each file is checked against Instagram's
limits for the post type, then written to media/YYYY-MM/ in the repository. The script prints
the public links to put in posts.csv; commit and push the media repository before scheduling.
Needs ffmpeg and ffprobe.
"""

import argparse
import json
import secrets
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

RAW = "https://raw.githubusercontent.com/dikshabhargava31-ops/instagram-media/main/"
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_BYTES = 95 * 1024 * 1024


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height:format=duration", "-of", "json", str(path)],
                         capture_output=True, text=True, check=True).stdout
    data = json.loads(out)
    stream = data["streams"][0]
    return stream["width"], stream["height"], float(data.get("format", {}).get("duration") or 0)


def problems_for(kind, is_video, width, height, duration, size):
    found = []
    if size > MAX_BYTES:
        found.append(f"{size / 1048576:.0f} MB is over the 95 MB upload limit")
    if not is_video and kind in ("post", "carousel") and not 0.79 <= width / height <= 1.92:
        found.append(f"{width}x{height} is outside the feed's 4:5 to 1.91:1 range (use story for 9:16)")
    if is_video and kind == "reel" and not 3 <= duration <= 900:
        found.append(f"reels must be 3 s to 15 min (this is {duration:.0f} s)")
    if is_video and kind in ("story", "carousel") and duration > 60:
        found.append(f"{kind} videos can be at most 60 s (this is {duration:.0f} s)")
    if kind == "post" and is_video:
        found.append("a photo post can't be a video; use --type reel")
    if kind == "reel" and not is_video:
        found.append("a reel must be a video")
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--repo", type=Path, required=True, help="local clone of instagram-media")
    parser.add_argument("--type", choices=["post", "carousel", "reel", "story"], required=True)
    args = parser.parse_args()

    if args.type == "carousel" and not 2 <= len(args.files) <= 10:
        raise SystemExit("A carousel needs 2 to 10 files.")
    if args.type != "carousel" and len(args.files) != 1:
        raise SystemExit(f"A {args.type} takes exactly one file.")

    stamp = datetime.now(ZoneInfo("Asia/Kolkata"))
    folder = args.repo / "media" / stamp.strftime("%Y-%m")
    folder.mkdir(parents=True, exist_ok=True)
    base = f"{stamp:%Y%m%d-%H%M}-{secrets.token_hex(2)}"
    links, failed = [], False

    for n, src in enumerate(args.files, start=1):
        ext = src.suffix.lower()
        is_video = ext in VIDEO_EXTENSIONS
        if not is_video and ext not in IMAGE_EXTENSIONS:
            print(f"ERROR    {src}: not a photo or video Instagram can take")
            failed = True
            continue
        width, height, duration = probe(src)
        problems = problems_for(args.type, is_video, width, height, duration, src.stat().st_size)
        if problems:
            print(f"ERROR    {src}: " + "; ".join(problems))
            failed = True
            continue
        if is_video:
            dest = folder / f"{base}-{n}{'.mov' if ext == '.mov' else '.mp4'}"
            shutil.copyfile(src, dest)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(min(1, duration / 2)), "-i", str(src),
                            "-frames:v", "1", "-vf", "scale='min(540,iw)':-2", "-q:v", "4",
                            str(dest.with_suffix(".poster.jpg"))], check=True)
        else:
            dest = folder / f"{base}-{n}.jpg"
            # Flatten transparency onto white, cap the width at 1440 px and save as JPEG.
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-f", "lavfi", "-i",
                            f"color=white:s={width}x{height}", "-filter_complex",
                            "[1][0]overlay=format=auto,scale='min(1440,iw)':-2,format=yuvj420p",
                            "-frames:v", "1", "-q:v", "2", str(dest)], check=True)
        print(f"READY    {src} -> {dest.relative_to(args.repo)}")
        links.append(RAW + dest.relative_to(args.repo).as_posix())

    if failed:
        sys.exit(1)
    print("\nmedia column for posts.csv:")
    print("|".join(links))


if __name__ == "__main__":
    main()
