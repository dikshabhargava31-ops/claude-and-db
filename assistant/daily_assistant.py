#!/usr/bin/env python3
"""Daily Ops Assistant: plans the day from the IPA Ops Board and sends it to Gmail and your laptop.

Three runs a day (the "Daily assistant" workflow, India time):

  morning  Reads every open task on the board, picks the day's plan (one important task first,
           then the urgent ones, then quick wins), decides what to hand off and to whom, assigns
           those tasks on the board, and sends you the to-do list.
  midday   Checks the morning plan against the board and nudges about the first task that
           hasn't moved, with a five-minute first step.
  evening  Counts what got done, lists what carries over, and names tomorrow's first task.
           Also asks you to chase hand-offs that are overdue.

The board's data (ops.json) and this assistant's settings and saved plans stay in the private
repository dikshabhargava31-ops/ipa_task; nothing personal is written to this public repository
or printed in the public Actions log.

    BOARD_TOKEN=... python3 assistant/daily_assistant.py morning --dry-run   # print, change nothing
    python3 assistant/daily_assistant.py morning --board sample.json --dry-run

Environment:
  BOARD_TOKEN         GitHub token that can read and write ipa_task (Contents: read and write)
  ANTHROPIC_API_KEY   optional; without it the plan comes from built-in rules
  GMAIL_ADDRESS, GMAIL_APP_PASSWORD   send the messages as an email to yourself (EMAIL_TO for another inbox)
  NTFY_TOPIC          a private topic name: pop-up notifications on your laptop or phone through ntfy.sh
  WHATSAPP_PHONE, CALLMEBOT_APIKEY    optional: also send to WhatsApp through CallMeBot
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
DATA_PATH = "ops.json"  # the IPA Ops Board (priority/index.html)
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
    # Long-overdue dates are stale plans, not news: say "overdue" once instead of counting the days.
    when = ("" if d is None else f" ({-d}d overdue)" if -7 <= d < 0 else " (overdue)" if d < -7
            else " (today)" if d == 0 else " (tomorrow)" if d == 1 else "")
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
            "coo_move": {"type": "string", "description": "One concrete COO-level move for today, under 25 words: something that builds a system, hands off a recurring job, puts a number on results, or moves a strategic priority. Specific to this board, not generic advice."},
        },
        "required": ["top", "quick", "delegate", "later", "note", "coo_move"],
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
- Delegate only to names in the team list, and only work that clearly matches a person's role, KRAs and daily duties
  (for example test papers to the typist, reels to the video editor, lead calls to sales, data entry to the back office).
  Planning, target-setting, budgets, pricing, anything with management or the founder, and decisions stay with {me}.
  If nobody clearly fits, keep it. Hand off at most 5 tasks a day. Don't delegate a task already assigned to someone.
- Every task id you use must come from the task list. Each id appears in at most one list.
- Write the way {me} talks: short, plain, spoken English. Nothing dramatic or formal.
- Answer only by calling report_plan once."""


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
    messages = [{"role": "user", "content": prompt}]
    for _ in range(2):  # this model doesn't accept a forced tool choice, so ask again if it answers in text
        response = client.messages.create(model=MODEL, max_tokens=4000, system=system, messages=messages,
                                          tools=[PLAN_TOOL], tool_choice={"type": "auto"})
        block = next((b for b in response.content if b.type == "tool_use" and b.name == "report_plan"), None)
        if block:
            return block.input
        messages += [{"role": "assistant", "content": response.content},
                     {"role": "user", "content": "Please give the plan by calling report_plan once."}]
    return None


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
    # With the Ops Board, only Claude hands work off: keyword rules can't tell planning from routine work.
    for t in ([] if OPS else mine):
        text = norm(t["t"])
        if not any(k in text for k in keep_kw) and not t.get("delegatedAt"):
            who = pick_person(t)
            if who:
                d = days_left(t, day)
                due = " this week" if d is None else " today" if d <= 0 else " by tomorrow" if d == 1 else f" by {dt.date.fromisoformat(t['due'][:10]):%a %d %b}"
                plan["delegate"].append({"id": t["id"], "to": who, "reason": "similar to work they've done",
                                         "message": f"Hi {who}, can you take “{t['t'].strip()}” ({t['_project']}){due}? Tell me when it's done."})
                used.add(t["id"])
    rest = [t for t in mine if t["id"] not in used and t["_status"] != "Waiting"]  # waiting on someone else
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
    for d in plan.get("delegate", [])[:5]:
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
    now = dt.datetime.now(dt.timezone.utc).isoformat()[:19] + "Z"
    for _ in range(4):
        ops, sha = read_file(DATA_PATH, token)
        ids = {norm(p["name"]): p["id"] for p in ops.get("people", [])}
        changed = 0
        for d in plan["delegate"]:
            for t in ops.get("tasks", []):
                if t.get("id") == d["id"] and t.get("who") in ("me", "", None) and status_of(t) != "Done" and norm(d["to"]) in ids:
                    t.update({"who": ids[norm(d["to"])], "delegatedAt": now, "assignedAt": now, "delegatedBy": BOT,
                              "delegatedReason": d["reason"]})
                    changed += 1
        if not changed:
            return 0
        first = plan["delegate"][0]
        msg = f"Ops board: {BOT} assigned {changed} task{'s' if changed > 1 else ''} ({first['to']}{' and others' if changed > 1 else ''})"
        status = write_file(DATA_PATH, ops, sha, msg, token)
        if status in (200, 201):
            return changed
        if status != 409:
            print(f"Could not save the hand-offs to the board (HTTP {status}).", file=sys.stderr)
            return 0
        time.sleep(2)
    return 0


