# Creator Research Studio

A private web app that researches, plans and prepares YouTube and Instagram content for a creator team. It's built around one workspace per brand or channel (the first preset is **@camahendrasir**: CA education, student challenges, careers and commentary), and it works on your behalf:

- **Run my content research** (top right, or on a daily/weekly schedule) studies your channel, refreshes saved competitors and inspiration channels, finds outlier videos, searches your content pillars, collects audience questions from comments, checks current developments and debates on the web, recommends topics, and prepares hooks and outlines for the best ones.
- Everything it finds lands in the **review queue** on the Dashboard: what was found, why it matters, what was prepared, and what needs your decision. Blocked steps (missing connection, quota, budget) are listed as blocked, never as done.
- It creates only internal drafts and recommendations. It never publishes, schedules posts externally, changes live content, spends money beyond the budget you approved, or adds account permissions without your click.

The app is plain Node.js (22.5 or newer) with one dependency, the Anthropic SDK. There's no build step. It doesn't use or affect the static sites in this repository.

## Start it

```bash
cd studio
npm install
cp .env.example .env      # then fill in the keys you have (see below)
npm start                 # http://localhost:4317
```

Open the app, create the owner account (the first sign-up only; after that only accounts you add can sign in), and choose **Start with “CA Mahendra Sir”**. A separate **demo workspace** with fictional sample data is available too; it's labelled "Demo data" everywhere and never mixes with a real workspace.

