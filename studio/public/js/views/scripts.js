// Script Studio: research brief, hooks, outline, full script, section revisions, versions,
// comments, approval status and claims to verify. Also studies reference scripts.
import { get, post, patch } from "../api.js";
import { esc, date, ago, loading, empty, errorBox, toast, busy, linkify, source } from "../ui.js";
import { hooksList, informedBy, hookStudio } from "./opportunities.js";

const STATUS = { draft: "Draft", "in-review": "In review", "changes-requested": "Changes requested", approved: "Approved" };

export default async function scripts(el, ctx) {
  if (ctx.rest[0]) return editor(el, ctx, ctx.rest[0]);
  const list = await get(`${ctx.base}/scripts`);
  el.innerHTML = `
    <h1>Script Studio</h1>
    <div class="grid g2" style="align-items:start">
      <div class="card"><h2>Scripts</h2>
        ${list.length ? `<table><tbody>${list.map((s) => `<tr><td><a href="#/scripts/${s.id}">${esc(s.title)}</a></td><td><span class="pill ${s.status === "approved" ? "done" : ""}">${STATUS[s.status]}</span></td><td class="faint">v${s.versions} · ${ago(s.updatedAt)}</td></tr>`).join("")}</tbody></table>` : empty("No scripts yet. Use <b>Develop Script</b> on a topic in Opportunities or an item in the Planner.")}
        ${ctx.canEdit ? `<form class="row" id="newScript" style="margin-top:10px"><input name="title" placeholder="Or start a blank script: title" required style="flex:1"><button class="btn">Create</button></form>` : ""}
      </div>
      <div class="card"><h2>Study a reference script</h2>
        <p class="muted">Paste a script, upload a transcript (.txt, .srt, .vtt) or add a video link. The analysis covers structure, pacing, hook, transitions and payoff, so new scripts can use the principles without copying wording. Transcripts of other channels' videos can't be downloaded through YouTube's API; paste them instead.</p>
        <form id="study">
          <label>Title<input name="title" placeholder="e.g. Storytelling channel — exam failure video"></label>
          <label>Video link (optional)<input name="url" placeholder="https://www.youtube.com/watch?v=…"></label>
          <label>Script or transcript<textarea name="text" placeholder="Paste here"></textarea></label>
          <label>…or upload a file<input type="file" name="file" accept=".txt,.srt,.vtt,.md,text/plain"></label>
          <button class="btn primary" ${ctx.canEdit ? "" : "disabled"}>Save and analyse</button>
        </form><div id="studyOut"></div></div>
    </div>`;
  const ns = el.querySelector("#newScript");
  if (ns) ns.onsubmit = async (e) => { e.preventDefault(); const s = await post(`${ctx.base}/scripts`, { title: ns.title.value }); ctx.nav(`scripts/${s.id}`); };
  const study = el.querySelector("#study");
  study.onsubmit = async (e) => {
    e.preventDefault();
    const out = el.querySelector("#studyOut");
    const file = study.file.files[0];
    let text = study.text.value;
    if (file) text = (await file.text()).replace(/^\d+\s*$|^[\d:,.]+\s*-->.*$|^WEBVTT.*$/gm, "").replace(/\n{2,}/g, "\n").trim();
    try {
      const ref = await post(`${ctx.base}/references`, { kind: "transcript", title: study.title.value || file?.name || "Reference script", url: study.url.value, text, categories: ["script-structures"] });
      if (!text && ref.videoId) {
        out.innerHTML = loading("Checking whether a transcript can be fetched…");
        try { await post(`${ctx.base}/references/${ref.id}/transcript`); }
        catch (err) { out.innerHTML = `${errorBox(err)}<p>The link is saved in the <a href="#/library?open=${ref.id}">library</a>; paste its transcript there to analyse it.</p>`; return; }
      } else if (!text) { out.innerHTML = '<div class="notice">Paste text, upload a file or add a link.</div>'; return; }
      out.innerHTML = loading("Analysing structure, pacing and hook…");
      const r = await post(`${ctx.base}/references/${ref.id}/analyze`);
      out.innerHTML = analysisHtml(r.analysis) + `<p><a href="#/library?open=${ref.id}">Open in the library</a></p>`;
    } catch (err) { out.innerHTML = errorBox(err) + '<p class="faint">The text is saved in the Reference Library either way.</p>'; }
  };
}

