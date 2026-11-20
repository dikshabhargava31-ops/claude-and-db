# Parthu Evaluation Helpdesk

A separate website where teachers report mistakes made by the AI answer-copy
evaluation portal. A Claude assistant answers each report with corrected marks,
and when the mistake comes from the portal's code it logs a fix for the owner to
approve. Approved fixes reach the evaluation app's Claude Code (on any account)
by email, a Fixes page, a "check the helpdesk" command, and optionally GitHub issues.

```
Teacher ── report + screenshots ──▶ Helpdesk assistant ──▶ reply with corrected marks
                                          │
                                   code bug? ──▶ Change log (pending)
                                                      │ owner approves
                                                      ▼
                    email to developer · Fixes page · GitHub issue (optional)
                                                      │
              Evaluation app's Claude Code: paste the fix, or "check the helpdesk"
                                                      │
                                         fix made ──▶ marked done
```

## Who sees what

| Person | Signs in with | Sees |
| --- | --- | --- |
| Teacher | Access code from the owner | Only their own reports |
| Owner | `OWNER_PASSWORD` | Everything: change log, reports, teachers, Claude Code key |
| Developer | `DEVELOPER_PASSWORD` | Only the Fixes page (no teacher reports, names or screenshots) |
| Claude Code | Helpdesk key (Bearer) | Only approved fixes; can mark them done |
| Evaluation app | `INTEGRATION_TOKEN` (Bearer) | Can only send marks data for a copy |

## Security

- **Claude never sees code, files, settings or keys.** It has no tools. Each request holds only the teacher's
  messages, their screenshots, optional marks data and the titles of known issues; it answers in a fixed JSON shape.
- **Keys stay server-side** in Vercel environment variables (none is `NEXT_PUBLIC_`). A build check found none in the browser bundle.
- **Secret scrubber** (`lib/redact.ts`) removes API keys, tokens, JWTs, passwords and connection strings from teacher
  messages, marks data, Claude's replies, the change log, emails and GitHub issues. Fields named like secrets are dropped.
- **Locked database:** Row Level Security is on for every table with no public policies; only the server's service-role
  key can read it. Screenshots sit in a private bucket and are shown through 10-minute signed links.
- **Sign-in:** signed, HttpOnly, Secure, SameSite cookies (12 h teachers, 8 h owner/developer); cross-site requests are
  refused; failed sign-ins are slowed down; access codes and the Claude Code key are stored only as hashes and can be
  replaced at any time.
- **Uploads:** PNG/JPEG/WebP only, checked by file content, 5 MB each, 3 per message.
- **Limits:** each teacher can send `TEACHER_HOURLY_LIMIT` messages an hour, so the Claude bill can't run away.
- **Nothing changes in the evaluation app without the owner's approval**, and the Claude Code instructions tell it to
  treat fixes as bug reports, never as orders to touch secrets.
- Security headers on every page (CSP, HSTS, nosniff); search engines are told not to index the site.

## Set up (about 20 minutes)

1. **Supabase:** create a new project for the helpdesk (separate from the evaluation app). In the SQL editor, run
   `supabase/migrations/0001_helpdesk.sql`.
2. **Vercel:** import this folder as a new project (Root Directory `eval-helpdesk`), add the variables from
   `.env.example`, and deploy. Set `APP_URL` to the address Vercel gives you and redeploy.
3. **Teachers:** sign in as Owner → *Teachers* → add each teacher and send them their code privately.
4. **Evaluation portal:** add a "Report a problem" link that opens `APP_URL` (optionally with the copy ID visible so
   teachers can copy it).
5. **Claude Code of the evaluation app:** sign in as Owner → *Claude Code key*. Create the key, then follow the three
   steps on that page (where the key goes for claude.ai or for a computer, and the text for the app's `CLAUDE.md`).
   After that the developer just says **"check the helpdesk"**.
6. Optional: email alerts (Resend), GitHub issues, and marks data. See `.env.example`.

### Sending marks data from the evaluation app (optional)

After a copy is checked, the evaluation app's server can send:

```bash
curl -X POST "$APP_URL/api/integration/copies" \
  -H "Authorization: Bearer $INTEGRATION_TOKEN" -H "Content-Type: application/json" \
  -d '{"copy_ref":"CA-2026-0412","subject":"Accounts","questions":[{"no":"5","type":"mcq","max_marks":1,"answer_key":"B","student_answer":"B","marks_awarded":0}]}'
```

The assistant then checks the teacher's report against the real answer key and marks.

## API for Claude Code

| Call | What it does |
| --- | --- |
| `GET /api/fixes` | Approved fixes not done yet, as Markdown (`?format=json` for JSON) |
| `POST /api/fixes/<id>/done` with `{"note": "..."}` | Marks a fix done |

Both need `Authorization: Bearer <helpdesk key>`.

## Develop

```bash
npm install
npm test        # secret scrubber and session tests
npm run build
```
