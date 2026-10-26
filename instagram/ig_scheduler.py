#!/usr/bin/env python3
"""Publish scheduled Instagram posts for several accounts through the Instagram Graph API.

Commands:
  check            validate posts.csv and list what is queued
  verify           log in to each account and show its posting quota (posts nothing)
  probe            have Instagram fetch and process a media link without publishing it
  run [--dry-run]  publish every post that is due and not yet published
                   (--watch-hours keeps it running to publish upcoming posts on time)
  refresh-tokens   renew each account's 60-day token (writes one file per secret to --out-dir)

Accounts come from the IG_ACCOUNTS environment variable (a JSON object) or --accounts <file>:
  {"ipa": {"user_id": "1784...", "token": "IGAA...", "api": "instagram"}}
and from IG_ACCOUNT_<NAME> secrets ("<user_id> <token>"), passed as JSON in IG_SECRETS.
"api" is "instagram" (Instagram Login, default) or "facebook" (Facebook Login through a Page;
token refresh then also needs "app_id" and "app_secret").

Only the standard library is used, so it runs on any Python 3.10+ without installing anything.
"""

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
POSTS_FILE = HERE / "posts.csv"
STATE_FILE = HERE / "published.json"

GRAPH_VERSION = os.environ.get("IG_GRAPH_VERSION", "v23.0")
DEFAULT_TZ = os.environ.get("IG_TIMEZONE", "Asia/Kolkata")
MAX_ATTEMPTS = 3
RETRY_GAP = timedelta(minutes=10)
WATCH_POLL = timedelta(minutes=2)
REPORTED_SKIPS = set()
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v"}
TYPES = {"post", "carousel", "reel", "story"}
COLUMNS = ["id", "account", "publish_at", "type", "media", "caption", "first_comment"]


class PostError(Exception):
    pass


# ---------- input ----------

ACCOUNT_SECRET = re.compile(r"^IG_ACCOUNT_([A-Z0-9_]+)$")


def parse_account(name, raw, source):
    """An account is JSON ({"user_id": ..., "token": ...}) or just "<user_id> <token>"."""
    raw = raw.strip()
    try:
        acc = json.loads(raw)
    except ValueError:
        if raw.startswith("{"):
            raise SystemExit(f"{source} is not valid JSON. Check the quotes, commas and braces.")
        parts = raw.replace(",", " ").split()
        if len(parts) != 2:
            raise SystemExit(f"{source} should be the Instagram user ID, a space, then the token.")
        acc = {"user_id": parts[0], "token": parts[1]}
    if not isinstance(acc, dict) or not acc.get("user_id") or not acc.get("token"):
        raise SystemExit(f"Account '{name}' ({source}) needs both user_id and token.")
    acc.setdefault("api", "instagram")
    acc["source"] = source
    return acc


def load_accounts(path):
    """Accounts come from IG_ACCOUNTS (one JSON object) and from one IG_ACCOUNT_<NAME> secret per
    account, which the workflows pass in IG_SECRETS. A per-account secret wins over IG_ACCOUNTS."""
    raw = Path(path).read_text() if path else os.environ.get("IG_ACCOUNTS", "")
    accounts = {}
    if raw.strip():
        try:
            combined = json.loads(raw)
        except ValueError as e:
            raise SystemExit(f"IG_ACCOUNTS is not valid JSON ({e}). Check the quotes, commas and braces.")
        for name, acc in combined.items():
            accounts[name] = parse_account(name, json.dumps(acc), "IG_ACCOUNTS")
    try:
        secrets = json.loads(os.environ.get("IG_SECRETS") or "{}")
    except ValueError:
        secrets = {}
    for key, value in sorted(secrets.items()):
        m = ACCOUNT_SECRET.match(key)
        if m and value:
            name = m.group(1).lower()
            accounts[name] = parse_account(name, value, key)
    return accounts


def parse_time(value, tz_name):
    dt = datetime.fromisoformat(value.strip().replace("T", " "))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(tz_name))
    return dt


def is_video(url):
    return Path(urllib.parse.urlparse(url).path).suffix.lower() in VIDEO_EXTENSIONS


