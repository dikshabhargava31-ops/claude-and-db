#!/usr/bin/env python3
"""Copy finished photos and videos into the instagram-media repository, ready to schedule.

  python3 instagram/prepare_media.py --repo ../instagram-media --type reel videos/promo/renders/promo.mp4

Photos become JPEGs (Instagram accepts nothing else) at most 1440 px wide; videos get a
.poster.jpg beside them for the planner's thumbnails. Each file is checked against Instagram's
limits for the post type, then written to media/YYYY-MM/ in the repository. The script prints
the public links to put in posts.csv; commit and push the media repository before scheduling.
Videos whose audio timestamps are broken (EXPORT-GUIDE.md) are repaired on the way.
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ig_scheduler import audio_timestamps_broken, repair_audio  # noqa: E402

RAW = "https://raw.githubusercontent.com/dikshabhargava31-ops/instagram-media/main/"
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MB = 1024 * 1024
FILE_LIMIT = 95 * MB   # GitHub refuses files over 100 MB
PART_SIZE = 45 * MB
REEL_LIMIT = 300 * MB  # Instagram's limit for reels


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height:format=duration", "-of", "json", str(path)],
                         capture_output=True, text=True, check=True).stdout
    data = json.loads(out)
    stream = data["streams"][0]
    return stream["width"], stream["height"], float(data.get("format", {}).get("duration") or 0)


def split_into_parts(src, dest):
    """Write src as numbered pieces beside dest plus a .parts.json listing them; the scheduler joins
    them at posting time. Returns the .parts.json path."""
    parts = []
    with open(src, "rb") as f:
        while chunk := f.read(PART_SIZE):
            part = dest.with_name(f"{dest.name}.part{len(parts):03d}")
            part.write_bytes(chunk)
            parts.append(part.name)
    manifest = dest.with_name(dest.stem + ".parts.json")
    manifest.write_text(json.dumps({"name": dest.name, "size": src.stat().st_size, "parts": parts}))
    return manifest


def problems_for(kind, is_video, width, height, duration, size):
    found = []
    if size > REEL_LIMIT:
        found.append(f"{size / MB:.0f} MB is over Instagram's 300 MB limit")
    elif size > FILE_LIMIT and kind != "reel":
        found.append(f"{size / MB:.0f} MB is over 95 MB; only reels can be bigger (up to 300 MB)")
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
            original = src
            repaired = repair_audio(src.read_bytes()) if audio_timestamps_broken(src) else None
            if repaired:
                # see EXPORT-GUIDE.md: these timing faults garble the sound on Instagram
                src = Path(folder / f"{base}-{n}.repaired.mp4")
                src.write_bytes(repaired)
                dest = dest.with_suffix(".mp4")
            if src.stat().st_size > FILE_LIMIT:
                dest = split_into_parts(src, dest)
            else:
                shutil.copyfile(src, dest)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(min(1, duration / 2)), "-i", str(src),
                            "-frames:v", "1", "-vf", "scale='min(540,iw)':-2", "-q:v", "4",
                            str(folder / f"{base}-{n}.poster.jpg")], check=True)
            if repaired:
                src.unlink()   # the repaired copy has been copied or split into dest
        else:
            original = src
            dest = folder / f"{base}-{n}.jpg"
            # Flatten transparency onto white, cap the width at 1440 px and save as JPEG.
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-f", "lavfi", "-i",
                            f"color=white:s={width}x{height}", "-filter_complex",
                            "[1][0]overlay=format=auto,scale='min(1440,iw)':-2,format=yuvj420p",
                            "-frames:v", "1", "-q:v", "2", str(dest)], check=True)
        print(f"READY    {original} -> {dest.relative_to(args.repo)}")
        links.append(RAW + dest.relative_to(args.repo).as_posix())

    if failed:
        sys.exit(1)
    print("\nmedia column for posts.csv:")
    print("|".join(links))


if __name__ == "__main__":
    main()
