// Sign-in, users, workspaces, members, settings, connection status, runs and the review queue.
import * as auth from "../auth.js";
import { httpError } from "../auth.js";
import * as yt from "../youtube.js";
import * as google from "../google.js";
import * as ai from "../ai.js";
import * as ig from "../instagram.js";
import { startRun, isRunning, startDueRuns } from "../research.js";
import { seedDemo } from "../demo.js";

export const CA_PRESET = {
  name: "CA Mahendra Sir",
  profile: {
    youtubeUrl: "https://www.youtube.com/@camahendrasir",
    instagramUrls: [],
    niche: "CA education, student challenges, careers and commentary",
    audience: "CA Foundation, Inter and Final students in India (and their parents), plus young CAs choosing careers",
    pillars: ["CA exam strategy and results", "Student challenges and mental pressure", "CA careers, articleship and jobs", "ICAI updates and commentary"],
    scriptLanguage: "Natural Hindi-English (Hinglish, Roman script)",
    titleLanguage: "English",
    tone: "Direct, warm teacher who speaks to students like a mentor; evidence over hype; no generic motivation",
    formats: ["Long-form commentary (10–20 min)", "Explainers", "YouTube Shorts / Instagram Reels (30–60 s)"],
    lengths: "Long-form 10–20 minutes; Shorts and Reels 30–60 seconds",
    notes: "",
  },
};

export function blankWorkspace(name) {
  return { name, profile: { youtubeUrl: "", instagramUrls: [], niche: "", audience: "", pillars: [], scriptLanguage: "Natural Hindi-English (Hinglish, Roman script)", titleLanguage: "English", tone: "", formats: [], lengths: "", notes: "" } };
}

const DEFAULT_SETTINGS = { aiBudgetUsd: 0, schedule: { frequency: "off", time: "07:30", weekday: 1 }, igAccount: "" };

function cleanProfile(p = {}) {
  const list = (v) => (Array.isArray(v) ? v : String(v || "").split(/\n|;/)).map((s) => String(s).trim()).filter(Boolean).slice(0, 30);
  const s = (v) => String(v ?? "").slice(0, 4000);
  return {
    youtubeUrl: s(p.youtubeUrl), instagramUrls: list(p.instagramUrls), niche: s(p.niche), audience: s(p.audience),
    pillars: list(p.pillars), scriptLanguage: s(p.scriptLanguage), titleLanguage: s(p.titleLanguage), tone: s(p.tone),
    formats: list(p.formats), lengths: s(p.lengths), notes: s(p.notes),
  };
}