export function analysisHtml(a) {
  if (!a) return "";
  return `<div class="card tight"><h3>Analysis</h3><dl class="kv">
    <dt>Hook</dt><dd>${esc(a.hook)}</dd>
    <dt>Structure</dt><dd><ol style="margin:0;padding-left:18px">${a.structure.map((s) => `<li><b>${esc(s.part)}</b> (${esc(s.approxShare)}): ${esc(s.whatItDoes)}</li>`).join("")}</ol></dd>
    <dt>Pacing</dt><dd>${esc(a.pacing)}</dd><dt>Transitions</dt><dd>${esc(a.transitions)}</dd><dt>Payoff</dt><dd>${esc(a.payoff)}</dd>
    <dt>Principles to reuse</dt><dd><ul style="margin:0;padding-left:18px">${a.principles.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></dd>
    <dt>Don't copy</dt><dd><ul style="margin:0;padding-left:18px">${a.avoidCopying.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></dd></dl></div>`;
}

function outlineToText(o) {
  return (o?.sections || []).map((s) => `## ${s.heading}${s.purpose ? ` | ${s.purpose}` : ""}\n${(s.beats || []).map((b) => `- ${b}`).join("\n")}`).join("\n\n");
}
function textToOutline(text, payoff) {
  const sections = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) { const [h, p] = line.slice(3).split(" | "); sections.push({ heading: h.trim(), purpose: (p || "").trim(), beats: [] }); }
    else if (line.trim() && sections.length) sections[sections.length - 1].beats.push(line.replace(/^\s*-\s*/, "").trim());
  }
  return { sections, payoff: payoff || "" };
}

async function editor(el, ctx, id) {
  let s = await get(`${ctx.base}/scripts/${id}`);
  let tab = ctx.query.tab || "brief";
  const ai = ctx.ws.status.ai;
  const draw = () => {
    const cur = s.versions[s.versions.length - 1];
    const claims = cur.claims || [];
    const openClaims = claims.filter((c) => s.claimStatus?.[c]?.status !== "verified");
    el.innerHTML = `
      <p><a href="#/scripts">← Scripts</a></p>
      <div class="row between"><h1>${esc(s.title)}</h1>
        <span class="row">${ctx.canEdit ? `<select id="status" style="width:auto" aria-label="Approval status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${s.status === k ? "selected" : ""}>${l}</option>`).join("")}</select>` : `<span class="pill">${STATUS[s.status]}</span>`}
        ${s.itemId ? `<a class="btn small" href="#/planner?open=${s.itemId}">Planner item</a>` : ""}</span></div>
      <p class="muted">Language: ${esc(s.language || "")} (change the default in Settings) · version ${cur.v} · ${date(cur.at, true)} · ${source(ai.state === "live" ? "live" : "unavailable")} AI</p>
      ${s.lastNotice ? `<div class="notice">Template used: ${esc(s.lastNotice)}</div>` : ""}
      ${openClaims.length ? `<div class="notice"><b>${openClaims.length} claim(s) to verify before recording.</b> See the Claims tab.</div>` : ""}
      <div class="tabs">${["brief", "hooks", "outline", "script", "claims", "versions", "comments"].map((t) => `<button data-tab="${t}" class="${tab === t ? "on" : ""}">${{ brief: "Research brief", hooks: "Hooks", outline: "Outline", script: "Full script", claims: `Claims (${openClaims.length})`, versions: `Versions (${s.versions.length})`, comments: `Comments (${s.comments.length})` }[t]}</button>`).join("")}</div>
      <div id="tab">${tabHtml(tab, s, cur, ctx)}</div>
      ${s.informedBy?.length ? `<div class="card tight">${informedBy(s.informedBy)}</div>` : ""}`;
  };
  draw();

  const save = async (body, note) => { s = await post(`${ctx.base}/scripts/${s.id}/versions`, { ...body, note }); draw(); toast("Saved as a new version."); };
  const generate = async (what, btn, extra = {}) => {
    try { s = await busy(btn, () => post(`${ctx.base}/scripts/${s.id}/generate`, { what, ...extra }), "Generating…"); draw(); }
    catch (err) { toast(err.message, true); }
  };

  el.onchange = async (e) => {
    if (e.target.id === "status") { s = await patch(`${ctx.base}/scripts/${s.id}`, { status: e.target.value }); toast(`Status: ${STATUS[s.status]}`); }
    if (e.target.name === "chosenHook") await save({ chosenHook: e.target.value }, "Chose hook");
  };
  el.onclick = async (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) { tab = t.dataset.tab; return draw(); }
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const cur = s.versions[s.versions.length - 1];
    try {
      switch (b.dataset.act) {
        case "gen": return generate(b.dataset.what, b, { useWeb: true });
        case "hookStudio": return hookStudio(ctx, { topic: { id: s.topicId, title: s.title }, existingHook: cur.chosenHook || "" });
        case "saveOutline": return save({ outline: textToOutline(el.querySelector("#outlineText").value, cur.outline?.payoff) }, "Edited outline");
        case "saveScript": return save({ sections: [...el.querySelectorAll("[data-sec]")].map((x) => ({ heading: x.querySelector("input").value, text: x.querySelector("textarea").value })) }, "Edited script");
        case "addSection": return save({ sections: [...cur.sections, { heading: "New section", text: "" }] }, "Added section");
        case "revise": {
          const instruction = prompt("How should this section change? (e.g. shorter, add an example, more Hinglish)");
          if (!instruction) return;
          s = await busy(b, () => post(`${ctx.base}/scripts/${s.id}/revise`, { sectionIndex: Number(b.dataset.i), instruction }), "Revising…");
          return draw();
        }
        case "restore": s = await post(`${ctx.base}/scripts/${s.id}/restore`, { v: Number(b.dataset.v) }); toast(`Restored version ${b.dataset.v} as a new version.`); return draw();
        case "viewVersion": {
          const v = s.versions.find((x) => x.v === Number(b.dataset.v));
          el.querySelector(`#ver-${v.v}`).innerHTML = `<pre class="script">${esc(v.sections.map((x) => `## ${x.heading}\n${x.text}`).join("\n\n") || "(no script text in this version)")}</pre>`;
          return;
        }
        case "comment": {
          const text = el.querySelector("#commentText").value;
          s = await post(`${ctx.base}/scripts/${s.id}/comments`, { text, section: el.querySelector("#commentSection").value });
          return draw();
        }
        case "verify": {
          const claim = b.dataset.claim;
          const src = b.dataset.state === "verified" ? "" : prompt("Source that confirms it (link or document):", "");
          if (src === null) return;
          s = await patch(`${ctx.base}/scripts/${s.id}`, { claimStatus: { claim, status: b.dataset.state === "verified" ? "open" : "verified", source: src } });
          return draw();
        }
      }
    } catch (err) { toast(err.message, true); }
  };
}

