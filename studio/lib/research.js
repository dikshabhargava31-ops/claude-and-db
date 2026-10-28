// "Run my content research": the research-to-shortlist workflow. Each step records whether it
// was done, skipped, blocked (missing connection or approval) or failed, with the reason, and
// everything it finds lands in the review queue. Nothing is published or scheduled externally.
import * as yt from "./youtube.js";
import * as google from "./google.js";
import * as ai from "./ai.js";
import * as gen from "./generate.js";
import { describeScore } from "./outliers.js";
import { waitUntil } from "@vercel/functions";
import { refreshChannel, upsertVideo, checkOverlap, extractQuestions, addReview, rescoreChannel } from "./domain.js";

// A run counts as in progress while its row says so; one stuck for 15 minutes (for example a
// server instance that was stopped) no longer blocks new runs.
export function isRunning(store, ws) {
  const cutoff = new Date(Date.now() - 15 * 60e3).toISOString();
  return store.inWs("runs", ws, (r) => r.status === "running" && r.startedAt > cutoff).length > 0;
}

// Starts a run in the background. `done` resolves when it finishes; on Vercel, waitUntil keeps the
// function alive after the response so the run can complete.
export function startRun(store, ws, { trigger = "manual", userId = null } = {}) {
  if (isRunning(store, ws)) return null;
  const run = store.insert("runs", { ws, trigger, startedBy: userId, status: "running", startedAt: new Date().toISOString(), steps: [], outputs: { topicIds: [], outlierVideoIds: [], reviewIds: [] } });
  const done = execute(store, ws, run.id)
    .catch((e) => { store.update("runs", run.id, { status: "failed", error: e.message, finishedAt: new Date().toISOString() }); })
    .then(() => store.persist())
    .catch((e) => console.error("Saving the research run failed:", e.message));
  waitUntil(done);
  return { ...run, done };
}

