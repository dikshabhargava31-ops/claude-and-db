// Instagram, reusing the scheduler that already exists in this repository instead of building another:
//  - Planner bridge: reads instagram/accounts.json, posts.csv and published.json from GitHub
//    (the files the Instagram Planner and the scheduler workflow use), and, only after the
//    owner approves a specific post, appends one row to posts.csv on main.
//  - Insights: per-post Instagram metrics through the Instagram Graph API, for accounts given a
//    token with the instagram_business_manage_insights permission in IG_INSIGHTS_ACCOUNTS.
import { httpError } from "./auth.js";
import { parseCSV, csvField } from "./csv.js";

const GH_API = () => process.env.GITHUB_API_BASE || "https://api.github.com";
const IG_GRAPH = () => process.env.IG_GRAPH_BASE || "https://graph.instagram.com/v23.0";
export const plannerRepo = () => process.env.IG_PLANNER_REPO || "dikshabhargava31-ops/claude-and-db";
export const plannerBranch = () => process.env.IG_PLANNER_BRANCH || "main";
export const plannerUrl = () => process.env.IG_PLANNER_URL || "https://dikshabhargava31-ops.github.io/claude-and-db/schedule/";
export const plannerWritable = () => !!process.env.GITHUB_TOKEN;

const TYPES = new Set(["post", "carousel", "reel", "story"]);
const VIDEO = /\.(mp4|mov|m4v)(\?|$)/i;
const COLUMNS = ["id", "account", "publish_at", "type", "media", "caption", "first_comment"];

async function gh(path, opts = {}) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "creator-research-studio" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let res;
  try {
    res = await fetch(GH_API() + path, { ...opts, headers: { ...headers, ...(opts.body ? { "content-type": "application/json" } : {}) }, signal: AbortSignal.timeout(20000) });
  } catch (e) {
    throw httpError(502, `Couldn't reach GitHub (${e.cause?.code || e.message}).`, { integration: "instagramPlanner" });
  }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw httpError(res.status === 409 ? 409 : 502, `GitHub: ${b.message || res.status}`, { integration: "instagramPlanner", ghStatus: res.status });
  }
  return res.status === 204 ? null : res.json();
}

async function readFile(path) {
  const f = await gh(`/repos/${plannerRepo()}/contents/${path}?ref=${plannerBranch()}`);
  return { sha: f.sha, text: Buffer.from(f.content, "base64").toString("utf8") };
}

let cache = null;
export async function plannerState({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < 120e3) return cache.data;
  const [accounts, posts, published] = await Promise.all([
    readFile("instagram/accounts.json"),
    readFile("instagram/posts.csv"),
    readFile("instagram/published.json").catch(() => ({ text: '{"published":{},"failed":{}}' })),
  ]);
  const [head, ...rows] = parseCSV(posts.text);
  const state = JSON.parse(published.text);
  const list = rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || "").trim()])))
    .filter((p) => p.id && !p.id.startsWith("#"))
    .map((p) => ({
      ...p,
      status: state.published?.[p.id] ? "published" : state.failed?.[p.id] ? "failed" : "queued",
      permalink: state.published?.[p.id]?.permalink || null,
      publishedAt: state.published?.[p.id]?.published_at || null,
      error: state.failed?.[p.id]?.error || null,
    }));
  const data = { accounts: JSON.parse(accounts.text), posts: list, fetchedAt: new Date().toISOString(), repo: plannerRepo(), branch: plannerBranch() };
  cache = { at: Date.now(), data };
  return data;
}

// India time "YYYY-MM-DD HH:MM" -> Date (the scheduler's default zone is Asia/Kolkata, UTC+5:30, no DST).
export function parseIST(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 5, +m[5] - 30));
}

