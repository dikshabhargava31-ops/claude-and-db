#!/usr/bin/env python3
"""Keep cuet/data/forms.json up to date with Claude.

Every run:
  1. checks each form already on the site against the college's official admission pages
     (status, round deadlines, apply link), and
  2. looks for new UG application forms (colleges with their own admissions, or that take CUET)
     that are not on the site yet.

Changes are written to forms.json; the "Forms watcher" workflow then opens a pull request so the
Everything CUET team can review and merge them. Nothing goes live without that review.

    ANTHROPIC_API_KEY=... python3 cuet/scripts/forms_watch.py            # check all + discover
    python3 cuet/scripts/forms_watch.py --only ashoka christ             # check some forms
    python3 cuet/scripts/forms_watch.py --no-discover --dry-run          # print, write nothing

Needs `pip install anthropic`. Writes a short markdown summary to cuet/data/forms-watch.md for the PR.
"""
import argparse
import concurrent.futures as cf
import datetime as dt
import json
import re
import sys
import urllib.parse
from pathlib import Path

import anthropic

DATA = Path(__file__).resolve().parent.parent / "data"
FORMS = DATA / "forms.json"
SUMMARY = DATA / "forms-watch.md"
MODEL = "claude-opus-5-5"
CYCLE = "2027"
# Pages that only repeat news; they may be read for leads but are never stored as the place to apply.
NOT_OFFICIAL = ("careers360", "collegedunia", "shiksha", "matchtocollege", "collegedekho", "pw.live", "cracku",
                "iquanta", "aglasem", "toprankers", "sarvgyan", "kollegeapply", "hitbullseye", "careerlauncher",
                "imsindia", "findmycollege", "zollege", "collegehai", "pagalguy", "indcareer", "jagranjosh",
                "ndtv", "indiatoday", "timesofindia", "hindustantimes", "wikipedia", "youtube", "facebook",
                "instagram", "linkedin", "twitter", "x.com", "reddit", "quora")
STATUSES = ["open", "upcoming", "closed", "check"]

DEADLINE = {
    "type": "object",
    "properties": {
        "label": {"type": "string", "description": "Short name, e.g. 'Round 1' or 'Applications close'"},
        "date": {"type": "string", "description": "YYYY-MM-DD, or YYYY-MM-DDTHH:MM:00+05:30 when a time is given"},
        "source": {"type": "string", "description": "URL of the page that states this date"},
    },
    "required": ["label", "date", "source"],
    "additionalProperties": False,
}
CHECK_TOOL = {
    "name": "report_form",
    "description": "Report the current UG admission status of one college or test. Call it exactly once, at the end.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": STATUSES,
                       "description": "open: applications being accepted now; upcoming: announced or expected but not open; "
                                      "closed: this cycle's applications have closed; check: nothing found for the cycle"},
            "deadlines": {"type": "array", "items": DEADLINE,
                          "description": "Every application or round deadline for this cycle you found. Empty if none."},
            "apply_url": {"type": "string", "description": "Official page where students apply (college or test domain). Empty if not found."},
            "entrance": {"type": "string", "description": "How students get in, one short line"},
            "accepts_cuet": {"type": "boolean", "description": "True only if the college says it accepts NTA's CUET (UG) score"},
            "note": {"type": "string", "description": "One plain sentence for students, e.g. test date or round details. Empty if nothing useful."},
            "confident": {"type": "boolean", "description": "True only if the dates come from the college's or test body's own website"},
        },
        "required": ["status", "deadlines", "apply_url", "entrance", "accepts_cuet", "note", "confident"],
        "additionalProperties": False,
    },
}
DISCOVER_TOOL = {
    "name": "report_new_forms",
    "description": "Report new UG application forms that are not on the existing list. Call it exactly once, at the end.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "forms": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "College or test name as students know it"},
                    "city": {"type": "string"},
                    "type": {"type": "string", "description": "Short course area, e.g. 'Liberal arts', 'Management (IPM)', 'Design'"},
                    "status": {"type": "string", "enum": ["open", "upcoming"]},
                    "apply_url": {"type": "string", "description": "Official application or admissions page"},
                    "entrance": {"type": "string"},
                    "accepts_cuet": {"type": "boolean"},
                    "deadlines": {"type": "array", "items": DEADLINE},
                    "note": {"type": "string"},
                },
                "required": ["name", "city", "type", "status", "apply_url", "entrance", "accepts_cuet", "deadlines", "note"],
                "additionalProperties": False,
            }},
        },
        "required": ["forms"],
        "additionalProperties": False,
    },
}
SYSTEM = (
    "You keep the college application-form list of Everything CUET, a free website for Indian students applying to "
    f"undergraduate programmes starting in {CYCLE}. Students rely on these dates, so accuracy beats coverage. "
    "Use web search and web fetch. Prefer the college's or test body's own website; a news or coaching site can point "
    "you to the official page but is never enough on its own to report a date as confident. Report only dates for the "
    f"{CYCLE} intake (the cycle whose applications run from mid-{int(CYCLE) - 1} to mid-{CYCLE}); never copy last year's "
    "dates forward. If you cannot confirm something, leave it out and say so in the note. When done, call the report tool once."
)