# ---------------------------------------------------------------- routines, follow-ups, reviews (Ops Board)

def routine_state(r, d, since):
    """Same rules as the board: daily Mon–Sat; weekly from its weekday; monthly inside its day window (+5 days)."""
    done_map = OPS.get("routineDone", {})
    dow = d.isoweekday() % 7  # Sunday = 0, as in the board
    if r["freq"] == "daily":
        key, due, overdue = d.isoformat(), dow != 0 and d.isoformat() >= since, False
    elif r["freq"] == "weekly":
        y, w, _ = d.isocalendar()
        key = f"{y}-W{w:02d}"
        due_day = d - dt.timedelta(days=dow - r.get("dow", 1))
        due, overdue = dow != 0 and dow >= r.get("dow", 1) and due_day.isoformat() >= since, dow > r.get("dow", 1)
    elif r["freq"] == "monthly":
        key = d.isoformat()[:7]
        last = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)
        to = min(r.get("to", 31), last.day)
        start = d.replace(day=min(r.get("from", 1), last.day))
        in_window = d.day >= r.get("from", 1) and start.isoformat() >= since
        due, overdue = in_window and d.day <= to + 5, in_window and d.day > to
    else:
        return False, False
    return due and done_map.get(r["id"]) != key, overdue


def routines_due(day):
    since = OPS.get("routineSince", "2000-01-01")
    out = [(r, od) for r in OPS.get("routines", []) for due, od in [routine_state(r, day, since)] if due]
    return sorted(out, key=lambda x: not x[1])


def follow_ups(day):
    """Team tasks to check on: stuck, due within a day, or no check-in for 2+ days."""
    names = {p["id"]: p["name"] for p in OPS.get("people", [])}
    out = []
    for t in OPS.get("tasks", []):
        if t.get("who") in ("me", "", None) or status_of(t) == "Done":
            continue
        left = days_left(t, day)
        last = (t.get("lastCheck") or t.get("assignedAt") or t.get("createdAt") or "")[:10]
        quiet = (day - dt.date.fromisoformat(last)).days if last else 99
        if status_of(t) == "Stuck" or (left is not None and left <= 1) or quiet >= 2:
            why = "stuck" if status_of(t) == "Stuck" else (f"{-left}d overdue" if left is not None and left < 0 else
                  "due today" if left == 0 else "due tomorrow" if left == 1 else f"no check-in for {quiet}d" if quiet < 99 else "no check-in yet")
            out.append((left if left is not None else 99, f"{short(t['t'], 55)} — {names.get(t['who'], t['who'])} ({why})"))
    return [x for _, x in sorted(out)]


def reviews_left(day):
    if day.day < 25:
        return None
    month = day.isoformat()[:7]
    done = (OPS.get("reviews") or {}).get(month, {})
    return [p["name"] for p in OPS.get("people", []) if not (done.get(p["id"]) or {}).get("k")]


def ops_lines(day, evening=False):
    """Extra lines for the morning and evening messages when the Ops Board is in use."""
    if not OPS:
        return []
    lines = []
    due = routines_due(day)
    if due and not evening:
        lines += ["", f"*Routine today* ({len(due)})"]
        lines += [f"• {short(r['task'], 70)}{' — overdue' if od else ''}" for r, od in due[:8]]
        if len(due) > 8:
            lines.append(f"…and {len(due) - 8} more on the board")
    elif due and evening:
        lines += ["", f"*Routine still open today:* {len(due)}. Tick the ones you did on the board."]
    fu = follow_ups(day)
    if fu:
        lines += ["", "*Follow up with the team*"] + [f"• {x}" for x in fu[:6]]
        if len(fu) > 6:
            lines.append(f"…and {len(fu) - 6} more on the board")
    left = reviews_left(day)
    if left:
        lines += ["", f"*KRA reviews:* {len(left)} left for {day:%B} ({', '.join(n.split()[0] for n in left[:5])}{'…' if len(left) > 5 else ''})."]
    return lines


# ---------------------------------------------------------------- messages

def short(text, n=70):
    text = " ".join(str(text).split())
    return text if len(text) <= n else text[:n - 1].rstrip() + "…"


