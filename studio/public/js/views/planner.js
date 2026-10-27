// Content Planner: board and calendar from Idea to Published, item details, duplicate detection,
// and hand-off of Instagram posts to the existing Instagram Planner (after owner approval).
import { get, post, patch, del } from "../api.js";
import { esc, date, ago, loading, empty, errorBox, toast, modal, busy, formData, confirmBox, overlapNote, STAGES, PLATFORMS } from "../ui.js";
import { addToPlanner, developScript } from "../actions.js";

const today = () => new Date().toISOString().slice(0, 10);

function itemCard(i, members) {
  const owner = members.find((m) => m.id === i.owner);
  const overdue = i.deadline && i.deadline < today() && i.stage !== "Published";
  return `<div class="icard ${overdue ? "overdue" : ""}" draggable="true" data-id="${i.id}" tabindex="0">
    <div class="t">${i.favourite ? "★ " : ""}${esc(i.title)}</div>
    <div class="faint" style="font-size:.8rem">${PLATFORMS[i.platform] || ""}${owner ? " · " + esc(owner.name) : ""}${i.deadline ? ` · <span class="${overdue ? "down" : ""}">${date(i.deadline)}</span>` : ""}</div>
    <select data-move="${i.id}" aria-label="Move to stage" style="margin-top:6px;font-size:.8rem;padding:2px 6px">${STAGES.map((s) => `<option ${s === i.stage ? "selected" : ""}>${s}</option>`).join("")}</select></div>`;
}

function calendar(items, igPosts, month) {
  const first = new Date(month + "-01T00:00:00");
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const events = {};
  const add = (d, html) => { if (d) (events[d.slice(0, 10)] ??= []).push(html); };
  for (const i of items) {
    add(i.deadline, `<a class="ev yt" href="#/planner?open=${i.id}" title="Deadline: ${esc(i.title)}">⏰ ${esc(i.title)}</a>`);
    if (i.scheduledAt) add(i.scheduledAt.replace(" ", "T"), `<a class="ev yt" href="#/planner?open=${i.id}" title="Scheduled">📅 ${esc(i.title)}</a>`);
    if (i.publishedAt) add(i.publishedAt, `<a class="ev yt" href="#/planner?open=${i.id}">✅ ${esc(i.title)}</a>`);
  }
  for (const p of igPosts) add(p.publish_at.replace(" ", "T"), `<a class="ev ig" href="${esc(p.permalink || "#/planner")}" ${p.permalink ? 'target="_blank" rel="noopener noreferrer"' : ""} title="Instagram Planner: ${esc(p.account)} ${esc(p.type)} (${esc(p.status)})">IG ${esc(p.account)} · ${esc(p.type)} ${p.status === "published" ? "✓" : p.status === "failed" ? "⚠" : ""}</a>`);
  const cells = [];
  for (let d = new Date(start), n = 0; n < 42; n++, d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cells.push(`<div class="d ${d.getMonth() !== first.getMonth() ? "off" : ""} ${key === today() ? "today" : ""}"><b>${d.getDate()}</b>${(events[key] || []).join("")}</div>`);
  }
  return `<div class="cal">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => `<div class="faint" style="font-size:.8rem">${x}</div>`).join("")}${cells.join("")}</div>`;
}

