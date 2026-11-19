# Daily Ops Assistant

GitHub's own schedule proved unreliable for this repository (on 19 Nov none of the timed runs started), so three scheduled tasks on the owner's Claude account start the workflow at 08:42, 13:17 and 18:47 IST with `once` ticked. GitHub's schedule stays as a backup: each message also has two backup times (morning 09:07 and 09:34, midday 13:47, evening 19:17 and 19:47). The first run that sends records it in `ipa_task/assistant/sent/`, and the backups then do nothing, so you never get a message twice. Running the workflow by hand always sends.

Plans your day from the **IPA Ops Board** (`ops.json`) and sends it to you by **Gmail** and as a **notification on your laptop** (and phone, if you like), Monday to Saturday:

| Time (IST) | Message |
| --- | --- |
| 08:42 | **To-do list.** Routine work due today, team tasks to follow up, and in the last week of the month the KRA reviews still to do. Up to 3 tasks in order, with the most important one (not the loudest) first, and a 5-minute first step for each. Quick tasks to batch in one slot. What it handed off, and to whom. What can wait. One line on what you finished yesterday. At the end, a ready-to-send WhatsApp note for each person. |
| 13:17 | **Nudge.** How many of today's tasks are done, and the next one with its first small step. |
| 18:47 | **Wrap-up.** What you and the team finished, what carries over, hand-offs to chase, and tomorrow's first task, so there's nothing to decide at night. On Fridays and Saturdays, the week's count for your impact log. |

## How it decides what to hand off

You don't choose. Every morning it looks at your open tasks (unassigned, or assigned to you) and:

- **keeps** work that needs you: legal judgment, money and vendor decisions, strategy, founder conversations, hiring (the `keep` list in the settings);
- **hands off** work that clearly matches someone's role, KRAs and daily duties on the board (at most 5 a day; planning, targets and budgets stay with you). Only Claude makes hand-offs, so without `ANTHROPIC_API_KEY` nothing is handed off;
- **assigns it on the board** (Assigned to: that person; the change is saved as "Ops Assistant"), and writes the message for you to forward.

It never hands off a task twice. If you take a task back, it stays yours. With no team in the settings it only hands off work very like what someone has already done.

With `ANTHROPIC_API_KEY` set, Claude makes the plan. Without it, built-in rules make a simpler one.

## Setup (about 10 minutes)

### 1. Board token

Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to **only** `dikshabhargava31-ops/ipa_task` and **Contents: Read and write**. Add it as the secret `BOARD_TOKEN` (this repository → Settings → Secrets and variables → Actions).

### 2. Gmail

The assistant sends the email from your Gmail to your Gmail, so it lands in your inbox, not spam.

1. Turn on [2-Step Verification](https://myaccount.google.com/signinoptions/twosv) for your Google account if it's off. Google only offers app passwords with it on.
2. Open [App passwords](https://myaccount.google.com/apppasswords), name it `Daily assistant` and create it. Google shows a 16-letter password once.
3. Add two secrets: `GMAIL_ADDRESS` (your Gmail address) and `GMAIL_APP_PASSWORD` (the 16 letters).

The app password can only send and read mail, not change your account, and you can delete it at any time on the same page. To get the emails in another inbox, add `EMAIL_TO`.

### 3. Laptop notification (ntfy, free, no account)

1. Make up a private topic name that nobody could guess, such as `ipa-diksha-7h3kq9x2`. Anyone who knows the name can read the notifications, so treat it like a password.
2. On your laptop open [ntfy.sh/app](https://ntfy.sh/app), choose **Subscribe to topic**, enter the name, and allow notifications when the browser asks. Keep it as a pinned tab, or install it (Chrome or Edge: the install icon in the address bar) so it works with the window closed. On Windows you can also use the ntfy desktop app.
3. Optional: install the **ntfy** app on your phone and subscribe to the same topic.
4. Add the secret `NTFY_TOPIC` with the topic name.

Clicking a notification opens the board.

### 4. Claude (optional)

`ANTHROPIC_API_KEY` lets Claude make the plan; without it, built-in rules do. Create one at [console.anthropic.com](https://console.anthropic.com) and set a monthly spend limit there.

### 5. Test

Actions → *Daily assistant* → Run workflow → `morning`. The email and the notification should arrive within a minute. The run's log says which channels sent.

WhatsApp through CallMeBot still works if you ever add `WHATSAPP_PHONE` and `CALLMEBOT_APIKEY`. Every channel with its secrets gets each message.

## Settings (`assistant/config.json` in ipa_task)

| Key | Meaning |
| --- | --- |
| `me` | Your name as it appears on the board |
| `auto_assign` | `true`: assign hand-offs on the board. `false`: only suggest them in the message |
| `max_top`, `max_quick` | How many main and quick tasks a day (3 and 4) |
| `priority_order` | Project names, most important first |
| `keep`, `keep_keywords` | Work that always stays with you |
| `team` | `name`, `role`, `good_at` for each person |

## Privacy

This repository is public, so its Actions log shows only counts. The email goes through your own Gmail; the notification passes through ntfy.sh, so keep the topic name private and keep personal details (salaries, marks, bank details) out of task names. Tasks, settings and each day's plan (`assistant/plans/<date>.json`) stay in `ipa_task`.

## Trying it locally

```bash
python3 assistant/daily_assistant.py morning --board data.json --config assistant/config.example.json
```

`--board` reads a local copy of the board and only prints the messages. `--no-ai` skips Claude.
