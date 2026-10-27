// Dashboard: setup checklist, the latest research run, the review queue and the pipeline at a glance.
import { get, post } from "../api.js";
import { esc, num, date, ago, loading, empty, toast, busy, STAGES } from "../ui.js";
import { videoCard, parseVideo, saveReference, developIdea, shortlist } from "../actions.js";

const STEP_PILL = { done: "done", running: "manual", skipped: "skipped", blocked: "blocked", failed: "failed" };

function runCard(run) {
  if (!run) return `<div class="card"><h2>Research runs</h2>${empty("No research run yet. Click <b>Run my content research</b> (top right) to study your channel, monitor saved competitors, find outliers and audience questions, check current developments and prepare a prioritised shortlist.")}</div>`;
  return `<div class="card"><div class="row between"><h2>Latest research run</h2><span class="muted">${esc(run.trigger)} · started ${ago(run.startedAt)} · <b>${esc(run.status)}</b></span></div>
    <ol class="steps">${run.steps.map((s) => `<li><span class="pill ${STEP_PILL[s.status] || ""}">${esc(s.status)}</span> <b>${esc(s.label)}</b>${s.detail ? ` — <span class="muted">${esc(s.detail)}</span>` : ""}${s.status === "blocked" ? ' <a href="#/settings">Fix connection</a>' : ""}</li>`).join("")}</ol>
    ${run.status === "running" ? loading("Running… this page updates by itself.") : ""}</div>`;
}

function reviewItem(r, ctx) {
  const head = `<div class="row between"><h3>${esc(r.title)}</h3><span class="tag">${esc(r.type)}</span></div>`;
  const why = r.why ? `<p><b>Why it matters:</b> ${esc(r.why)}</p>` : "";
  const prepared = r.prepared ? `<p><b>Prepared:</b> ${esc(r.prepared)}</p>` : "";
  const needs = r.needs ? `<p><b>Needs your decision:</b> ${esc(r.needs)}</p>` : "";
  const dismiss = ctx.canEdit ? `<button class="btn small ghost" data-act="decide" data-id="${r.id}" data-d="dismissed">Dismiss</button>` : "";
  let body = "";
  if (r.type === "outlier" && r.video) body = `<div style="max-width:340px">${videoCard({ ...r.video, scoreText: r.why }, { actions: ctx.canEdit ? ["save", "develop"] : [] })}</div>`;
  if (r.type === "topics") body = `<ul>${(r.topics || []).map((t) => `<li><a href="#/opportunities?open=${t.id}">${esc(t.title)}</a> <span class="faint">(${esc(t.confidence)} confidence${t.overlap?.length ? ", overlap warning" : ""})</span></li>`).join("")}</ul><a class="btn small" href="#/opportunities">Review in Opportunities</a>`;
  if (r.type === "draft" && r.topic) body = `<div class="row">${ctx.canEdit && r.topic.status === "suggested" ? `<button class="btn small primary" data-act="shortlist" data-id="${r.topic.id}" data-review="${r.id}">Shortlist</button>` : `<span class="pill done">${esc(r.topic.status)}</span>`}<a class="btn small" href="#/opportunities?open=${r.topic.id}">Open hooks and outline</a></div>`;
  if (r.type === "questions") body = `<details><summary>Show questions</summary><ul>${(r.data || []).map((q) => `<li>${esc(q.text)} <span class="faint">— ${esc(q.videoTitle || "")}, ${q.likes} likes</span></li>`).join("")}</ul></details>`;
  if (r.type === "performance") body = `<a class="btn small" href="#/analytics?video=${esc(r.videoId)}">See evidence and experiments</a>`;
  if (r.type === "blocked") body = `<a class="btn small" href="#/settings">Open connections</a>`;
  if (r.type === "question") body = `<a class="btn small" href="#/settings">Open workspace settings</a>`;
  if (r.type === "ig-schedule") {
    body = `<dl class="kv"><dt>Account</dt><dd>${esc(r.post.account)}</dd><dt>Time (IST)</dt><dd>${esc(r.post.publish_at)}</dd><dt>Type</dt><dd>${esc(r.post.type)}</dd><dt>Media</dt><dd>${r.post.media.split("|").map((m) => `<a href="${esc(m)}" target="_blank" rel="noopener noreferrer">${esc(m.split("/").pop())}</a>`).join(", ")}</dd><dt>Caption</dt><dd style="white-space:pre-wrap">${esc(r.post.caption)}</dd><dt>CSV row</dt><dd><code style="word-break:break-all">${esc(r.csvRow)}</code> <button class="btn small" data-act="copy" data-text="${esc(r.csvRow)}">Copy</button></dd></dl>
      <div class="row" style="margin-top:8px">${ctx.isOwner && ctx.ws.status.instagramPlanner.write ? `<button class="btn primary small" data-act="approveIg" data-id="${r.id}">Approve and schedule on Instagram</button>` : ""}${ctx.canEdit ? `<button class="btn small" data-act="decide" data-id="${r.id}" data-d="rejected">Reject</button>` : ""}<a class="btn small" href="${esc(ctx.ws.status.instagramPlanner.url)}" target="_blank" rel="noopener noreferrer">Open Instagram Planner</a></div>
      ${!ctx.isOwner ? '<p class="faint">Only the workspace owner can approve external scheduling.</p>' : ""}`;
    return `<div class="card">${head}${why}${needs}${body}</div>`;
  }
  return `<div class="card">${head}${why}${prepared}${needs}${body}<div class="row" style="margin-top:6px">${dismiss}</div></div>`;
}

