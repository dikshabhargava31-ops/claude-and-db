# Instagram scheduler

This tool posts to any number of Instagram accounts on a schedule, for free. You list your posts in `posts.csv`. Every 15 minutes, GitHub Actions publishes the ones that are due through Instagram's official API, then records them in `published.json` so nothing is posted twice.

- **Post types:** single photos, carousels (2–10 photos or videos), Reels and Stories, each with an optional first comment.
- **Timing:** GitHub starts scheduled runs late when it is busy, so a post usually goes out 0–30 minutes after its time.
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

To add an account later, edit the secret and paste the whole JSON again.

## 3. Let tokens renew themselves (once)

Tokens expire after 60 days. The *Instagram token refresh* workflow renews them every Monday, but it needs permission to save the new tokens:

1. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new). Give it access to this repository only, with **Secrets: Read and write**.
2. Save it as a repository secret named `GH_PAT`.

If a token expires anyway, generate a new one (step 1.4) and update `IG_ACCOUNTS`.

## 4. Schedule posts

Add rows to `posts.csv`. You can edit it on github.com, or in Excel or Google Sheets (save as CSV):

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

Instagram downloads each file from its link, so the link has to open the file itself, not a preview page. Google Drive and Dropbox share links don't work. Free hosts that give direct links include [Cloudinary](https://cloudinary.com) and [ImgBB](https://imgbb.com) (images only).

- **Images:** JPEG only. Use a 4:5 ratio (1080×1350) for the feed and 9:16 (1080×1920) for Stories.
- **Reels:** MP4 or MOV, 9:16, 3 seconds to 15 minutes. Videos rendered in `videos/<name>/renders/` are already the right size.
- **Daily limit:** each account can publish at most 50 posts per day through the API.

## Check and run

- **Check the list:** the *Actions* tab shows every run and what it posted or why it failed. On your own computer, `python3 instagram/ig_scheduler.py check` validates `posts.csv` and lists what is queued.
- **Run it now:** go to *Actions → Instagram scheduler → Run workflow*. Tick *dry run* to only see what would be posted.
- **Retry a failed post:** fix it in `posts.csv`, delete its entry under `"failed"` in `published.json`, and give it a new `publish_at` if it is more than 12 hours late.

## Good to know

- **The schedule is public.** This repository is public, so anyone can read upcoming captions in `posts.csv`. To keep them private, copy `instagram/` and the two `.github/workflows/instagram-*.yml` files into a private repository. Private repositories get 2,000 free Actions minutes a month, so change the cron in `instagram-scheduler.yml` to `*/30 * * * *` there.
- **Scheduled runs can switch off.** GitHub turns off scheduled workflows in a public repository after 60 days without commits. Each published post makes a commit. If nothing is posted for two months, re-enable the workflow from the Actions tab.
