# PARTHU.AI landing page

A single static page: `index.html`, plus `assets/`. There is no build step. It's rebuilt from the Claude Design file `PARTHU_Landing.html` as plain HTML, CSS and a little JavaScript.

- **WhatsApp number:** `919216652471`. To change it, replace that value in `index.html`. It appears in 2 links.
- **Promo video:** YouTube `WNVaQFqKj3o`. To change it, replace that ID in the `iframe` in `index.html`. It appears twice in the URL.
- **Logo mark:** `assets/parthu-mark.png`.

## My Second Brain

`daily/` is a separate personal dashboard (`index.html`, `style.css`, `app.js`, no build step). It covers:

- **Dashboard:** a daily report (today's to-dos, overdue, coming up, habits, focus, reading), quick capture, affirmation and mood, life areas, the wheel of life, life goals, today's schedule, habits, a weekly overview, projects in progress, currently reading and notebooks.
- **Plan:** tasks (today, this week, GTD inbox, Eisenhower matrix with drag and drop, all open, completed), projects linked to goals, life goals linked to areas, and life areas with progress.
- **Knowledge:** notebooks, notes and topics; resources with type, topic and status; and a library with a book board, genres, highlights and a reading report.
- **Wellbeing:** habits, journal and a focus timer.
- **Systems:** a PARA overview and an archive. Search with `/` (or Ctrl+K), and quick capture with `N`.

Data is saved in the browser's local storage. Use **Settings & backup** to export or import it. Data from the earlier planner versions carries over.

## IPA Ops Board

`priority/index.html` is the **IPA Ops Board** (no build step), which replaced the IPA Priority Board on 19 Nov 2026. It's for Diksha only; the team gets their tasks and role sheets on WhatsApp.

- **Today:** the day's tasks in order (from the daily assistant's plan), routine work due, team tasks that need a follow-up, and what's waiting for approval.
- **Team:** one page per person with their tasks, a role sheet (daily, weekly and monthly duties, KRAs and review questions) and buttons to copy or send it on WhatsApp.
- **Coach:** the weekly COO coaching (what you're missing, COO actions, growth moves for the centre, a number to track, a line for the founder), today's COO move, and earlier weeks.
- **Work log:** everything done, by day: finished tasks, ticked routines, reviews, meetings, and anything typed in by hand, with weekly counts.
- **Day list:** tasks set "On my day list for" a date show on Today in that order, and the morning message sends them as written.
- **Tasks:** everyone's tasks with filters; **KRA reviews:** monthly actual and status for each KRA, with notes and a message to send; **Meeting:** the Monday agenda, notes and action items; **Routine:** daily, weekly, monthly, season and yearly work to tick off each cycle; **Expenses:** spends with bills and approvals, and budget vs spent per category.
- **Private data:** everything is `ops.json` in the private repository `dikshabhargava31-ops/ipa_task`. The page has no data of its own. Sign in with a name and a [classic token](https://github.com/settings/tokens/new?scopes=repo&description=IPA%20Ops%20Board) with `repo` ticked; the token stays in that browser. Every change is a commit there, so its history is the board's history. **Settings** downloads a backup.

## Daily Ops Assistant

`assistant/` plans each day from the IPA Ops Board and sends it to you by Gmail and as a laptop notification: a to-do list at 08:42, a nudge at 13:17 and a wrap-up at 18:47 (Monday to Saturday, India time). It lists routine work due and team follow-ups, decides what to hand off, assigns it on the board and writes the message to forward. Setup and settings: `assistant/README.md`.

## Video studio

Claude Code makes videos here with HyperFrames (skills in `.claude/skills/`). Each video lives in `videos/<name>/`. `CLAUDE.md` maps trending styles (vertical reels, word-by-word captions, kinetic type, beat-synced edits, launch promos) to the right tool. `scripts/setup-video-tools.sh` installs auto-editor, PySceneDetect and yt-dlp (`--full` adds Demucs); cloud sessions run it automatically. To control DaVinci Resolve or transcribe locally, see `docs/local-video-setup.md`.

## Creator Research Studio

The Creator Research Studio app (research, topics, scripts and content planning) lives in its own private repository, `dikshabhargava31-ops/creator-research-studio`. It sends Instagram posts to the scheduler below only after the owner approves them.

## Instagram scheduler

`instagram/` posts to several Instagram accounts on a schedule for free. A GitHub Actions workflow publishes each post in `instagram/posts.csv` through Instagram's official API when it is due. `schedule/index.html` is the **Instagram Planner** (no build step): a month, week and list calendar of every post, plus a composer with file upload and a live preview. Uploaded files go to the public repository `dikshabhargava31-ops/instagram-media`, so large media stays out of this one. Setup, the planner and the CSV format are in `instagram/README.md`.

## Everything CUET

`cuet/` is the Everything CUET website (`index.html`, `style.css`, `app.js`, `config.js`, no build step), built from the competitor research: every feature competitors offer, plus the dream list, reminders and preference builder none of them combine.

- **Pages:** home with live deadline countdowns and free alert sign-up; NTA participating universities (search, type and state filters, compare, college pages); college predictor (Dream / Target / Safe / Not eligible, gap to cutoff, round-wise advice, top 20 per tier, WhatsApp share); Dream List board with drag and drop, CSAS preference order (hostel and fee filters, print, copy, WhatsApp) and a read-only parent link; master calendar (.ics with 7-day, 48-hour and same-day alarms, Google Calendar, browser reminders); application tracker with status steps and document checklist; tools (answer-key marks calculator, subject combination checker, university compare, same course at other universities, normalisation guide); resources (NTA and SATHEE links, exam pattern, past cutoffs, webinars, news, YouTube); vetted fixed-price senior calls; college groups and allotment-day tracker; plans with cart, 30% bundle discount and partner promo codes; a rule-based admission assistant; Hindi / English toggle.
- **University list and official facts:** come only from NTA. `cuet/data/universities.json` (244 institutions for CUET (UG) 2026: 49 Central, 41 State, 27 Deemed, 120 Private, 7 other government) and `cuet/data/official.json` (2026 dates, application fees, exam pattern, the 37 subjects with 2026 statistics, candidate numbers, rules and helpdesk links) are built from the workbook extracted from `cuet.nta.nic.in` and NTA's bulletin and result notice: `python3 cuet/scripts/import_nta.py --xlsx CUET_UG_2026_Official_Data.xlsx` (needs `pip install openpyxl`). Each year, update the workbook and run it again. The same script can instead read NTA's page or its PDFs (`--pdf central.pdf --category Central …`, needs `pdfplumber`); the **CUET NTA universities import** workflow runs that version on demand.
- **College forms** (`cuet/data/forms.json`, the **College forms** page): UG 2027 application forms for colleges with their own admissions (IIM Bangalore UG, Ashoka, IILM, SSLA, Bennett, CHRIST, FLAME, Krea, plus Jindal, Plaksha, Shiv Nadar, Ahmedabad, Azim Premji, Masters' Union, ATLAS, IPMAT Indore/Rohtak, JIPMAT, SET, SLAT, NPAT, Mahindra, Vijaybhoomi, Sai and St. Xavier's Mumbai). Links point to official college or test sites only. Deadlines are reported dates, each linked to the page it came from, and also show in the calendar. Update `status` and `deadlines` as colleges publish their schedules.
- **New forms, automatically:** the **CUET forms watcher** workflow (`.github/workflows/cuet-forms-watch.yml`) runs every Monday and Thursday morning and on demand. `cuet/scripts/forms_watch.py` asks Claude (Opus 5.5, with web search) to check every form on the site against the college's own admission pages and to look for new UG forms. It then opens a pull request listing what changed. Nothing goes live until someone reviews and merges it. Only dates confirmed on official websites change the site; news and coaching sites are never stored as apply links. Needs the repository secret `ANTHROPIC_API_KEY`. Each run costs a few dollars of API usage.
- **Pictures:** the site ships with illustrations in `cuet/assets/illus/`. To use photos instead, put them in `cuet/assets/photos/` and name them under `photos` in `cuet/config.js` (slots: `campus`, `senior`, `forms`, `kit`).
- **Other data** (`cuet/data/`): `cutoffs.json` (round-wise closing scores; the predictor, compare and past-cutoff tables read it), `subject-rules.json` (course eligibility), `events.json` (university and expected dates; NTA's official dates come from `official.json`), `allotments.json` (checked allotment reports). Fill them only from official allotment lists and bulletins.
- **Settings** (`cuet/config.js`): WhatsApp number and an optional form endpoint for sign-ups and orders, prices, partner promo codes, vetted mentors, group links, webinars, news and YouTube videos. Until a WhatsApp number or endpoint is set, sign-ups and orders are kept only in the visitor's browser.
- **Logins and leads:** students browse freely and log in (Google or an email code, through Supabase) when they save a college, turn on reminders, see predictor results, book a senior or order form filling, then give their name, mobile, Class 12 year, category, state and interest. Leads and requests are in Supabase and on the site's admin page (`#/admin`) with CSV download. Setup: `cuet/supabase/README.md`. Until Supabase is connected in `config.js`, a short sign-up form is used instead.
- **Student data:** saved in the browser's local storage; nothing is sent anywhere unless the student submits a form.