function checklist(c, ws) {
  const steps = [
    ["Set up the workspace profile", c.profile, "#/settings"],
    ["Add competitor and inspiration channels", c.channels, "#/channels"],
    ["Search or import real video references", c.videos, "#/research"],
    ["Save a reference", c.refs, "#/research"],
    ["Develop and shortlist an original topic", c.shortlisted, "#/opportunities"],
    ["Generate a personalised hook and outline", c.scripts, "#/scripts"],
    ["Move the topic through the content pipeline", c.moved, "#/planner"],
  ];
  if (steps.every((s) => s[1])) return "";
  return `<div class="card"><h2>Getting started${ws.demo ? " (demo)" : ""}</h2><ol class="steps">${steps.map(([l, ok, href]) => `<li>${ok ? '<span class="pill done">done</span>' : '<span class="pill">to do</span>'} <a href="${href}">${l}</a></li>`).join("")}</ol></div>`;
}

export default async function dashboard(el, ctx) {
  const [runs, reviews, items, channels, refs, scripts, topics] = await Promise.all([
    get(`${ctx.base}/runs`), get(`${ctx.base}/reviews?decision=pending`), get(`${ctx.base}/items`), get(`${ctx.base}/channels`),
    get(`${ctx.base}/references`), get(`${ctx.base}/scripts`), get(`${ctx.base}/topics`),
  ]);
  const p = ctx.ws.profile || {};
  const c = {
    profile: !!(p.niche && p.audience && p.pillars?.length), channels: channels.some((x) => x.list !== "own"),
    videos: channels.some((x) => x.storedVideos) || refs.some((r) => r.videoId), refs: refs.length > 0,
    shortlisted: topics.some((t) => t.status === "shortlisted"), scripts: scripts.length > 0,
    moved: items.some((i) => STAGES.indexOf(i.stage) > 2),
  };
  const counts = Object.fromEntries(STAGES.map((s) => [s, items.filter((i) => i.stage === s).length]));
  const upcoming = items.filter((i) => i.deadline && i.stage !== "Published").sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 6);
  const run = runs[0];
  el.innerHTML = `
    <h1>Dashboard</h1>
    ${checklist(c, ctx.ws)}
    <div class="grid g2" style="align-items:start">
      <div>
        <h2>Review queue ${reviews.length ? `<span class="pill accent">${reviews.length} waiting</span>` : ""}</h2>
        <p class="muted">What the assistant found, why it matters, what it prepared and what needs your decision.</p>
        ${reviews.length ? reviews.map((r) => reviewItem(r, ctx)).join("") : empty("Nothing waiting for you. Run research to fill the queue.")}
      </div>
      <div>
        <div id="runBox">${runCard(run)}</div>
        <div class="card"><h2>Pipeline</h2><div class="grid g4">${STAGES.map((s) => `<a href="#/planner" style="text-decoration:none;color:inherit"><div class="stat">${counts[s]}</div><div class="muted" style="font-size:.85rem">${s}</div></a>`).join("")}</div></div>
        <div class="card"><h2>Next deadlines</h2>${upcoming.length ? `<table><tbody>${upcoming.map((i) => `<tr><td><a href="#/planner?open=${i.id}">${esc(i.title)}</a></td><td>${esc(i.stage)}</td><td class="num ${i.deadline < new Date().toISOString().slice(0, 10) ? "down" : ""}">${date(i.deadline)}</td></tr>`).join("")}</tbody></table>` : empty("No deadlines set.")}</div>
      </div>
    </div>`;

  el.onclick = async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    try {
      if (act === "saveRef") await saveReference(ctx, { video: parseVideo(b) });
      if (act === "develop") await developIdea(ctx, { video: parseVideo(b) }, b);
      if (act === "copy") { await navigator.clipboard.writeText(b.dataset.text); toast("CSV row copied."); }
      if (act === "decide") { await post(`${ctx.base}/reviews/${b.dataset.id}/decide`, { decision: b.dataset.d }); await ctx.refresh(); }
      if (act === "shortlist") { if (await shortlist(ctx, b.dataset.id, b)) { await post(`${ctx.base}/reviews/${b.dataset.review}/decide`, { decision: "done" }); await ctx.refresh(); } }
      if (act === "approveIg") {
        const r = await busy(b, () => post(`${ctx.base}/reviews/${b.dataset.id}/decide`, { decision: "approved" }), "Scheduling…");
        toast(`Scheduled. ${r.result?.note || ""}`);
        await ctx.refresh();
      }
    } catch (err) { toast(err.message, true); }
  };

  // While a run is in progress, refresh its progress every few seconds.
  if (run?.status === "running") {
    const timer = setInterval(async () => {
      if (!ctx.isCurrent() || !el.isConnected) return clearInterval(timer);
      try {
        const r = await get(`${ctx.base}/runs/${run.id}`);
        const box = el.querySelector("#runBox");
        if (box) box.innerHTML = runCard(r);
        if (r.status !== "running") { clearInterval(timer); toast("Research run finished."); ctx.refresh(); }
      } catch (e) { clearInterval(timer); }
    }, 3000);
  }
}
