# Daily Ops Assistant

Plans your day from the **IPA Priority Board** and sends it to you on WhatsApp, Monday to Saturday:

| Time (IST) | Message |
| --- | --- |
| 08:42 | **To-do list.** Up to 3 tasks in order, with the most important one (not the loudest) first, and a 5-minute first step for each. Quick tasks to batch in one slot. What it handed off, and to whom. What can wait. One line on what you finished yesterday. A second message holds a ready-to-forward note for each person. |
| 13:17 | **Nudge.** How many of today's tasks are done, and the next one with its first small step. |
| 18:47 | **Wrap-up.** What you and the team finished, what carries over, hand-offs to chase, and tomorrow's first task, so there's nothing to decide at night. On Fridays and Saturdays, the week's count for your impact log. |

## How it decides what to hand off

You don't choose. Every morning it looks at your open tasks (unassigned, or assigned to you) and:

- **keeps** work that needs you: legal judgment, money and vendor decisions, strategy, founder conversations, hiring (the `keep` list in the settings);
- **hands off** the rest to the team member who fits best, judged by what each person is good at and what they've done on the board before;
- **assigns it on the board** (Assigned to: that person; the change is saved as "Ops Assistant"), and writes the message for you to forward.

It never hands off a task twice. If you take a task back, it stays yours. With no team in the settings it only hands off work very like what someone has already done.

With `ANTHROPIC_API_KEY` set, Claude makes the plan. Without it, built-in rules make a simpler one.

## Setup (about 10 minutes)

1. **WhatsApp (CallMeBot, free).** Follow the steps on [callmebot.com](https://www.callmebot.com/blog/free-api-whatsapp-messages/): save their number and send them the activation message from your phone. They reply with your API key.
2. **Board token.** Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to **only** `dikshabhargava31-ops/ipa_task` and **Contents: Read and write**.
3. **Secrets.** In this repository go to Settings → Secrets and variables → Actions and add:
   - `BOARD_TOKEN`: the token from step 2
   - `WHATSAPP_PHONE`: your number with country code, such as `+9198xxxxxxxx`
   - `CALLMEBOT_APIKEY`: the key from step 1
   - `ANTHROPIC_API_KEY` is already there for the CUET forms watcher, and this uses it too.
4. **Your team.** Copy `config.example.json` to `assistant/config.json` in the private `ipa_task` repository. Put your real team in `team` (name as it appears on the board, role, and what they're good at) and change `keep` and `priority_order` if you need to. Names and roles stay private there.
5. **Test.** Actions → *Daily assistant* → Run workflow → `morning`. The message should arrive within a minute.

To use Twilio instead of CallMeBot, add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_WHATSAPP_FROM` instead of `CALLMEBOT_APIKEY`.

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

This repository is public, so its Actions log shows only counts. Tasks, settings and each day's plan (`assistant/plans/<date>.json`) stay in `ipa_task`.

## Trying it locally

```bash
python3 assistant/daily_assistant.py morning --board data.json --config assistant/config.example.json
```

`--board` reads a local copy of the board and only prints the messages. `--no-ai` skips Claude.
