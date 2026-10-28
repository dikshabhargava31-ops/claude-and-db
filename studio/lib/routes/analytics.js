// Performance analysis and the dashboard: YouTube long-form, YouTube Shorts and Instagram are
// tracked separately, each against its own baseline at comparable ages, and every published item
// is linked back to its idea, hook, title/thumbnail and script.
import { httpError } from "../auth.js";
import * as google from "../google.js";
import * as ig from "../instagram.js";
import * as yt from "../youtube.js";
import * as gen from "../generate.js";
import { median, describeScore, ageDays, METHOD_TEXT } from "../outliers.js";
import { refreshChannel, upsertVideo, videoKey, rescoreChannel } from "../domain.js";
import { toObjects } from "../csv.js";

const ratio = (v, base) => (v != null && base ? Math.round((v / base) * 100) / 100 : null);
const pct = (x) => (x == null ? null : Math.round(x * 10) / 10);

function ownChannels(store, ws) {
  return store.inWs("channels", ws, (c) => c.list === "own");
}

function lineage(store, ws, item) {
  if (!item) return null;
  const topic = item.topicId ? store.get("topics", item.topicId) : null;
  const script = item.scriptId ? store.get("scripts", item.scriptId) : null;
  const last = script?.versions?.[script.versions.length - 1];
  return {
    itemId: item.id, idea: topic ? { id: topic.id, title: topic.title, question: topic.centralQuestion, origin: topic.origin } : { title: item.title },
    hook: last?.chosenHook || item.hook || topic?.hook || null,
    title: item.finalTitle || item.title, titleOptions: item.titleOptions, thumbnail: item.thumbnailBrief, thumbnailUrl: item.thumbnailUrl || null,
    script: script ? { id: script.id, status: script.status, versions: script.versions.length } : null,
    lessons: item.lessons || "", changes: item.changes || [], experiments: item.experiments || [],
  };
}

function youtubeRows(store, ws, format) {
  const own = ownChannels(store, ws).map((c) => c.id);
  const items = store.inWs("items", ws);
  const vids = store.inWs("videos", ws, (v) => own.includes(v.channelRowId) && v.format === format);
  const a = (v, k) => v.analytics?.[k] ?? null;
  const base = {
    first7: median(vids.map((v) => a(v, "first7"))), first28: median(vids.map((v) => a(v, "first28"))),
    avgViewPercentage: median(vids.map((v) => a(v, "averageViewPercentage") ?? a(v, "avgViewPercentage"))),
    ctr: median(vids.map((v) => a(v, "ctr"))), subscribersGained: median(vids.map((v) => a(v, "subscribersGained"))),
  };
  const rows = vids.sort((x, y) => (y.publishedAt || "").localeCompare(x.publishedAt || "")).map((v) => {
    const item = items.find((i) => i.videoId === v.videoId);
    const avp = a(v, "averageViewPercentage") ?? a(v, "avgViewPercentage");
    return {
      videoId: v.videoId, title: v.title, thumb: v.thumb, publishedAt: v.publishedAt, ageDays: Math.round(ageDays(v.publishedAt)), source: v.source,
      views: v.views, score: v.score, scoreText: describeScore(v.score),
      first7: a(v, "first7"), first7Ratio: ratio(a(v, "first7"), base.first7), first28: a(v, "first28"), first28Ratio: ratio(a(v, "first28"), base.first28),
      avgViewPercentage: pct(avp), avgViewDuration: a(v, "averageViewDuration") ?? a(v, "avgViewDurationSec"),
      impressions: a(v, "impressions"), ctr: a(v, "ctr"), ctrSource: a(v, "ctrSource"), subscribersGained: a(v, "subscribersGained"),
      analyticsSource: v.analytics?.analyticsAt ? "live" : Object.keys(v.analytics || {}).length ? "imported" : null,
      lineage: lineage(store, ws, item),
    };
  });
  return { rows, baseline: base };
}

