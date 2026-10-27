// Channels: my channel, direct competitors and inspiration channels.
import { get, post, patch, del } from "../api.js";
import { esc, num, date, ago, dur, source, scorePill, loading, empty, errorBox, toast, modal, busy, confirmBox, formData } from "../ui.js";

const LISTS = [
  ["own", "My channel", "Your own channel(s). Used for your baseline, performance analysis and duplicate detection."],
  ["competitor", "Direct competitors", "Channels serving a similar audience."],
  ["inspiration", "Inspiration channels", "Outside your niche: study their titles, thumbnails, hooks, storytelling or editing."],
];
const STUDY = ["titles", "thumbnails", "hooks", "storytelling", "editing"];

function row(c, ctx) {
  return `<tr>
    <td>${c.thumb ? `<img src="${esc(c.thumb)}" alt="" width="32" height="32" style="border-radius:50%">` : ""}</td>
    <td><b>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.title)}</a>` : esc(c.title)}</b> <span class="faint">${esc(c.handle || "")}</span>
      ${c.list === "inspiration" ? `<div>${STUDY.map((s) => `<label class="check" style="font-size:.82rem"><input type="checkbox" data-act="study" data-id="${c.id}" value="${s}" ${c.studyFor?.includes(s) ? "checked" : ""} ${ctx.canEdit ? "" : "disabled"}>${s}</label>`).join("")}</div>` : ""}
      ${c.notes ? `<div class="faint">${esc(c.notes)}</div>` : ""}
      ${c.lastError ? `<div class="notice error" style="margin:4px 0 0">${esc(c.lastError)}</div>` : ""}</td>
    <td class="num">${num(c.subscribers)}<div class="faint">subs</div></td>
    <td class="num">${c.storedVideos}<div class="faint">stored videos</div></td>
    <td class="num">${c.outliers ? `<span class="pill accent">${c.outliers}</span>` : "0"}<div class="faint">outliers</div></td>
    <td>${source(c.source)}<div class="faint" style="font-size:.8rem">${c.lastRefreshed ? "refreshed " + ago(c.lastRefreshed) : c.lastImported ? "imported " + ago(c.lastImported) : "no data yet"}</div></td>
    <td style="white-space:nowrap">
      <button class="btn small" data-act="videos" data-id="${c.id}">Videos</button>
      ${ctx.canEdit ? `${c.ytChannelId && c.source !== "demo" ? `<button class="btn small" data-act="refresh" data-id="${c.id}">Refresh</button>` : ""}
      <button class="btn small" data-act="csv" data-id="${c.id}">Import CSV</button>
      <select data-act="move" data-id="${c.id}" aria-label="Move to list" style="width:auto">${LISTS.map(([k, l]) => `<option value="${k}" ${k === c.list ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="btn small ghost" data-act="notes" data-id="${c.id}">Notes</button>
      <button class="btn small danger" data-act="remove" data-id="${c.id}">Remove</button>` : ""}
    </td></tr>`;
}

export default async function channels(el, ctx) {
  const list = await get(`${ctx.base}/channels`);
  const yt = ctx.ws.status.youtubeData;
  el.innerHTML = `
    <div class="row between"><h1>Channels</h1>${source(yt.state)}</div>
    ${yt.state !== "live" ? '<div class="notice">Without the YouTube Data API key, channels are listed by hand and their videos come from CSV imports (YouTube Studio export for your own channel, or a sheet with video ID/URL, title, publish date, duration and views).</div>' : ""}
    ${ctx.canEdit ? `<form class="card row" id="addForm">
      <input name="input" placeholder="Channel link, @handle, a video link from the channel, or a channel name" style="flex:1;min-width:240px" required>
      <select name="list" style="width:auto">${LISTS.map(([k, l]) => `<option value="${k}" ${k === "competitor" ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="btn primary">Add channel</button></form><div id="choose"></div>` : ""}
    ${LISTS.map(([k, label, help]) => {
      const rows = list.filter((c) => c.list === k);
      return `<div class="card"><h2>${label} <span class="faint">(${rows.length})</span></h2><p class="muted">${help}</p>
        ${rows.length ? `<div class="table-wrap"><table><tbody>${rows.map((c) => row(c, ctx)).join("")}</tbody></table></div>` : empty("None yet.")}</div>`;
    }).join("")}`;

  const add = async (body, btn) => {
    try {
      const r = await busy(btn, () => post(`${ctx.base}/channels`, body), "Adding…");
      if (r.choose) {
        el.querySelector("#choose").innerHTML = `<div class="card"><h3>Which channel?</h3>${r.choose.length ? `<table><tbody>${r.choose.map((c) => `<tr><td>${esc(c.title)} <span class="faint">${esc(c.handle || "")}</span></td><td class="num">${num(c.subscribers)} subs</td><td><button class="btn small" data-act="pick" data-yt="${esc(c.ytChannelId)}" data-list="${body.list}">Add</button></td></tr>`).join("")}</tbody></table>` : empty("No channels found.")}</div>`;
        return;
      }
      toast(`${r.title} added${r.storedVideos === 0 && r.source === "live" ? "" : ""}.`);
      ctx.refresh();
    } catch (err) { toast(err.message, true); }
  };
  const form = el.querySelector("#addForm");
  if (form) form.onsubmit = (e) => { e.preventDefault(); add(formData(form), form.querySelector("button")); };

  el.onchange = async (e) => {
    const t = e.target;
    if (t.dataset.act === "move") { await patch(`${ctx.base}/channels/${t.dataset.id}`, { list: t.value }); ctx.refresh(); }
    if (t.dataset.act === "study") {
      const boxes = [...el.querySelectorAll(`[data-act=study][data-id="${t.dataset.id}"]`)].filter((x) => x.checked).map((x) => x.value);
      await patch(`${ctx.base}/channels/${t.dataset.id}`, { studyFor: boxes });
    }
  };

  el.onclick = async (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const id = b.dataset.id;
    const c = list.find((x) => x.id === id);
    try {
      if (b.dataset.act === "pick") await add({ input: b.dataset.yt, list: b.dataset.list }, b);
      if (b.dataset.act === "refresh") { const r = await busy(b, () => post(`${ctx.base}/channels/${id}/refresh`), "Refreshing…"); toast(`${r.videos} videos updated.`); ctx.refresh(); }
      if (b.dataset.act === "remove" && await confirmBox("Remove channel?", `Remove <b>${esc(c.title)}</b> and its stored videos from this workspace?`, "Remove")) { await del(`${ctx.base}/channels/${id}`); ctx.refresh(); }
      if (b.dataset.act === "notes") {
        const notes = prompt("Notes about this channel (what to watch for):", c.notes || "");
        if (notes !== null) { await patch(`${ctx.base}/channels/${id}`, { notes }); ctx.refresh(); }
      }
      if (b.dataset.act === "csv") importCsv(ctx, c);
      if (b.dataset.act === "videos") showVideos(ctx, c);
    } catch (err) { toast(err.message, true); }
  };
}

function importCsv(ctx, c) {
  modal((box, close) => {
    box.innerHTML = `<h2>Import videos for ${esc(c.title)}</h2>
      <p class="muted">Use a YouTube Studio export (Analytics → Advanced mode → Content → Export → CSV) for your own channel, or any sheet with columns such as <code>Video ID</code> or <code>URL</code>, <code>Title</code>, <code>Published</code>, <code>Duration</code>, <code>Views</code>. Studio exports also bring impressions, CTR, average view duration and percentage viewed. Imported rows are labelled "Imported data".</p>
      <input type="file" accept=".csv,text/csv" id="f"><div id="out"></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="go">Import</button><button class="btn ghost" id="cancel">Close</button></div>`;
    box.querySelector("#cancel").onclick = () => close();
    box.querySelector("#go").onclick = async (e) => {
      const file = box.querySelector("#f").files[0];
      if (!file) return toast("Choose a CSV file.", true);
      try {
        const r = await busy(e.target, async () => post(`${ctx.base}/videos/import-csv`, { channelRowId: c.id, csv: await file.text() }));
        box.querySelector("#out").innerHTML = `<div class="notice good">Imported ${r.imported} videos. Columns used: ${esc(Object.values(r.mapped).join(", "))}.${r.unmapped.length ? ` Ignored: ${esc(r.unmapped.join(", "))}.` : ""}</div>`;
        ctx.reloadWs();
      } catch (err) { box.querySelector("#out").innerHTML = errorBox(err); }
    };
  }).then(() => ctx.refresh());
}

function showVideos(ctx, c) {
  modal(async (box) => {
    box.innerHTML = `<h2>${esc(c.title)}</h2>${loading()}`;
    try {
      const vids = await get(`${ctx.base}/channels/${c.id}/videos`);
      box.innerHTML = `<h2>${esc(c.title)}</h2><p class="muted">Scores compare each video with this channel's own same-format videos (see Research → How outliers are measured).</p>
        ${vids.length ? `<div class="table-wrap"><table><thead><tr><th>Video</th><th>Published</th><th class="num">Length</th><th class="num">Views</th><th>Vs channel</th></tr></thead><tbody>
        ${vids.map((v) => `<tr><td><a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.title)}</a> ${source(v.source)}</td><td>${date(v.publishedAt)}</td><td class="num">${dur(v.durationSec)}${v.format === "short" ? " · Short" : ""}</td><td class="num">${num(v.views)}</td><td>${scorePill(v.score)} <span class="faint" style="font-size:.82rem">${esc(v.scoreText)}</span></td></tr>`).join("")}</tbody></table></div>` : empty("No videos stored. Refresh the channel or import a CSV.")}`;
    } catch (err) { box.innerHTML = errorBox(err); }
  }, { wide: true });
}