function genBtn(what, label, ctx) {
  return ctx.canEdit ? `<button class="btn primary" data-act="gen" data-what="${what}">${label}</button>` : "";
}

function tabHtml(tab, s, cur, ctx) {
  if (tab === "brief") {
    const b = cur.brief;
    return `<div class="card"><div class="row between"><h2>Research brief</h2>${genBtn("brief", b ? "Regenerate brief" : "Research and write brief", ctx)}</div>
      <p class="faint">Uses web search for current, sourced facts (needs AI). Facts not from an official or primary source are marked for verification.</p>
      ${b ? `<p>${esc(b.summary)}</p><h3>Key facts</h3><table><tbody>${b.keyFacts.map((f) => `<tr><td>${esc(f.claim)}</td><td>${f.source ? `<a href="${esc(f.source)}" target="_blank" rel="noopener noreferrer">source</a>` : '<span class="faint">no source</span>'}</td><td>${f.needsVerification ? '<span class="pill warn">verify</span>' : '<span class="pill done">sourced</span>'}</td></tr>`).join("")}</tbody></table>
        <h3>Audience questions</h3><ul>${b.audienceQuestions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
        <h3>Angle</h3><p>${esc(b.angle)}</p><h3>Open questions</h3><ul>${b.openQuestions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
        ${b.sources?.length ? `<h3>Sources</h3><ol>${b.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title || x.url)}</a></li>`).join("")}</ol>` : ""}` : empty("No brief yet.")}</div>`;
  }
  if (tab === "hooks") {
    return `<div class="card"><div class="row between"><h2>Hook variants</h2><span class="row">${genBtn("hooks", cur.hooks?.length ? "New hook set" : "Generate hooks", ctx)}${ctx.canEdit ? '<button class="btn" data-act="hookStudio">Improve a hook…</button>' : ""}</span></div>
      <p class="faint">Relatable situation, contradiction, direct question, evidence-led surprise, short story and strong claim — in your speaking style, guided by approved examples.</p>
      ${cur.hooks?.length ? cur.hooks.map((h) => `<label class="check" style="display:flex;align-items:flex-start"><input type="radio" name="chosenHook" value="${esc(h.text)}" ${cur.chosenHook === h.text ? "checked" : ""} ${ctx.canEdit ? "" : "disabled"}><span>Use this hook</span></label>${hooksList([h])}`).join("") : empty("No hooks yet.")}
      ${cur.chosenHook ? `<div class="notice good"><b>Chosen hook:</b> ${esc(cur.chosenHook)}</div>` : ""}</div>`;
  }
  if (tab === "outline") {
    return `<div class="card"><div class="row between"><h2>Outline</h2>${genBtn("outline", cur.outline ? "Regenerate outline" : "Generate outline", ctx)}</div>
      ${cur.outline ? `<ol>${cur.outline.sections.map((x) => `<li><b>${esc(x.heading)}</b>${x.purpose ? ` — ${esc(x.purpose)}` : ""}<ul>${x.beats.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></li>`).join("")}</ol>${cur.outline.payoff ? `<p><b>Payoff:</b> ${esc(cur.outline.payoff)}</p>` : ""}` : empty("No outline yet.")}
      ${ctx.canEdit ? `<details><summary>Edit outline</summary><p class="faint">One section per <code>## Heading | purpose</code> line, beats as <code>- </code> lines.</p><textarea id="outlineText" style="min-height:240px">${esc(outlineToText(cur.outline))}</textarea><button class="btn" data-act="saveOutline">Save outline</button></details>` : ""}</div>`;
  }
  if (tab === "script") {
    return `<div class="card"><div class="row between"><h2>Full script</h2>${genBtn("script", cur.sections.length ? "Regenerate full script" : "Write full script", ctx)}</div>
      <p class="faint">Written from the outline, brief and chosen hook. Facts that need checking are marked <code>[VERIFY: …]</code>.</p>
      ${cur.sections.length ? cur.sections.map((x, i) => `<div class="card tight" data-sec="${i}"><div class="row between"><input value="${esc(x.heading)}" aria-label="Section heading" style="font-weight:600;max-width:420px" ${ctx.canEdit ? "" : "disabled"}>${ctx.canEdit ? `<button class="btn small" data-act="revise" data-i="${i}">Revise section with AI</button>` : ""}</div><textarea style="min-height:160px;margin-top:6px" ${ctx.canEdit ? "" : "disabled"}>${esc(x.text)}</textarea></div>`).join("") : empty("No script text yet. Generate it, or add a section and write.")}
      ${ctx.canEdit ? '<div class="row"><button class="btn primary" data-act="saveScript">Save version</button><button class="btn" data-act="addSection">Add section</button></div>' : ""}</div>`;
  }
  if (tab === "claims") {
    const claims = cur.claims || [];
    return `<div class="card"><h2>Claims to verify</h2>${claims.length ? `<table><tbody>${claims.map((c) => { const st = s.claimStatus?.[c]; return `<tr><td>${esc(c)}</td><td>${st?.status === "verified" ? `<span class="pill done">verified</span> ${st.source ? linkify(st.source) : ""}` : '<span class="pill warn">open</span>'}</td><td>${ctx.canEdit ? `<button class="btn small" data-act="verify" data-claim="${esc(c)}" data-state="${st?.status || "open"}">${st?.status === "verified" ? "Reopen" : "Mark verified"}</button>` : ""}</td></tr>`; }).join("")}</tbody></table>` : empty("No flagged claims in the current version.")}</div>`;
  }
  if (tab === "versions") {
    return `<div class="card"><h2>Version history</h2>${[...s.versions].reverse().map((v) => `<div class="card tight"><div class="row between"><span><b>v${v.v}</b> · ${date(v.at, true)} · ${esc(v.note || "")}</span><span class="row"><button class="btn small" data-act="viewVersion" data-v="${v.v}">View</button>${ctx.canEdit && v.v !== s.versions.length ? `<button class="btn small" data-act="restore" data-v="${v.v}">Restore</button>` : ""}</span></div><div id="ver-${v.v}"></div></div>`).join("")}</div>`;
  }
  return `<div class="card"><h2>Comments</h2>
    ${s.comments.length ? s.comments.map((c) => `<div class="card tight"><b>${esc(c.byName || "")}</b> <span class="faint">${date(c.at, true)} · v${c.v}${c.section ? " · " + esc(c.section) : ""}</span><p style="white-space:pre-wrap;margin:.3rem 0 0">${esc(c.text)}</p></div>`).join("") : empty("No comments yet.")}
    <select id="commentSection" style="margin-top:8px"><option value="">Whole script</option>${cur.sections.map((x) => `<option>${esc(x.heading)}</option>`).join("")}</select>
    <textarea id="commentText" placeholder="Add a comment" style="margin-top:6px"></textarea><button class="btn" data-act="comment" style="margin-top:6px">Comment</button></div>`;
}
