// Authorised YouTube data for the workspace's own channel: OAuth 2.0 (web server flow),
// YouTube Analytics API (retention, traffic sources, watch time, subscribers, comparable-age views),
// YouTube Reporting API reach reports (thumbnail impressions and CTR), and caption download.
// Tokens stay in the server's data store and are never sent to the browser.
import crypto from "node:crypto";
import { httpError } from "./auth.js";
import { toObjects } from "./csv.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const ANALYTICS = () => process.env.YT_ANALYTICS_BASE || "https://youtubeanalytics.googleapis.com/v2";
const REPORTING = () => process.env.YT_REPORTING_BASE || "https://youtubereporting.googleapis.com/v1";
const DATA = () => process.env.YT_API_BASE || "https://www.googleapis.com/youtube/v3";

export const BASE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];
// Needed only to download captions of your own videos. Google groups it with "manage your
// YouTube account", so it's requested separately and only when the owner asks for it.
export const CAPTION_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

export const oauthConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.PUBLIC_URL);
const redirectUri = () => process.env.PUBLIC_URL.replace(/\/$/, "") + "/oauth/google/callback";

const pending = new Map(); // state -> {ws, userId, scopes, at}

export function authUrl(ws, userId, { captions = false } = {}) {
  if (!oauthConfigured()) throw httpError(503, "Google sign-in isn't set up. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and PUBLIC_URL to .env.", { integration: "youtubeAnalytics" });
  const state = crypto.randomBytes(24).toString("base64url");
  const scopes = captions ? [...BASE_SCOPES, CAPTION_SCOPE] : BASE_SCOPES;
  pending.set(state, { ws, userId, scopes, at: Date.now() });
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(), response_type: "code",
    scope: scopes.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return u.toString();
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(502, `Google sign-in failed: ${body.error_description || body.error || res.status}`, { integration: "youtubeAnalytics" });
  return body;
}

export async function finishAuth(store, { code, state }) {
  const p = pending.get(state);
  pending.delete(state);
  if (!p || Date.now() - p.at > 15 * 60e3) throw httpError(400, "This Google sign-in link expired. Start the connection again from Settings.");
  const tok = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  const id = "yt:" + p.ws;
  const prev = store.get("connections", id);
  const row = {
    ws: p.ws, kind: "youtube", connectedBy: p.userId,
    refreshToken: tok.refresh_token || prev?.refreshToken,
    accessToken: tok.access_token, expiresAt: Date.now() + (tok.expires_in - 60) * 1000,
    scopes: (tok.scope || p.scopes.join(" ")).split(" "),
  };
  if (prev) store.update("connections", id, row); else store.insert("connections", { id, ...row });
  const me = await authed(store, p.ws, `${DATA()}/channels?part=snippet,statistics,contentDetails&mine=true`);
  const ch = me.items?.[0];
  store.update("connections", id, { channelId: ch?.id || null, channelTitle: ch?.snippet?.title || null });
  return { ws: p.ws, channel: ch };
}

export function connection(store, ws) {
  return store.get("connections", "yt:" + ws);
}

export function disconnect(store, ws) {
  store.remove("connections", "yt:" + ws);
}

async function accessToken(store, ws) {
  const c = connection(store, ws);
  if (!c) throw httpError(503, "Your YouTube channel isn't connected. Connect it in Settings → Connections.", { integration: "youtubeAnalytics" });
  if (c.accessToken && c.expiresAt > Date.now()) return c.accessToken;
  if (!c.refreshToken) throw httpError(401, "The YouTube connection expired. Reconnect it in Settings.", { integration: "youtubeAnalytics" });
  const tok = await tokenRequest({ refresh_token: c.refreshToken, grant_type: "refresh_token" });
  store.update("connections", c.id, { accessToken: tok.access_token, expiresAt: Date.now() + (tok.expires_in - 60) * 1000 });
  return tok.access_token;
}

async function authed(store, ws, url, { raw = false, method = "GET", body } = {}) {
  const token = await accessToken(store, ws);
  let res;
  try {
    res = await fetch(url, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  } catch (e) {
    throw httpError(502, `Couldn't reach Google (${e.cause?.code || e.message}).`, { integration: "youtubeAnalytics" });
  }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw httpError(res.status === 403 ? 403 : 502, `Google API error: ${b.error?.message || res.status}`, { integration: "youtubeAnalytics" });
  }
  return raw ? res.text() : res.json();
}

function rowsToObjects(report) {
  const cols = (report.columnHeaders || []).map((c) => c.name);
  return (report.rows || []).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}

const ymd = (d) => new Date(d).toISOString().slice(0, 10);

export async function analyticsQuery(store, ws, params) {
  const u = new URL(ANALYTICS() + "/reports");
  u.search = new URLSearchParams({ ids: "channel==MINE", ...params });
  return rowsToObjects(await authed(store, ws, u.toString()));
}

// Lifetime totals per video for the given IDs.
export async function videoTotals(store, ws, videoIds, since = "2005-04-23") {
  const out = {};
  for (let i = 0; i < videoIds.length; i += 200) {
    const rows = await analyticsQuery(store, ws, {
      startDate: since, endDate: ymd(Date.now()), dimensions: "video",
      metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,shares",
      filters: "video==" + videoIds.slice(i, i + 200).join(","), maxResults: 200, sort: "-views",
    });
    for (const r of rows) out[r.video] = r;
  }
  return out;
}