function instagramRows(store, ws) {
  const media = store.inWs("igMedia", ws);
  const items = store.inWs("items", ws, (i) => i.platform === "instagram");
  const byType = {};
  for (const m of media) if (ageDays(m.publishedAt) >= 7) (byType[m.type === "reel" ? "reel" : "feed"] ??= []).push(m);
  const metric = (m, k) => m.metrics?.[k] ?? null;
  const base = {};
  for (const [t, list] of Object.entries(byType)) base[t] = { reach: median(list.map((m) => metric(m, "reach"))), views: median(list.map((m) => metric(m, "views"))), saved: median(list.map((m) => metric(m, "saved"))), shares: median(list.map((m) => metric(m, "shares"))), n: list.length };
  const rows = media.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "")).map((m) => {
    const t = m.type === "reel" ? "reel" : "feed";
    const b = base[t] || {};
    const item = items.find((i) => i.igPostId && m.plannerId === i.igPostId) || items.find((i) => i.publicationLink && m.permalink && i.publicationLink.startsWith(m.permalink));
    return { ...m, group: t, ageDays: Math.round(ageDays(m.publishedAt)), reachRatio: ratio(metric(m, "reach"), b.reach), viewsRatio: ratio(metric(m, "views"), b.views), savesRatio: ratio(metric(m, "saved"), b.saved), sharesRatio: ratio(metric(m, "shares"), b.shares), comparable: ageDays(m.publishedAt) >= 7, lineage: lineage(store, ws, item) };
  });
  return { rows, baseline: base };
}

// Plain observations from stored numbers only; explanations are produced separately.
function observations(store, ws, v, extra = {}) {
  const obs = [];
  if (v.views != null) obs.push(`${v.views.toLocaleString("en-IN")} views after ${Math.round(ageDays(v.publishedAt))} days (${v.source} data, fetched ${v.fetchedAt?.slice(0, 16).replace("T", " ")} UTC).`);
  obs.push(`Compared with its own channel: ${describeScore(v.score)}`);
  const e = v.score?.engagement;
  if (e != null) obs.push(`Public engagement (likes + comments ÷ views): ${(e * 100).toFixed(2)}%.`);
  const a = v.analytics || {};
  if (a.first7 != null) obs.push(`Views in first 7 days: ${a.first7.toLocaleString("en-IN")}${extra.base?.first7 ? ` (channel median ${Math.round(extra.base.first7).toLocaleString("en-IN")})` : ""}.`);
  if (a.first28 != null) obs.push(`Views in first 28 days: ${a.first28.toLocaleString("en-IN")}${extra.base?.first28 ? ` (channel median ${Math.round(extra.base.first28).toLocaleString("en-IN")})` : ""}.`);
  if (a.ctr != null) obs.push(`Impressions CTR: ${a.ctr}%${a.impressions != null ? ` on ${a.impressions.toLocaleString("en-IN")} impressions` : ""}${extra.base?.ctr ? ` (channel median ${extra.base.ctr}%)` : ""}.`);
  const avp = a.averageViewPercentage ?? a.avgViewPercentage;
  if (avp != null) obs.push(`Average percentage viewed: ${pct(avp)}%${extra.base?.avgViewPercentage ? ` (channel median ${pct(extra.base.avgViewPercentage)}%)` : ""}.`);
  if (a.subscribersGained != null) obs.push(`Subscribers gained: ${a.subscribersGained}.`);
  if (extra.retention) {
    const r = extra.retention;
    if (r.introRetention != null) obs.push(`Audience still watching at 10% of the video: ${r.introRetention}% (relative to views).`);
    for (const d of r.drops) obs.push(`Retention drop of ${d.fall} points between ${Math.round(d.from * 100)}% and ${Math.round(d.to * 100)}% of the video.`);
  }
  if (extra.traffic?.length) {
    const total = extra.traffic.reduce((s, t) => s + (t.views || 0), 0);
    obs.push("Traffic sources: " + extra.traffic.slice(0, 5).map((t) => `${t.insightTrafficSourceType} ${Math.round(((t.views || 0) / total) * 100)}%`).join(", ") + ".");
  }
  return obs;
}

