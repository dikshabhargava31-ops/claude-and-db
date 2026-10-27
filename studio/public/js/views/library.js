// Reference Library: links, videos, screenshots, images, documents, transcripts and notes,
// plus style preferences (learned vs explicitly approved).
import { get, post, patch, del } from "../api.js";
import { esc, date, source, loading, empty, errorBox, toast, modal, busy, formData, fileToBase64, confirmBox, CATEGORY_LABELS, linkify } from "../ui.js";
import { developIdea } from "../actions.js";
import { analysisHtml } from "./scripts.js";

const KINDS = { link: "Link", video: "Video", image: "Screenshot / image", document: "Document", transcript: "Transcript / script", note: "Note" };

function refCard(r, ctx) {
  return `<article class="card" id="r-${r.id}">
    <div class="row between"><h3 style="margin:0">${r.approvedExample ? '<span class="pill accent">Approved example</span> ' : ""}${esc(r.title)}</h3><span class="row"><span class="tag">${KINDS[r.kind] || esc(r.kind)}</span>${r.source === "demo" ? source("demo") : ""}</span></div>
    ${r.url ? `<div><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.url)}</a></div>` : ""}
    ${r.video ? `<div class="faint" style="font-size:.85rem">${esc(r.video.channelTitle || "")}${r.video.views != null ? ` · ${Number(r.video.views).toLocaleString("en-IN")} views` : ""}${r.video.publishedAt ? " · " + date(r.video.publishedAt) : ""} · saved ${date(r.createdAt)}${r.video.scoreText ? `<br>${esc(r.video.scoreText)}` : ""}</div>` : ""}
    ${r.fileId && /^image\//.test(r.fileMime || "") ? `<img src="/files/${ctx.ws.id}/${r.fileId}" alt="${esc(r.title)}" style="max-width:280px;border-radius:6px;margin-top:6px">` : r.fileId ? `<div><a href="/files/${ctx.ws.id}/${r.fileId}">${esc(r.fileName)}</a></div>` : ""}
    <div style="margin-top:4px">${(r.categories || []).map((c) => `<span class="tag">${esc(CATEGORY_LABELS[c] || c)}</span>`).join("")}${(r.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}</div>
    ${r.summary ? `<p style="margin-top:6px">${esc(r.summary)}</p>` : ""}
    ${r.notes ? `<p class="muted" style="white-space:pre-wrap">${linkify(r.notes)}</p>` : ""}
    ${r.text ? `<details><summary>Text${r.transcriptSource ? ` (${esc(r.transcriptSource)})` : ""}</summary><pre class="script">${esc(r.text)}${r.hasMoreText ? "…" : ""}</pre></details>` : ""}
    ${r.suggestion ? `<div class="notice info"><b>Suggested (AI):</b> ${esc(r.suggestion.summary)}<br>Tags: ${r.suggestion.tags.map(esc).join(", ")} · Categories: ${r.suggestion.categories.map((c) => esc(CATEGORY_LABELS[c] || c)).join(", ")}
      ${ctx.canEdit ? `<div class="row" style="margin-top:6px"><button class="btn small primary" data-act="accept" data-id="${r.id}">Accept</button><button class="btn small" data-act="edit" data-id="${r.id}">Edit instead</button></div>` : ""}</div>` : ""}
    ${r.analysis ? `<details><summary>Script analysis</summary>${analysisHtml(r.analysis)}</details>` : ""}
    ${ctx.canEdit ? `<div class="row" style="margin-top:8px">
      <button class="btn small" data-act="suggest" data-id="${r.id}">Suggest tags & summary</button>
      ${r.text && r.text.length > 200 ? `<button class="btn small" data-act="analyze" data-id="${r.id}">Analyse script</button>` : ""}
      <button class="btn small" data-act="develop" data-id="${r.id}">Develop Idea</button>
      <button class="btn small" data-act="approve" data-id="${r.id}">${r.approvedExample ? "Remove approval" : "Approve as style example"}</button>
      <button class="btn small ghost" data-act="edit" data-id="${r.id}">Edit</button>
      <button class="btn small danger" data-act="delete" data-id="${r.id}">Delete</button></div>` : ""}
  </article>`;
}