def morning_message(plan, tasks, cfg, day, handed):
    by_id = {t["id"]: t for t in tasks}
    lines = [f"*Good morning {cfg['me']}* · {day:%a %d %b}", ""]
    if plan["top"]:
        lines.append("*Your list for today*" if plan.get("day_list") else "*Do these, in this order*")
        for i, x in enumerate(plan["top"], 1):
            t = by_id[x["id"]]
            if plan.get("day_list"):
                lines.append(f"{i}. {short(t['t'], 160)}")
                continue
            lines.append(f"{i}. {short(label(t, day), 95)} — _{t['_project']}_")
            lines.append(f"   ↳ Start: {short(x['first_step'], 80)}")
        lines.append("")
    if plan["quick"]:
        lines.append("*Quick ones (one 30-min slot)*")
        lines += [f"• {short(label(by_id[i], day), 95)}" for i in plan["quick"]]
        lines.append("")
    if plan["delegate"]:
        lines.append(f"*Handed off{' (assigned on the board)' if handed else ''}*")
        lines += [f"• {short(by_id[d['id']]['t'], 55)} → *{d['to']}*" for d in plan["delegate"]]
        lines.append("_Messages to forward are below._")
        lines.append("")
    if plan["later"]:
        lines.append(f"*Not today:* {len(plan['later'])} task{'s' if len(plan['later']) > 1 else ''} can wait.")
    slipping = [by_id[x["id"]] for x in plan["top"] if (by_id[x["id"]].get("carried") or 0) >= 3]
    if slipping:
        lines += ["", "*Slipping*"] + [f"• {short(t['t'], 70)} has moved {t['carried']} days. Do 15 minutes first, hand it off, or drop it."
                                        for t in slipping[:3]]
    lines += ops_lines(day)
    if plan.get("coo_move"):
        lines += ["", f"*COO move today:* {plan['coo_move']}"]
    if plan.get("note"):
        lines += ["", plan["note"]]
    return "\n".join(lines).strip()


def forward_message(plan):
    """A ready-to-send WhatsApp line for each person."""
    if not plan["delegate"]:
        return None
    people = {}
    for d in plan["delegate"]:
        people.setdefault(d["to"], []).append(d["message"])
    parts = ["*Hand-off messages* · copy each one and send it on WhatsApp"]
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
    chase = [] if OPS else [t for t in tasks if t.get("delegatedBy") == BOT and t["_status"] != "Done" and (days_left(t, day) or 1) <= 0]
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
    lines += ops_lines(day, evening=True)
    lines += ["", "Mark anything you finished on the board so tomorrow's list is right."]
    return "\n".join(lines)


# ---------------------------------------------------------------- sending

BOARD_URL = "https://dikshabhargava31-ops.github.io/claude-and-db/priority/"


def as_html(text):
    """WhatsApp-style *bold* and _italic_ to simple HTML for the email."""
    import html
    out = html.escape(text)
    out = re.sub(r"\*([^*\n]+)\*", r"<b>\1</b>", out)
    out = re.sub(r"(?<![\w])_([^_\n]+)_(?![\w])", r"<i>\1</i>", out)
    return ("<div style=\"font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2328\">"
            + out.replace("\n", "<br>") + f"<br><br><a href=\"{BOARD_URL}\">Open the IPA Ops Board</a></div>")


def as_markdown(text):
    """WhatsApp-style *bold* and _italic_ to Markdown for the ntfy notification."""
    out = re.sub(r"\*([^*\n]+)\*", r"**\1**", text)
    return re.sub(r"(?<![\w])_([^_\n]+)_(?![\w])", r"*\1*", out)


def send_email(text, title):
    import smtplib
    from email.message import EmailMessage
    user = "".join(os.environ["GMAIL_ADDRESS"].split())
    m = EmailMessage()
    m["Subject"], m["From"], m["To"] = title, f"{BOT} <{user}>", os.environ.get("EMAIL_TO", "").strip() or user
    m.set_content(re.sub(r"[*_]", "", text) + f"\n\nBoard: {BOARD_URL}")
    m.add_alternative(as_html(text), subtype="html")
    password = "".join(os.environ["GMAIL_APP_PASSWORD"].split())
    if "@" not in user or len(password) != 16 or not password.isalnum():
        raise ValueError(f"check the secrets: GMAIL_ADDRESS {'looks right' if '@' in user else 'has no @'}, "
                         f"GMAIL_APP_PASSWORD has {len(password)} letters (an app password has 16, letters only)")

    def attempt(port):
        stage = "connecting"
        try:
            smtp = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=40) if port == 465 else smtplib.SMTP("smtp.gmail.com", 587, timeout=40)
            with smtp:
                stage = "greeting"
                smtp.ehlo()
                if port == 587:
                    stage = "starting encryption"
                    smtp.starttls()
                    smtp.ehlo()
                stage = "signing in"
                smtp.login(user, password)
                stage = "sending"
                smtp.send_message(m)
        except smtplib.SMTPException as e:
            raise type(e)(f"port {port}, while {stage}: {e}") if isinstance(e, smtplib.SMTPServerDisconnected) else e

    try:
        attempt(465)
    except (smtplib.SMTPServerDisconnected, OSError) as e:
        print(f"Gmail: {e}; trying port 587.", file=sys.stderr)
        attempt(587)


