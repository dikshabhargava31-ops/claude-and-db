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

`priority/` is the IPA Priority Board (`index.html` plus `data.json`, no build step). It has the projects gallery, "Do this now", tasks (Kanban, by day, by project, calendar), a timeline, a folder for each project with notes, links and a work log, and idle-project reminders.

- **Shared data:** everyone sees the board stored in `priority/data.json` on `main`. Anyone with the link can view it.
- **Editing:** click **Sign in to edit** and enter your name and a GitHub [fine-grained token](https://github.com/settings/personal-access-tokens/new) for only this repository, with **Contents: Read and write**. Each editor must be a collaborator on the repository (Settings → Collaborators). The token is kept only in that browser.
- **Names:** every change is saved as a commit with the editor's name. Tasks show who they're assigned to, who added them and who finished them. The work log and links show who added each entry. Use **Show tasks for** to see one person's tasks. The repository's commit history for `priority/data.json` is the full change history.
- **Work log:** editors can delete entries. Deleting a "Done" entry keeps the task done.
- **Back up / Restore:** download a copy of the board, or replace it for everyone from a copy.
- **Files:** GitHub Pages can't store uploads, so add work as links (for example Google Drive).
