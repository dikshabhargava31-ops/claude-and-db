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

## IPA Priority Board

`priority/index.html` is the IPA Priority Board (no build step). It has the projects gallery, "Do this now", tasks (Kanban, by day, by project, calendar), a timeline, a folder for each project with notes, links and a work log, and idle-project reminders.

- **Private data:** the board's data is `data.json` in the private repository `dikshabhargava31-ops/ipa-priority-board-data`, not in this public repository. The page has no data of its own, so anyone who isn't signed in sees nothing.
- **Access:** add each person to `ipa-priority-board-data` (Settings → Collaborators). They never need access to this repository, so their token can't change the website.
- **Signing in:** each person enters their name and a [classic token](https://github.com/settings/tokens/new?scopes=repo&description=IPA%20Priority%20Board) with the `repo` box ticked. The token is kept only in that browser. Signing out removes it and the browser's copy of the board.
- **Names:** every change is saved as a commit in the data repository with the editor's name. Tasks show who they're assigned to, who added them and who finished them. The work log and links show who added each entry. Use **Show tasks for** to see one person's tasks.
- **Work log:** editors can delete entries. Deleting a "Done" entry keeps the task done.
- **Back up / Restore:** download a copy of the board, or replace it for everyone from a copy.
- **Files:** GitHub Pages can't store uploads, so add work as links (for example Google Drive).
