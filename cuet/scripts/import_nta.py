#!/usr/bin/env python3
"""Build cuet/data/universities.json from NTA's official CUET (UG) participating-universities list.

NTA publishes the list at https://cuet.nta.nic.in/participating-universities/ as one file per
category (Central, State, Deemed, Private, Government/other institutions), usually PDFs.

    python3 cuet/scripts/import_nta.py                 # fetch the page and every linked list
    python3 cuet/scripts/import_nta.py --pdf central.pdf --category Central --pdf state.pdf --category State
    python3 cuet/scripts/import_nta.py --check         # parse and print counts, write nothing

Needs `pdfplumber` for PDFs and `openpyxl` for --xlsx (pip install pdfplumber openpyxl). Nothing here invents or fills in data: a
university is written exactly as it appears in NTA's file, and a run that finds no universities
leaves the existing JSON untouched.
"""
import argparse
import datetime as dt
import html
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

PAGE = "https://cuet.nta.nic.in/participating-universities/"
OUT = Path(__file__).resolve().parent.parent / "data" / "universities.json"
OFFICIAL = OUT.with_name("official.json")
UA = "Mozilla/5.0 (EverythingCUET importer; +https://github.com/dikshabhargava31-ops/claude-and-db)"

CATEGORIES = [  # (keyword in link text or file name, category)
    ("central", "Central"),
    ("state", "State"),
    ("deemed", "Deemed"),
    ("private", "Private"),
    ("government", "Government / other"),
    ("govt", "Government / other"),
    ("other", "Government / other"),
    ("institut", "Government / other"),
]

STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
    "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
    "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal",
]
STATE_ALIASES = {
    "new delhi": "Delhi", "nct of delhi": "Delhi", "orissa": "Odisha", "uttaranchal": "Uttarakhand",
    "pondicherry": "Puducherry", "j&k": "Jammu and Kashmir", "jammu & kashmir": "Jammu and Kashmir",
    "a&n islands": "Andaman and Nicobar Islands", "andaman & nicobar islands": "Andaman and Nicobar Islands",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read(), r.headers.get_content_type()


def category_for(text):
    t = text.lower()
    for key, cat in CATEGORIES:
        if key in t:
            return cat
    return None


def clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", str(s or "")))
    return re.sub(r"\s+", " ", s).strip(" .,;")


def norm_state(s):
    s = clean(s)
    if not s:
        return ""
    low = s.lower()
    if low in STATE_ALIASES:
        return STATE_ALIASES[low]
    for st in STATES:
        if st.lower() == low or st.lower().replace(" and ", " & ") == low:
            return st
    return s.title() if s.isupper() else s


def find_state(text):
    """The state named in a free-text row (used only when the file has no State column)."""
    low = text.lower()
    for alias, st in STATE_ALIASES.items():
        if re.search(r"\b" + re.escape(alias) + r"\b", low):
            return st
    for st in sorted(STATES, key=len, reverse=True):
        if re.search(r"\b" + re.escape(st.lower()) + r"\b", low):
            return st
    return ""


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:80]


HEADER_KEYS = {
    "name": ("name of the university", "name of university", "university name", "name of the institution",
             "institution name", "university", "institution", "name"),
    "state": ("state", "state/ut", "state / ut", "location", "city"),
    "website": ("website", "web site", "url", "web"),
}


def map_header(row):
    cols = {}
    for i, cell in enumerate(row):
        c = clean(cell).lower()
        if not c:
            continue
        for field, keys in HEADER_KEYS.items():
            if field not in cols and any(c == k or c.startswith(k) for k in keys):
                cols[field] = i
                break
    return cols if "name" in cols else None


def rows_from_table(table):
    """Turn one extracted table (list of rows) into dicts, using its header row when it has one."""
    out, cols = [], None
    for row in table:
        cells = [clean(c) for c in row]
        if not any(cells):
            continue
        header = None if any(re.fullmatch(r"\d+\.?", c) for c in cells) else map_header(cells)
        if header and (len(header) > 1 or "name" in cells[header["name"]].lower()
                       or cells[header["name"]].lower() in HEADER_KEYS["name"]):
            cols = header
            continue
        if cols:
            name = cells[cols["name"]] if cols["name"] < len(cells) else ""
            state = cells[cols["state"]] if "state" in cols and cols["state"] < len(cells) else ""
            web = cells[cols["website"]] if "website" in cols and cols["website"] < len(cells) else ""
            if not name or re.fullmatch(r"[\d. ]+", name):  # header and rows don't line up: take the longest cell
                name = max(cells, key=len)
        else:  # no header: drop the serial number, take the longest cell as the name
            rest = [c for c in cells if c and not re.fullmatch(r"\d+\.?", c)]
            if not rest:
                continue
            name = max(rest, key=len)
            state = next((c for c in rest if c != name and norm_state(c) in STATES), "")
            web = next((c for c in rest if re.search(r"(www\.|https?://|\.(ac|edu|org|in)\b)", c, re.I)), "")
        if not name or re.fullmatch(r"[\d. ]+", name) or len(name) < 6:
            continue
        out.append({"name": name, "state": norm_state(state) or find_state(name), "website": web})
    return out