export default async function planner(el, ctx) {
  const view = ctx.query.view || "board";
  const [items, ig] = await Promise.all([get(`${ctx.base}/items`), get(`${ctx.base}/instagram/planner`).catch((e) => ({ error: e.message, posts: [], accounts: {} }))]);
  const members = ctx.ws.members;
  el.innerHTML = `
    <div class="row between"><h1>Content Planner</h1>${ctx.canEdit ? '<button class="btn primary" id="add">Add to Planner</button>' : ""}</div>
    <div class="tabs">${["board", "calendar", "list"].map((v) => `<button data-view="${v}" class="${view === v ? "on" : ""}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div>
    <form class="row card tight" id="filters">
      <input name="q" placeholder="Search" style="flex:1;min-width:160px">
      <select name="platform" style="width:auto"><option value="">All platforms</option>${Object.entries(PLATFORMS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <select name="owner" style="width:auto"><option value="">Anyone</option>${members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("")}</select>
      <label class="check"><input type="checkbox" name="fav" value="1">favourites</label>
      <label class="check"><input type="checkbox" name="mine" value="1">assigned to me</label>
      ${view === "calendar" ? `<input type="month" name="month" value="${ctx.query.month || today().slice(0, 7)}" style="width:auto">` : ""}
    </form>
    ${ig.error ? `<div class="notice">Instagram Planner couldn't be read: ${esc(ig.error)}</div>` : `<p class="faint">Instagram posts come live from your existing Instagram Planner (${esc(ig.repo || "")}, read ${ago(ig.fetchedAt)}). This planner doesn't publish; approved Instagram posts are handed to that scheduler.</p>`}
    <div id="body"></div>`;

  el.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => ctx.nav(`planner?view=${b.dataset.view}`)));
  const add = el.querySelector("#add");
  if (add) add.onclick = async () => { if (await addToPlanner(ctx)) ctx.refresh(); };

  const filtered = () => {
    const f = formData(el.querySelector("#filters"));
    return items.filter((i) => (!f.q || [i.title, i.notes, i.hook].join(" ").toLowerCase().includes(f.q.toLowerCase())) && (!f.platform || i.platform === f.platform) && (!f.owner || i.owner === f.owner) && (!f.fav.length || i.favourite) && (!f.mine.length || i.owner === ctx.user.id));
  };
  const draw = () => {
    const list = filtered();
    const body = el.querySelector("#body");
    if (view === "board") {
      body.innerHTML = `<div class="board">${STAGES.map((s) => { const col = list.filter((i) => i.stage === s); return `<section class="col" data-stage="${s}"><h3>${s}<span>${col.length}</span></h3>${col.map((i) => itemCard(i, members)).join("")}</section>`; }).join("")}</div>`;
    } else if (view === "calendar") {
      const month = formData(el.querySelector("#filters")).month || today().slice(0, 7);
      body.innerHTML = calendar(list, ig.posts || [], month);
    } else {
      body.innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr><th>Title</th><th>Stage</th><th>Platform</th><th>Owner</th><th>Deadline</th><th>Script</th></tr></thead><tbody>${list.map((i) => `<tr><td><a href="#" data-open="${i.id}">${i.favourite ? "★ " : ""}${esc(i.title)}</a></td><td>${esc(i.stage)}</td><td>${PLATFORMS[i.platform] || ""}</td><td>${esc(members.find((m) => m.id === i.owner)?.name || "")}</td><td>${date(i.deadline)}</td><td>${i.scriptId ? `<a href="#/scripts/${i.scriptId}">open</a>` : ""}</td></tr>`).join("")}</tbody></table></div>` : empty("No items match.");
    }
  };
  el.querySelector("#filters").oninput = draw;
  draw();

  const move = async (id, stage) => {
    try { await patch(`${ctx.base}/items/${id}`, { stage }); const i = items.find((x) => x.id === id); i.stage = stage; draw(); toast(`Moved to ${stage}.`); }
    catch (err) { toast(err.message, true); }
  };
  el.ondragstart = (e) => { const c = e.target.closest(".icard"); if (c) e.dataTransfer.setData("text/plain", c.dataset.id); };
  el.ondragover = (e) => { const col = e.target.closest(".col"); if (col && ctx.canEdit) { e.preventDefault(); col.classList.add("drop"); } };
  el.ondragleave = (e) => e.target.closest(".col")?.classList.remove("drop");
  el.ondrop = (e) => { const col = e.target.closest(".col"); if (!col) return; e.preventDefault(); col.classList.remove("drop"); move(e.dataTransfer.getData("text/plain"), col.dataset.stage); };
  el.onchange = (e) => { if (e.target.dataset.move) move(e.target.dataset.move, e.target.value); };
  el.onclick = (e) => {
    const o = e.target.closest("[data-open]");
    if (o) { e.preventDefault(); return openItem(ctx, o.dataset.open, ig); }
    const c = e.target.closest(".icard");
    if (c && !e.target.closest("select")) openItem(ctx, c.dataset.id, ig);
  };
  el.onkeydown = (e) => { const c = e.target.closest(".icard"); if (c && e.key === "Enter") openItem(ctx, c.dataset.id, ig); };
  if (ctx.query.open) openItem(ctx, ctx.query.open, ig);
}