// What each connected feature is using right now: live, imported, demo or unavailable.
export function integrationStatus(store, ws) {
  const w = ws && store.get("workspaces", ws);
  const conn = ws ? google.connection(store, ws) : null;
  const spend = ws ? ai.aiSpend(store, ws) : null;
  const igAcc = ig.insightsAccounts();
  const lastRun = ws ? store.inWs("runs", ws).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] : null;
  const remote = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    hosting: process.env.VERCEL ? "vercel" : "local",
    database: { label: "Database (where everything is saved)", state: remote ? "live" : "manual", detail: remote ? `Supabase${process.env.VERCEL ? ", hosted on Vercel" : ""}. Data is shared by every copy of the app that uses this Supabase project.` : "Saved in data/db.json on this computer. Connect Supabase to host the app online (see studio/README.md → Publish on Vercel).", needs: "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY" },
    youtubeData: { label: "YouTube Data API (public videos and channels)", state: yt.youtubeConfigured() ? "live" : "unavailable", detail: yt.youtubeConfigured() ? `${yt.quotaUsed(store).toLocaleString()} of ${yt.DAILY_QUOTA.toLocaleString()} quota units used today (Pacific day).` : "Add YOUTUBE_API_KEY to .env. Without it, import videos by link (title, channel, thumbnail only) or CSV.", needs: "YOUTUBE_API_KEY" },
    youtubeAnalytics: { label: "YouTube Analytics (my channel, authorised)", state: conn ? "live" : google.oauthConfigured() ? "not connected" : "unavailable", detail: conn ? `Connected to ${conn.channelTitle || "a channel"}${conn.scopes?.includes(google.CAPTION_SCOPE) ? " (with caption permission)" : ""}.` : google.oauthConfigured() ? "The owner can connect the channel in Settings → Connections." : "Needs a Google Cloud OAuth client: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and PUBLIC_URL.", needs: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, PUBLIC_URL, then Connect", channel: conn?.channelTitle || null },
    impressions: { label: "Impressions and CTR (YouTube Reporting API reach reports)", state: conn ? "live" : "unavailable", detail: conn ? "Start the daily reach reports once (Settings → Connections); YouTube adds reports from that day on. YouTube Studio CSV exports can also be imported." : "Needs the YouTube connection. Until then, import a YouTube Studio CSV export.", needs: "YouTube connection" },
    ai: { label: "AI research assistant (Claude)", state: !ai.aiConfigured() ? "unavailable" : !(w?.settings?.aiBudgetUsd > 0) ? "awaiting approval" : "live", detail: !ai.aiConfigured() ? "Add ANTHROPIC_API_KEY. Until then, hooks and outlines are fill-in templates and no topics are generated." : !(w?.settings?.aiBudgetUsd > 0) ? "Owner: approve a monthly AI budget in Settings → AI & budget." : `$${spend.usd.toFixed(2)} of $${w.settings.aiBudgetUsd} used this month (${spend.calls} calls, ${spend.searches} web searches). Model ${ai.MODEL()}.`, needs: "ANTHROPIC_API_KEY + budget approval" },
    webSearch: { label: "Web research with sources", state: ai.aiConfigured() && w?.settings?.aiBudgetUsd > 0 ? "live" : "unavailable", detail: "Runs through Claude's web search tool ($10 per 1,000 searches, counted in the AI budget).", needs: "AI connection" },
    instagramPlanner: { label: "Instagram Planner (existing scheduler)", state: "live", write: ig.plannerWritable(), detail: `Reads ${ig.plannerRepo()} (${ig.plannerBranch()}). ${ig.plannerWritable() ? "Approved posts can be sent to it." : "Read-only: add GITHUB_TOKEN (contents: write) to send approved posts; until then copy the row or use the Planner."}`, needs: "GITHUB_TOKEN for sending", url: ig.plannerUrl() },
    instagramInsights: { label: "Instagram insights", state: Object.keys(igAcc).length ? "live" : "unavailable", detail: Object.keys(igAcc).length ? `Accounts: ${Object.keys(igAcc).join(", ")}.` : "Needs IG_INSIGHTS_ACCOUNTS with a token that has the instagram_business_manage_insights permission (the scheduler's publishing tokens are GitHub secrets and stay there). Until then, import an Instagram CSV.", needs: "IG_INSIGHTS_ACCOUNTS" },
    transcripts: { label: "Transcripts", state: conn?.scopes?.includes(google.CAPTION_SCOPE) ? "live" : "manual", detail: "Own videos: caption download after the owner grants the caption permission. Other channels' videos: paste or upload a transcript (YouTube's API only lets owners download captions).", needs: "Caption permission (own videos only)" },
    lastRun: lastRun ? { at: lastRun.startedAt, status: lastRun.status } : null,
  };
}

