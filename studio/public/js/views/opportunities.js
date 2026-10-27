// Opportunities: topic cards with evidence, angles, titles, thumbnail concepts and hooks.
import { get, post, patch } from "../api.js";
import { esc, loading, empty, errorBox, toast, modal, busy, formData, overlapNote, TOPIC_TAGS, linkify } from "../ui.js";
import { shortlist, developScript } from "../actions.js";

const ORIGIN = { ai: "AI recommendation", manual: "Added by team", template: "Template — fill in", demo: "Demo data", assistant: "From AI assistant" };

export function hooksList(hooks, { approve = false } = {}) {
  return hooks.map((h, i) => `<div class="card tight"><div class="row between"><b>${esc(h.approach)}</b>${approve ? `<span class="row"><button class="btn small" data-act="copyHook" data-i="${i}">Copy</button><button class="btn small" data-act="approveHook" data-i="${i}">Approve as example</button></span>` : ""}</div>
    <p style="white-space:pre-wrap;margin:.3rem 0">${esc(h.text)}</p>
    ${h.whyItWorks ? `<div class="faint" style="font-size:.85rem">${esc(h.whyItWorks)}</div>` : ""}
    ${h.claimsToVerify?.length ? `<div class="notice" style="margin:.4rem 0 0">Verify before recording: ${h.claimsToVerify.map(esc).join("; ")}</div>` : ""}</div>`).join("");
}

export function informedBy(list) {
  if (!list?.length) return '<p class="faint">No saved references matched this work. Save hooks, titles and script examples to personalise results.</p>';
  return `<div class="faint" style="font-size:.85rem"><b>Informed by:</b> ${list.map((r) => `<a href="#/library?open=${r.id}">${esc(r.title)}</a> (${esc(r.reason || "")})`).join("; ")}</div>`;
}

// The hook generator, used from Opportunities and the Script Studio.
export function hookStudio(ctx, { topic, existingHook = "" }) {
  return modal((box, close) => {
    box.innerHTML = `<h2>Hook generator</h2><p class="muted">${esc(topic?.title || "")}</p>
      <form id="hf"><label>Improve this hook (optional)<textarea name="existingHook" placeholder="Paste a hook to improve using your approved examples">${esc(existingHook)}</textarea></label>
      <label>Direction (optional)<input name="instruction" placeholder="e.g. more urgent, speak to CA Inter students, under 10 seconds"></label>
      <div class="row"><button class="btn primary">Generate hooks</button><button type="button" class="btn ghost" data-close>Close</button></div></form><div id="out"></div>`;
    box.querySelector("[data-close]").onclick = () => close();
    let hooks = [];
    box.querySelector("#hf").onsubmit = async (e) => {
      e.preventDefault();
      const out = box.querySelector("#out");
      out.innerHTML = loading("Writing hooks…");
      try {
        const r = await post(`${ctx.base}/hooks`, { topicId: topic?.id, title: topic?.title, ...formData(e.target) });
        hooks = r.data;
        out.innerHTML = `${r.origin === "template" ? `<div class="notice">Template drafts — fill the [brackets]. ${esc(r.notice || "")}</div>` : ""}${informedBy(r.informedBy)}${hooksList(hooks, { approve: ctx.canEdit })}`;
      } catch (err) { out.innerHTML = errorBox(err); }
    };
    box.onclick = async (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const h = hooks[Number(b.dataset.i)];
      if (b.dataset.act === "copyHook") { await navigator.clipboard.writeText(h.text); toast("Hook copied."); }
      if (b.dataset.act === "approveHook") { await post(`${ctx.base}/hooks/approve`, { text: h.text, approach: h.approach, topicTitle: topic?.title }); b.outerHTML = '<span class="pill done">Approved example</span>'; toast("Saved as an approved hook example. Future hooks will follow it."); }
    };
  }, { wide: true });
}