export function makePostId(account, publishAt) {
  const stamp = publishAt.replace(/[-: T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
  const rand = Array.from({ length: 4 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  return `${account}-${stamp}-${rand}`;
}

// Mirrors the checks in instagram/ig_scheduler.py (load_posts) so a row is never committed
// that the scheduler would reject.
export function validatePost(p, accounts) {
  const problems = [];
  if (!p.account || !(p.account in accounts)) problems.push(`Choose an account from accounts.json (${Object.keys(accounts).join(", ")}).`);
  const when = parseIST(p.publish_at);
  if (!when) problems.push("publish_at must look like 2026-11-01 18:30 (India time).");
  else if (when.getTime() < Date.now() - 5 * 60e3) problems.push("publish_at is in the past. Pick a future time.");
  if (!TYPES.has(p.type)) problems.push("type must be post, carousel, reel or story.");
  const media = String(p.media || "").split("|").map((m) => m.trim()).filter(Boolean);
  if (!media.length) problems.push("Add at least one public media link.");
  if (media.some((m) => !m.startsWith("https://"))) problems.push("Media must be public https:// links (the Instagram Planner puts uploads in instagram-media).");
  if (p.type === "post" && (media.length !== 1 || VIDEO.test(media[0]))) problems.push("A post needs exactly one image (use reel for a video).");
  if (p.type === "carousel" && (media.length < 2 || media.length > 10)) problems.push("A carousel needs 2 to 10 media links.");
  if (p.type === "reel" && (media.length !== 1 || !VIDEO.test(media[0]))) problems.push("A reel needs exactly one .mp4 or .mov video.");
  if (p.type === "story" && media.length !== 1) problems.push("A story needs exactly one image or video.");
  if ((p.caption || "").length > 2200) problems.push("Caption is over Instagram's 2,200 characters.");
  if (((p.caption || "") + " " + (p.first_comment || "")).match(/#\w+/g)?.length > 30) problems.push("Instagram allows at most 30 hashtags.");
  return problems;
}

export function csvRow(p) {
  return COLUMNS.map((c) => csvField(p[c] ?? "")).join(",");
}

// Commits one approved row to posts.csv on main. Retries once if someone saved in between.
export async function commitPost(post) {
  if (!plannerWritable()) throw httpError(503, "Sending to the Instagram Planner needs GITHUB_TOKEN on the server (contents: write on " + plannerRepo() + ").", { integration: "instagramPlanner" });
  for (let attempt = 0; attempt < 2; attempt++) {
    const f = await readFile("instagram/posts.csv");
    if (parseCSV(f.text).some((r) => r[0] === post.id)) throw httpError(409, `posts.csv already has a row with id ${post.id}.`);
    const text = f.text.replace(/\n*$/, "\n") + csvRow(post) + "\n";
    try {
      const res = await gh(`/repos/${plannerRepo()}/contents/instagram/posts.csv`, {
        method: "PUT",
        body: JSON.stringify({ message: `Instagram: schedule ${post.id}`, content: Buffer.from(text).toString("base64"), sha: f.sha, branch: plannerBranch() }),
      });
      cache = null;
      return { commit: res.commit?.html_url || null };
    } catch (e) {
      if (e.ghStatus !== 409 || attempt) throw e;
    }
  }
}

// Asks the scheduler workflow to start a run, as the Planner does after saving. The run only
// publishes posts that are due; a future post waits for its time.
export async function triggerSchedulerRun() {
  await gh(`/repos/${plannerRepo()}/actions/workflows/instagram-scheduler.yml/dispatches`, {
    method: "POST", body: JSON.stringify({ ref: plannerBranch(), inputs: { mode: "publish" } }),
  });
}

// ---- Insights ----
export function insightsAccounts() {
  try { return JSON.parse(process.env.IG_INSIGHTS_ACCOUNTS || "{}"); } catch { return {}; }
}

async function graph(path, token) {
  const u = new URL(IG_GRAPH() + path);
  u.searchParams.set("access_token", token);
  let res;
  try { res = await fetch(u, { signal: AbortSignal.timeout(20000) }); }
  catch (e) { throw httpError(502, `Couldn't reach Instagram (${e.cause?.code || e.message}).`, { integration: "instagramInsights" }); }
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(502, `Instagram: ${b.error?.error_user_msg || b.error?.message || res.status}`, { integration: "instagramInsights" });
  return b;
}

// Instagram metrics differ from YouTube's: there is no thumbnail CTR. Reach, views, saves,
// shares and interactions are reported per post; Reels add average watch time.
const FEED_METRICS = "reach,views,saved,shares,total_interactions";
const REEL_METRICS = FEED_METRICS + ",ig_reels_avg_watch_time,ig_reels_video_view_total_time";

export async function fetchInsights(shortName, limit = 30) {
  const acc = insightsAccounts()[shortName];
  if (!acc) throw httpError(503, `No insights token for '${shortName}'. Add it to IG_INSIGHTS_ACCOUNTS.`, { integration: "instagramInsights" });
  const media = await graph(`/${acc.user_id}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count&limit=${limit}`, acc.token);
  const out = [];
  for (const m of media.data || []) {
    const row = { mediaId: m.id, account: shortName, caption: m.caption || "", type: m.media_product_type === "REELS" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : "post", permalink: m.permalink, publishedAt: m.timestamp, likes: m.like_count ?? null, comments: m.comments_count ?? null, metrics: {}, metricsError: null };
    try {
      const ins = await graph(`/${m.id}/insights?metric=${row.type === "reel" ? REEL_METRICS : FEED_METRICS}`, acc.token);
      for (const d of ins.data || []) row.metrics[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? null;
    } catch (e) {
      row.metricsError = e.message;
    }
    out.push(row);
  }
  return out;
}