def send_ntfy(text, title, urgent=False):
    topic = os.environ["NTFY_TOPIC"].strip()
    req = urllib.request.Request(f"https://ntfy.sh/{urllib.parse.quote(topic)}", data=as_markdown(text).encode(), headers={
        "Title": title.encode("ascii", "ignore").decode(), "Markdown": "yes", "Click": BOARD_URL,
        "Tags": "clipboard", "Priority": "high" if urgent else "default", "User-Agent": "daily-ops-assistant"})
    with urllib.request.urlopen(req, timeout=30) as r:
        r.read()


def send_whatsapp(text, phone, key):
    q = urllib.parse.urlencode({"phone": phone, "text": text, "apikey": key})
    req = urllib.request.Request(f"https://api.callmebot.com/whatsapp.php?{q}", headers={"User-Agent": "daily-ops-assistant"})
    with urllib.request.urlopen(req, timeout=40) as r:
        if "ERROR" in r.read().decode(errors="replace").upper()[:400]:
            raise RuntimeError("CallMeBot refused the message")


def notify(text, dry_run, title, urgent=False):
    """Send one message to every channel that has its secrets: Gmail, laptop/phone (ntfy), WhatsApp (CallMeBot)."""
    if dry_run:
        print(f"[{title}]\n{text}", end="\n\n---\n\n")
        return True
    env = os.environ.get
    channels = []
    if env("GMAIL_ADDRESS") and env("GMAIL_APP_PASSWORD"):
        channels.append(("Gmail", lambda: send_email(text, title)))
    if env("NTFY_TOPIC"):
        channels.append(("laptop notification", lambda: send_ntfy(text, title, urgent)))
    if env("WHATSAPP_PHONE") and env("CALLMEBOT_APIKEY"):
        channels.append(("WhatsApp", lambda: send_whatsapp(text, env("WHATSAPP_PHONE").strip(), env("CALLMEBOT_APIKEY").strip())))
    if not channels:
        print("No channel set up: add GMAIL_ADDRESS and GMAIL_APP_PASSWORD, or NTFY_TOPIC (assistant/README.md).", file=sys.stderr)
        return False
    sent = []
    for name, send in channels:
        for attempt in range(3):
            try:
                send()
                sent.append(name)
                break
            except Exception as e:  # server replies name the problem but never contain the password
                print(f"{name}: send failed ({type(e).__name__}: {str(e)[:300]}).", file=sys.stderr)
                time.sleep(5 * (attempt + 1))
    print(f"\"{title}\" sent by: {', '.join(sent) or 'nothing'} (of {', '.join(n for n, _ in channels)}).")
    return bool(sent)


# ---------------------------------------------------------------- once a day per message

SENT_DIR = "assistant/sent"


# Timed runs only send inside their own window (India time). GitHub sometimes starts a scheduled run hours late:
# on 19 Nov the evening run started at 03:08 the next day and treated that day as finished.
WINDOWS = {"morning": (7, 0, 12, 0), "midday": (12, 0, 17, 0), "evening": (17, 30, 23, 0)}


def in_window(mode):
    now = dt.datetime.now(IST)
    h1, m1, h2, m2 = WINDOWS[mode]
    return (h1, m1) <= (now.hour, now.minute) < (h2, m2)


def skip_timed_run(mode, args, token, day):
    if not args.once:
        return False
    if not in_window(mode):
        print(f"Not sending the {mode} message: it's {dt.datetime.now(IST):%H:%M} in India, outside its window.")
        return True
    if already_sent(mode, token, day):
        print(f"The {mode} message already went out today.")
        return True
    return False


def already_sent(mode, token, day):
    """GitHub sometimes starts a scheduled run late or not at all, so each message has backup times.
    The first run that sends records it here; later backup runs for the same message stay quiet."""
    if not token:
        return False
    done, _ = read_file(f"{SENT_DIR}/{day.isoformat()}.json", token)
    return bool((done or {}).get(mode))


def mark_sent(mode, token, day):
    if not token:
        return
    for _ in range(3):
        done, sha = read_file(f"{SENT_DIR}/{day.isoformat()}.json", token)
        done = done or {}
        done[mode] = dt.datetime.now(IST).isoformat(timespec="minutes")
        if write_file(f"{SENT_DIR}/{day.isoformat()}.json", done, sha, f"{BOT}: sent the {mode} message", token) in (200, 201):
            return
        time.sleep(2)


# ---------------------------------------------------------------- smarter lists

def update_ops(fn, msg, token):
    """Change ops.json on the newest copy, retrying if the board saved in between. fn returns a count of changes."""
    for _ in range(4):
        ops, sha = read_file(DATA_PATH, token)
        n = fn(ops)
        if not n:
            return 0
        if write_file(DATA_PATH, ops, sha, f"Ops board: {BOT} {msg}", token) in (200, 201):
            return n
        time.sleep(2)
    return 0


def next_workday(day):
    nxt = day + dt.timedelta(days=1)
    return nxt + dt.timedelta(days=1) if nxt.weekday() == 6 else nxt