function card(t, ctx, open) {
  const conf = { high: "done", medium: "warn", low: "" }[t.confidence] || "";
  return `<article class="card" id="t-${t.id}">
    <div class="row between"><h2 style="margin:0">${t.favourite ? "★ " : ""}${esc(t.title)}</h2>
      <span class="row"><span class="pill ${t.origin === "demo" ? "demo" : ""}">${ORIGIN[t.origin] || esc(t.origin)}</span><span class="pill ${conf}">${esc(t.confidence || "?")} confidence</span><span class="pill ${t.status === "shortlisted" ? "done" : t.status === "rejected" ? "failed" : ""}">${esc(t.status)}</span></span></div>
    ${t.centralQuestion ? `<p style="font-size:1.05rem;margin:.4rem 0"><b>Q:</b> ${esc(t.centralQuestion)}</p>` : ""}
    <div>${(t.tags || []).map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>
    ${overlapNote(t.overlap)}
    ${t.notice ? `<div class="notice">${esc(t.notice)}</div>` : ""}
    <details ${open ? "open" : ""}><summary>Details, sources, titles and hook</summary>
      <dl class="kv" style="margin-top:8px">
        <dt>Why the audience cares</dt><dd>${esc(t.whyAudience || "—")}</dd>
        <dt>Why now</dt><dd>${esc(t.whyNow || "—")}</dd>
        <dt>Original angle</dt><dd>${esc(t.angle || "—")}</dd>
        <dt>Title options</dt><dd>${t.titles?.length ? `<ol style="margin:0;padding-left:18px">${t.titles.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : "—"}</dd>
        <dt>Thumbnail concept</dt><dd>${esc(t.thumbnailConcept || "—")}</dd>
        <dt>Opening hook</dt><dd style="white-space:pre-wrap">${esc(t.hook || "—")}</dd>
        <dt>Format</dt><dd>${esc(t.format || "—")}</dd>
        <dt>Sources</dt><dd>${t.sources?.length ? t.sources.map((s) => `<div><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a></div>`).join("") : "—"}</dd>
        <dt>Reference videos</dt><dd>${t.referenceVideoIds?.length ? t.referenceVideoIds.map((v) => `<a href="https://www.youtube.com/watch?v=${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>`).join(", ") : "—"}</dd>
        <dt>Research gaps</dt><dd>${esc(t.researchGaps || "—")}</dd>
        ${t.notes ? `<dt>Notes</dt><dd style="white-space:pre-wrap">${linkify(t.notes)}</dd>` : ""}
        ${t.rejectReason ? `<dt>Rejected because</dt><dd>${esc(t.rejectReason)}</dd>` : ""}
      </dl>
      ${t.informedBy?.length ? informedBy(t.informedBy) : ""}
      ${t.prepared ? `<h3 style="margin-top:12px">Prepared hooks ${t.prepared.origin === "template" ? '<span class="pill warn">template</span>' : ""}</h3>${hooksList(t.prepared.hooks)}<h3>Prepared outline</h3><ol>${t.prepared.outline.sections.map((s) => `<li><b>${esc(s.heading)}</b> — ${esc(s.purpose || "")}<ul>${(s.beats || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul></li>`).join("")}</ol>` : ""}
    </details>
    ${ctx.canEdit ? `<div class="row" style="margin-top:10px">
      ${t.status === "suggested" ? `<button class="btn primary small" data-act="shortlist" data-id="${t.id}">Shortlist</button>` : ""}
      ${t.status !== "rejected" ? `<button class="btn small" data-act="script" data-id="${t.id}">Develop Script</button><button class="btn small" data-act="hooks" data-id="${t.id}">Generate hooks</button>` : ""}
      <button class="btn small" data-act="edit" data-id="${t.id}">Edit</button>
      <button class="btn small ghost" data-act="fav" data-id="${t.id}">${t.favourite ? "Unfavourite" : "Favourite"}</button>
      ${t.status === "rejected" ? `<button class="btn small" data-act="restore" data-id="${t.id}">Restore</button>` : t.status === "suggested" ? `<button class="btn small danger" data-act="reject" data-id="${t.id}">Reject</button>` : ""}
      ${t.itemId ? `<a class="btn small ghost" href="#/planner?open=${t.itemId}">In planner</a>` : ""}
    </div>` : ""}
  </article>`;
}

function topicForm(t = {}) {
  return `<form id="tf">
    <label>Proposed topic<input name="title" required value="${esc(t.title || "")}"></label>
    <label>Central question<input name="centralQuestion" value="${esc(t.centralQuestion || "")}"></label>
    <div class="grid g2"><label>Why the audience cares<textarea name="whyAudience">${esc(t.whyAudience || "")}</textarea></label><label>Why now<textarea name="whyNow">${esc(t.whyNow || "")}</textarea></label></div>
    <label>Original angle<textarea name="angle">${esc(t.angle || "")}</textarea></label>
    <label>Three title options (one per line)<textarea name="titles">${esc((t.titles || []).join("\n"))}</textarea></label>
    <div class="grid g2"><label>Thumbnail concept<input name="thumbnailConcept" value="${esc(t.thumbnailConcept || "")}"></label><label>Recommended format<input name="format" value="${esc(t.format || "")}" placeholder="long-form, Short, Reel"></label></div>
    <label>Opening hook<textarea name="hook">${esc(t.hook || "")}</textarea></label>
    <label>Research gaps<input name="researchGaps" value="${esc(t.researchGaps || "")}"></label>
    <div class="grid g2"><label>Confidence<select name="confidence">${["low", "medium", "high"].map((c) => `<option ${t.confidence === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    <fieldset><legend>Tags</legend>${TOPIC_TAGS.map((x) => `<label class="check"><input type="checkbox" name="tags" value="${x}" ${t.tags?.includes(x) ? "checked" : ""}>${x}</label>`).join("")}</fieldset></div>
    <div id="ov"></div>
    <div class="row"><button class="btn primary">Save topic</button><button type="button" class="btn ghost" data-close>Cancel</button></div></form>`;
}

function editTopic(ctx, t) {
  return modal((box, close) => {
    box.innerHTML = `<h2>${t?.id ? "Edit topic" : "New topic"}</h2>${topicForm(t || {})}`;
    const form = box.querySelector("#tf");
    box.querySelector("[data-close]").onclick = () => close();
    form.title.onblur = async () => {
      const r = await post(`${ctx.base}/overlap`, { text: `${form.title.value} ${form.centralQuestion.value}`, excludeId: t?.id }).catch(() => ({ overlap: [] }));
      box.querySelector("#ov").innerHTML = overlapNote(r.overlap);
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = formData(form);
      d.titles = d.titles.split("\n").map((x) => x.trim()).filter(Boolean);
      try {
        const r = await busy(form.querySelector(".primary"), () => (t?.id ? patch(`${ctx.base}/topics/${t.id}`, d) : post(`${ctx.base}/topics`, d)));
        close(r);
      } catch (err) { toast(err.message, true); }
    };
  }, { wide: true });
}

export default async function opportunities(el, ctx) {
  const topics = await get(`${ctx.base}/topics`);
  const ai = ctx.ws.status.ai;
  el.innerHTML = `
    <div class="row between"><h1>Opportunities</h1>${ctx.canEdit ? '<button class="btn" id="newTopic">New topic</button>' : ""}</div>
    ${ai.state !== "live" ? `<div class="notice">${esc(ai.detail)} Topic recommendations come from research runs with AI; you can still add and develop topics by hand.</div>` : ""}
    <form class="card row" id="filters">
      <input name="q" placeholder="Search topics" style="flex:1;min-width:180px">
      <select name="status" style="width:auto"><option value="active">Suggested + shortlisted</option><option value="suggested">Suggested</option><option value="shortlisted">Shortlisted</option><option value="rejected">Rejected</option><option value="">All</option></select>
      ${TOPIC_TAGS.map((x) => `<label class="check"><input type="checkbox" name="tags" value="${x}">${x}</label>`).join("")}
      <label class="check"><input type="checkbox" name="fav" value="1">favourites</label>
    </form>
    <div id="list"></div>`;
  const draw = () => {
    const f = formData(el.querySelector("#filters"));
    const q = f.q.toLowerCase();
    let list = topics.filter((t) => (f.status === "active" ? ["suggested", "shortlisted"].includes(t.status) : !f.status || t.status === f.status));
    if (f.tags.length) list = list.filter((t) => f.tags.every((x) => t.tags?.includes(x)));
    if (f.fav.length) list = list.filter((t) => t.favourite);
    if (q) list = list.filter((t) => [t.title, t.centralQuestion, t.angle, t.notes].join(" ").toLowerCase().includes(q));
    el.querySelector("#list").innerHTML = list.length ? list.map((t) => card(t, ctx, ctx.query.open === t.id)).join("") : empty(topics.length ? "No topics match these filters." : "No topics yet. Run research, develop an idea from a saved reference or video, or add one by hand.");
  };
  el.querySelector("#filters").oninput = draw;
  draw();
  if (ctx.query.open) el.querySelector(`#t-${CSS.escape(ctx.query.open)}`)?.scrollIntoView({ block: "start" });

  const newBtn = el.querySelector("#newTopic");
  if (newBtn) newBtn.onclick = async () => { if (await editTopic(ctx)) ctx.refresh(); };

  el.onclick = async (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const t = topics.find((x) => x.id === b.dataset.id);
    try {
      if (b.dataset.act === "shortlist") { if (await shortlist(ctx, t.id, b)) ctx.refresh(); }
      if (b.dataset.act === "script") await developScript(ctx, { topicId: t.id, itemId: t.itemId }, b);
      if (b.dataset.act === "hooks") hookStudio(ctx, { topic: t, existingHook: t.hook });
      if (b.dataset.act === "edit") { if (await editTopic(ctx, t)) ctx.refresh(); }
      if (b.dataset.act === "fav") { await patch(`${ctx.base}/topics/${t.id}`, { favourite: !t.favourite }); ctx.refresh(); }
      if (b.dataset.act === "restore") { await post(`${ctx.base}/topics/${t.id}/restore`); ctx.refresh(); }
      if (b.dataset.act === "reject") {
        const reason = prompt("Why reject it? (The reason becomes a proposed preference you can approve in Settings → Preferences.)", "");
        if (reason === null) return;
        await post(`${ctx.base}/topics/${t.id}/reject`, { reason });
        toast("Rejected. It won't be suggested again.");
        ctx.refresh();
      }
    } catch (err) { toast(err.message, true); }
  };
}