async function openItem(ctx, id, ig) {
  const changed = await modal(async (box, close) => {
    box.innerHTML = loading();
    let i;
    try { i = await get(`${ctx.base}/items/${id}`); } catch (err) { box.innerHTML = errorBox(err); return; }
    const members = ctx.ws.members;
    const dis = ctx.canEdit ? "" : "disabled";
    box.innerHTML = `
      <div class="row between"><h2>${esc(i.title)}</h2><button class="btn ghost" data-close>Close</button></div>
      <p class="faint">${esc(i.stage)} · created ${date(i.createdAt)}${i.topic ? ` · from topic <a href="#/opportunities?open=${i.topic.id}">${esc(i.topic.title)}</a>` : ""}</p>
      <form id="itemForm">
        <label>Title<input name="title" value="${esc(i.title)}" ${dis}></label><div id="ov"></div>
        <div class="grid g3">
          <label>Stage<select name="stage" ${dis}>${STAGES.map((s) => `<option ${s === i.stage ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label>Platform<select name="platform" ${dis}>${Object.entries(PLATFORMS).map(([k, l]) => `<option value="${k}" ${k === i.platform ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label>Format<input name="format" value="${esc(i.format || "")}" ${dis}></label>
          <label>Owner<select name="owner" ${dis}><option value="">Unassigned</option>${members.map((m) => `<option value="${m.id}" ${m.id === i.owner ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
          <label>Deadline<input type="date" name="deadline" value="${esc(i.deadline || "")}" ${dis}></label>
          <label class="check" style="margin-top:24px"><input type="checkbox" name="favourite" value="1" ${i.favourite ? "checked" : ""} ${dis}>Favourite</label>
        </div>
        <label>Title options (one per line)<textarea name="titleOptions" ${dis}>${esc((i.titleOptions || []).join("\n"))}</textarea></label>
        <div class="grid g2"><label>Thumbnail brief<textarea name="thumbnailBrief" ${dis}>${esc(i.thumbnailBrief || "")}</textarea></label><label>Hook<textarea name="hook" ${dis}>${esc(i.hook || "")}</textarea></label></div>
        <div class="grid g2"><label>Final published title<input name="finalTitle" value="${esc(i.finalTitle || "")}" ${dis}></label><label>Publication link<input name="publicationLink" value="${esc(i.publicationLink || "")}" placeholder="YouTube or Instagram URL" ${dis}></label></div>
        <label>Notes<textarea name="notes" ${dis}>${esc(i.notes || "")}</textarea></label>
        ${i.stage === "Published" ? `<label>Lessons learned<textarea name="lessons" ${dis}>${esc(i.lessons || "")}</textarea></label>` : ""}
        ${ctx.canEdit ? '<div class="row"><button class="btn primary">Save</button></div>' : ""}
      </form>
      <hr class="sep">
      <div class="grid g2">
        <div><h3>Script</h3>${i.script ? `<a href="#/scripts/${i.script.id}">${esc(i.script.title)}</a> · ${esc(i.script.status)} · v${i.script.versions.length}` : ctx.canEdit ? '<button class="btn" data-act="script">Develop Script</button>' : "—"}
          <h3 style="margin-top:12px">References</h3>${i.references.length ? `<ul>${i.references.map((r) => `<li><a href="#/library?open=${r.id}">${esc(r.title)}</a></li>`).join("")}</ul>` : '<p class="faint">None linked.</p>'}
          ${ctx.canEdit ? '<div class="row"><input id="refSearch" placeholder="Find a saved reference to link"><button class="btn small" data-act="findRef">Find</button></div><div id="refResults"></div>' : ""}</div>
        <div><h3>History</h3><ul style="max-height:180px;overflow:auto">${[...(i.history || [])].reverse().map((h) => `<li><span class="faint">${date(h.at, true)}</span> ${esc(h.note)}</li>`).join("")}</ul></div>
      </div>
      <hr class="sep">
      <h3>Creative changes after publishing</h3><p class="faint">Record title, thumbnail or other changes with their date so results can be read properly.</p>
      ${i.changes?.length ? `<table><tbody>${i.changes.map((c) => `<tr><td>${date(c.at, true)}</td><td>${esc(c.field)}</td><td>${esc(c.from)} → ${esc(c.to)}</td><td class="faint">${esc(c.note || "")}</td></tr>`).join("")}</tbody></table>` : '<p class="faint">No changes recorded.</p>'}
      ${ctx.canEdit ? `<form class="grid g4" id="changeForm"><input name="field" placeholder="title / thumbnail / …" required><input name="from" placeholder="from"><input name="to" placeholder="to"><input type="datetime-local" name="date"><input name="note" placeholder="note"><button class="btn small">Record change</button></form>` : ""}
      <h3 style="margin-top:12px">Experiments</h3>
      ${i.experiments?.length ? `<table><tbody>${i.experiments.map((x) => `<tr><td>${esc(x.change)}</td><td class="faint">${esc(x.measure)}</td><td>${esc(x.status)}</td><td>${esc(x.result || "")}</td><td>${ctx.canEdit ? `<button class="btn small" data-act="xres" data-x="${x.id}">Record result</button>` : ""}</td></tr>`).join("")}</tbody></table>` : '<p class="faint">No experiments yet.</p>'}
      ${ctx.canEdit ? '<form class="row" id="xForm"><input name="change" placeholder="What to try (e.g. face-led thumbnail)" required style="flex:2"><input name="measure" placeholder="What to measure" style="flex:1"><button class="btn small">Add experiment</button></form>' : ""}
      <hr class="sep">
      <h3>Instagram</h3>
      ${i.igPostId ? `<p>Scheduled through the Instagram Planner as <code>${esc(i.igPostId)}</code> for ${esc(i.scheduledAt || "")} IST.</p>` : ctx.canEdit ? igForm(ig, i) : '<p class="faint">Not scheduled.</p>'}
      ${ctx.canEdit ? '<hr class="sep"><button class="btn small danger" data-act="delete">Delete item</button>' : ""}`;

    let dirty = false;
    box.querySelector("[data-close]").onclick = () => close(dirty);
    const form = box.querySelector("#itemForm");
    form.title.onblur = async () => {
      const r = await post(`${ctx.base}/overlap`, { text: form.title.value, excludeId: i.id }).catch(() => ({ overlap: [] }));
      box.querySelector("#ov").innerHTML = overlapNote(r.overlap.filter((o) => o.id !== i.topicId));
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = formData(form);
      d.favourite = d.favourite.length > 0;
      d.titleOptions = d.titleOptions.split("\n").map((x) => x.trim()).filter(Boolean);
      try { await busy(form.querySelector(".primary"), () => patch(`${ctx.base}/items/${i.id}`, d)); dirty = true; toast("Saved."); close(true); }
      catch (err) { toast(err.message, true); }
    };
    const cf = box.querySelector("#changeForm");
    if (cf) cf.onsubmit = async (e) => { e.preventDefault(); await post(`${ctx.base}/items/${i.id}/changes`, formData(cf)); close(true); openItem(ctx, i.id, ig); };
    const xf = box.querySelector("#xForm");
    if (xf) xf.onsubmit = async (e) => { e.preventDefault(); await post(`${ctx.base}/items/${i.id}/experiments`, formData(xf)); close(true); openItem(ctx, i.id, ig); };
    const igf = box.querySelector("#igForm");
    if (igf) igf.onsubmit = async (e) => {
      e.preventDefault();
      const d = formData(igf);
      d.media = d.media.split("\n").map((x) => x.trim()).filter(Boolean);
      try {
        await busy(igf.querySelector(".primary"), () => post(`${ctx.base}/items/${i.id}/instagram`, d));
        toast("Prepared. It's in the review queue waiting for the owner's approval; nothing is scheduled yet.");
        close(true);
      } catch (err) { box.querySelector("#igErr").innerHTML = errorBox(err); }
    };
    box.onclick = async (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      try {
        if (b.dataset.act === "script") { close(true); await developScript(ctx, { itemId: i.id }, b); }
        if (b.dataset.act === "delete" && await confirmBox("Delete item?", esc(i.title), "Delete")) { await del(`${ctx.base}/items/${i.id}`); close(true); }
        if (b.dataset.act === "xres") { const result = prompt("Result of the experiment (with dates and numbers if you have them):"); if (result) { await patch(`${ctx.base}/items/${i.id}/experiments/${b.dataset.x}`, { result, status: "done" }); close(true); openItem(ctx, i.id, ig); } }
        if (b.dataset.act === "findRef") {
          const q = box.querySelector("#refSearch").value;
          const refs = await get(`${ctx.base}/references?q=${encodeURIComponent(q)}`);
          box.querySelector("#refResults").innerHTML = refs.slice(0, 8).map((r) => `<div class="row between"><span>${esc(r.title)}</span><button class="btn small" data-act="linkRef" data-ref="${r.id}">Link</button></div>`).join("") || '<p class="faint">No matches.</p>';
        }
        if (b.dataset.act === "linkRef") { await patch(`${ctx.base}/items/${i.id}`, { referenceIds: [...new Set([...(i.referenceIds || []), b.dataset.ref])] }); close(true); openItem(ctx, i.id, ig); }
      } catch (err) { toast(err.message, true); }
    };
  }, { wide: true });
  if (changed) ctx.refresh();
}

function igForm(ig, i) {
  const accounts = Object.entries(ig.accounts || {});
  if (!accounts.length) return `<p class="faint">The Instagram Planner's accounts couldn't be read${ig.error ? ` (${esc(ig.error)})` : ""}.</p>`;
  return `<details><summary>Prepare an Instagram post for the existing scheduler</summary>
    <p class="faint">Upload the media with the Instagram Planner's composer (it stores files in <code>instagram-media</code>) and paste the public links here. The post goes to the review queue; it is only scheduled when the workspace owner approves it.</p>
    <form id="igForm"><div class="grid g3">
      <label>Account<select name="account">${accounts.map(([k, u]) => `<option value="${esc(k)}">@${esc(u)} (${esc(k)})</option>`).join("")}</select></label>
      <label>Time (India)<input type="datetime-local" name="publish_at" required></label>
      <label>Type<select name="type"><option value="reel">Reel</option><option value="post">Photo post</option><option value="carousel">Carousel</option><option value="story">Story</option></select></label></div>
      <label>Media links (one per line, public https)<textarea name="media" required></textarea></label>
      <label>Caption<textarea name="caption">${esc(i.finalTitle || i.title)}</textarea></label>
      <label>First comment (optional)<input name="first_comment"></label>
      <div id="igErr"></div><button class="btn primary">Send for approval</button></form></details>`;
}