// Rule-based hypotheses for when AI isn't connected. They're tied to one observation each and
// always labelled as hypotheses.
function ruleHypotheses(v, base) {
  const out = [], a = v.analytics || {};
  const avp = a.averageViewPercentage ?? a.avgViewPercentage;
  if (a.ctr != null && base.ctr && a.ctr < base.ctr * 0.8) out.push({ hypothesis: "The title/thumbnail may have attracted fewer clicks than usual.", basedOn: `CTR ${a.ctr}% vs median ${base.ctr}%`, confidence: "medium" });
  if (a.ctr != null && base.ctr && a.ctr > base.ctr * 1.2) out.push({ hypothesis: "The packaging (title/thumbnail) likely helped.", basedOn: `CTR ${a.ctr}% vs median ${base.ctr}%`, confidence: "medium" });
  if (avp != null && base.avgViewPercentage && avp < base.avgViewPercentage * 0.85) out.push({ hypothesis: "The content may not have held viewers as well as usual — check the opening and the biggest drop-off.", basedOn: `Avg % viewed ${pct(avp)} vs median ${pct(base.avgViewPercentage)}`, confidence: "medium" });
  if (v.score?.score != null && v.score.score >= 2 && !out.length) out.push({ hypothesis: "Topic demand or timing may explain the extra reach; no authorised metrics are available to separate packaging from content.", basedOn: describeScore(v.score), confidence: "low" });
  if (v.score?.score != null && v.score.score <= 0.5 && !out.length) out.push({ hypothesis: "Lower reach could come from topic interest, packaging or timing; connect analytics to tell these apart.", basedOn: describeScore(v.score), confidence: "low" });
  return out;
}

async function analysisFor(store, ws, videoId) {
  const v = store.get("videos", videoKey(ws, videoId));
  if (!v) throw httpError(404, "Video isn't stored in this workspace. Refresh its channel or import it first.");
  const ch = v.channelRowId ? store.get("channels", v.channelRowId) : null;
  const isOwn = ch?.list === "own";
  const extra = { base: null };
  const limits = [];
  if (isOwn) {
    extra.base = youtubeRows(store, ws, v.format).baseline;
    const conn = google.connection(store, ws);
    if (conn && conn.channelId === v.channelId) {
      try { extra.retention = google.dropOffs(await google.retention(store, ws, v.videoId)); } catch (e) { limits.push(`Retention unavailable: ${e.message}`); }
      try { extra.traffic = await google.trafficSources(store, ws, v.videoId); } catch (e) { limits.push(`Traffic sources unavailable: ${e.message}`); }
    } else limits.push("Authorised analytics (retention, traffic sources, watch time) need the YouTube connection in Settings.");
    if (v.analytics?.ctr == null) limits.push("No impressions/CTR yet: start reach reports in Settings or import a YouTube Studio CSV.");
  } else {
    limits.push("Competitor/inspiration video: only public data (views, likes, comments, dates, duration) is available. CTR, impressions, retention and watch time are private to the channel owner and are not estimated.");
  }
  return { video: { ...v, scoreText: describeScore(v.score) }, isOwn, channel: ch && { id: ch.id, title: ch.title, list: ch.list }, observed: observations(store, ws, v, extra), retention: extra.retention || null, traffic: extra.traffic || null, limits, method: METHOD_TEXT, base: extra.base };
}

