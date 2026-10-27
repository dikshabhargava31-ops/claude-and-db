// Settings: workspace profile, connections (with data-source status), AI budget approval,
// research schedule, team access and account.
import { get, post, patch, del } from "../api.js";
import { esc, source, toast, busy, formData, confirmBox, ago } from "../ui.js";

const TABS = { profile: "Workspace", connections: "Connections", ai: "AI & budget", schedule: "Research schedule", team: "Team & access", account: "My account" };

export default async function settings(el, ctx) {
  const tab = TABS[ctx.query.tab] ? ctx.query.tab : ctx.query.connect ? "connections" : "profile";
  el.innerHTML = `<h1>Settings</h1>
    ${ctx.query.connect === "ok" ? '<div class="notice good">YouTube channel connected.</div>' : ctx.query.connect === "denied" ? '<div class="notice">The Google permission request was cancelled. Nothing was connected.</div>' : ctx.query.connect === "error" ? `<div class="notice error">${esc(ctx.query.message || "Connection failed.")}</div>` : ""}
    <div class="tabs">${Object.entries(TABS).map(([k, l]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</div><div id="body"></div>`;
  el.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => ctx.nav(`settings?tab=${b.dataset.t}`)));
  const body = el.querySelector("#body");
  await ({ profile, connections, ai, schedule, team, account })[tab](body, ctx);
}

function profile(el, ctx) {
  const p = ctx.ws.profile || {};
  const dis = ctx.canEdit ? "" : "disabled";
  el.innerHTML = `<form class="card" id="pf">
    <p class="muted">These settings, your approved examples and your feedback personalise every recommendation in this workspace. Other workspaces keep their own.</p>
    <label>Workspace name<input name="name" value="${esc(ctx.ws.name)}" ${dis}></label>
    <div class="grid g2"><label>YouTube channel link<input name="youtubeUrl" value="${esc(p.youtubeUrl)}" ${dis}></label><label>Instagram account links (one per line)<textarea name="instagramUrls" ${dis}>${esc((p.instagramUrls || []).join("\n"))}</textarea></label></div>
    <label>Niche<input name="niche" value="${esc(p.niche)}" ${dis}></label>
    <label>Target audience<textarea name="audience" ${dis}>${esc(p.audience)}</textarea></label>
    <label>Content pillars (one per line — research runs search these)<textarea name="pillars" ${dis}>${esc((p.pillars || []).join("\n"))}</textarea></label>
    <div class="grid g2"><label>Script language (default)<input name="scriptLanguage" value="${esc(p.scriptLanguage)}" ${dis}></label><label>Titles and thumbnail text language<input name="titleLanguage" value="${esc(p.titleLanguage)}" ${dis}></label></div>
    <label>Tone and speaking style<textarea name="tone" ${dis}>${esc(p.tone)}</textarea></label>
    <div class="grid g2"><label>Preferred formats (one per line)<textarea name="formats" ${dis}>${esc((p.formats || []).join("\n"))}</textarea></label><label>Typical lengths<textarea name="lengths" ${dis}>${esc(p.lengths)}</textarea></label></div>
    <label>Other notes for the assistant<textarea name="notes" ${dis}>${esc(p.notes)}</textarea></label>
    <p class="faint">Approved examples of scripts, hooks, titles and thumbnails live in the <a href="#/library?approved=1">Reference Library</a> (mark any reference "Approve as style example"). Rules you approve live under <a href="#/library?tab=preferences">Style preferences</a>; rejected ideas are kept in <a href="#/opportunities">Opportunities</a> → Rejected.</p>
    ${ctx.canEdit ? '<button class="btn primary">Save workspace</button>' : ""}</form>`;
  const form = el.querySelector("#pf");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(form);
    const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
    try {
      await busy(form.querySelector(".primary"), () => patch(ctx.base, { name: d.name, profile: { ...d, instagramUrls: lines(d.instagramUrls), pillars: lines(d.pillars), formats: lines(d.formats) } }));
      toast("Workspace saved.");
      ctx.refresh();
    } catch (err) { toast(err.message, true); }
  };
}