def load_posts(tz_name):
    """Read posts.csv. Returns (posts, problems). Rows whose id starts with # are skipped."""
    posts, problems, seen = [], [], set()
    with POSTS_FILE.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [c for c in COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f"posts.csv is missing columns: {', '.join(missing)}")
        for line, row in enumerate(reader, start=2):
            row = {k: (v or "").strip() for k, v in row.items() if k}
            post_id = row["id"]
            if not post_id or post_id.startswith("#"):
                continue
            where = f"line {line} ({post_id})"
            if post_id in seen:
                problems.append(f"{where}: duplicate id")
                continue
            seen.add(post_id)
            kind = row["type"].lower() or "post"
            media = [m.strip() for m in row["media"].split("|") if m.strip()]
            try:
                when = parse_time(row["publish_at"], tz_name)
            except ValueError:
                problems.append(f"{where}: publish_at '{row['publish_at']}' is not like 2026-10-25 18:30")
                continue
            if kind not in TYPES:
                problems.append(f"{where}: type must be one of {', '.join(sorted(TYPES))}")
                continue
            if not row["account"]:
                problems.append(f"{where}: account is empty")
                continue
            if any(not m.startswith("https://") for m in media):
                problems.append(f"{where}: media must be public https:// links")
                continue
            if kind == "post" and (len(media) != 1 or is_video(media[0])):
                problems.append(f"{where}: a post needs exactly one image (use reel for a video)")
                continue
            if kind == "carousel" and not 2 <= len(media) <= 10:
                problems.append(f"{where}: a carousel needs 2 to 10 media links separated by |")
                continue
            if kind == "reel" and (len(media) != 1 or not is_video(media[0])):
                problems.append(f"{where}: a reel needs exactly one .mp4 or .mov video")
                continue
            if kind == "story" and len(media) != 1:
                problems.append(f"{where}: a story needs exactly one image or video")
                continue
            if len(row["caption"]) > 2200:
                problems.append(f"{where}: caption is over Instagram's 2200 characters")
                continue
            posts.append({**row, "type": kind, "media": media, "when": when, "line": line})
    return posts, problems


def load_state():
    if STATE_FILE.exists():
        state = json.loads(STATE_FILE.read_text())
    else:
        state = {}
    state.setdefault("published", {})
    state.setdefault("failed", {})
    return state


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n")


# ---------- Graph API ----------