async function execute(store, ws, runId) {
  const run = () => store.get("runs", runId);
  const w = store.get("workspaces", ws);
  const p = w.profile || {};
  const evidence = [];

  const step = async (key, label, fn) => {
    const s = { key, label, status: "running", startedAt: new Date().toISOString() };
    store.update("runs", runId, { steps: [...run().steps, s] });
    const set = (patch) => store.update("runs", runId, { steps: run().steps.map((x) => (x.key === key ? { ...x, ...patch, finishedAt: new Date().toISOString() } : x)) });
    try {
      const r = await fn();
      if (r?.status) set(r); else set({ status: "done", detail: r?.detail || r || "" });
    } catch (e) {
      const blocked = e.integration && [503, 402, 401, 403, 429].includes(e.status);
      set({ status: blocked ? "blocked" : "failed", detail: e.message, integration: e.integration || null });
    }
  };
  const addOut = (k, ids) => store.update("runs", runId, { outputs: { ...run().outputs, [k]: [...run().outputs[k], ...ids] } });
  const review = (item) => { const r = addReview(store, ws, { runId, ...item }); addOut("reviewIds", [r.id]); return r; };

  await step("profile", "Check workspace setup", async () => {
    const missing = [["niche", p.niche], ["target audience", p.audience], ["content pillars", p.pillars?.length]].filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
      review({ type: "question", title: "Workspace setup is incomplete", why: `Recommendations depend on your ${missing.join(", ")}.`, needs: `Fill in ${missing.join(", ")} in Settings → Workspace.` });
      return { status: "done", detail: `Missing: ${missing.join(", ")}. Results will be less personal until these are filled in.` };
    }
    return "Profile complete.";
  });

  const own = store.inWs("channels", ws, (c) => c.list === "own");
  const tracked = store.inWs("channels", ws, (c) => c.list === "competitor" || c.list === "inspiration").slice(0, 25);

  await step("own", "Study my channel", async () => {
    if (!own.length) return { status: "skipped", detail: "No own channel added. Add it in Channels." };
    if (!yt.youtubeConfigured()) {
      own.forEach((c) => rescoreChannel(store, ws, c.id));
      return { status: "blocked", integration: "youtubeData", detail: "YouTube Data API not connected; used imported data only." };
    }
    let n = 0;
    for (const c of own) n += (await refreshChannel(store, ws, c)).length;
    let note = "";
    if (google.connection(store, ws)) {
      const vids = store.inWs("videos", ws, (v) => own.some((c) => c.id === v.channelRowId)).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "")).slice(0, 30);
      const totals = await google.videoTotals(store, ws, vids.map((v) => v.videoId));
      for (const v of vids) if (totals[v.videoId]) upsertVideo(store, ws, { videoId: v.videoId, analytics: { ...totals[v.videoId], analyticsAt: new Date().toISOString() } }, { source: "live" });
      note = " Authorised analytics refreshed for the latest 30.";
    }
    return `Refreshed ${n} of my videos.${note}`;
  });

  await step("tracked", "Monitor competitors and inspiration channels", async () => {
    if (!tracked.length) return { status: "skipped", detail: "No competitor or inspiration channels saved yet." };
    if (!yt.youtubeConfigured()) {
      tracked.forEach((c) => rescoreChannel(store, ws, c.id));
      return { status: "blocked", integration: "youtubeData", detail: "YouTube Data API not connected; outliers use previously stored data only." };
    }
    const errors = [];
    for (const c of tracked) {
      try { await refreshChannel(store, ws, c, { max: 30 }); }
      catch (e) { errors.push(`${c.title}: ${e.message}`); store.update("channels", c.id, { lastError: e.message }); if (e.status === 429) break; }
    }
    return errors.length ? { status: errors.length === tracked.length ? "failed" : "done", detail: `Refreshed ${tracked.length - errors.length}/${tracked.length}. ${errors.join("; ")}` } : `Refreshed ${tracked.length} channels.`;
  });

  await step("outliers", "Find outlier videos", async () => {
    const since = Date.now() - 90 * 864e5;
    const reviewed = new Set(store.inWs("reviews", ws, (r) => r.type === "outlier").map((r) => r.videoId));
    const vids = store.inWs("videos", ws, (v) => tracked.some((c) => c.id === v.channelRowId) && v.score?.score >= 2 && new Date(v.publishedAt) > since)
      .sort((a, b) => b.score.score - a.score.score);
    for (const v of vids.slice(0, 12)) {
      evidence.push(`OUTLIER video ${v.videoId} "${v.title}" by ${v.channelTitle} (${tracked.find((c) => c.id === v.channelRowId)?.list}), ${v.format}, published ${v.publishedAt?.slice(0, 10)}, ${v.views} views: ${describeScore(v.score)}`);
      if (!reviewed.has(v.videoId)) {
        review({ type: "outlier", videoId: v.videoId, title: v.title, why: `${v.channelTitle}: ${describeScore(v.score)}`, prepared: "Saved for review. You can save it as a reference or develop an original angle from it." });
      }
    }
    addOut("outlierVideoIds", vids.slice(0, 12).map((v) => v.id));
    return vids.length ? `${vids.length} outliers in the last 90 days.` : "No outliers (2×+) in the last 90 days among tracked channels.";
  });

  await step("search", "Search YouTube for my content pillars", async () => {
    const pillars = (p.pillars || []).slice(0, 3);
    if (!pillars.length) return { status: "skipped", detail: "No content pillars set." };
    if (!yt.youtubeConfigured()) return { status: "blocked", integration: "youtubeData", detail: "YouTube Data API not connected." };
    if (yt.DAILY_QUOTA - yt.quotaUsed(store) < 1500) return { status: "skipped", detail: "Saving the remaining YouTube quota (search costs 100 units)." };
    const publishedAfter = new Date(Date.now() - 30 * 864e5).toISOString();
    let n = 0;
    for (const q of pillars) {
      const vids = await yt.searchVideos(store, { q, publishedAfter, order: "viewCount", maxResults: 10, regionCode: "IN" });
      for (const v of vids.slice(0, 6)) evidence.push(`SEARCH "${q}" → video ${v.videoId} "${v.title}" by ${v.channelTitle}, ${v.format}, ${v.views} views, published ${v.publishedAt?.slice(0, 10)} (raw views only; channel baseline unknown)`);
      n += vids.length;
    }
    return `${n} recent videos found for ${pillars.length} pillars.`;
  });

  await step("questions", "Collect audience questions from comments", async () => {
    if (!yt.youtubeConfigured()) return { status: "blocked", integration: "youtubeData", detail: "YouTube Data API not connected." };
    const ownVids = store.inWs("videos", ws, (v) => own.some((c) => c.id === v.channelRowId)).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "")).slice(0, 5);
    const outVids = store.inWs("videos", ws, (v) => run().outputs.outlierVideoIds.includes(v.id)).slice(0, 3);
    const comments = [];
    for (const v of [...ownVids, ...outVids]) {
      try { comments.push(...(await yt.videoComments(store, v.videoId, 50)).map((c) => ({ ...c, videoTitle: v.title }))); } catch { /* comments disabled */ }
    }
    const qs = extractQuestions(comments).slice(0, 25);
    for (const q of qs) evidence.push(`AUDIENCE QUESTION (comment on "${q.videoTitle}", ${q.likes} likes): ${q.text}`);
    if (qs.length) review({ type: "questions", title: `${qs.length} audience questions found`, why: "Unanswered questions are direct demand for videos.", data: qs.slice(0, 15) });
    return `${qs.length} questions from ${comments.length} comments.`;
  });

  await step("news", "Check current developments and debates", async () => {
    const topic = [p.niche, (p.pillars || []).join(", ")].filter(Boolean).join(" — ");
    if (!topic) return { status: "skipped", detail: "Set a niche or pillars first." };
    const r = await ai.research(store, ws, `What has happened in the last 30 days (today is ${new Date().toISOString().slice(0, 10)}) that matters to this audience: ${p.audience || "the channel's audience"}? Area: ${topic}. Include official announcements, rule or exam changes, results, notable debates or controversies with credible coverage, and recurring student/career concerns. For each item give the date and source.`, { maxUses: 6 });
    evidence.push(`CURRENT DEVELOPMENTS (web research):\n${r.text}\nSources:\n${r.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}`);
    return `${r.sources.length} sources reviewed.`;
  });

  await step("topics", "Recommend topics", async () => {
    if (!evidence.length) return { status: "skipped", detail: "No evidence gathered, so no topics were generated (the app doesn't invent recommendations)." };
    const strong = store.inWs("videos", ws, (v) => own.some((c) => c.id === v.channelRowId) && v.score?.score >= 1.5).slice(0, 8);
    for (const v of strong) evidence.push(`OUR STRONG VIDEO ${v.videoId} "${v.title}": ${describeScore(v.score)}`);
    const { data } = await gen.topicCards(store, ws, { evidence: evidence.join("\n"), count: 6 });
    let created = 0, repeats = 0;
    for (const t of data) {
      const overlap = checkOverlap(store, ws, `${t.title} ${t.centralQuestion}`);
      if (overlap.some((o) => o.kind === "topic" && o.level === "strong" && o.status === "suggested")) { repeats++; continue; }
      const row = store.insert("topics", { ws, ...t, status: "suggested", origin: "ai", runId, overlap });
      created++;
      addOut("topicIds", [row.id]);
    }
    if (created) review({ type: "topics", title: `${created} new topic recommendations`, why: "Prioritised from outliers, audience questions, search and current developments.", topicIds: run().outputs.topicIds });
    return `${created} topics recommended${repeats ? `, ${repeats} skipped as repeats of earlier suggestions` : ""}.`;
  });

  await step("prepare", "Prepare hooks and outlines for the top topics", async () => {
    const ids = run().outputs.topicIds;
    if (!ids.length) return { status: "skipped", detail: "No new topics to prepare." };
    const order = { high: 0, medium: 1, low: 2 };
    const top = ids.map((id) => store.get("topics", id)).filter((t) => !t.overlap?.some((o) => o.level === "strong")).sort((a, b) => order[a.confidence] - order[b.confidence]).slice(0, 2);
    for (const t of top) {
      const h = await gen.hooks(store, ws, t);
      const o = await gen.outline(store, ws, t, { hook: h.data[0]?.text });
      store.update("topics", t.id, { prepared: { hooks: h.data, outline: o.data, origin: h.origin, informedBy: h.informedBy, at: new Date().toISOString() } });
      review({ type: "draft", topicId: t.id, title: `Hooks and outline ready: ${t.title}`, why: `Confidence ${t.confidence}. ${t.whyNow || ""}`, prepared: `${h.data.length} hooks and a ${o.data.sections.length}-section outline (${h.origin}).`, needs: "Shortlist it to move it into the planner, or reject it with a reason." });
    }
    return `Prepared ${top.length} topics.`;
  });

  await step("performance", "Flag strong and weak recent videos", async () => {
    const recent = store.inWs("videos", ws, (v) => own.some((c) => c.id === v.channelRowId) && Date.now() - new Date(v.publishedAt) < 60 * 864e5 && v.score?.score != null);
    const flagged = recent.filter((v) => v.score.score >= 2 || v.score.score <= 0.5);
    const seen = new Set(store.inWs("reviews", ws, (r) => r.type === "performance").map((r) => r.videoId));
    for (const v of flagged) {
      if (seen.has(v.videoId)) continue;
      review({ type: "performance", videoId: v.videoId, title: `${v.score.score >= 2 ? "Strong" : "Weak"}: ${v.title}`, why: describeScore(v.score), needs: "Open Analytics to see the evidence and suggested experiments." });
    }
    return recent.length ? `${flagged.length} of ${recent.length} recent videos flagged.` : { status: "skipped", detail: "No scored videos from the last 60 days." };
  });

  const steps = run().steps;
  for (const s of steps.filter((x) => x.status === "blocked")) {
    review({ type: "blocked", title: `Blocked: ${s.label}`, why: s.detail, integration: s.integration });
  }
  const failed = steps.some((s) => s.status === "failed");
  store.update("runs", runId, { status: failed ? "completed with errors" : "completed", finishedAt: new Date().toISOString() });
}

