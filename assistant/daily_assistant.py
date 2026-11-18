#!/usr/bin/env python3
"""Daily Ops Assistant: plans the day from the IPA Priority Board and sends it to WhatsApp.

Three runs a day (the "Daily assistant" workflow, India time):

  morning  Reads every open task on the board, picks the day's plan (one important task first,
           then the urgent ones, then quick wins), decides what to hand off and to whom, assigns
           those tasks on the board, and sends the to-do list to WhatsApp.
  midday   Checks the morning plan against the board and nudges about the first task that
           hasn't moved, with a five-minute first step.
  evening  Counts what got done, lists what carries over, and names tomorrow's first task.
           Also asks you to chase hand-offs that are overdue.

The board's data (data.json) and this assistant's settings and saved plans stay in the private
repository dikshabhargava31-ops/ipa_task; nothing personal is written to this public repository
or printed in the public Actions log.

    BOARD_TOKEN=... python3 assistant/daily_assistant.py morning --dry-run   # print, change nothing
    python3 assistant/daily_assistant.py morning --board sample.json --dry-run

Environment:
  BOARD_TOKEN         GitHub token that can read and write ipa_task (Contents: read and write)
  ANTHROPIC_API_KEY   optional; without it the plan comes from built-in rules
  WHATSAPP_PHONE      your number with country code, e.g. +9198xxxxxxxx
  CALLMEBOT_APIKEY    the key CallMeBot sends you (free), or instead:
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM   for Twilio's WhatsApp API
"""
import argparse
import base64
import copy
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
BOARD = {"owner": "dikshabhargava31-ops", "repo": "ipa_task", "branch": "main"}
DATA_PATH = "data.json"
CONFIG_PATH = "assistant/config.json"
PLANS_DIR = "assistant/plans"
BOT = "Ops Assistant"
MODEL = "claude-opus-5-5"
HERE = Path(__file__).resolve().parent

# Used when ipa_task has no assistant/config.json yet. Copy config.example.json there to change it.
DEFAULT_CONFIG = {
    "me": "Diksha",
    "auto_assign": True,
    "max_top": 3,
    "max_quick": 4,
    "priority_order": ["PARTHU", "Mentorship", "CUET", "YouTube"],
    "keep": [
        "Legal judgment: contracts, ASCI and DPDP checks, anything you sign",
        "Money and vendor decisions, pricing, payroll approval",
        "Strategy, priorities and anything the founder must hear from you",
        "Hiring, firing and performance conversations",
    ],
    "keep_keywords": ["legal", "contract", "asci", "dpdp", "vendor", "pricing", "price", "strategy", "founder",
                      "approve", "approval", "hire", "hiring", "interview", "salary revision", "agreement", "sign"],
    "team": [],
    "quick_keywords": ["send", "share", "call", "reply", "forward", "upload", "remind", "follow up", "check"],
}


# ---------------------------------------------------------------- GitHub (private board repo)