class Graph:
    def __init__(self, account):
        self.user_id = account["user_id"]
        self.token = account["token"]
        host = "graph.instagram.com" if account["api"] == "instagram" else "graph.facebook.com"
        self.base = f"https://{host}/{GRAPH_VERSION}"

    def call(self, method, path, **params):
        params["access_token"] = self.token
        data = urllib.parse.urlencode(params).encode()
        url = f"{self.base}/{path}"
        if method == "GET":
            req = urllib.request.Request(f"{url}?{data.decode()}")
        else:
            req = urllib.request.Request(url, data=data, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            try:
                err = json.load(e).get("error", {})
                message = err.get("error_user_msg") or err.get("message") or str(e)
            except ValueError:
                message = str(e)
            raise PostError(f"{path.split('/')[-1]}: {message}") from None
        except urllib.error.URLError as e:
            raise PostError(f"network error: {e.reason}") from None

    def container(self, **params):
        return self.call("POST", f"{self.user_id}/media", **params)["id"]

    def wait_until_ready(self, container_id, timeout=600):
        # Videos are processed by Instagram before they can be published; images are usually instant.
        deadline = time.time() + timeout
        while True:
            status = self.call("GET", container_id, fields="status_code,status")
            code = status.get("status_code")
            if code in ("FINISHED", "PUBLISHED") or code is None:
                return
            if code in ("ERROR", "EXPIRED"):
                raise PostError(f"Instagram could not process the media: {status.get('status', code)}")
            if time.time() > deadline:
                raise PostError("Instagram took more than 10 minutes to process the media")
            time.sleep(10)

    def media_params(self, url, **extra):
        if is_video(url):
            return {"video_url": url, "media_type": extra.pop("video_type", "VIDEO"), **extra}
        extra.pop("video_type", None)
        return {"image_url": url, **extra}


def publish(graph, post):
    caption = post["caption"]
    kind = post["type"]
    media = post["media"]

    if kind == "post":
        creation = graph.container(image_url=media[0], caption=caption)
    elif kind == "reel":
        creation = graph.container(media_type="REELS", video_url=media[0], caption=caption, share_to_feed="true")
    elif kind == "story":
        params = graph.media_params(media[0], video_type="STORIES")
        params.setdefault("media_type", "STORIES")
        creation = graph.container(**params)
    else:
        children = []
        for url in media:
            child = graph.container(**graph.media_params(url, is_carousel_item="true"))
            graph.wait_until_ready(child)
            children.append(child)
        creation = graph.container(media_type="CAROUSEL", children=",".join(children), caption=caption)

    graph.wait_until_ready(creation)
    media_id = graph.call("POST", f"{graph.user_id}/media_publish", creation_id=creation)["id"]

    result = {"media_id": media_id}
    try:
        result["permalink"] = graph.call("GET", media_id, fields="permalink").get("permalink", "")
    except PostError:
        pass
    if post["first_comment"]:
        try:
            graph.call("POST", f"{media_id}/comments", message=post["first_comment"])
        except PostError as e:
            result["comment_error"] = str(e)
    return result


# ---------- commands ----------

def cmd_check(args):
    accounts = load_accounts(args.accounts)
    posts, problems = load_posts(args.timezone)
    state = load_state()
    if accounts:
        for p in posts:
            if p["account"] not in accounts:
                problems.append(f"line {p['line']} ({p['id']}): no account named '{p['account']}' "
                                f"(known: {', '.join(sorted(accounts))})")
    now = datetime.now(timezone.utc)
    queued = [p for p in posts if p["id"] not in state["published"]]
    print(f"{len(posts)} posts in posts.csv, {len(state['published'])} already published, {len(queued)} queued.")
    for p in sorted(queued, key=lambda p: p["when"]):
        due = "DUE NOW" if p["when"] <= now else p["when"].astimezone(ZoneInfo(args.timezone)).strftime("%a %d %b %H:%M")
        print(f"  {due:>16}  {p['account']:<20} {p['type']:<8} {p['id']}")
    for post_id, fail in state["failed"].items():
        print(f"  FAILED {fail['attempts']}x  {post_id}: {fail['error']}")
    for problem in problems:
        print(f"  PROBLEM  {problem}")
    return 1 if problems else 0


def publish_due(accounts, posts, state, args):
    """Publish every post that is due now. Returns the number of failures."""
    now = datetime.now(timezone.utc)
    late_limit = timedelta(hours=args.max_late_hours)
    failures = 0
    for post in sorted(posts, key=lambda p: p["when"]):
        post_id = post["id"]
        if post_id in state["published"] or post["when"] > now:
            continue
        fail = state["failed"].get(post_id, {"attempts": 0})
        if fail["attempts"] >= MAX_ATTEMPTS or now < retry_time(fail):
            continue
        label = f"{post['account']} {post['type']} {post_id}"
        if now - post["when"] > late_limit:
            if post_id not in REPORTED_SKIPS:
                REPORTED_SKIPS.add(post_id)
                print(f"SKIP     {label}: more than {args.max_late_hours}h past its time. "
                      f"Give it a new publish_at to post it.")
            continue
        if post["account"] not in accounts:
            if not args.dry_run:
                print(f"ERROR    {label}: no account named '{post['account']}'")
                failures += 1
            else:
                print(f"WOULD    {label} (account not configured)")
            continue
        if args.dry_run:
            print(f"WOULD    {label}")
            continue
        try:
            result = publish(Graph(accounts[post["account"]]), post)
        except PostError as e:
            fail = {"attempts": fail["attempts"] + 1, "error": str(e),
                    "last_try": datetime.now(timezone.utc).isoformat(timespec="minutes")}
            state["failed"][post_id] = fail
            save_state(state)
            print(f"ERROR    {label} (try {fail['attempts']}/{MAX_ATTEMPTS}): {e}")
            failures += 1
            continue
        state["failed"].pop(post_id, None)
        state["published"][post_id] = {
            "account": post["account"],
            "type": post["type"],
            "published_at": datetime.now(timezone.utc).isoformat(timespec="minutes"),
            **result,
        }
        save_state(state)  # saved after every post so a crash never posts twice
        print(f"POSTED   {label} {result.get('permalink', result['media_id'])}")
        if "comment_error" in result:
            print(f"WARNING  first comment failed: {result['comment_error']}")
    return failures


def retry_time(fail):
    """A failed post is tried again RETRY_GAP after its last try."""
    if not fail.get("last_try"):
        return datetime.min.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(fail["last_try"]) + RETRY_GAP


def next_due(posts, state):
    """When the next unpublished post (or retry) falls due in the future, or None."""
    now = datetime.now(timezone.utc)
    times = []
    for post in posts:
        if post["id"] in state["published"]:
            continue
        fail = state["failed"].get(post["id"], {"attempts": 0})
        if fail["attempts"] >= MAX_ATTEMPTS:
            continue
        due = max(post["when"], retry_time(fail))
        if due > now:
            times.append(due)
    return min(times, default=None)


def git(*cmd):
    return subprocess.run(["git", *cmd], cwd=HERE, capture_output=True, text=True)


def git_sync():
    """Commit published.json if it changed, then pull the latest schedule and push."""
    if git("diff", "--quiet", "--", STATE_FILE.name).returncode:
        git("add", STATE_FILE.name)
        git("commit", "-qm", "Instagram: record published posts")
    for _ in range(3):
        if git("pull", "-q", "--rebase").returncode == 0:
            ahead = git("rev-list", "--count", "@{u}..HEAD").stdout.strip()
            if ahead == "0" or git("push", "-q").returncode == 0:
                return
        time.sleep(5)
    print("WARNING  couldn't sync with GitHub; will try again")


def cmd_run(args):
    accounts = load_accounts(args.accounts)
    posts, problems = load_posts(args.timezone)
    if not accounts and not args.dry_run:
        if not posts:
            print("No accounts or posts yet. Add the IG_ACCOUNTS secret (see instagram/README.md).")
            return 0
        raise SystemExit("No accounts configured. Set the IG_ACCOUNTS secret (see instagram/README.md).")
    for problem in problems:
        print(f"PROBLEM  {problem}")

    # GitHub often starts scheduled runs hours late, so with --watch-hours a run stays up while a
    # post is coming and publishes it on time, re-reading the schedule for new posts as it waits.
    deadline = datetime.now(timezone.utc) + timedelta(hours=args.watch_hours)
    failures = 0
    while True:
        state = load_state()
        failures += publish_due(accounts, posts, state, args)
        if args.sync:
            git_sync()
        if args.dry_run or not args.watch_hours:
            break
        upcoming = next_due(posts, load_state())
        now = datetime.now(timezone.utc)
        if upcoming is None or upcoming > deadline:
            print("DONE     nothing else due before this run ends" if upcoming else "DONE     nothing else scheduled")
            break
        wait = max(5, min(WATCH_POLL.total_seconds(), (upcoming - now).total_seconds()))
        print(f"WAITING  next post at {upcoming.astimezone(ZoneInfo(args.timezone)):%d %b %H:%M}; "
              f"checking again in {wait / 60:.0f} min" if wait >= 60 else f"checking again in {wait:.0f} s")
        time.sleep(wait)
        posts, _ = load_posts(args.timezone)
    return 1 if failures else 0


def cmd_verify(args):
    accounts = load_accounts(args.accounts)
    if not accounts:
        raise SystemExit("No accounts configured. Set the IG_ACCOUNTS secret (see instagram/README.md).")
    failed = 0
    for name, acc in accounts.items():
        graph = Graph(acc)
        try:
            username = graph.call("GET", graph.user_id, fields="username").get("username", "?")
            limit = graph.call("GET", f"{graph.user_id}/content_publishing_limit", fields="quota_usage,config")
            usage = (limit.get("data") or [{}])[0]
            total = usage.get("config", {}).get("quota_total", 50)
            print(f"OK       {name}: @{username}, {usage.get('quota_usage', 0)}/{total} posts used in the last 24h")
        except PostError as e:
            print(f"ERROR    {name}: {e}")
            failed += 1
    return 1 if failed else 0


def cmd_probe(args):
    """Create a container for a media link and wait for Instagram to process it. Never publishes."""
    accounts = load_accounts(args.accounts)
    name = args.account or next(iter(accounts), None)
    if name not in accounts:
        raise SystemExit(f"No account named '{name}'.")
    graph = Graph(accounts[name])
    url = args.url
    try:
        if is_video(url):
            container = graph.container(media_type="REELS", video_url=url)
        else:
            container = graph.container(image_url=url)
        graph.wait_until_ready(container)
    except PostError as e:
        print(f"REJECTED {url}: {e}")
        return 1
    print(f"OK       Instagram accepted {url} (nothing was published)")
    return 0


def cmd_refresh_tokens(args):
    accounts = load_accounts(args.accounts)
    if not accounts:
        print("No accounts configured yet, nothing to renew.")
        return 0
    failed = []
    for name, acc in accounts.items():
        try:
            if acc["api"] == "instagram":
                url = "https://graph.instagram.com/refresh_access_token?" + urllib.parse.urlencode(
                    {"grant_type": "ig_refresh_token", "access_token": acc["token"]})
            else:
                if not acc.get("app_id") or not acc.get("app_secret"):
                    print(f"SKIP     {name}: facebook accounts need app_id and app_secret to refresh")
                    continue
                url = f"https://graph.facebook.com/{GRAPH_VERSION}/oauth/access_token?" + urllib.parse.urlencode({
                    "grant_type": "fb_exchange_token", "client_id": acc["app_id"],
                    "client_secret": acc["app_secret"], "fb_exchange_token": acc["token"]})
            with urllib.request.urlopen(url, timeout=60) as resp:
                data = json.load(resp)
            acc["token"] = data["access_token"]
            days = int(data.get("expires_in", 0)) // 86400
            print(f"RENEWED  {name}" + (f" (valid {days} more days)" if days else ""))
        except (urllib.error.URLError, KeyError, ValueError) as e:
            print(f"ERROR    {name}: {getattr(e, 'reason', e)}")
            failed.append(name)
    # One file per secret, named after it, so the workflow can save each one back.
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    strip = lambda acc: {k: v for k, v in acc.items() if k != "source"}
    combined = {n: strip(a) for n, a in accounts.items() if a["source"] == "IG_ACCOUNTS"}
    if combined:
        (out / "IG_ACCOUNTS").write_text(json.dumps(combined))
    for name, acc in accounts.items():
        if acc["source"] != "IG_ACCOUNTS":
            (out / acc["source"]).write_text(json.dumps(strip(acc)))
    return 1 if failed else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--accounts", help="accounts JSON file (default: IG_ACCOUNTS environment variable)")
    parser.add_argument("--timezone", default=DEFAULT_TZ, help=f"timezone for publish_at without an offset (default {DEFAULT_TZ})")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check")
    sub.add_parser("verify")
    probe = sub.add_parser("probe")
    probe.add_argument("url")
    probe.add_argument("--account", help="account to test with (default: the first one)")
    run = sub.add_parser("run")
    run.add_argument("--dry-run", action="store_true", help="show what would be posted without posting")
    run.add_argument("--max-late-hours", type=float, default=12, help="skip posts more than this many hours late (default 12)")
    run.add_argument("--watch-hours", type=float, default=0,
                     help="keep running this long while posts are coming up, publishing each on time")
    run.add_argument("--sync", action="store_true",
                     help="commit published.json and pull the latest schedule after each round (used by the workflow)")
    refresh = sub.add_parser("refresh-tokens")
    refresh.add_argument("--out-dir", required=True, help="folder to write one file per renewed secret to")
    args = parser.parse_args()
    handler = {"check": cmd_check, "verify": cmd_verify, "probe": cmd_probe, "run": cmd_run, "refresh-tokens": cmd_refresh_tokens}[args.command]
    sys.exit(handler(args))


if __name__ == "__main__":
    main()