def carry_over(token, day):
    """Evening: unfinished tasks on today's list move to the end of the next working day's list."""
    nxt = next_workday(day)

    def fn(ops):
        tasks = ops.get("tasks", [])
        left = sorted([t for t in tasks if t.get("plannedFor") == day.isoformat() and status_of(t) != "Done" and t.get("who") in ("me", "", None)],
                      key=lambda t: t.get("order") or 0)
        start = max([t.get("order") or 0 for t in tasks if t.get("plannedFor") == nxt.isoformat()] or [0])
        for i, t in enumerate(left, 1):
            t.update({"plannedFor": nxt.isoformat(), "order": start + i, "carried": (t.get("carried") or 0) + 1})
        return len(left)
    return update_ops(fn, f"moved unfinished tasks to {nxt:%d %b}", token), nxt


ASK = re.compile(r"^ask\s+(?P<who>.+?)\s+(?:to|for|about)\s+(?P<what>.+)$", re.I)


def ask_followups(day_list, token, day):
    """'Ask Sunil to make the KD Jain list' also becomes Sunil's task, so it shows up in follow-ups."""
    people = {p["name"].replace(" Ma'am", "").split()[0].lower(): p for p in OPS.get("people", [])}
    wanted = []
    for t in day_list:
        m = ASK.match(t["t"].strip())
        if not m:
            continue
        key = m.group("who").replace(" Ma'am", "").replace(" ma'am", "").split()[0].lower()
        if key in people:
            what = m.group("what").strip()
            wanted.append((t["id"], people[key]["id"], what[0].upper() + what[1:], t.get("project", "")))
    if not wanted:
        return 0
    now = dt.datetime.now(dt.timezone.utc).isoformat()[:19] + "Z"

    def fn(ops):
        have = {x.get("fromTask") for x in ops.get("tasks", [])}
        n = 0
        for src, pid, what, project in wanted:
            if src in have:
                continue
            ops["tasks"].append({"id": f"f{src}", "t": what, "who": pid, "project": project, "due": day.isoformat(), "pri": "High",
                                 "status": "Not started", "note": "Asked by Diksha", "createdAt": now, "assignedAt": now, "fromTask": src})
            n += 1
        return n
    return update_ops(fn, "added follow-ups for today's 'Ask …' tasks", token)


# ---------------------------------------------------------------- the COO coach

COACH_TOOL = {
    "name": "report_coaching",
    "description": "Report the weekly coaching. Call it exactly once.",
    "input_schema": {
        "type": "object",
        "properties": {
            "headline": {"type": "string", "description": "One sentence: the honest read on this week, with a number in it."},
            "missing": {"type": "array", "description": "2 or 3 things she is missing or doing that hold her back from COO-level work. Each tied to evidence from the data.",
                        "items": {"type": "object", "properties": {"gap": {"type": "string"}, "evidence": {"type": "string", "description": "Numbers or task names from this week"}},
                                  "required": ["gap", "evidence"]}},
            "coo_actions": {"type": "array", "description": "2 or 3 concrete actions for the coming week that a COO would take. Each doable within the week.",
                            "items": {"type": "object", "properties": {"action": {"type": "string"}, "why": {"type": "string"}, "first_step": {"type": "string", "description": "Under 15 words"}},
                                      "required": ["action", "why", "first_step"]}},
            "growth": {"type": "array", "description": "1 or 2 things to implement now at the centre for growth (admissions, revenue, retention, results, brand). Specific to IPA's projects and team, with how to start and what to measure.",
                       "items": {"type": "object", "properties": {"idea": {"type": "string"}, "how_to_start": {"type": "string"}, "owner": {"type": "string", "description": "Who on the team should run it"}, "metric": {"type": "string"}},
                                 "required": ["idea", "how_to_start", "owner", "metric"]}},
            "number_to_track": {"type": "string", "description": "One number to track next week, with this week's value if known."},
            "impact_line": {"type": "string", "description": "One line she can forward to the founder about this week's results, with numbers. Plain, not boastful."},
        },
        "required": ["headline", "missing", "coo_actions", "growth", "number_to_track", "impact_line"],
    },
}

COACH_SYSTEM = """You are an experienced COO and executive coach for {me}. {profile}

Each week you read {me}'s operations board for an education institute (IPA): what {me} finished, what slipped, what was handed
to the team, routines kept, KRA reviews, meetings and spending. Then you coach {me} towards a COO role.

Be specific and honest, like a good mentor: point to real tasks and numbers from the data, never generic advice.
Look for: urgent work crowding out the priority order ({priorities}); work {me} does that the team could do; tasks that keep
slipping; follow-ups and reviews not happening; results not measured; the centre's growth levers (admissions pipeline,
conversion, CUET counselling, mentorship programmes, PARTHU AI, content) not being pushed.
Growth ideas must suit an Indian coaching institute and this team; name who should own them.
Write in short, plain, spoken English. No clichés, no flattery, no emojis. Answer only by calling report_coaching once."""