def rows_from_text(text):
    """Fallback for PDFs without detectable tables: numbered lines like '12. University of X, Place'."""
    out = []
    for line in text.splitlines():
        m = re.match(r"\s*(\d{1,3})[.)]?\s+(.+)", line)
        if not m:
            continue
        rest = clean(m.group(2))
        web = ""
        wm = re.search(r"(https?://\S+|www\.\S+)", rest)
        if wm:
            web, rest = wm.group(1), clean(rest.replace(wm.group(1), ""))
        if len(re.findall(r"[A-Za-z]{2,}", rest)) >= 2 and not re.match(r"page\b", rest, re.I):
            out.append({"name": rest, "state": find_state(rest), "website": web})
    return out


def parse_pdf(data):
    try:
        import pdfplumber
    except ImportError:
        sys.exit("pdfplumber is needed to read NTA's PDFs: pip install pdfplumber")
    rows, text = [], []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                rows += rows_from_table(table)
            text.append(page.extract_text() or "")
    return rows or rows_from_text("\n".join(text))


def parse_html_tables(page_html):
    rows = []
    for t in re.findall(r"<table.*?</table>", page_html, re.S | re.I):
        table = [re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S | re.I)
                 for tr in re.findall(r"<tr.*?</tr>", t, re.S | re.I)]
        rows += rows_from_table(table)
    return rows


def links_on_page(page_html, base):
    found = []
    for href, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', page_html, re.S | re.I):
        url = urllib.parse.urljoin(base, html.unescape(href))
        text = clean(label) + " " + urllib.parse.unquote(url.rsplit("/", 1)[-1])
        if url.lower().split("?")[0].endswith(".pdf") and category_for(text):
            found.append((url, category_for(text), clean(label) or url))
    return found


def build(entries):
    seen, out = set(), []
    for e in entries:
        key = (re.sub(r"[^a-z0-9]", "", e["name"].lower()), e["category"])
        if key in seen:
            continue
        seen.add(key)
        web = e.get("website", "")
        if web and not web.lower().startswith("http"):
            web = "https://" + web.lstrip("/")
        out.append({
            "id": slug(e["category"] + "-" + e["name"]),
            "name": e["name"],
            "category": e["category"],
            "state": e.get("state", ""),
            "website": web,
            "source": e["source"],
        })
    order = {c: i for i, c in enumerate(["Central", "State", "Deemed", "Private", "Government / other"])}
    out.sort(key=lambda u: (order.get(u["category"], 9), u["name"].lower()))
    return out


# ---------- workbook (--xlsx) ----------
XLSX_TYPES = {"central university": "Central", "state university": "State", "deemed university": "Deemed",
              "private university": "Private", "other government institution": "Government / other"}
MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def sheet_blocks(ws):
    """A sheet as {title, source, intro, blocks}: each block is a header row plus its data rows.
    A one-cell line before a table is that table's label; one after the last table is its note."""
    rows = [[c for c in r] for r in ws.iter_rows(values_only=True)]
    rows = [r[:max((i + 1 for i, c in enumerate(r) if c not in (None, "")), default=0)] for r in rows]
    title = clean(rows[0][0]) if rows and rows[0] else ws.title
    source, intro, blocks, cur, pending = "", "", [], None, ""
    for r in rows[1:]:
        if not r:
            cur = None
            continue
        if len(r) == 1:
            text = clean(r[0])
            if text.lower().startswith("source:"):
                source = text.split(":", 1)[1].strip()
            elif not blocks:
                intro = text
            else:
                pending = (pending + " " + text).strip()
            continue
        if cur is None:
            if isinstance(r[1], (int, float)):  # a table with no header row
                cur = {"label": pending, "header": ["Item", "Value"], "rows": []}
            else:
                cur = {"label": pending, "header": [clean(c) for c in r], "rows": []}
                blocks.append(cur)
                pending = ""
                continue
            blocks.append(cur)
            pending = ""
        cur["rows"].append([c if isinstance(c, (int, float)) else clean(c) for c in r])
    if pending and blocks:
        blocks[-1]["note"] = pending
    return {"title": title, "source": source, "intro": intro, "blocks": blocks}


def as_dicts(block, keys):
    return [{k: (row[i] if i < len(row) and row[i] != "" else None) for i, k in enumerate(keys)} for row in block["rows"]]


def iso_date(text):
    """'30 Jan 2026 (11:50 PM)' -> '2026-01-30T23:50:00+05:30'; '03 Jan 2026' -> '2026-01-03'."""
    m = re.search(r"(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})", str(text or ""))
    if not m:
        return None
    d = f"{m.group(3)}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    t = re.search(r"(\d{1,2}):(\d{2})\s*([AP]M)", str(text), re.I)
    if t:
        h = int(t.group(1)) % 12 + (12 if t.group(3).upper() == "PM" else 0)
        d += f"T{h:02d}:{t.group(2)}:00+05:30"
    return d