def domain(url):
    return urllib.parse.urlparse(url or "").netloc.lower().removeprefix("www.")


def official(url):
    d = domain(url)
    return bool(d) and not any(bad in d for bad in NOT_OFFICIAL)


def valid_date(s):
    try:
        dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
        return bool(re.match(r"^\d{4}-\d{2}-\d{2}", s))
    except ValueError:
        return False


def ask(client, prompt, tool):
    """One research task: Claude searches the web, then calls the report tool. Returns its input, or None."""
    messages = [{"role": "user", "content": prompt}]
    tools = [{"type": "web_search_20260209", "name": "web_search", "max_uses": 8},
             {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 6}, tool]
    for _ in range(6):
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM,
            messages=messages,
            tools=tools,
            tool_choice={"type": "auto"},
            output_config={"effort": "medium"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if response.stop_reason == "refusal":
            print("  declined:", response.stop_details, file=sys.stderr)
            return None
        report = next((b for b in response.content if b.type == "tool_use" and b.name == tool["name"]), None)
        if report:
            return report.input
        if response.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": response.content})
            continue
        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": f"Please finish by calling {tool['name']} once with what you found."})
    return None


def check_form(client, form):
    links = "\n".join(f"- {label}: {url}" for label, url in form.get("links", []))
    known = "\n".join(f"- {d['label']}: {d['date']}" for d in form.get("deadlines", [])) or "- none"
    prompt = (f"College / test: {form['name']} ({form.get('city', '')})\n"
              f"Official links we have:\n{links}\n"
              f"Deadlines currently on our site:\n{known}\n"
              f"Current status on our site: {form.get('status')}\n\n"
              f"Find the current state of its UG admissions for the {CYCLE} intake and report it.")
    return ask(client, prompt, CHECK_TOOL)


def discover(client, forms):
    names = ", ".join(f["name"] for f in forms)
    prompt = (f"Find undergraduate application forms in India for the {CYCLE} intake that opened or were announced recently "
              "and that students who take CUET would also apply to: private and deemed universities with their own "
              "admissions (liberal arts, management/IPM, design, law, commerce), and well-known colleges or tests with "
              f"their own forms. Skip anything already on our list: {names}. Skip engineering-only (JEE) and medical (NEET) "
              "admissions. Report at most 8, only ones with an official application or admissions page.")
    out = ask(client, prompt, DISCOVER_TOOL)
    return (out or {}).get("forms", [])


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40]


def clean_deadlines(items):
    seen, out = set(), []
    for d in items:
        if not valid_date(d["date"]) or not d.get("label"):
            continue
        key = (d["label"].strip().lower(), d["date"])
        if key in seen:
            continue
        seen.add(key)
        out.append({"label": d["label"].strip(), "date": d["date"], "source": d.get("source", "")})
    return sorted(out, key=lambda d: d["date"])