def week_data(day):
    """A compact summary of the last 7 days from the board, for the coach."""
    start = day - dt.timedelta(days=6)
    names = {p["id"]: p["name"] for p in OPS.get("people", [])}
    in_week = lambda s: bool(s) and start.isoformat() <= s[:10] <= day.isoformat()
    tasks = OPS.get("tasks", [])
    mine_done = [t for t in tasks if t.get("who") in ("me", "", None) and status_of(t) == "Done" and in_week(t.get("doneAt"))]
    team_done = [t for t in tasks if t.get("who") not in ("me", "", None) and status_of(t) == "Done" and in_week(t.get("doneAt"))]
    by_proj = {}
    for t in mine_done:
        by_proj[t.get("project") or "No project"] = by_proj.get(t.get("project") or "No project", 0) + 1
    open_mine = [t for t in tasks if t.get("who") in ("me", "", None) and status_of(t) != "Done"]
    overdue = [t for t in open_mine if (days_left(t, day) or 0) < 0]
    team_open = [t for t in tasks if t.get("who") not in ("me", "", None) and status_of(t) != "Done"]
    slipping = [t for t in open_mine if (t.get("carried") or 0) >= 2]
    handed = [t for t in tasks if in_week(t.get("delegatedAt") or t.get("assignedAt"))]
    logs = [x for x in OPS.get("log", []) if in_week(x.get("at"))]
    routines_done = [x for x in logs if x.get("kind") == "routine"]
    notes = [x for x in logs if x.get("kind") == "note"]
    month = day.isoformat()[:7]
    reviewed = len([1 for r in (OPS.get("reviews") or {}).get(month, {}).values() if r.get("k")])
    meetings = [m for m in OPS.get("meetings", []) if in_week(m.get("date"))]
    spent = sum(float(e.get("amount") or 0) for e in OPS.get("expenses", []) if (e.get("date") or "")[:7] == month and e.get("status") in ("Approved", "Paid"))
    budget = sum(float(v or 0) for v in (OPS.get("budget") or {}).values())
    L = [f"Week: {start:%d %b} to {day:%d %b %Y}.",
         f"Finished by {OPS.get('me', 'her')}: {len(mine_done)} tasks. By project: " + "; ".join(f"{k}: {v}" for k, v in sorted(by_proj.items(), key=lambda x: -x[1])),
         "Finished tasks: " + "; ".join(short(t["t"], 70) for t in mine_done[:25]),
         f"Other work she logged: " + ("; ".join(short(x["text"], 60) for x in notes[:15]) or "none"),
         f"Team finished: {len(team_done)} tasks (" + "; ".join(f"{short(t['t'], 40)} – {names.get(t['who'], t['who'])}" for t in team_done[:10]) + ")",
         f"Handed to the team this week: {len(handed)}. Team tasks still open: {len(team_open)}, of which overdue: "
         f"{len([t for t in team_open if (days_left(t, day) or 0) < 0])}.",
         f"Her open tasks: {len(open_mine)}, overdue: {len(overdue)}. Overdue by project: " +
         "; ".join(f"{k}: {v}" for k, v in sorted({(t.get('project') or '-'): sum(1 for x in overdue if x.get('project') == t.get('project')) for t in overdue}.items(), key=lambda x: -x[1])[:8]),
         "Slipping (moved 2+ days): " + ("; ".join(f"{short(t['t'], 60)} ({t['carried']}x)" for t in slipping) or "none"),
         f"Routines ticked this week: {len(routines_done)} of {len(OPS.get('routines', []))} defined.",
         f"Team meetings held this week: {len(meetings)}. KRA reviews done for {month}: {reviewed} of {len(OPS.get('people', []))} people.",
         f"Spending this month: ₹{spent:,.0f}" + (f" of a ₹{budget:,.0f} budget." if budget else " (no budget set)."),
         "Projects in priority order: " + "; ".join(f"P{p['priority']} {p['name']}" for p in sorted(OPS.get("projects", []), key=lambda p: p.get("priority", 99))),
         "Team: " + "; ".join(f"{p['name']} ({p['role']})" for p in OPS.get("people", []))]
    return "\n".join(L)


def coach(args):
    board, cfg, token = load(args)
    day = today()
    if not OPS or not os.environ.get("ANTHROPIC_API_KEY") or args.no_ai:
        print("The coach needs the Ops Board and ANTHROPIC_API_KEY.")
        return
    import anthropic
    system = COACH_SYSTEM.format(me=cfg["me"], profile=cfg.get("profile", ""),
                                 priorities=" → ".join(cfg.get("priority_order") or []))
    messages = [{"role": "user", "content": week_data(day) + "\n\nCoach me for next week."}]
    client, report = anthropic.Anthropic(), None
    for _ in range(2):
        response = client.messages.create(model=MODEL, max_tokens=6000, system=system, messages=messages,
                                          tools=[COACH_TOOL], tool_choice={"type": "auto"})
        block = next((b for b in response.content if b.type == "tool_use" and b.name == "report_coaching"), None)
        if block:
            report = block.input
            break
        messages += [{"role": "assistant", "content": response.content},
                     {"role": "user", "content": "Please give it by calling report_coaching once."}]
    if not report:
        print("The coach didn't return a report.", file=sys.stderr)
        return
    L = [f"*Your weekly COO coach* · {day:%d %b}", "", report["headline"], "", "*What you're missing*"]
    L += [f"• {x['gap']} _({x['evidence']})_" for x in report["missing"]]
    L += ["", "*Your COO actions this week*"]
    L += [f"{i}. {x['action']}\n   Why: {x['why']}\n   Start: {x['first_step']}" for i, x in enumerate(report["coo_actions"], 1)]
    L += ["", "*Grow the centre: start now*"]
    L += [f"• {x['idea']}\n   How: {x['how_to_start']}\n   Owner: {x['owner']} · Measure: {x['metric']}" for x in report["growth"]]
    L += ["", f"*Number to track:* {report['number_to_track']}", "", f"*For the founder:* {report['impact_line']}"]
    notify("\n".join(L), args.dry_run, f"Your weekly COO coach - {day:%d %b}")
    if token and not args.dry_run:
        entry = {"date": day.isoformat(), **report}
        update_ops(lambda ops: ops.setdefault("coach", []).append(entry) or 1, "saved the weekly coaching", token)


