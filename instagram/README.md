# Instagram scheduler

This tool posts to any number of Instagram accounts on a schedule, for free. You list your posts in `posts.csv`. Every 15 minutes, GitHub Actions publishes the ones that are due through Instagram's official API, then records them in `published.json` so nothing is posted twice.

- **Post types:** single photos, carousels (2–10 photos or videos), Reels and Stories, each with an optional first comment.
- **Timing:** GitHub often starts scheduled runs hours late, so a run doesn't just post what's due. While a post is coming up in the next 5½ hours, the run stays open, re-reads the schedule every 2 minutes and publishes each post on time. The planner also starts a run whenever you save a post. Waiting uses free Actions minutes, because this repository is public.
- **Safety:** a post that fails is retried in each of the next 2 runs, then left alone. A post more than 12 hours late is skipped, so an old date typed by mistake never posts.

## 1. Set up each Instagram account (once)

1. **Make the account professional.** In the Instagram app, go to Settings → *Account type and tools* → *Switch to professional account* (Business or Creator). This is free and doesn't need a Facebook Page.
2. **Create one Meta app for all accounts.** On [developers.facebook.com](https://developers.facebook.com/apps), choose *Create app* and pick the use case *Manage messaging & content on Instagram*. Leave the app in development mode; it works for your own accounts without App Review.
3. **Add each account as a tester.** In the app, open *App roles → Roles → Add people → Instagram Tester* and enter the username. Then accept the invite on Instagram: Settings → *Website permissions → Apps and websites → Tester invites*.
4. **Get each account's ID and token.** In the app, open *Instagram → API setup with Instagram business login → Generate access tokens* and click *Add account*. Log in to that account and allow the permissions for content publishing and comments. Copy the **Instagram user ID** (the number) and the **token**. Each token lasts 60 days; step 3 renews it automatically.

## 2. Add the accounts to GitHub (once)

In this repository, open Settings → *Secrets and variables → Actions → New repository secret*. Name it `IG_ACCOUNTS` and paste one entry per account. You choose the short names (like `ipa`); they're what you type in `posts.csv`:

```json
{
  "ipa": {"user_id": "17841400000000000", "token": "IGAA..."},
  "second": {"user_id": "17841400000000001", "token": "IGAA..."}
}
```

### Adding another account later

You don't need to touch `IG_ACCOUNTS`, whose tokens have been renewed since you pasted them.

1. **Connect it in Meta.** Do steps 1.1, 1.3 and 1.4 for the new account in the same Meta app: make it professional, add it as an Instagram Tester and accept the invite, then copy its user ID and token.
2. **Give it its own secret.** Create a repository secret in the first free slot, from `IG_ACCOUNT_1` to `IG_ACCOUNT_10`. As its value, paste a short name (lowercase letters, digits or `_`), the user ID and the token, separated by spaces: `school 17841400000000003 IGAA...`.
3. **Show it in the planner.** Add the short name and the Instagram username to `accounts.json` (`"school": "school_username"`).

Run *Instagram scheduler* with mode *verify* to check it. The weekly renewal covers these secrets too. For more than 12 accounts in all, add `IG_ACCOUNT_11` and up to the `env` lists in both `instagram-*.yml` workflows.

## 3. Let tokens renew themselves (once)

Tokens expire after 60 days. The *Instagram token refresh* workflow renews them every Monday, but it needs permission to save the new tokens:

1. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new). Give it access to this repository only, with **Secrets: Read and write**.
2. Save it as a repository secret named `GH_PAT`.

If a token expires anyway, generate a new one (step 1.4) and update `IG_ACCOUNTS`.

## 4. Schedule posts

The easiest way is the **Instagram Planner**: https://dikshabhargava31-ops.github.io/claude-and-db/schedule/