// Views in the first 7 and 28 days after publication: the fair way to compare videos of different ages.
export async function comparableWindows(store, ws, videoId, publishedAt) {
  const start = new Date(publishedAt);
  const end = new Date(Math.min(start.getTime() + 27 * 864e5, Date.now()));
  const rows = await analyticsQuery(store, ws, { startDate: ymd(start), endDate: ymd(end), dimensions: "day", metrics: "views,subscribersGained", filters: "video==" + videoId, sort: "day" });
  const days = (Date.now() - start.getTime()) / 864e5;
  const sum = (n) => rows.slice(0, n).reduce((a, r) => a + (r.views || 0), 0);
  return { first7: days >= 7 ? sum(7) : null, first28: days >= 28 ? sum(28) : null, daily: rows.map((r) => [r.day, r.views]) };
}

export async function retention(store, ws, videoId) {
  return analyticsQuery(store, ws, { startDate: "2005-04-23", endDate: ymd(Date.now()), dimensions: "elapsedVideoTimeRatio", metrics: "audienceWatchRatio,relativeRetentionPerformance", filters: `video==${videoId};audienceType==ORGANIC` });
}

export async function trafficSources(store, ws, videoId) {
  const params = { startDate: "2005-04-23", endDate: ymd(Date.now()), dimensions: "insightTrafficSourceType", metrics: "views,estimatedMinutesWatched", sort: "-views" };
  if (videoId) params.filters = "video==" + videoId;
  return analyticsQuery(store, ws, params);
}

// Finds significant drop-offs in a retention curve: steepest falls between points.
export function dropOffs(curve) {
  const pts = curve.map((r) => ({ at: r.elapsedVideoTimeRatio, w: r.audienceWatchRatio })).sort((a, b) => a.at - b.at);
  const drops = [];
  for (let i = 1; i < pts.length; i++) {
    const fall = pts[i - 1].w - pts[i].w;
    if (fall >= 0.04) drops.push({ from: pts[i - 1].at, to: pts[i].at, fall: Math.round(fall * 1000) / 10 });
  }
  const intro = pts.find((p) => p.at >= 0.1);
  return { introRetention: intro ? Math.round(intro.w * 1000) / 10 : null, drops: drops.sort((a, b) => b.fall - a.fall).slice(0, 4) };
}

// --- Reporting API: reach reports (thumbnail impressions and impressions CTR) ---
export const REACH_REPORT = "channel_reach_basic_a1";

export async function reachJob(store, ws) {
  const jobs = await authed(store, ws, `${REPORTING()}/jobs`);
  return (jobs.jobs || []).find((j) => j.reportTypeId === REACH_REPORT) || null;
}

// Creating a reporting job is a change on the channel's account, so the UI only calls this when
// the owner clicks "Start impressions reports". YouTube then produces daily reports from that day on.
export async function createReachJob(store, ws) {
  const existing = await reachJob(store, ws);
  if (existing) return existing;
  return authed(store, ws, `${REPORTING()}/jobs`, { method: "POST", body: { reportTypeId: REACH_REPORT, name: "Creator Research Studio reach" } });
}

export async function reachByVideo(store, ws) {
  const job = await reachJob(store, ws);
  if (!job) return { job: null, videos: {}, reports: 0 };
  const list = await authed(store, ws, `${REPORTING()}/jobs/${job.id}/reports`);
  const reports = (list.reports || []).slice(0, 60);
  const agg = {};
  for (const rep of reports) {
    const csv = await authed(store, ws, rep.downloadUrl, { raw: true });
    for (const r of toObjects(csv)) {
      const imp = Number(r.video_thumbnail_impressions || 0);
      const ctr = Number(r.video_thumbnail_impressions_ctr || 0);
      const a = (agg[r.video_id] ??= { impressions: 0, clicks: 0, firstDate: r.date, lastDate: r.date });
      a.impressions += imp;
      a.clicks += imp * ctr;
      if (r.date < a.firstDate) a.firstDate = r.date;
      if (r.date > a.lastDate) a.lastDate = r.date;
    }
  }
  for (const a of Object.values(agg)) a.ctr = a.impressions ? Math.round((a.clicks / a.impressions) * 10000) / 100 : null;
  return { job, videos: agg, reports: reports.length };
}

// --- Captions of the channel's own videos (needs the optional caption scope) ---
export async function ownCaption(store, ws, videoId) {
  const c = connection(store, ws);
  if (!c?.scopes?.includes(CAPTION_SCOPE)) throw httpError(403, "Caption download needs the extra caption permission. The owner can grant it in Settings → Connections.", { integration: "captions" });
  const list = await authed(store, ws, `${DATA()}/captions?part=snippet&videoId=${encodeURIComponent(videoId)}`);
  const track = (list.items || []).sort((a, b) => (a.snippet.trackKind === "standard" ? -1 : 1) - (b.snippet.trackKind === "standard" ? -1 : 1))[0];
  if (!track) throw httpError(404, "This video has no caption track. Upload or paste a transcript instead.");
  const srt = await authed(store, ws, `${DATA()}/captions/${track.id}?tfmt=srt`, { raw: true });
  return { language: track.snippet.language, kind: track.snippet.trackKind, text: srtToText(srt) };
}

export function srtToText(srt) {
  return String(srt).split(/\r?\n/).filter((l) => l.trim() && !/^\d+$/.test(l.trim()) && !/-->/.test(l)).join(" ").replace(/\s+/g, " ").trim();
}