export default [
  ["GET", "/api/session", "public", ({ user, store }) => ({ user: auth.publicUser(user), needsSetup: !store.all("users").length })],

  ["POST", "/api/setup", "public", ({ store, body, setSession }) => {
    if (store.all("users").length) throw httpError(403, "The owner account already exists. Sign in instead.");
    // On a hosted app anyone could reach this page first, so only OWNER_EMAIL may create the owner.
    const owner = String(process.env.OWNER_EMAIL || "").trim().toLowerCase();
    if (process.env.VERCEL && !owner) throw httpError(403, "Set OWNER_EMAIL in Vercel's environment variables to create the owner account.");
    if (owner && String(body.email || "").trim().toLowerCase() !== owner) throw httpError(403, "Only the email set as OWNER_EMAIL can create the owner account.");
    const user = auth.createUser(store, { ...body, admin: true });
    setSession(auth.createSession(store, user.id));
    return { user: auth.publicUser(user) };
  }],

  ["POST", "/api/login", "public", ({ store, body, req, setSession }) => {
    const key = `${req.socket.remoteAddress}|${String(body.email).toLowerCase()}`;
    if (!auth.loginAllowed(key)) throw httpError(429, "Too many attempts. Wait 15 minutes and try again.");
    const user = store.all("users", (u) => u.email === String(body.email || "").trim().toLowerCase())[0];
    if (!user || !auth.checkPassword(String(body.password || ""), user.passHash)) {
      auth.noteFailedLogin(key);
      throw httpError(401, "Email or password is wrong.");
    }
    setSession(auth.createSession(store, user.id));
    return { user: auth.publicUser(user) };
  }],

  ["POST", "/api/logout", "public", ({ store, token, setSession }) => { auth.endSession(store, token); setSession(""); return { ok: true }; }],

  ["POST", "/api/me/password", "auth", ({ store, user, body }) => {
    if (!auth.checkPassword(String(body.current || ""), user.passHash)) throw httpError(400, "Current password is wrong.");
    const problem = auth.validatePassword(body.next);
    if (problem) throw httpError(400, problem);
    store.update("users", user.id, { passHash: auth.hashPassword(body.next) });
    return { ok: true };
  }],

  ["GET", "/api/users", "auth", ({ store, user }) => {
    if (!user.admin) throw httpError(403, "Only the app admin can see accounts.");
    return store.all("users").map(auth.publicUser);
  }],

  // The admin creates team accounts with a temporary password and shares it privately.
  ["POST", "/api/users", "auth", ({ store, user, body }) => {
    if (!user.admin) throw httpError(403, "Only the app admin can add accounts.");
    return auth.publicUser(auth.createUser(store, body));
  }],

  ["GET", "/api/status", "auth", ({ store }) => integrationStatus(store, null)],

  ["GET", "/api/workspaces", "auth", ({ store, user }) =>
    store.all("workspaces", (w) => auth.roleIn(w, user.id)).map((w) => ({ id: w.id, name: w.name, demo: !!w.demo, role: auth.roleIn(w, user.id) }))],

  ["POST", "/api/workspaces", "auth", ({ store, user, body }) => {
    if (body.demo) {
      const existing = store.all("workspaces", (w) => w.demo && auth.roleIn(w, user.id))[0];
      if (existing) return existing;
      const w = store.insert("workspaces", { ...blankWorkspace("Demo workspace (sample data)"), demo: true, members: [{ userId: user.id, role: "owner" }], settings: { ...DEFAULT_SETTINGS } });
      seedDemo(store, w.id, user.id);
      return w;
    }
    const base = body.preset === "ca" ? structuredClone(CA_PRESET) : blankWorkspace(String(body.name || "New workspace").slice(0, 80));
    if (body.name) base.name = String(body.name).slice(0, 80);
    return store.insert("workspaces", { ...base, members: [{ userId: user.id, role: "owner" }], settings: { ...DEFAULT_SETTINGS } });
  }],

  ["GET", "/api/ws/:ws", "viewer", ({ store, workspace, role, ws, user }) => ({
    id: workspace.id, name: workspace.name, demo: !!workspace.demo, profile: workspace.profile, settings: workspace.settings, role,
    members: workspace.members.map((m) => ({ ...auth.publicUser(store.get("users", m.userId)), role: m.role })),
    status: integrationStatus(store, ws), running: isRunning(store, ws), me: auth.publicUser(user),
  })],

  ["PATCH", "/api/ws/:ws", "editor", ({ store, ws, workspace, role, body }) => {
    const patch = {};
    if (body.name) patch.name = String(body.name).slice(0, 80);
    if (body.profile) patch.profile = cleanProfile({ ...workspace.profile, ...body.profile });
    if (body.settings) {
      if (role !== "owner") throw httpError(403, "Only the workspace owner can change settings, budgets and schedules.");
      const s = { ...workspace.settings };
      if ("aiBudgetUsd" in body.settings) s.aiBudgetUsd = Math.max(0, Math.min(10000, Number(body.settings.aiBudgetUsd) || 0));
      if (body.settings.schedule) {
        const sc = body.settings.schedule;
        if (!["off", "daily", "weekly"].includes(sc.frequency)) throw httpError(400, "Frequency must be off, daily or weekly.");
        if (!/^\d{2}:\d{2}$/.test(sc.time || "")) throw httpError(400, "Time must look like 07:30.");
        s.schedule = { frequency: sc.frequency, time: sc.time, weekday: Number(sc.weekday ?? 1) };
      }
      if ("igAccount" in body.settings) s.igAccount = String(body.settings.igAccount || "");
      patch.settings = s;
    }
    return store.update("workspaces", ws, patch);
  }],

  ["POST", "/api/ws/:ws/members", "owner", ({ store, ws, workspace, body }) => {
    const u = store.all("users", (x) => x.email === String(body.email || "").trim().toLowerCase())[0];
    if (!u) throw httpError(404, "No account with that email. The app admin adds accounts first (Settings → Team).");
    if (!["owner", "editor", "viewer"].includes(body.role)) throw httpError(400, "Role must be owner, editor or viewer.");
    const members = workspace.members.filter((m) => m.userId !== u.id).concat({ userId: u.id, role: body.role });
    return store.update("workspaces", ws, { members });
  }],

  ["DELETE", "/api/ws/:ws/members/:userId", "owner", ({ store, ws, workspace, params, user }) => {
    if (params.userId === user.id) throw httpError(400, "You can't remove yourself.");
    return store.update("workspaces", ws, { members: workspace.members.filter((m) => m.userId !== params.userId) });
  }],

  // Vercel cron job (vercel.json): starts scheduled research runs. Vercel sends CRON_SECRET.
  ["GET", "/api/cron/research", "public", async ({ store, req }) => {
    if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) throw httpError(401, "Not allowed.");
    const runs = startDueRuns(store, { anyTime: true });
    await store.persist();
    await Promise.all(runs.map((r) => r.done));
    return { started: runs.length };
  }],

  // ---- research runs and the review queue ----
  ["POST", "/api/ws/:ws/runs", "editor", ({ store, ws, user }) => {
    const run = startRun(store, ws, { trigger: "manual", userId: user.id });
    if (!run) throw httpError(409, "A research run is already in progress for this workspace.");
    const { done, ...row } = run;
    return row;
  }],

  ["GET", "/api/ws/:ws/runs", "viewer", ({ store, ws }) => store.inWs("runs", ws).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 20)],

  ["GET", "/api/ws/:ws/runs/:id", "viewer", ({ store, ws, params }) => store.getInWs("runs", ws, params.id) || (() => { throw httpError(404, "Run not found."); })()],

  ["GET", "/api/ws/:ws/reviews", "viewer", ({ store, ws, query }) => {
    const list = store.inWs("reviews", ws, (r) => !query.decision || r.decision === query.decision);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200).map((r) => ({
      ...r, video: r.videoId ? store.get("videos", `${ws}:${r.videoId}`) : null,
      topics: r.topicIds ? r.topicIds.map((id) => store.get("topics", id)).filter(Boolean) : undefined,
      topic: r.topicId ? store.get("topics", r.topicId) : undefined,
    }));
  }],

  ["POST", "/api/ws/:ws/reviews/:id/decide", "editor", async ({ store, ws, params, body, role, user }) => {
    const r = store.getInWs("reviews", ws, params.id);
    if (!r) throw httpError(404, "Review item not found.");
    if (!["approved", "rejected", "dismissed", "done"].includes(body.decision)) throw httpError(400, "Unknown decision.");
    if (r.type === "ig-schedule" && body.decision === "approved") {
      if (role !== "owner") throw httpError(403, "Only the workspace owner can approve scheduling on Instagram.");
      const state = await ig.plannerState({ fresh: true });
      const problems = ig.validatePost(r.post, state.accounts);
      if (problems.length) throw httpError(400, problems.join(" "));
      const result = await ig.commitPost(r.post);
      let runNote = "The scheduler's 15-minute check will pick it up.";
      try { await ig.triggerSchedulerRun(); runNote = "A scheduler run was started; it publishes the post at its time."; } catch (e) { runNote = `Couldn't start a scheduler run (${e.message}); the 15-minute check will pick it up.`; }
      if (r.itemId) {
        const item = store.get("items", r.itemId);
        if (item) store.update("items", r.itemId, { stage: "Scheduled", igPostId: r.post.id, scheduledAt: r.post.publish_at, history: [...(item.history || []), { at: new Date().toISOString(), by: user.id, note: `Scheduled on Instagram (${r.post.account}) for ${r.post.publish_at} IST` }] });
      }
      return store.update("reviews", r.id, { decision: "approved", decidedBy: user.id, decidedAt: new Date().toISOString(), result: { ...result, note: runNote } });
    }
    return store.update("reviews", r.id, { decision: body.decision, decidedBy: user.id, decidedAt: new Date().toISOString(), note: body.note || "" });
  }],
];