function refForm(r = {}) {
  return `<form id="rf">
    ${r.id ? "" : `<label>Type<select name="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>`}
    <label>Title<input name="title" value="${esc(r.title || "")}"></label>
    <label>Link<input name="url" value="${esc(r.url || "")}" placeholder="https://…"></label>
    ${r.id ? "" : '<label>File (screenshot, image, PDF, document or transcript, up to 25 MB)<input type="file" name="file"></label>'}
    <fieldset><legend>Categories</legend>${Object.entries(CATEGORY_LABELS).map(([k, l]) => `<label class="check"><input type="checkbox" name="categories" value="${k}" ${r.categories?.includes(k) ? "checked" : ""}>${l}</label>`).join("")}</fieldset>
    <label>Tags (comma separated)<input name="tags" value="${esc((r.tags || []).join(", "))}"></label>
    <label>Summary<textarea name="summary">${esc(r.summary || "")}</textarea></label>
    <label>Notes<textarea name="notes">${esc(r.notes || "")}</textarea></label>
    <label>Text / transcript<textarea name="text" style="min-height:160px">${esc(r.text || "")}</textarea></label>
    <div class="row"><button class="btn primary">${r.id ? "Save changes" : "Save Reference"}</button><button type="button" class="btn ghost" data-close>Cancel</button></div></form>`;
}

function editRef(ctx, r) {
  return modal((box, close) => {
    box.innerHTML = `<h2>${r ? "Edit reference" : "Add reference"}</h2>${refForm(r || {})}`;
    const form = box.querySelector("#rf");
    box.querySelector("[data-close]").onclick = () => close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = formData(form);
      try {
        await busy(form.querySelector(".primary"), async () => {
          if (r) return patch(`${ctx.base}/references/${r.id}`, d);
          const f = form.file.files[0];
          if (f) d.file = { name: f.name, mime: f.type || "application/octet-stream", data: await fileToBase64(f) };
          return post(`${ctx.base}/references`, d);
        });
        close(true);
      } catch (err) { toast(err.message, true); }
    };
  }, { wide: true });
}

async function preferences(el, ctx) {
  const prefs = await get(`${ctx.base}/preferences`);
  const group = (status) => prefs.filter((p) => p.status === status);
  const row = (p) => `<tr><td>${esc(p.statement)}${p.evidence ? `<div class="faint">${esc(p.evidence)}</div>` : ""}</td><td><span class="tag">${p.kind === "learned" ? "learned from feedback" : "set by team"}</span></td><td style="white-space:nowrap">${ctx.canEdit ? `${p.status !== "approved" ? `<button class="btn small primary" data-pact="approved" data-id="${p.id}">Approve</button>` : ""}${p.status !== "rejected" ? `<button class="btn small" data-pact="rejected" data-id="${p.id}">Reject</button>` : ""}<button class="btn small ghost" data-pact="edit" data-id="${p.id}">Edit</button><button class="btn small danger" data-pact="delete" data-id="${p.id}">Delete</button>` : ""}</td></tr>`;
  el.innerHTML = `<p class="muted">A saved reference is material to learn from. A <b>style preference</b> is a rule you've approved; only approved preferences shape generated hooks, titles, topics and scripts. Preferences learned from your rejections and edits wait here for approval.</p>
    ${ctx.canEdit ? `<form class="card row" id="prefForm"><input name="statement" placeholder="e.g. Titles under 60 characters; never use 'shocking'" style="flex:1" required><button class="btn primary">Add approved preference</button></form>` : ""}
    <div class="card"><h2>Waiting for approval (${group("proposed").length})</h2>${group("proposed").length ? `<table><tbody>${group("proposed").map(row).join("")}</tbody></table>` : empty("Nothing waiting.")}</div>
    <div class="card"><h2>Approved (${group("approved").length})</h2>${group("approved").length ? `<table><tbody>${group("approved").map(row).join("")}</tbody></table>` : empty("No approved preferences yet.")}</div>
    <div class="card"><h2>Rejected (${group("rejected").length})</h2>${group("rejected").length ? `<table><tbody>${group("rejected").map(row).join("")}</tbody></table>` : empty("None.")}</div>`;
  const form = el.querySelector("#prefForm");
  if (form) form.onsubmit = async (e) => { e.preventDefault(); await post(`${ctx.base}/preferences`, { statement: form.statement.value }); preferences(el, ctx); };
  el.onclick = async (e) => {
    const b = e.target.closest("[data-pact]");
    if (!b) return;
    const p = prefs.find((x) => x.id === b.dataset.id);
    if (b.dataset.pact === "edit") { const st = prompt("Edit preference:", p.statement); if (st) await patch(`${ctx.base}/preferences/${p.id}`, { statement: st }); }
    else if (b.dataset.pact === "delete") await del(`${ctx.base}/preferences/${p.id}`);
    else await patch(`${ctx.base}/preferences/${p.id}`, { status: b.dataset.pact });
    preferences(el, ctx);
  };
}

export default async function library(el, ctx) {
  const tab = ctx.query.tab === "preferences" ? "preferences" : "refs";
  el.innerHTML = `<div class="row between"><h1>Reference Library</h1>${ctx.canEdit && tab === "refs" ? '<button class="btn primary" id="add">Add reference</button>' : ""}</div>
    <div class="tabs"><button class="${tab === "refs" ? "on" : ""}" data-go="library">References</button><button class="${tab === "preferences" ? "on" : ""}" data-go="library?tab=preferences">Style preferences</button></div><div id="body">${loading()}</div>`;
  el.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => ctx.nav(b.dataset.go)));
  const body = el.querySelector("#body");
  if (tab === "preferences") return preferences(body, ctx);
  el.querySelector("#add")?.addEventListener("click", async () => { if (await editRef(ctx)) ctx.refresh(); });

  body.innerHTML = `<form class="card row" id="filters">
      <input name="q" placeholder="Search references (title, tags, notes, text)" style="flex:1;min-width:200px">
      <select name="category" style="width:auto"><option value="">All categories</option>${Object.entries(CATEGORY_LABELS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <select name="kind" style="width:auto"><option value="">All types</option>${Object.entries(KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <label class="check"><input type="checkbox" name="approved" value="1" ${ctx.query.approved ? "checked" : ""}>approved examples only</label></form><div id="list">${loading()}</div>`;
  let refs = [];
  const load = async () => {
    const f = formData(body.querySelector("#filters"));
    const q = new URLSearchParams(Object.entries({ q: f.q, category: f.category, kind: f.kind, approved: f.approved.length ? "1" : "" }).filter(([, v]) => v));
    const list = body.querySelector("#list");
    try {
      refs = await get(`${ctx.base}/references?${q}`);
      list.innerHTML = refs.length ? refs.map((r) => refCard(r, ctx)).join("") : empty("No references yet. Use <b>Save Reference</b> on any video in Research, or add links, screenshots, documents, transcripts and notes here.");
      if (ctx.query.open) { const c = list.querySelector(`#r-${CSS.escape(ctx.query.open)}`); c?.scrollIntoView(); c?.querySelector("details")?.setAttribute("open", ""); }
    } catch (err) { list.innerHTML = errorBox(err); }
  };
  let t;
  body.querySelector("#filters").oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  await load();

  body.onclick = async (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const r = refs.find((x) => x.id === b.dataset.id);
    try {
      switch (b.dataset.act) {
        case "suggest": await busy(b, () => post(`${ctx.base}/references/${r.id}/suggest`), "Reading…"); return load();
        case "accept": await patch(`${ctx.base}/references/${r.id}`, { acceptSuggestion: true }); return load();
        case "analyze": await busy(b, () => post(`${ctx.base}/references/${r.id}/analyze`), "Analysing…"); return load();
        case "develop": return developIdea(ctx, { referenceId: r.id }, b);
        case "approve": await patch(`${ctx.base}/references/${r.id}`, { approvedExample: !r.approvedExample }); toast(r.approvedExample ? "Approval removed." : "Approved: generated work will follow this example's style."); return load();
        case "edit": { const full = await get(`${ctx.base}/references/${r.id}`); if (await editRef(ctx, full)) load(); return; }
        case "delete": if (await confirmBox("Delete reference?", esc(r.title), "Delete")) { await del(`${ctx.base}/references/${r.id}`); load(); } return;
      }
    } catch (err) { toast(err.message, true); }
  };
}