async function connections(el, ctx) {
  const st = ctx.ws.status;
  const yt = st.youtubeAnalytics;
  let accounts = {};
  try { accounts = (await get(`${ctx.base}/instagram/planner`)).accounts; } catch { /* shown in status */ }
  const rows = ["youtubeData", "youtubeAnalytics", "impressions", "transcripts", "ai", "webSearch", "instagramPlanner", "instagramInsights"];
  el.innerHTML = `
    <div class="card"><h2>Connection status</h2><p class="muted">Every feature shows whether it uses live connected data, imported data, demo data, or is unavailable. Keys and tokens are kept on the server and never sent to the browser.</p>
      <div class="table-wrap"><table><tbody>${rows.map((k) => `<tr><td><b>${esc(st[k].label)}</b><div class="faint">${esc(st[k].detail)}</div></td><td>${source(st[k].state)}</td><td class="faint" style="font-size:.85rem">${st[k].state === "live" ? "" : "Needs: " + esc(st[k].needs)}</td></tr>`).join("")}</tbody></table></div>
      ${st.lastRun ? `<p class="faint">Last research run: ${ago(st.lastRun.at)} (${esc(st.lastRun.status)}).</p>` : ""}</div>
    <div class="card"><h2>YouTube channel (authorised analytics)</h2>
      <p>Connecting asks Google for <b>read-only</b> access: <code>youtube.readonly</code> and <code>yt-analytics.readonly</code>. It unlocks retention and drop-offs, traffic sources, watch time, average percentage viewed, subscribers gained and first-7/28-day views for your own videos. Free; the YouTube Analytics API has its own generous quota.</p>
      ${!ctx.isOwner ? '<p class="faint">Only the workspace owner can connect accounts or add permissions.</p>' : yt.state === "unavailable" ? `<div class="notice">${esc(yt.detail)} See studio/README.md → “YouTube Analytics”.</div>` : `
        <div class="row">${yt.state === "live" ? `<span class="pill live">Connected: ${esc(yt.channel || "")}</span>` : ""}
        <a class="btn ${yt.state === "live" ? "" : "primary"}" href="/oauth/google/start/${ctx.ws.id}">${yt.state === "live" ? "Reconnect" : "Connect my YouTube channel"}</a>
        ${yt.state === "live" ? '<button class="btn" id="reach">Start impressions/CTR reports</button><button class="btn danger" id="disc">Disconnect</button>' : ""}</div>
        <p class="faint" style="margin-top:8px"><b>Impressions and CTR</b> come from YouTube's Reporting API “reach” reports. Starting them creates one daily reporting job on your channel (a reporting setting, not a change to your videos); YouTube produces reports from that day forward.</p>
        <p class="faint"><b>Caption download</b> for your own videos needs Google's <code>youtube.force-ssl</code> scope, which Google describes as managing your YouTube account. The Studio only reads captions with it, but grant it only if you want that: <a href="/oauth/google/start/${ctx.ws.id}?captions=1">Grant caption permission</a>.</p>`}
    </div>
    <div class="card"><h2>Instagram</h2>
      <p>Scheduling reuses your existing Instagram Planner and GitHub Actions scheduler (<code>instagram/</code> in the repository): this app reads its accounts, queue and published posts, and — only after the owner approves a post — adds one row to <code>instagram/posts.csv</code> on <code>main</code>. It doesn't publish anything itself.</p>
      ${Object.keys(accounts).length ? `<label>Instagram account for this workspace<select id="igAcc" ${ctx.isOwner ? "" : "disabled"}><option value="">—</option>${Object.entries(accounts).map(([k, u]) => `<option value="${esc(k)}" ${ctx.ws.settings?.igAccount === k ? "selected" : ""}>@${esc(u)} (${esc(k)})</option>`).join("")}</select></label>` : ""}
      <p class="faint">To send approved posts: set <code>GITHUB_TOKEN</code> (fine-grained, this repository only, Contents: read and write, Actions: read and write). For per-post insights: set <code>IG_INSIGHTS_ACCOUNTS</code> with a token that has <code>instagram_business_manage_insights</code> — the scheduler's tokens are GitHub secrets and stay there.</p></div>
    <div class="card"><h2>Costs and quotas</h2><ul>
      <li><b>YouTube Data API:</b> free, 10,000 units/day. Search = 100 units, channel/video lookups = 1. A research run with 10 saved channels and 3 pillars uses about 350–400 units.</li>
      <li><b>YouTube Analytics and Reporting APIs:</b> free; read-only OAuth.</li>
      <li><b>Claude API:</b> paid per use (see AI & budget). Blocked until the owner approves a monthly budget.</li>
      <li><b>Instagram Graph API and GitHub:</b> free within their rate limits.</li></ul></div>`;
  const reach = el.querySelector("#reach");
  if (reach) reach.onclick = async () => {
    if (!(await confirmBox("Start impressions reports?", "This creates a daily “channel_reach_basic_a1” reporting job on your YouTube channel. It doesn't change your videos. Continue?", "Start reports"))) return;
    try { const r = await busy(reach, () => post(`${ctx.base}/youtube/reach-job`)); toast(r.note); } catch (err) { toast(err.message, true); }
  };
  const disc = el.querySelector("#disc");
  if (disc) disc.onclick = async () => { if (await confirmBox("Disconnect YouTube?", "Stored analytics stay; new authorised data stops.", "Disconnect")) { await post(`${ctx.base}/youtube/disconnect`); ctx.refresh(); } };
  const igAcc = el.querySelector("#igAcc");
  if (igAcc) igAcc.onchange = async () => { await patch(ctx.base, { settings: { igAccount: igAcc.value } }); toast("Saved."); };
}

function ai(el, ctx) {
  const st = ctx.ws.status.ai;
  const budget = ctx.ws.settings?.aiBudgetUsd || 0;
  el.innerHTML = `<div class="card"><h2>AI & budget</h2><p>${source(st.state)} ${esc(st.detail)}</p>
    <p>AI features (topic recommendations, web research, hooks, briefs, outlines, scripts, analysis and the assistant) call the Claude API, which is billed per use to your Anthropic account. The model is set by <code>CLAUDE_MODEL</code> (default Claude Opus 5.5: $4 per million input tokens, $20 per million output tokens; web searches $10 per 1,000).</p>
    <p class="muted">Typical costs: a hook set ≈ $0.02–0.05; a full script ≈ $0.10–0.30; a research run with web research ≈ $0.30–1.00; an assistant answer ≈ $0.02–0.15. These are estimates; the app tracks its own estimate below and stops when the approved budget is reached.</p>
    <form id="bf" class="row"><label style="margin:0">Approved monthly AI budget (USD)<input type="number" name="aiBudgetUsd" min="0" step="1" value="${budget}" ${ctx.isOwner ? "" : "disabled"} style="width:160px"></label>${ctx.isOwner ? '<button class="btn primary">Approve budget</button>' : '<span class="faint">Only the owner can approve spending.</span>'}</form>
    <p class="faint">Set 0 to switch AI off. Without AI, hooks and outlines fall back to clearly labelled fill-in templates and no topics are generated.</p></div>`;
  const f = el.querySelector("#bf");
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await patch(ctx.base, { settings: { aiBudgetUsd: Number(f.aiBudgetUsd.value) } }); toast("Budget saved."); ctx.refresh(); } catch (err) { toast(err.message, true); }
  };
}

function schedule(el, ctx) {
  const s = ctx.ws.settings?.schedule || { frequency: "off", time: "07:30", weekday: 1 };
  const dis = ctx.isOwner ? "" : "disabled";
  el.innerHTML = `<form class="card" id="sf"><h2>Scheduled research runs</h2>
    <p>Runs the full research-to-shortlist workflow automatically and puts the results in the review queue. It only creates internal drafts and recommendations — it never publishes, schedules posts, changes live content or adds permissions. Runs happen while the server is running and count against the AI budget and YouTube quota.</p>
    <div class="grid g3"><label>Frequency<select name="frequency" ${dis}>${["off", "daily", "weekly"].map((f) => `<option ${s.frequency === f ? "selected" : ""}>${f}</option>`).join("")}</select></label>
    <label>Time (India)<input type="time" name="time" value="${esc(s.time)}" ${dis}></label>
    <label>Day (weekly)<select name="weekday" ${dis}>${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => `<option value="${i}" ${Number(s.weekday) === i ? "selected" : ""}>${d}</option>`).join("")}</select></label></div>
    ${ctx.isOwner ? '<button class="btn primary">Save schedule</button>' : '<p class="faint">Only the owner can change the schedule.</p>'}
    ${ctx.ws.settings?.lastScheduledRunAt ? `<p class="faint">Last scheduled run ${ago(ctx.ws.settings.lastScheduledRunAt)}.</p>` : ""}</form>`;
  const f = el.querySelector("#sf");
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await patch(ctx.base, { settings: { schedule: formData(f) } }); toast("Schedule saved."); ctx.refresh(); } catch (err) { toast(err.message, true); }
  };
}

async function team(el, ctx) {
  const users = ctx.user.admin ? await get("/api/users").catch(() => []) : [];
  el.innerHTML = `<div class="card"><h2>Members of this workspace</h2><p class="muted">Owner: everything, including connections, budgets, schedules and approvals. Editor: research, write and plan. Viewer: read and comment.</p>
    <table><tbody>${ctx.ws.members.map((m) => `<tr><td>${esc(m.name)} <span class="faint">${esc(m.email)}</span></td><td>${ctx.isOwner && m.id !== ctx.user.id ? `<select data-role="${m.id}" data-email="${esc(m.email)}" style="width:auto">${["owner", "editor", "viewer"].map((r) => `<option ${r === m.role ? "selected" : ""}>${r}</option>`).join("")}</select>` : esc(m.role)}</td><td>${ctx.isOwner && m.id !== ctx.user.id ? `<button class="btn small danger" data-remove="${m.id}">Remove</button>` : ""}</td></tr>`).join("")}</tbody></table>
    ${ctx.isOwner ? `<form class="row" id="addMember" style="margin-top:10px"><input name="email" type="email" placeholder="Email of an existing account" required style="flex:1"><select name="role" style="width:auto"><option>editor</option><option>viewer</option><option>owner</option></select><button class="btn">Add to workspace</button></form>` : ""}</div>
    ${ctx.user.admin ? `<div class="card"><h2>Accounts (admin)</h2><p class="muted">Only accounts created here can sign in. Share the temporary password privately; they can change it under My account.</p>
      <table><tbody>${users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.admin ? "admin" : ""}</td></tr>`).join("")}</tbody></table>
      <form class="grid g4" id="newUser" style="margin-top:10px"><input name="name" placeholder="Name" required><input name="email" type="email" placeholder="Email" required><input name="password" placeholder="Temporary password (10+ chars)" required minlength="10"><button class="btn">Create account</button></form></div>` : ""}`;
  el.onchange = async (e) => { if (e.target.dataset.role) { await post(`${ctx.base}/members`, { email: e.target.dataset.email, role: e.target.value }); toast("Role updated."); ctx.reloadWs(); } };
  el.onclick = async (e) => { const b = e.target.closest("[data-remove]"); if (b && await confirmBox("Remove member?", "They lose access to this workspace.", "Remove")) { await del(`${ctx.base}/members/${b.dataset.remove}`); ctx.refresh(); } };
  const am = el.querySelector("#addMember");
  if (am) am.onsubmit = async (e) => { e.preventDefault(); try { await post(`${ctx.base}/members`, formData(am)); toast("Member added."); ctx.refresh(); } catch (err) { toast(err.message, true); } };
  const nu = el.querySelector("#newUser");
  if (nu) nu.onsubmit = async (e) => { e.preventDefault(); try { await post("/api/users", formData(nu)); toast("Account created. Now add it to a workspace."); ctx.refresh(); } catch (err) { toast(err.message, true); } };
}

function account(el, ctx) {
  el.innerHTML = `<form class="card" id="pw" style="max-width:480px"><h2>Change password</h2>
    <label>Current password<input type="password" name="current" required autocomplete="current-password"></label>
    <label>New password (10+ characters)<input type="password" name="next" required minlength="10" autocomplete="new-password"></label>
    <button class="btn primary">Change password</button></form>`;
  const f = el.querySelector("#pw");
  f.onsubmit = async (e) => { e.preventDefault(); try { await post("/api/me/password", formData(f)); toast("Password changed."); f.reset(); } catch (err) { toast(err.message, true); } };
}