- **Calendar:** month, week and list views of every post, colour-coded by account and status. Filter by account, and click a post to see its preview, edit it, duplicate it, delete it or post it now. Posts that failed are flagged at the top with Instagram's reason.
- **Create post:** pick one or more accounts. Drop in JPG, PNG or MP4 files; PNGs become JPGs and large photos are scaled to 1440 px. The type (photo, carousel, reel or story) follows from the files, and you can change it. A live Instagram-style preview sits beside the form. Instagram's limits (photo shape, reel length, caption length, 30 hashtags) are checked before anything is saved.
- **Files:** the page uploads them to the public repository [`instagram-media`](https://github.com/dikshabhargava31-ops/instagram-media), because Instagram only downloads media from a public link. Large media never goes into this repository.
- **Publish due now:** publishes anything already due straight away.
- **Signing in:** the page uses a [classic token](https://github.com/settings/tokens/new?scopes=repo&description=Instagram%20Planner) with the `repo` box ticked. It's kept only in that browser. If you're already signed in to the IPA Priority Board in the same browser, the page reuses that sign-in.
- **Accounts:** the account list comes from `accounts.json` (short name → Instagram username, no tokens). When you add an account to `IG_ACCOUNTS`, add it there too.

For files made in a Claude Code session, `prepare_media.py` does the same conversion and checks, then copies the files into a clone of `instagram-media`. `CLAUDE.md` has the steps.

You can also add rows to `posts.csv` by hand, on github.com or in Excel or Google Sheets (save as CSV):

| Column | What to put |
| --- | --- |
| `id` | Any unique name, like `diwali-offer`. Start it with `#` to switch the row off. |
| `account` | A short name from `IG_ACCOUNTS`. |
| `publish_at` | India time, like `2026-11-01 18:30`. Add an offset (`2026-11-01T18:30+04:00`) to use another zone. |
| `type` | `post`, `carousel`, `reel` or `story`. |
| `media` | A public `https://` link to the file. For a carousel, put the links in order separated by `\|`. |
| `caption` | The caption, up to 2,200 characters. Wrap it in quotes if it has commas or line breaks. |
| `first_comment` | Optional, for example the hashtags. |

### Media files

Instagram downloads each file from its link, so the link has to open the file itself, not a preview page. The planner and `prepare_media.py` handle this by putting files in `instagram-media`. If you add a link by hand, note that Google Drive and Dropbox share links don't work.

- **Images:** JPEG only. Use a 4:5 ratio (1080×1350) for the feed and 9:16 (1080×1920) for Stories.
- **Reels:** MP4 or MOV, 9:16, 3 seconds to 15 minutes. Videos rendered in `videos/<name>/renders/` are already the right size.
- **Daily limit:** each account can publish a limited number of posts per day through the API (100 at the time of writing). The *verify* run shows the current limit.

## Check and run

- **Check the list:** the *Actions* tab shows every run and what it posted or why it failed. On your own computer, `python3 instagram/ig_scheduler.py check` validates `posts.csv` and lists what is queued.
- **Run it now:** go to *Actions → Instagram scheduler → Run workflow*. Choose *dry-run* to only see what would be posted, *verify* to check that every account's token works, or *probe* with a link to have Instagram fetch and process that file. Verify and probe never publish anything.
- **Retry a failed post:** in the planner, open it and click *Post now* (it gets a fresh set of tries), or *Edit* it. By hand: fix it in `posts.csv`, delete its entry under `"failed"` in `published.json`, and give it a new `publish_at` if it is more than 12 hours late.

## Good to know

- **The schedule is public.** This repository is public, so anyone can read upcoming captions in `posts.csv`. To keep them private, copy `instagram/` and the two `.github/workflows/instagram-*.yml` files into a private repository. Private repositories get only 2,000 free Actions minutes a month, and a waiting run uses them, so there lower `--watch-hours` in `instagram-scheduler.yml` (for example to 0.5) and change the cron to `*/30 * * * *`.
- **Scheduled runs can switch off.** GitHub turns off scheduled workflows in a public repository after 60 days without commits. Each published post makes a commit. If nothing is posted for two months, re-enable the workflow from the Actions tab.