# ---------------------------------------------------------------- runs

OPS = {}  # the Ops Board's data for this run: people, routines, reviews


def ops_to_board(ops):
    """The Ops Board keeps one task list; the planner works on tasks grouped by project, with names in `who`."""
    names = {p["id"]: p["name"] for p in ops.get("people", [])}
    projects = {p["name"]: {"id": p["name"], "name": p["name"], "priority": p.get("priority", 99), "tasks": []}
                for p in ops.get("projects", [])}
    for t in ops.get("tasks", []):
        name = t.get("project") or "General"
        proj = projects.setdefault(name, {"id": name, "name": name, "priority": 99, "tasks": []})
        who = "" if t.get("who") in ("me", "", None) else names.get(t["who"], t["who"])
        proj["tasks"].append({**t, "who": who, "doneBy": who or ops.get("me", "")})
    return {"projects": list(projects.values())}


def team_from_ops(ops):
    """Each person's role, KRAs and daily duties tell the planner what to hand them."""
    team = []
    for p in ops.get("people", []):
        good = [k["kra"] for k in p.get("kras", []) if k["kra"] != "Daily task sheet"]
        good += [d for d in (p.get("duties") or {}).get("daily", []) if "task sheet" not in d.lower()]
        team.append({"name": p["name"], "role": p.get("role", ""), "good_at": good})
    return team


def load(args):
    global OPS
    token = os.environ.get("BOARD_TOKEN", "").strip()
    if args.board:
        data = json.loads(Path(args.board).read_text())
        cfg = {**DEFAULT_CONFIG, **(json.loads(Path(args.config).read_text()) if args.config else {})}
        token = None
    else:
        if not token:
            sys.exit("Add the BOARD_TOKEN secret: a GitHub token that can read and write dikshabhargava31-ops/ipa_task.")
        data, _ = read_file(DATA_PATH, token)
        if not data:
            sys.exit("The board has no ops.json yet.")
        cfg, _ = read_file(CONFIG_PATH, token)
        cfg = {**DEFAULT_CONFIG, **(cfg or {})}
    if "people" not in data:  # an old Priority Board file (tests)
        OPS = {}
        return data, cfg, token
    OPS = data
    cfg["me"] = data.get("me") or cfg["me"]
    if data.get("people"):
        cfg["team"] = team_from_ops(data)
    return ops_to_board(data), cfg, token