export default [
  ["GET", "/api/ws/:ws/analytics", "viewer", ({ store, ws, query }) => {
    const platform = query.platform || "youtube-long";
    if (platform === "instagram") {
      const { rows, baseline } = instagramRows(store, ws);
      return { platform, rows, baseline, metricsNote: "Instagram has no thumbnail CTR. Posts are compared on reach, views, saves and shares within the same type (Reels vs feed posts), only once they're 7+ days old.", fetchedAt: store.get("usage", "ig-" + ws)?.at || null };
    }
    const { rows, baseline } = youtubeRows(store, ws, platform === "youtube-short" ? "short" : "long");
    return { platform, rows, baseline, metricsNote: "Each video is compared with this channel's own median for the same format. First-7/28-day views (authorised analytics) are the fairest comparison across ages; without them, the age-adjusted outlier score is used.", method: METHOD_TEXT, lastRefreshed: ownChannels(store, ws)[0]?.lastRefreshed || null };
  }],

  ["POST", "/api/ws/:ws/analytics/refresh", "editor", async ({ store, ws }) => {
    const report = [];
    const own = ownChannels(store, ws);
    if (!own.length) throw httpError(400, "Add your own channel in Channels first.");
    for (const c of own) {
      if (yt.youtubeConfigured() && c.ytChannelId) { await refreshChannel(store, ws, c); report.push(`Public data refreshed for ${c.title}.`); }
      else { rescoreChannel(store, ws, c.id); report.push(`${c.title}: no YouTube API key, so only imported data was re-scored.`); }
    }
    const conn = google.connection(store, ws);
    if (conn) {
      const vids = store.inWs("videos", ws, (v) => own.some((c) => c.id === v.channelRowId) && v.channelId === conn.channelId).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "")).slice(0, 30);
      const totals = await google.videoTotals(store, ws, vids.map((v) => v.videoId));
      for (const v of vids) {
        const w = await google.comparableWindows(store, ws, v.videoId, v.publishedAt).catch(() => ({}));
        upsertVideo(store, ws, { videoId: v.videoId, analytics: { ...(totals[v.videoId] || {}), first7: w.first7 ?? null, first28: w.first28 ?? null, analyticsAt: new Date().toISOString() } }, { source: "live" });
      }
      report.push(`Authorised analytics refreshed for ${vids.length} videos.`);
      try {
        const reach = await google.reachByVideo(store, ws);
        if (reach.job) {
          for (const [id, r] of Object.entries(reach.videos)) if (store.get("videos", videoKey(ws, id))) upsertVideo(store, ws, { videoId: id, analytics: { impressions: r.impressions, ctr: r.ctr, ctrSource: `Reach reports ${r.firstDate}–${r.lastDate}` } }, { source: "live" });
          report.push(reach.reports ? `Impressions/CTR from ${reach.reports} daily reach reports.` : "Reach reports started; YouTube hasn't produced the first one yet (allow up to 48 hours).");
        } else report.push("Impressions/CTR: reach reports not started (Settings → Connections).");
      } catch (e) { report.push(`Impressions/CTR unavailable: ${e.message}`); }
    } else report.push("YouTube Analytics not connected: retention, traffic sources and first-7/28-day views unavailable.");
    return { report, at: new Date().toISOString() };
  }],

  ["GET", "/api/ws/:ws/videos/:videoId/analysis", "viewer", ({ store, ws, params }) => analysisFor(store, ws, params.videoId)],

  ["POST", "/api/ws/:ws/videos/:videoId/explain", "editor", async ({ store, ws, params }) => {
    const a = await analysisFor(store, ws, params.videoId);
    try {
      const { data } = await gen.explainPerformance(store, ws, { subject: `${a.isOwn ? "Our" : "A " + (a.channel?.list || "tracked") + " channel's"} video "${a.video.title}" (${a.video.format}).`, observed: [...a.observed, ...a.limits], isCompetitor: !a.isOwn });
      return { ...a, explanation: { ...data, origin: "ai" } };
    } catch (e) {
      if (e.integration !== "ai" || ![402, 503].includes(e.status)) throw e;
      return { ...a, explanation: { likelyExplanations: ruleHypotheses(a.video, a.base || {}), experiments: [], dataGaps: a.limits, origin: "rules", notice: e.message } };
    }
  }],

  // ---- YouTube connection (owner only) ----
  ["GET", "/oauth/google/start/:ws", "owner", async ({ store, ws, user, query, res }) => {
    const location = google.authUrl(store, ws, user.id, { captions: query.captions === "1" });
    await store.persist();
    res.writeHead(302, { location });
    res.end();
  }],

  ["GET", "/oauth/google/callback", "auth", async ({ store, query, res }) => {
    if (query.error) { res.writeHead(302, { location: `/#/settings?connect=denied` }); return res.end(); }
    try {
      const { ws } = await google.finishAuth(store, query);
      await store.persist();
      res.writeHead(302, { location: `/#/settings?ws=${ws}&connect=ok` });
    } catch (e) {
      res.writeHead(302, { location: `/#/settings?connect=error&message=${encodeURIComponent(e.message)}` });
    }
    res.end();
  }],

  ["POST", "/api/ws/:ws/youtube/disconnect", "owner", ({ store, ws }) => { google.disconnect(store, ws); return { ok: true }; }],

  ["POST", "/api/ws/:ws/youtube/reach-job", "owner", async ({ store, ws }) => {
    const job = await google.createReachJob(store, ws);
    return { job, note: "YouTube creates daily reach reports from today; the first usually appears within 48 hours." };
  }],

  // ---- Instagram metrics ----
  ["POST", "/api/ws/:ws/instagram/insights/refresh", "editor", async ({ store, ws, body }) => {
    const accounts = body.account ? [body.account] : Object.keys(ig.insightsAccounts());
    if (!accounts.length) throw httpError(503, "No Instagram insights tokens configured (IG_INSIGHTS_ACCOUNTS). Import a CSV instead.", { integration: "instagramInsights" });
    let n = 0;
    let planner = null;
    try { planner = await ig.plannerState(); } catch { /* optional link to planner posts */ }
    for (const acc of accounts) {
      for (const m of await ig.fetchInsights(acc)) {
        const plannerId = planner?.posts.find((p) => p.permalink && p.permalink === m.permalink)?.id || null;
        const id = `${ws}:ig:${m.mediaId}`;
        const row = { ws, ...m, plannerId, source: "live", fetchedAt: new Date().toISOString() };
        if (store.get("igMedia", id)) store.update("igMedia", id, row); else store.insert("igMedia", { id, ...row });
        n++;
      }
    }
    const id = "ig-" + ws;
    if (store.get("usage", id)) store.update("usage", id, { at: new Date().toISOString() }); else store.insert("usage", { id, at: new Date().toISOString() });
    return { refreshed: n };
  }],

  // CSV columns: permalink (or id), date, type (reel/post/carousel), reach, views, likes, comments, saves, shares, caption
  ["POST", "/api/ws/:ws/instagram/import-csv", "editor", ({ store, ws, body }) => {
    const rows = toObjects(body.csv || "");
    const lc = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase().trim(), v]));
    const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(/[,\s]/g, "")));
    let n = 0;
    for (const raw of rows) {
      const r = lc(raw);
      const key = r.permalink || r["post id"] || r.id;
      const when = new Date(r.date || r["publish time"] || r.timestamp);
      if (!key || isNaN(when)) continue;
      const id = `${ws}:ig:${key.replace(/\W+/g, "_")}`;
      const t = (r.type || r["post type"] || "post").toLowerCase();
      const row = { ws, mediaId: key, account: body.account || r.account || "", caption: r.caption || r.description || "", type: t.includes("reel") ? "reel" : t.includes("carousel") ? "carousel" : "post", permalink: r.permalink || "", publishedAt: when.toISOString(), likes: num(r.likes), comments: num(r.comments), metrics: { reach: num(r.reach), views: num(r.views ?? r.plays), saved: num(r.saves ?? r.saved), shares: num(r.shares) }, source: "imported", fetchedAt: new Date().toISOString() };
      if (store.get("igMedia", id)) store.update("igMedia", id, row); else store.insert("igMedia", { id, ...row });
      n++;
    }
    if (!n) throw httpError(400, "No rows found. The CSV needs a permalink (or id) column plus date, type and metric columns.");
    return { imported: n };
  }],
];