def apply_check(form, r, log):
    """Merge one report into a form. Only confident findings change dates or status."""
    if not r:
        log.append(f"- **{form['name']}**: no answer, left as is")
        return False
    changed = []
    new_dl = clean_deadlines(r["deadlines"])
    if r["confident"]:
        if r["status"] in STATUSES and r["status"] != form.get("status") and not (r["status"] == "check" and form.get("deadlines")):
            changed.append(f"status {form.get('status')} → {r['status']}")
            form["status"] = r["status"]
        # Merge round by round: update or add what was found, keep rounds it did not mention.
        merged = {d["label"].lower(): d for d in form.get("deadlines", [])}
        diff = [d for d in new_dl if merged.get(d["label"].lower(), {}).get("date") != d["date"]]
        for d in diff:
            merged[d["label"].lower()] = d
        if diff:
            changed.append("deadlines " + ", ".join(f"{d['label']} {d['date'][:10]}" for d in diff))
            form["deadlines"] = sorted(merged.values(), key=lambda d: d["date"])
        if r["note"] and r["note"] != form.get("note"):
            form["note"] = r["note"]
        if r["accepts_cuet"] and not form.get("acceptsCuet"):
            form["acceptsCuet"] = True
            changed.append("accepts CUET")
    url = r.get("apply_url", "")
    if url and official(url) and url not in [u for _, u in form.get("links", [])]:
        form.setdefault("links", []).append(["Apply (new link)", url])
        changed.append(f"new link {url}")
    if changed:
        log.append(f"- **{form['name']}**: " + "; ".join(changed) + ("" if r["confident"] else " _(not confirmed on the official site)_"))
    elif not r["confident"]:
        log.append(f"- {form['name']}: nothing confirmed on the official site")
    return bool(changed)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", help="form ids to check")
    ap.add_argument("--no-discover", action="store_true", help="skip looking for new forms")
    ap.add_argument("--dry-run", action="store_true", help="print results, write nothing")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    data = json.loads(FORMS.read_text())
    forms = data["forms"]
    todo = [f for f in forms if not args.only or f["id"] in args.only]
    client = anthropic.Anthropic()
    log_updates, log_new = [], []

    with cf.ThreadPoolExecutor(args.workers) as pool:
        results = dict(zip([f["id"] for f in todo], pool.map(lambda f: check_form(client, f), todo)))
    changed = sum(apply_check(f, results.get(f["id"]), log_updates) for f in todo)

    if not args.no_discover:
        have = {slug(f["name"]) for f in forms} | {domain(u) for f in forms for _, u in f.get("links", [])}
        for n in discover(client, forms):
            if not official(n["apply_url"]) or slug(n["name"]) in have or domain(n["apply_url"]) in have:
                continue
            forms.append({
                "id": slug(n["name"]), "name": n["name"].strip(), "type": n["type"], "city": n["city"],
                "entrance": n["entrance"], "status": n["status"], "acceptsCuet": n["accepts_cuet"],
                "links": [["Apply", n["apply_url"]]], "deadlines": clean_deadlines(n["deadlines"]),
                "note": n["note"], "fromDoc": False, "added": dt.date.today().isoformat(),
            })
            have.add(slug(n["name"]))
            log_new.append(f"- **{n['name']}** ({n['city']}) — {n['status']}, apply: {n['apply_url']}")
            changed += 1

    data["checked"] = dt.date.today().isoformat()
    summary = [f"# Forms check — {data['checked']}", "",
               f"Checked {len(todo)} forms with {MODEL}. Review the dates before merging; students act on them.", "",
               "## Updates", *(log_updates or ["- none"]), "", "## New forms found", *(log_new or ["- none"]), ""]
    print("\n".join(summary))
    if args.dry_run:
        return
    FORMS.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    SUMMARY.write_text("\n".join(summary))
    print(f"{changed} change(s) written")


if __name__ == "__main__":
    main()