def morning(args):
    board, cfg, token = load(args)
    day = today()
    if skip_timed_run("morning", args, token, day):
        return
    all_tasks = flatten(board, day)
    yesterday = day - dt.timedelta(days=1 if day.weekday() else 2)
    wins = [t["t"].strip() for t in all_tasks if done_on(t, yesterday) and norm(t.get("doneBy") or cfg["me"]) == norm(cfg["me"])]
    open_tasks = [t for t in all_tasks if t["_status"] != "Done" and not t["_pdone"]]
    if not open_tasks:
        notify(f"*Good morning {cfg['me']}* · {day:%a %d %b}\n\nThe board has no open tasks. Add today's work there and I'll plan it tomorrow.",
               args.dry_run, f"Today's plan - {day:%a %d %b}")
        return
    candidates = [t for t in open_tasks if is_mine(t, cfg["me"])]
    # Tasks you put on today's list (plannedFor = today) are sent as you wrote them, in your order.
    day_list = sorted([t for t in candidates if t.get("plannedFor") == day.isoformat()], key=lambda t: t.get("order") or 0)
    rest = [t for t in candidates if t not in day_list][:60]
    candidates = day_list + rest
    plan = None
    if os.environ.get("ANTHROPIC_API_KEY") and not args.no_ai:
        try:
            plan = plan_with_claude(rest or candidates, board, cfg, day, wins)
        except Exception as e:  # the rules below still give a usable plan
            detail = getattr(e, "message", None) or str(e)
            print(f"Claude planning failed ({type(e).__name__}: {str(detail)[:300]}); using the built-in rules.", file=sys.stderr)
    coo_move = (plan or {}).get("coo_move", "")
    plan = clean_plan(plan or plan_with_rules(rest, board, cfg, day, wins), rest, board, cfg)
    plan["coo_move"] = str(coo_move)[:220]
    if token and not args.dry_run and day_list:
        made = ask_followups(day_list, token, day)
        if made:
            print(f"Created {made} follow-up task(s) from 'Ask …' items.")
    if day_list:  # your own list replaces the suggested top tasks and quick ones; hand-offs come from the rest
        plan["top"] = [{"id": t["id"], "why": "on your list", "first_step": ""} for t in day_list]
        plan["quick"] = []
        plan["day_list"] = True
    stale = sum(1 for t in candidates if (days_left(t, day) or 0) < -14)
    if stale >= 5 and day.weekday() == 0:  # Mondays: clear the backlog so the list stays believable
        plan["note"] = (plan["note"] + " " if plan["note"] else "") + (
            f"Weekly reset: {stale} tasks are 2+ weeks past their date. Give them new dates on the board, or delete the ones that no longer matter.")
    handed = apply_delegations(plan, token, cfg, day, args.dry_run)
    text = morning_message(plan, candidates, cfg, day, handed)
    fwd = forward_message(plan)
    n = len(plan["top"])
    ok = notify(text + (f"\n\n━━━━━━━━━━\n\n{fwd}" if fwd else ""), args.dry_run,
                f"Today's plan - {n} task{'s' if n != 1 else ''} - {day:%a %d %b}")
    if token and not args.dry_run:
        path = f"{PLANS_DIR}/{day.isoformat()}.json"
        _, sha = read_file(path, token)
        write_file(path, {"date": day.isoformat(), "sent": ok, **plan}, sha, f"{BOT}: plan for {day:%d %b}", token)
    if ok and not args.dry_run:
        mark_sent("morning", token, day)
    print(f"Morning plan: {len(plan['top'])} top, {len(plan['quick'])} quick, {len(plan['delegate'])} handed off "
          f"({handed} assigned on the board). Sent: {ok}.")


def resend(args):
    """Send today's morning list again as it was planned: no new plan and no new hand-offs."""
    board, cfg, token = load(args)
    day = today()
    saved = json.loads(Path(args.plan).read_text()) if args.plan else (read_file(f"{PLANS_DIR}/{day.isoformat()}.json", token)[0] if token else None)
    if not saved:
        sys.exit("There is no plan for today yet; run the morning message instead.")
    tasks = flatten(board, day)
    by_id = {t["id"] for t in tasks}
    plan = {k: saved.get(k) or [] for k in ("top", "quick", "delegate", "later")}
    plan["top"] = [x for x in plan["top"] if x["id"] in by_id]
    plan["quick"] = [i for i in plan["quick"] if i in by_id]
    plan["delegate"] = [d for d in plan["delegate"] if d["id"] in by_id]
    plan["note"], plan["day_list"] = saved.get("note", ""), saved.get("day_list", False)
    text = morning_message(plan, tasks, cfg, day, bool(plan["delegate"]))
    fwd = forward_message(plan)
    notify(text + (f"\n\n━━━━━━━━━━\n\n{fwd}" if fwd else ""), args.dry_run, f"Today's plan (sent again) - {day:%a %d %b}")


def followup(args, kind):
    board, cfg, token = load(args)
    day = today()
    if skip_timed_run(kind, args, token, day):
        return
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
        title = "Midday check"
    else:
        text = evening_message(saved or {}, board, cfg, day)
        title = f"Day done - {day:%a %d %b}"
        if token and not args.dry_run:
            moved, nxt = carry_over(token, day)
            if moved:
                text += f"\n\n*Moved to {nxt:%A}'s list:* {moved} unfinished task{'s' if moved != 1 else ''}, at the end. Change it on the board if you like."
    if text:
        ok = notify(text, args.dry_run, title, urgent=kind == "midday")
        if ok and not args.dry_run:
            mark_sent(kind, token, day)
        print(f"{kind.capitalize()} message sent: {ok}.")
    if kind == "evening" and day.weekday() == 5 and not args.dry_run:
        coach(args)  # Saturday evening: the weekly COO coaching report


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("mode", choices=["morning", "midday", "evening", "resend", "coach"],
                    help="resend: send today's morning list again, without re-planning. coach: the weekly COO coaching report now")
    ap.add_argument("--dry-run", action="store_true", help="print the messages; send and change nothing")
    ap.add_argument("--no-ai", action="store_true", help="plan with the built-in rules only")
    ap.add_argument("--once", action="store_true", help="skip if this message already went out today (scheduled runs)")
    ap.add_argument("--board", help="read a local data.json instead of the private repository (testing)")
    ap.add_argument("--config", help="with --board: a local config.json")
    ap.add_argument("--plan", help="with --board: a local saved plan for midday/evening")
    args = ap.parse_args()
    if args.board:
        args.dry_run = True
    if args.mode == "morning":
        morning(args)
    elif args.mode == "resend":
        resend(args)
    elif args.mode == "coach":
        coach(args)
    else:
        followup(args, args.mode)


if __name__ == "__main__":
    main()