def read_workbook(path):
    try:
        import openpyxl
    except ImportError:
        sys.exit("openpyxl is needed to read the workbook: pip install openpyxl")
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    sheets = {ws.title.lower(): sheet_blocks(ws) for ws in wb.worksheets}
    get = lambda name: sheets.get(name.lower()) or sys.exit(f"The workbook has no '{name}' sheet")

    uni = get("Universities")
    entries = []
    for row in uni["blocks"][0]["rows"]:
        kind, name = str(row[1]).lower(), clean(row[3])
        if kind not in XLSX_TYPES or not name:
            continue
        entries.append({"name": name, "state": "", "website": "", "category": XLSX_TYPES[kind], "source": uni["source"] or PAGE})

    ov = get("Overview")
    first = lambda sh: sh["blocks"][0] if sh["blocks"] else {"rows": [], "header": []}
    dates = get("Dates 2026")
    schedule = []
    for e in as_dicts(first(dates), ["event", "start", "end", "notes"]):
        start, end = iso_date(e["start"]), iso_date(e["end"])
        schedule.append({**e, "startDate": start, "endDate": end})
    fees = get("Fees")
    pattern = get("Exam Pattern")
    subj = get("Subjects & Stats")
    stats = get("Candidate Stats")
    rules = get("Rules")
    links = get("Contacts & Links")
    official = {
        "title": ov["title"],
        "extracted": ov["intro"],
        "overview": as_dicts(first(ov), ["item", "detail", "source"]),
        "schedule": {"source": dates["source"], "rows": schedule},
        "fees": {"source": fees["source"], "header": first(fees)["header"], "rows": first(fees)["rows"], "note": first(fees).get("note", "")},
        "pattern": {"source": pattern["source"], "rows": as_dicts(first(pattern), ["parameter", "detail"])},
        "subjects": {"source": subj["source"], "rows": as_dicts(first(subj), ["code", "subject", "type", "registered", "appeared", "attendance", "highest"])},
        "stats": {"source": stats["source"], "blocks": [{"label": b["label"], "header": b["header"], "rows": b["rows"]} for b in stats["blocks"]]},
        "rules": {"source": rules["source"], "rows": as_dicts(first(rules), ["area", "rule"])},
        "links": {"source": links["source"], "rows": as_dicts(first(links), ["item", "url", "notes"])},
    }
    return entries, official


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pdf", action="append", default=[], help="a list downloaded from NTA's page")
    ap.add_argument("--category", action="append", default=[], help="category of each --pdf, in order")
    ap.add_argument("--xlsx", help="workbook extracted from NTA's site (see above)")
    ap.add_argument("--year", default="2026", help="CUET (UG) cycle the list belongs to")
    ap.add_argument("--check", action="store_true", help="parse and print, write nothing")
    args = ap.parse_args()

    entries, official = [], None
    if args.xlsx:
        entries, official = read_workbook(args.xlsx)
        print(f"{args.xlsx}: {len(entries)} institutions")
    elif args.pdf:
        for i, path in enumerate(args.pdf):
            cat = args.category[i] if i < len(args.category) else category_for(Path(path).name)
            if not cat:
                sys.exit(f"Say which category {path} is with --category")
            for r in parse_pdf(Path(path).read_bytes()):
                entries.append({**r, "category": cat, "source": PAGE})
            print(f"{path}: {cat}")
    else:
        page_bytes, _ = fetch(PAGE)
        page_html = page_bytes.decode("utf-8", "replace")
        links = links_on_page(page_html, PAGE)
        print(f"{len(links)} list file(s) linked on {PAGE}")
        for url, cat, label in links:
            data, ctype = fetch(url)
            rows = parse_pdf(data) if data[:4] == b"%PDF" else parse_html_tables(data.decode("utf-8", "replace"))
            print(f"  {cat:<20} {len(rows):>4}  {label}")
            entries += [{**r, "category": cat, "source": url} for r in rows]
        if not links:  # some years the list is a table on the page itself
            for r in parse_html_tables(page_html):
                entries.append({**r, "category": category_for(r["name"]) or "Government / other", "source": PAGE})

    universities = build(entries)
    counts = {}
    for u in universities:
        counts[u["category"]] = counts.get(u["category"], 0) + 1
    print(json.dumps(counts, indent=2), f"\ntotal {len(universities)}")
    if not universities:
        sys.exit("No universities found; the existing list is left as it is.")
    if args.check:
        return
    OUT.write_text(json.dumps({
        "source": PAGE,
        "sourceName": "National Testing Agency (NTA), CUET (UG) participating universities",
        "via": re.sub(r"^[0-9a-f]{8}-", "", Path(args.xlsx).name) if args.xlsx else None,
        "cycle": args.year,
        "importedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "counts": counts,
        "universities": universities,
    }, ensure_ascii=False, indent=1) + "\n")
    print(f"Wrote {OUT}")
    if official:
        OFFICIAL.write_text(json.dumps({"cycle": args.year, **official}, ensure_ascii=False, indent=1, default=str) + "\n")
        print(f"Wrote {OFFICIAL}")


if __name__ == "__main__":
    main()
