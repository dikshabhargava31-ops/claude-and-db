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

## Setup

### 1. Board and secrets

1. **Board token.** Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to **only** `dikshabhargava31-ops/ipa_task` and **Contents: Read and write**.
2. **Your team.** Copy `config.example.json` to `assistant/config.json` in the private `ipa_task` repository. Put your real team in `team` (name as it appears on the board, role, what they're good at) and change `keep` and `priority_order` if you need to.
3. **Secrets.** In this repository go to Settings → Secrets and variables → Actions and add `BOARD_TOKEN` and `WHATSAPP_PHONE` (your number with country code, such as `+9198xxxxxxxx`). `ANTHROPIC_API_KEY` is already there for the CUET forms watcher, and this uses it too.

### 2. WhatsApp through Meta (recommended)

This uses Meta's official WhatsApp Cloud API, the same developer account as the Instagram scheduler.

1. **Add WhatsApp to your Meta app.** In [Meta for Developers](https://developers.facebook.com/apps) open your app → Add product → WhatsApp → Set up. Meta gives you a free **test number** straight away. Under *API Setup*, add your own number as a recipient and confirm the code WhatsApp sends you. The test number can message up to 5 numbers you add there.
2. **Copy two IDs** from *API Setup*: the **Phone number ID** and the **WhatsApp Business Account ID**.
3. **Make a permanent token.** In [Business Settings](https://business.facebook.com/settings) → Users → System users, add a system user (Admin), assign it your app and the WhatsApp account, and generate a token with `whatsapp_business_messaging` and `whatsapp_business_management`. The token on the API Setup page expires after 24 hours, so don't use that one.
4. **Add the secrets** `META_TOKEN`, `META_PHONE_NUMBER_ID` and `META_WABA_ID`.
5. **Submit the templates.** Actions → *Daily assistant* → Run workflow → `templates`. This sends the five message templates to Meta. Run it again later to see whether they're `APPROVED` (usually minutes, sometimes a day).
6. **Test.** Run workflow → `morning`.

**Why templates:** Meta only lets a business number start a chat with a message it has approved in advance: fixed wording with blanks. The assistant fills the blanks. A blank can't hold line breaks, so lists inside one appear on a single line separated by semicolons.

**Cost:** Meta charges a small fee for each template message (utility rate for India). Check [Meta's pricing page](https://developers.facebook.com/docs/whatsapp/pricing) for the current rate; three or four messages a day costs a few rupees.

**Your own number later:** the test number is fine for you. To message your team directly you'll want a real number: add one in WhatsApp Manager (it can't be a number already used in the WhatsApp app) and verify your business.

**Messaging your team directly:** set `"notify_team": true` in the settings and add each person's `phone`. The assistant then sends each person their task itself (template `ops_task_assigned`), and only lists the people without a number for you to forward to. Tell your team first that these messages will come, and on the test number add them as recipients.

### Or: CallMeBot (free, no Meta setup)

Follow the steps on [callmebot.com](https://www.callmebot.com/blog/free-api-whatsapp-messages/) and add the key as `CALLMEBOT_APIKEY` instead of the `META_*` secrets. It only sends to your own number and isn't an official WhatsApp service, so it can stop working without notice. Twilio also works: add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_WHATSAPP_FROM`.

## Settings (`assistant/config.json` in ipa_task)

| Key | Meaning |
| --- | --- |
| `me` | Your name as it appears on the board |
| `auto_assign` | `true`: assign hand-offs on the board. `false`: only suggest them in the message |
| `max_top`, `max_quick` | How many main and quick tasks a day (3 and 4) |
| `priority_order` | Project names, most important first |
| `keep`, `keep_keywords` | Work that always stays with you |
| `team` | `name`, `role`, `good_at` and, optionally, `phone` for each person |
| `notify_team` | With Meta: `true` sends each person their hand-off directly |

## Privacy

This repository is public, so its Actions log shows only counts. Tasks, settings and each day's plan (`assistant/plans/<date>.json`) stay in `ipa_task`.

## Trying it locally

```bash
python3 assistant/daily_assistant.py morning --board data.json --config assistant/config.example.json
```

`--board` reads a local copy of the board and only prints the messages, with the template blanks underneath. `--no-ai` skips Claude.