def gh(method, path, token, body=None):
    url = f"https://api.github.com/repos/{BOARD['owner']}/{BOARD['repo']}/contents/{path}"
    if method == "GET":
        url += f"?ref={BOARD['branch']}"
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None, headers={
        "Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "daily-ops-assistant"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {}


def read_file(path, token):
    status, j = gh("GET", path, token)
    if status == 404:
        return None, None
    if status != 200:
        sys.exit(f"Could not read {path} from the board repository (HTTP {status}). Check BOARD_TOKEN.")
    return json.loads(base64.b64decode(j["content"]).decode()), j["sha"]


def write_file(path, data, sha, message, token):
    body = {"message": message, "branch": BOARD["branch"],
            "content": base64.b64encode((json.dumps(data, indent=2, ensure_ascii=False) + "\n").encode()).decode(),
            "committer": {"name": BOT, "email": "41898282+github-actions[bot]@users.noreply.github.com"}}
    if sha:
        body["sha"] = sha
    status, _ = gh("PUT", path, token, body)
    return status


# ---------------------------------------------------------------- tasks

def today():
    return dt.datetime.now(IST).date()


def norm(s):
    return str(s or "").strip().lower()


def status_of(t):
    return t.get("status") or ("Done" if t.get("done") else "Not started")


def project_done(p):
    if p.get("status"):
        return p["status"] == "Done"
    ts = p.get("tasks") or []
    return bool(ts) and all(status_of(t) == "Done" for t in ts)


def days_left(t, day):
    try:
        return (dt.date.fromisoformat(t["due"][:10]) - day).days
    except (KeyError, ValueError, TypeError):
        return None


def band(t, day):
    d = days_left(t, day)
    return 4 if d is None else 0 if d < 0 else 1 if d <= 1 else 2 if d <= 7 else 3


def flatten(board, day):
    """Every task with its project, in the board's own 'Do this now' order."""
    out = []
    for p in board.get("projects", []):
        for t in p.get("tasks") or []:
            out.append({**t, "_pid": p["id"], "_project": p.get("name", ""), "_ppri": int(p.get("priority") or 99),
                        "_pdone": project_done(p), "_status": status_of(t)})
    out.sort(key=lambda t: (band(t, day), t["_ppri"], t.get("due") or "9999", bool(t.get("est"))))
    return out


def is_mine(t, me):
    return norm(t.get("who")) in ("", norm(me))


def done_on(t, day):
    at = t.get("doneAt") or (t.get("updatedAt") if t["_status"] == "Done" else None)
    if not at:
        return False
    try:
        return dt.datetime.fromisoformat(at.replace("Z", "+00:00")).astimezone(IST).date() == day
    except ValueError:
        return False


def label(t, day):
    d = days_left(t, day)
    when = "" if d is None else f" ({-d}d overdue)" if d < 0 else " (today)" if d == 0 else " (tomorrow)" if d == 1 else ""
    return f"{t['t'].strip()}{when}"


def team_names(board, cfg):
    names = {norm(m["name"]): m["name"] for m in cfg.get("team", []) if m.get("name")}
    for p in board.get("projects", []):
        for n in [p.get("owner")] + [t.get("who") for t in p.get("tasks") or []]:
            if n and norm(n) != norm(cfg["me"]) and norm(n) not in names:
                names[norm(n)] = n.strip()
    return list(names.values())


def past_work(board, cfg):
    """What each person has been given before, so the assistant hands similar work to the same people."""
    seen = {}
    for p in board.get("projects", []):
        for t in p.get("tasks") or []:
            who = (t.get("who") or "").strip()
            if who and norm(who) != norm(cfg["me"]):
                seen.setdefault(who, []).append(f"{t['t'].strip()} [{p.get('name', '')}]")
    return {k: v[-8:] for k, v in seen.items()}


# ---------------------------------------------------------------- planning

PLAN_TOOL = {
    "name": "report_plan",
    "description": "Report today's plan. Call it exactly once.",
    "input_schema": {
        "type": "object",
        "properties": {
            "top": {"type": "array", "description": "1 to 3 tasks to do today, most important first. The first should be the important (strategic) one, not just the loudest.",
                    "items": {"type": "object", "properties": {
                        "id": {"type": "string"},
                        "why": {"type": "string", "description": "Under 10 words"},
                        "first_step": {"type": "string", "description": "A concrete first action that takes 5 minutes or less, under 12 words"}},
                        "required": ["id", "why", "first_step"]}},
            "quick": {"type": "array", "description": "Up to 4 small tasks under 15 minutes each, to batch in one slot", "items": {"type": "string", "description": "task id"}},
            "delegate": {"type": "array", "description": "Tasks someone else on the team should do. Decide; don't ask.",
                         "items": {"type": "object", "properties": {
                             "id": {"type": "string"},
                             "to": {"type": "string", "description": "Exactly one name from the team list"},
                             "reason": {"type": "string", "description": "Under 10 words"},
                             "message": {"type": "string", "description": "A short WhatsApp message to that person, in the voice of a real colleague: what, by when, what done looks like. 1-2 sentences, no formalities."}},
                             "required": ["id", "to", "reason", "message"]}},
            "later": {"type": "array", "description": "Tasks to leave for later this week without guilt", "items": {"type": "string"}},
            "note": {"type": "string", "description": "One plain, specific line for the morning. Point to a real result from yesterday if there is one. No clichés, no motivational quotes, no emojis."},
        },
        "required": ["top", "quick", "delegate", "later", "note"],
    },
}

SYSTEM = """You are the chief of staff for {me}, who runs operations and the founder's office at an education institute
(HR and payroll, academic operations, product, content, admissions growth, new businesses, legal checks).
{me} wants to grow into a COO. The risk is that urgent small work crowds out important work and that {me} does
work a team member could do. Your job is to plan the day and to decide delegation so {me} doesn't have to.

Rules:
- Project priority order (most important first): {priorities}. Lower board priority numbers come first too.
- The first top task is the most important strategic task that can move today, even if something smaller is louder.
- Never put more than {max_top} tasks in "top". Overdue routine work can go in "quick" or be delegated.
- {me} keeps only work that needs {me}: {keep}. Everything else that a team member can do, delegate.
- Delegate only to names in the team list, and match the work to what each person has done before or is good at.
  If nobody fits, keep it. Don't delegate a task that's already assigned to someone else.
- Every task id you use must come from the task list. Each id appears in at most one list.
- Write the way {me} talks: short, plain, spoken English. Nothing dramatic or formal."""


def plan_with_claude(tasks, board, cfg, day, yesterday_wins):
    import anthropic
    team = cfg.get("team") or []
    team_txt = "\n".join(f"- {m['name']}: {m.get('role', '')}. Good at: {', '.join(m.get('good_at', []))}" for m in team)
    others = [n for n in team_names(board, cfg) if norm(n) not in {norm(m['name']) for m in team}]
    team_txt += "".join(f"\n- {n}" for n in others)
    history = "\n".join(f"- {who}: " + "; ".join(ts) for who, ts in past_work(board, cfg).items())
    rows = "\n".join(f"{t['id']} | {t['_project']} (P{t['_ppri']}) | {t['t'].strip()} | due {t.get('due') or '-'}"
                     f"{' (estimated)' if t.get('est') else ''} | {t['_status']} | assigned: {t.get('who') or '-'}" for t in tasks)
    prompt = (f"Today is {day:%A %d %B %Y}.\n\nTeam:\n{team_txt or '- (nobody listed)'}\n\n"
              f"Work each person has had before:\n{history or '- none'}\n\n"
              f"Finished yesterday by {cfg['me']}: {'; '.join(yesterday_wins) or 'nothing marked done'}\n\n"
              f"Open tasks (id | project | task | due | status | assigned):\n{rows}\n\nPlan today.")
    system = SYSTEM.format(me=cfg["me"], priorities=" → ".join(cfg.get("priority_order") or []) or "board priority",
                           max_top=cfg.get("max_top", 3), keep="; ".join(cfg.get("keep") or []))
    client = anthropic.Anthropic()
    response = client.messages.create(model=MODEL, max_tokens=4000, system=system,
                                      messages=[{"role": "user", "content": prompt}],
                                      tools=[PLAN_TOOL], tool_choice={"type": "tool", "name": "report_plan"})
    block = next((b for b in response.content if b.type == "tool_use"), None)
    return block.input if block else None


def plan_with_rules(tasks, board, cfg, day, yesterday_wins):
    """The same kind of plan without the API: board order, project priority order, keyword rules."""
    order = [norm(x) for x in cfg.get("priority_order") or []]

    def rank(t):
        p = norm(t["_project"])
        hit = next((i for i, x in enumerate(order) if x and x in p), len(order))
        return hit

    keep_kw = [norm(k) for k in cfg.get("keep_keywords") or []]
    quick_kw = [norm(k) for k in cfg.get("quick_keywords") or []]
    team = cfg.get("team") or []
    history = past_work(board, cfg)
    words = lambda s: set(re.findall(r"[a-z0-9]+", norm(s))) - {"the", "and", "for", "to", "of", "a", "in", "on", "with"}

    def hist_score(t, done):
        # Two points for each word shared with a task they've had before, one if it was in the same project.
        tw = words(t["t"])
        s = 0
        for d in done:
            text, _, proj = d.rpartition(" [")
            s += 2 * len(tw & words(text)) + (1 if norm(proj.rstrip("]")) == norm(t["_project"]) else 0)
        return min(s, 8)

    def pick_person(t):
        best, score = None, 0
        for m in team:
            s = sum(2 for k in m.get("good_at", []) if norm(k) and norm(k) in norm(t["t"] + " " + t["_project"]))
            s += hist_score(t, history.get(m["name"], []))
            if s > score:
                best, score = m["name"], s
        for who, done in history.items():
            if any(norm(who) == norm(m["name"]) for m in team):
                continue
            s = hist_score(t, done)
            if s > score + 1:
                best, score = who, s
        return best if score >= 2 else None

    mine = [t for t in tasks if is_mine(t, cfg["me"])]
    plan = {"top": [], "quick": [], "delegate": [], "later": [], "note": ""}
    used = set()
    for t in mine:
        text = norm(t["t"])
        if not any(k in text for k in keep_kw) and not t.get("delegatedAt"):
            who = pick_person(t)
            if who:
                d = days_left(t, day)
                due = " this week" if d is None else " today" if d <= 0 else " by tomorrow" if d == 1 else f" by {dt.date.fromisoformat(t['due'][:10]):%a %d %b}"
                plan["delegate"].append({"id": t["id"], "to": who, "reason": "similar to work they've done",
                                         "message": f"Hi {who}, can you take “{t['t'].strip()}” ({t['_project']}){due}? Tell me when it's done."})
                used.add(t["id"])
    rest = [t for t in mine if t["id"] not in used]
    strategic = sorted([t for t in rest if band(t, day) <= 2], key=lambda t: (rank(t), band(t, day), t["_ppri"]))
    first = strategic[0] if strategic else (rest[0] if rest else None)
    if first:
        plan["top"].append({"id": first["id"], "why": "your top-priority project", "first_step": "Open it and write the first line"})
        used.add(first["id"])
    for t in rest:
        if t["id"] in used:
            continue
        if len(plan["top"]) < cfg.get("max_top", 3) and band(t, day) <= 1 and not any(k in norm(t["t"]) for k in quick_kw):
            plan["top"].append({"id": t["id"], "why": "due now", "first_step": "Open it and do the first 5 minutes"})
        elif len(plan["quick"]) < cfg.get("max_quick", 4) and (any(k in norm(t["t"]) for k in quick_kw) or band(t, day) <= 1):
            plan["quick"].append(t["id"])
        elif band(t, day) <= 2:
            plan["later"].append(t["id"])
        else:
            continue
        used.add(t["id"])
    plan["note"] = (f"Yesterday you finished {len(yesterday_wins)}: {yesterday_wins[0]}." if yesterday_wins
                    else "Start with #1 before you open WhatsApp groups or email.")
    return plan


def clean_plan(plan, tasks, board, cfg):
    """Keep only real task ids, one list each, and real team names; stay within the limits."""
    ids = {t["id"] for t in tasks}
    allowed = {norm(n): n for n in team_names(board, cfg)}
    by_id = {t["id"]: t for t in tasks}
    used, out = set(), {"top": [], "quick": [], "delegate": [], "later": [], "note": str(plan.get("note", ""))[:240]}
    for d in plan.get("delegate", []):
        t = by_id.get(d.get("id"))
        if (t and d["id"] not in used and norm(d.get("to")) in allowed and is_mine(t, cfg["me"])
                and not t.get("delegatedAt")):  # handed off before and taken back: it stays yours
            out["delegate"].append({**d, "to": allowed[norm(d["to"])]})
            used.add(d["id"])
    for x in plan.get("top", []):
        if x.get("id") in ids and x["id"] not in used and len(out["top"]) < cfg.get("max_top", 3):
            out["top"].append(x)
            used.add(x["id"])
    for key, limit in (("quick", cfg.get("max_quick", 4)), ("later", 6)):
        for i in plan.get(key, []):
            if i in ids and i not in used and len(out[key]) < limit:
                out[key].append(i)
                used.add(i)
    return out


# ---------------------------------------------------------------- board updates

def apply_delegations(plan, token, cfg, day, dry_run):
    """Assign the delegated tasks on the board, replaying on the latest copy if someone saved meanwhile."""
    if not plan["delegate"] or not cfg.get("auto_assign", True) or dry_run or not token:
        return 0
    now = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    for _ in range(4):
        board, sha = read_file(DATA_PATH, token)
        changed = 0
        for d in plan["delegate"]:
            for p in board.get("projects", []):
                for t in p.get("tasks") or []:
                    if t.get("id") == d["id"] and is_mine({**t, "who": t.get("who")}, cfg["me"]) and status_of(t) != "Done":
                        t.update({"who": d["to"], "delegatedAt": now, "delegatedBy": BOT, "delegatedReason": d["reason"],
                                  "updatedBy": BOT, "updatedAt": now})
                        changed += 1
        if not changed:
            return 0
        first = plan["delegate"][0]
        msg = f"Board: {BOT} assigned {changed} task{'s' if changed > 1 else ''} ({first['to']}{' and others' if changed > 1 else ''})"
        status = write_file(DATA_PATH, board, sha, msg, token)
        if status in (200, 201):
            return changed
        if status != 409:
            print(f"Could not save the hand-offs to the board (HTTP {status}).", file=sys.stderr)
            return 0
        time.sleep(2)
    return 0


# ---------------------------------------------------------------- messages

def short(text, n=70):
    text = " ".join(str(text).split())
    return text if len(text) <= n else text[:n - 1].rstrip() + "…"


def morning_message(plan, tasks, cfg, day, handed):
    by_id = {t["id"]: t for t in tasks}
    lines = [f"*Good morning {cfg['me']}* · {day:%a %d %b}", ""]
    if plan["top"]:
        lines.append("*Do these, in this order*")
        for i, x in enumerate(plan["top"], 1):
            t = by_id[x["id"]]
            lines.append(f"{i}. {short(label(t, day))} — _{t['_project']}_")
            lines.append(f"   ↳ Start: {short(x['first_step'], 80)}")
        lines.append("")
    if plan["quick"]:
        lines.append("*Quick ones (one 30-min slot)*")
        lines += [f"• {short(label(by_id[i], day))}" for i in plan["quick"]]
        lines.append("")
    if plan["delegate"]:
        lines.append(f"*Handed off{' (assigned on the board)' if handed else ''}*")
        lines += [f"• {short(by_id[d['id']]['t'], 55)} → *{d['to']}*" for d in plan["delegate"]]
        lines.append("_Messages to forward are below._")
        lines.append("")
    if plan["later"]:
        lines.append(f"*Not today:* {len(plan['later'])} task{'s' if len(plan['later']) > 1 else ''} can wait.")
    if plan.get("note"):
        lines += ["", plan["note"]]
    return "\n".join(lines).strip()


def forward_message(plan):
    """One WhatsApp with a ready-to-forward line for each person."""
    if not plan["delegate"]:
        return None
    people = {}
    for d in plan["delegate"]:
        people.setdefault(d["to"], []).append(d["message"])
    parts = ["*Hand-off messages* · long-press, copy, forward"]
    for who, msgs in people.items():
        parts += ["", f"*{who}*"] + msgs
    return "\n".join(parts)


def midday_message(saved, board, cfg, day):
    tasks = {t["id"]: t for t in flatten(board, day)}
    top = [tasks[x["id"]] | {"_step": x.get("first_step", "")} for x in saved.get("top", []) if x["id"] in tasks]
    pending = [t for t in top if t["_status"] != "Done"]
    done = [t for t in top if t["_status"] == "Done"]
    if not top:
        return None
    if not pending:
        return f"*All {len(top)} of today's tasks are done.* That's the day's real work finished. Anything else is extra."
    t = pending[0]
    lines = [f"*Midday check* · {len(done)} of {len(top)} done", "",
             f"Next: *{short(t['t'])}*" + (" (not started yet)" if t["_status"] == "Not started" else ""),
             f"Just this: {short(t['_step'], 80) or 'open it and work for 25 minutes'}.",
             "Phone face down for 25 minutes, then mark it on the board."]
    return "\n".join(lines)


def evening_message(saved, board, cfg, day):
    tasks = flatten(board, day)
    by_id = {t["id"]: t for t in tasks}
    me = cfg["me"]
    wins = [t for t in tasks if done_on(t, day) and norm(t.get("doneBy") or t.get("updatedBy") or me) == norm(me)]
    team_wins = [t for t in tasks if done_on(t, day) and t not in wins]
    top = [by_id[x["id"]] for x in saved.get("top", []) if x["id"] in by_id] if saved else []
    carry = [t for t in top if t["_status"] != "Done"]
    chase = [t for t in tasks if t.get("delegatedBy") == BOT and t["_status"] != "Done" and (days_left(t, day) or 1) <= 0]
    lines = [f"*Day done* · {day:%a %d %b}", ""]
    if wins:
        lines.append(f"You finished *{len(wins)}* task{'s' if len(wins) != 1 else ''}" +
                     (f", your team finished {len(team_wins)}." if team_wins else "."))
    else:
        lines.append("Nothing is marked done on the board today. If you finished things, tick them: they count."
                     + (f" Your team finished {len(team_wins)}." if team_wins else ""))
    lines += [f"✓ {short(t['t'])}" for t in wins[:5]]
    if carry:
        lines += ["", "*Carries over to tomorrow*"] + [f"• {short(t['t'])}" for t in carry]
    if chase:
        lines += ["", "*Chase these hand-offs*"] + [f"• {short(t['t'], 50)} — {t.get('who')}" for t in chase[:5]]
    first = carry[0] if carry else None
    if first:
        lines += ["", f"Tomorrow's first task is already picked: *{short(first['t'])}*. Nothing to decide tonight."]
    if day.weekday() == 5 or day.weekday() == 4:
        week = [t for t in tasks if t["_status"] == "Done" and any(done_on(t, day - dt.timedelta(days=i)) for i in range(6))]
        lines += ["", f"This week: {len(week)} tasks closed across the board. Worth one line in your impact log."]
    lines += ["", "Mark anything you finished on the board so tomorrow's list is right."]
    return "\n".join(lines)


# ---------------------------------------------------------------- WhatsApp

def send_whatsapp(text, dry_run):
    if dry_run:
        print(text, end="\n\n---\n\n")
        return True
    phone = os.environ.get("WHATSAPP_PHONE", "").strip()
    if not phone:
        print("WHATSAPP_PHONE is not set; nothing sent.", file=sys.stderr)
        return False
    if os.environ.get("CALLMEBOT_APIKEY"):
        q = urllib.parse.urlencode({"phone": phone, "text": text, "apikey": os.environ["CALLMEBOT_APIKEY"]})
        req = urllib.request.Request(f"https://api.callmebot.com/whatsapp.php?{q}", headers={"User-Agent": "daily-ops-assistant"})
    elif os.environ.get("TWILIO_ACCOUNT_SID"):
        sid, tok = os.environ["TWILIO_ACCOUNT_SID"], os.environ.get("TWILIO_AUTH_TOKEN", "")
        frm = os.environ.get("TWILIO_WHATSAPP_FROM", "+14155238886")
        data = urllib.parse.urlencode({"From": f"whatsapp:{frm}", "To": f"whatsapp:{phone}", "Body": text}).encode()
        req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", data=data, headers={
            "Authorization": "Basic " + base64.b64encode(f"{sid}:{tok}".encode()).decode()})
    else:
        print("Add CALLMEBOT_APIKEY (or the TWILIO_* secrets) to send WhatsApp messages.", file=sys.stderr)
        return False
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                body = r.read().decode(errors="replace")
                if r.status < 300 and "ERROR" not in body.upper()[:400]:
                    return True
                print(f"WhatsApp gateway answered HTTP {r.status}.", file=sys.stderr)
        except urllib.error.URLError as e:
            print(f"WhatsApp send failed ({getattr(e, 'code', e.reason)}).", file=sys.stderr)
        time.sleep(5 * (attempt + 1))
    return False