The server listens on `127.0.0.1` only, so nobody else on the network can reach it. To use it as a team, see [Hosting it privately](#hosting-it-privately).

## What works right away (no keys)

| Feature | How it works without keys |
| --- | --- |
| Workspaces, profiles, approved examples, preferences | Fully working. |
| Channels | Add channels by link or @handle; import their videos from CSV (YouTube Studio export for your channel, or a sheet with video ID/URL, title, published date, duration, views). Rows are labelled **Imported data**. |
| Outliers | Computed from imported data with the same method as live data. |
| Video links | Title, channel and thumbnail through YouTube's key-less oEmbed. |
| Reference Library | Links, screenshots, images, documents, transcripts, notes; categories, tags, search, approved examples. |
| Opportunities | Add and edit topic cards; duplicate-topic warnings; reject with a reason (becomes a proposed preference). |
| Hooks and outlines | Fill-in **templates** built only from your topic, labelled "Template", with `[brackets]` where facts are needed. No topics are generated without AI. |
| Script Studio | Writing, versions, comments, approval status, claims-to-verify checklist. |
| Content Planner | Board (drag and drop), calendar, list, filters, favourites, owners, deadlines, history, title/thumbnail change log, experiments, lessons. |
| Instagram Planner | Your existing planner's posts appear in the calendar (read from GitHub). |
| Analytics | Your channel against its own baseline from imported data; Instagram from a CSV import. |

## What needs credentials

Each connection's status is shown in **Settings → Connections** and next to the data it feeds: **Live data**, **Imported data**, **Demo data** or **Unavailable**.

### YouTube Data API — `YOUTUBE_API_KEY` (free)

Search (keywords, topics, channel names, links), channel refreshes, view/like/comment counts, durations, comments for audience questions.

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable **YouTube Data API v3**.
2. *APIs & Services → Credentials → Create credentials → API key*. Restrict it to the YouTube Data API.
3. Put it in `.env` as `YOUTUBE_API_KEY`.

**Quota:** 10,000 units a day, reset at midnight Pacific time. A search costs 100 units; channel and video lookups cost 1. A research run with 10 saved channels and 3 pillars uses about 350–400 units. The app counts units and stops before the limit. Likes can be hidden by a channel; then they show as "—".

### YouTube Analytics and impressions — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_URL` (free)

Your own channel only: retention and drop-offs, traffic sources, watch time, average view duration and percentage viewed, subscribers gained, and views in the first 7 and 28 days after publishing (the fair way to compare videos of different ages).

1. In the same Google Cloud project, enable **YouTube Analytics API** and **YouTube Reporting API**.
2. *OAuth consent screen*: External, add yourself (and anyone who will connect) as a test user. Scopes: `youtube.readonly`, `yt-analytics.readonly`.
3. *Credentials → Create credentials → OAuth client ID → Web application*. Authorised redirect URI: `<PUBLIC_URL>/oauth/google/callback` (for local use, `http://localhost:4317/oauth/google/callback`).
4. Put the client ID and secret in `.env`, restart, then as the workspace owner use **Settings → Connections → Connect my YouTube channel**.
5. For **impressions and CTR**, click **Start impressions/CTR reports**. YouTube's public and Analytics APIs don't provide them; they come from the Reporting API's daily `channel_reach_basic_a1` reports, which start the day you create the job (allow up to 48 hours for the first one). Until then, import a YouTube Studio CSV export, which includes impressions and CTR.
6. Optional: **Grant caption permission** to download transcripts of your *own* videos. Google only offers this inside the broader `youtube.force-ssl` scope ("manage your YouTube account"), so it's a separate, explicit step. The app only reads captions with it.

**Not available, by design:** competitors' CTR, impressions, retention and watch time are private to their owners. The app never estimates them; competitor analysis uses public data and says so. Other channels' transcripts can't be downloaded through YouTube's API, so the app asks you to paste or upload them.

### Claude API — `ANTHROPIC_API_KEY` (paid)

Topic recommendations, web research with sources (current developments, controversies, research briefs), hooks, outlines, full scripts, section revisions, reference-script analysis, tag and summary suggestions, performance hypotheses and the AI Assistant.

1. Create a key at [console.anthropic.com](https://console.anthropic.com/) and put it in `.env`.
2. As the owner, approve a **monthly AI budget** in **Settings → AI & budget**. Until a budget is approved, AI calls are blocked rather than spending money; when the month's budget is used, they stop until you raise it.

**Cost:** the default model is Claude Opus 5.5 ($4 per million input tokens, $20 per million output tokens; web searches $10 per 1,000). Rough guide: a hook set $0.02–0.05, a full script $0.10–0.30, a research run with web research $0.30–1.00, an assistant answer $0.02–0.15. Set `CLAUDE_MODEL=claude-sonnet-5-5` for about half the price. The app's spend figure is an estimate from token counts; your Anthropic console has the exact bill. Requests use the server-side refusal fallback (`fallbacks: "default"`), so a request one model declines can be completed by Anthropic's recommended fallback model.

### Instagram

**Scheduling reuses your existing Instagram Planner** (`instagram/` and `schedule/` in this repository) instead of building a second scheduler:

- The Studio reads `instagram/accounts.json`, `posts.csv` and `published.json` from `main` (no token needed) and shows queued, published and failed posts in the Content Planner calendar.
- From a planner item, **Prepare an Instagram post** validates it with the same rules as `ig_scheduler.py` (account, India time, type, public https media, caption length, hashtags) and puts it in the review queue. **Nothing is scheduled until the workspace owner clicks Approve.** Approval appends one row to `instagram/posts.csv` on `main` (id format `<account>-<YYYYMMDD-HHMM>-<4 chars>`), then asks the *Instagram scheduler* workflow to start a run, which publishes the post at its time.
- Media upload stays in the Instagram Planner's composer (it stores files in `instagram-media`); paste the resulting links.
- **Needs:** `GITHUB_TOKEN` — a [fine-grained token](https://github.com/settings/personal-access-tokens/new) for `dikshabhargava31-ops/claude-and-db` only, with **Contents: read and write** (and **Actions: read and write** to start the run; without it the 15-minute schedule picks the post up). Without the token, the approval card shows the exact CSV row to paste.

**Instagram insights** (reach, views, saves, shares, interactions, Reels watch time) need a token with `instagram_business_manage_insights` in `IG_INSIGHTS_ACCOUNTS`. The scheduler's tokens live in GitHub secrets and only have publishing permissions, so they can't be reused. Generate one in the same Meta app (*Instagram → API setup → Generate access token*, with the insights permission). Until then, import a CSV in **Analytics → Instagram**. Instagram has no equivalent of YouTube's thumbnail CTR; posts are compared on reach, views, saves and shares within the same type (Reels vs feed) once they're 7+ days old.

## How outliers are measured

A video is compared only with **its own channel's** videos of the **same format** (3 minutes or less counts as a likely Short — an estimate, as the API has no Shorts flag):

- 28+ days old: views ÷ median views of the channel's other same-format videos that are also 28+ days old.
- Younger, with stored snapshots: views ÷ median views the channel's other videos had at the same age (±25%). The app stores a view snapshot each time it refreshes a channel, so this becomes available over time.
- Younger, no snapshots: views per day ÷ the channel's median daily views for same-format videos aged 3–60 days, marked low confidence.
- At least 5 comparable videos are required; videos under 2 days old aren't scored. 2× = outlier, 3× = strong outlier, 0.5× or less = underperformer.

For your own videos with Analytics connected, first-7 and first-28-day views give the comparison at equal ages.

## Privacy and security

- Private login (scrypt-hashed passwords, HttpOnly SameSite=Strict session cookies, only a hash of each session token stored), sign-in rate limiting, and per-workspace roles: **owner** (connections, budget, schedule, approvals), **editor**, **viewer**.
- The first account is the admin; other accounts are created by the admin in **Settings → Team & access** and added to workspaces by the owner.
- API keys and OAuth tokens stay in `.env` and `data/db.json` on the server and are never sent to the browser. State-changing requests need a custom header, so other sites can't submit them.
- All data lives in `studio/data/` (git-ignored, file mode 600). Back it up by copying that folder while the server is stopped.
- The code lives in this public repository, but no data or keys do. GitHub Pages skips this folder (`_config.yml` at the repository root excludes it), so the app is only reachable where you run or host it.

## Publish on Vercel

The app runs on Vercel with its data in Supabase (Vercel has no permanent disk). Your computer can keep using the same Supabase project, so both see the same data. Each push to the branch Vercel watches redeploys the app automatically.

**What changes when hosted:** uploads are limited to 3 MB (Vercel's 4.5 MB request limit); scheduled research runs start once a day at about 7:30 am India time (Vercel Hobby allows one cron run a day; on Pro, change the schedule in `vercel.json`); a request can run for up to 5 minutes, enough for a research run.

**Cost:** Supabase's free plan is enough to start (free projects pause after a week with no activity; the daily cron job keeps it active). Vercel's free Hobby plan is for personal, non-commercial use; for a business team, Vercel Pro is $20 per member a month.

1. **Supabase:** create a project at [supabase.com](https://supabase.com/dashboard) (region: Mumbai). Open **SQL Editor → New query**, paste `supabase.sql` from this folder and click **Run**. In **Project Settings → API Keys**, copy the **Project URL** and a **secret** key (or the legacy **service_role** key). Never put this key in a browser or share it.
2. **Copy your current data** (optional): add `SUPABASE_URL=` and `SUPABASE_SERVICE_ROLE_KEY=` to `.env` on your computer and run `npm run migrate`. Your account, workspaces, references and scripts are copied. From then on your computer also uses Supabase.
3. **Vercel:** sign up at [vercel.com](https://vercel.com) with GitHub. **Add New → Project**, import `dikshabhargava31-ops/claude-and-db` (allow Vercel's GitHub app to see it), set **Root Directory** to `studio` and **Framework Preset** to **Other**.
4. **Environment variables** (same screen, or Settings → Environment Variables; you can paste your whole `.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_TOKEN` (if used), plus:
   - `OWNER_EMAIL`: your email. Only this email can create the owner account on the hosted app (skip if you migrated your data, though it's harmless).
   - `CRON_SECRET`: any long random text. Vercel sends it with the daily cron call so nobody else can trigger runs.
   - `PUBLIC_URL`: the app's address, for example `https://creator-research-studio.vercel.app` (set it after the first deploy shows the address, then redeploy).
5. **Deploy.** Then in Google Cloud → Google Auth Platform → **Clients**, open your client and add the redirect URI `https://<your-address>/oauth/google/callback`, and reconnect YouTube from the hosted app's Settings.

## Hosting it elsewhere



For a team, run it on an always-on machine or a private server behind HTTPS (for example Caddy or nginx as a reverse proxy, or a private network such as Tailscale), set `HOST=0.0.0.0`, `PUBLIC_URL=https://your-host`, and register that URL's `/oauth/google/callback` in Google Cloud. Scheduled research runs only happen while the server is running. Choosing and paying for a host is your decision; nothing has been deployed.

## Tests

```bash
npm test            # unit tests: outlier maths, duplicate detection, CSV mapping, Instagram rules, schedule, auth
npm run test:e2e    # browser test of the full flow (needs Playwright + Chromium)
```

The end-to-end test runs the whole flow twice in Chromium: once against local stand-ins for YouTube, Claude and GitHub (setup → channels → search → save reference → develop and shortlist → brief, hooks, outline, script → pipeline → research run → assistant → analytics → Instagram approval), and once with no credentials to check that every page reports unavailable data honestly and falls back to templates and imports. It doesn't call the real services.