// ---- Scheduled runs ----
// settings.schedule = { frequency: "off" | "daily" | "weekly", time: "07:30" (India time), weekday: 1 (Mon) }
// `anyTime` is for once-a-day cron jobs (Vercel Hobby), which can't wait for the chosen time.
export function dueNow(schedule, lastRunAt, now = new Date(), { anyTime = false } = {}) {
  if (!schedule || schedule.frequency === "off" || !schedule.frequency) return false;
  const ist = new Date(now.getTime() + 330 * 60e3);
  const [h, m] = String(schedule.time || "07:30").split(":").map(Number);
  if (!anyTime && ist.getUTCHours() * 60 + ist.getUTCMinutes() < h * 60 + m) return false;
  if (schedule.frequency === "weekly" && ist.getUTCDay() !== Number(schedule.weekday ?? 1)) return false;
  const today = ist.toISOString().slice(0, 10);
  const last = lastRunAt ? new Date(new Date(lastRunAt).getTime() + 330 * 60e3).toISOString().slice(0, 10) : null;
  return last !== today;
}

// Starts every scheduled run that is due. Returns the runs started.
export function startDueRuns(store, { anyTime = false } = {}) {
  const started = [];
  for (const w of store.all("workspaces")) {
    if (dueNow(w.settings?.schedule, w.settings?.lastScheduledRunAt, new Date(), { anyTime })) {
      store.update("workspaces", w.id, { settings: { ...w.settings, lastScheduledRunAt: new Date().toISOString() } });
      const run = startRun(store, w.id, { trigger: "scheduled" });
      if (run) started.push(run);
    }
  }
  return started;
}

// On your own computer: check every minute. (On Vercel a cron job calls /api/cron/research instead.)
export function startScheduler(store) {
  return setInterval(() => store.sync().then(() => startDueRuns(store)).catch((e) => console.error(e.message)), 60e3);
}