# ---------------------------------------------------------------- runs

def load(args):
    token = os.environ.get("BOARD_TOKEN", "").strip()
    if args.board:
        board = json.loads(Path(args.board).read_text())
        cfg = json.loads(Path(args.config).read_text()) if args.config else {}
        return board, {**DEFAULT_CONFIG, **cfg}, None
    if not token:
        sys.exit("Add the BOARD_TOKEN secret: a GitHub token that can read and write dikshabhargava31-ops/ipa_task.")
    board, _ = read_file(DATA_PATH, token)
    if not board:
        sys.exit("The board has no data.json yet.")
    cfg, _ = read_file(CONFIG_PATH, token)
    return board, {**DEFAULT_CONFIG, **(cfg or {})}, token


def morning(args):
    board, cfg, token = load(args)
    day = today()
    all_tasks = flatten(board, day)
    yesterday = day - dt.timedelta(days=1 if day.weekday() else 2)
    wins = [t["t"].strip() for t in all_tasks if done_on(t, yesterday) and norm(t.get("doneBy") or cfg["me"]) == norm(cfg["me"])]
    open_tasks = [t for t in all_tasks if t["_status"] != "Done" and not t["_pdone"]]
    if not open_tasks:
        send_whatsapp(f"*Good morning {cfg['me']}* · {day:%a %d %b}\n\nThe board has no open tasks. Add today's work there and I'll plan it tomorrow.", args.dry_run)
        return
    candidates = [t for t in open_tasks if is_mine(t, cfg["me"])][:60]
    plan = None
    if os.environ.get("ANTHROPIC_API_KEY") and not args.no_ai:
        try:
            plan = plan_with_claude(candidates, board, cfg, day, wins)
        except Exception as e:  # the rules below still give a usable plan
            print(f"Claude planning failed ({type(e).__name__}); using the built-in rules.", file=sys.stderr)
    plan = clean_plan(plan or plan_with_rules(candidates, board, cfg, day, wins), candidates, board, cfg)
    handed = apply_delegations(plan, token, cfg, day, args.dry_run)
    ok = send_whatsapp(morning_message(plan, candidates, cfg, day, handed), args.dry_run)
    fwd = forward_message(plan)
    if fwd:
        send_whatsapp(fwd, args.dry_run)
    if token and not args.dry_run:
        path = f"{PLANS_DIR}/{day.isoformat()}.json"
        _, sha = read_file(path, token)
        write_file(path, {"date": day.isoformat(), "sent": ok, **plan}, sha, f"{BOT}: plan for {day:%d %b}", token)
    print(f"Morning plan: {len(plan['top'])} top, {len(plan['quick'])} quick, {len(plan['delegate'])} handed off "
          f"({handed} assigned on the board). Sent: {ok}.")


def followup(args, kind):
    board, cfg, token = load(args)
    day = today()
    saved = None
    if args.plan:
        saved = json.loads(Path(args.plan).read_text())
    elif token:
        saved, _ = read_file(f"{PLANS_DIR}/{day.isoformat()}.json", token)
    if kind == "midday":
        if not saved:
            print("No plan for today yet; skipping the midday nudge.")
            return
        text = midday_message(saved, board, cfg, day)
    else:
        text = evening_message(saved or {}, board, cfg, day)
    if text:
        ok = send_whatsapp(text, args.dry_run)
        print(f"{kind.capitalize()} message sent: {ok}.")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("mode", choices=["morning", "midday", "evening"])
    ap.add_argument("--dry-run", action="store_true", help="print the messages; send and change nothing")
    ap.add_argument("--no-ai", action="store_true", help="plan with the built-in rules only")
    ap.add_argument("--board", help="read a local data.json instead of the private repository (testing)")
    ap.add_argument("--config", help="with --board: a local config.json")
    ap.add_argument("--plan", help="with --board: a local saved plan for midday/evening")
    args = ap.parse_args()
    if args.board:
        args.dry_run = True
    if args.mode == "morning":
        morning(args)
    else:
        followup(args, args.mode)


if __name__ == "__main__":
    main()
