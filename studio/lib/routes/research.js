// Channels (own, competitors, inspiration), YouTube search, link and CSV imports, outliers.
import { httpError } from "../auth.js";
import * as yt from "../youtube.js";
import { mapVideoRows, toObjects } from "../csv.js";
import { METHOD_TEXT, describeScore, ageDays } from "../outliers.js";
import { upsertVideo, refreshChannel, rescoreChannel, videoKey } from "../domain.js";

const LISTS = ["own", "competitor", "inspiration"];

function withScoreText(v) {
  return v && { ...v, scoreText: describeScore(v.score) };
}

// Adds stored outlier scores to search results whose channel is tracked in this workspace.
function annotate(store, ws, videos) {
  const channels = store.inWs("channels", ws);
  return videos.map((v) => {
    const stored = store.get("videos", videoKey(ws, v.videoId));
    const ch = channels.find((c) => c.ytChannelId === v.channelId);
    return { ...v, source: "live", tracked: ch ? ch.list : null, score: stored?.score || null, scoreText: stored?.score ? describeScore(stored.score) : ch ? "Refresh the channel to score this video." : "Channel not tracked: add it to compare against its own baseline.", saved: !!store.inWs("references", ws, (r) => r.videoId === v.videoId).length };
  });
}

export default [
  ["GET", "/api/ws/:ws/channels", "viewer", ({ store, ws }) => store.inWs("channels", ws).map((c) => {
    const vids = store.inWs("videos", ws, (v) => v.channelRowId === c.id);
    return { ...c, videoCount: c.videoCount ?? vids.length, storedVideos: vids.length, outliers: vids.filter((v) => v.score?.score >= 2).length };
  })],

  ["POST", "/api/ws/:ws/channels", "editor", async ({ store, ws, body }) => {
    if (!LISTS.includes(body.list)) throw httpError(400, "List must be own, competitor or inspiration.");
    const input = String(body.input || "").trim();
    if (!input) throw httpError(400, "Enter a channel link, @handle or name.");
    let info;
    if (yt.youtubeConfigured()) {
      const parsed = yt.parseInput(input);
      if (parsed.type === "channel") info = await yt.channelBy(store, { id: parsed.id });
      else if (parsed.type === "handle") info = await yt.channelBy(store, { handle: parsed.handle });
      else if (parsed.type === "video") { const [v] = await yt.videosByIds(store, [parsed.id]); if (!v) throw httpError(404, "Video not found."); info = await yt.channelBy(store, { id: v.channelId }); }
      else if (body.ytChannelId) info = await yt.channelBy(store, { id: body.ytChannelId });
      else return { choose: await yt.searchChannels(store, parsed.q) };
      if (store.inWs("channels", ws, (c) => c.ytChannelId === info.ytChannelId).length) throw httpError(409, `${info.title} is already in this workspace.`);
      const ch = store.insert("channels", { ws, list: body.list, notes: body.notes || "", ...info, source: "live" });
      try { await refreshChannel(store, ws, ch); } catch (e) { store.update("channels", ch.id, { lastError: e.message }); }
      return store.get("channels", ch.id);
    }
    // Without an API key a channel can still be listed by hand; its videos come from CSV imports.
    const parsed = yt.parseInput(input);
    return store.insert("channels", { ws, list: body.list, notes: body.notes || "", title: body.title || (parsed.handle ? "@" + parsed.handle : input), handle: parsed.handle ? "@" + parsed.handle : null, ytChannelId: parsed.id || null, url: input.startsWith("http") ? input : parsed.handle ? `https://www.youtube.com/@${parsed.handle}` : null, source: "imported", lastRefreshed: null });
  }],

  ["PATCH", "/api/ws/:ws/channels/:id", "editor", ({ store, ws, params, body }) => {
    const c = store.getInWs("channels", ws, params.id);
    if (!c) throw httpError(404, "Channel not found.");
    const patch = {};
    if (body.list && LISTS.includes(body.list)) patch.list = body.list;
    if ("notes" in body) patch.notes = String(body.notes).slice(0, 4000);
    if ("studyFor" in body) patch.studyFor = Array.isArray(body.studyFor) ? body.studyFor.slice(0, 6) : [];
    return store.update("channels", c.id, patch);
  }],

  ["DELETE", "/api/ws/:ws/channels/:id", "editor", ({ store, ws, params }) => {
    const c = store.getInWs("channels", ws, params.id);
    if (!c) throw httpError(404, "Channel not found.");
    for (const v of store.inWs("videos", ws, (v) => v.channelRowId === c.id)) store.remove("videos", v.id);
    store.remove("channels", c.id);
    return { ok: true };
  }],

  ["POST", "/api/ws/:ws/channels/:id/refresh", "editor", async ({ store, ws, params }) => {
    const c = store.getInWs("channels", ws, params.id);
    if (!c) throw httpError(404, "Channel not found.");
    if (!c.ytChannelId) throw httpError(400, "This channel was added by hand; it can only be updated by CSV import until the YouTube API is connected and it's re-added.");
    try {
      const vids = await refreshChannel(store, ws, c);
      return { channel: store.get("channels", c.id), videos: vids.length };
    } catch (e) {
      store.update("channels", c.id, { lastError: e.message });
      throw e;
    }
  }],

  ["GET", "/api/ws/:ws/channels/:id/videos", "viewer", ({ store, ws, params }) =>
    store.inWs("videos", ws, (v) => v.channelRowId === params.id).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "")).map(withScoreText)],

  ["GET", "/api/ws/:ws/outliers", "viewer", ({ store, ws, query }) => {
    const days = Number(query.days || 90);
    const lists = query.list ? [query.list] : ["competitor", "inspiration"];
    const chans = store.inWs("channels", ws, (c) => lists.includes(c.list));
    const vids = store.inWs("videos", ws, (v) => chans.some((c) => c.id === v.channelRowId) && v.score?.score != null
      && ageDays(v.publishedAt) <= days && (!query.format || v.format === query.format) && v.score.score >= Number(query.min || 2));
    return { method: METHOD_TEXT, videos: vids.sort((a, b) => b.score.score - a.score.score).slice(0, 100).map((v) => ({ ...withScoreText(v), list: chans.find((c) => c.id === v.channelRowId)?.list })) };
  }],

  ["GET", "/api/ws/:ws/method", "viewer", () => ({ method: METHOD_TEXT })],

  // Search: keywords/topics, channel names, channel links or video links.
  ["POST", "/api/ws/:ws/search", "viewer", async ({ store, ws, body }) => {
    const parsed = yt.parseInput(body.input);
    const periodDays = { week: 7, month: 30, quarter: 90, year: 365 }[body.period];
    const publishedAfter = periodDays ? new Date(Date.now() - periodDays * 864e5).toISOString() : undefined;
    const duration = { short: "short", long: "long", medium: "medium" }[body.format] || "any";
    let videos = [], channels = [];
    if (parsed.type === "video") videos = await yt.videosByIds(store, [parsed.id]);
    else if (parsed.type === "channel" || parsed.type === "handle") {
      const ch = await yt.channelBy(store, parsed.type === "channel" ? { id: parsed.id } : { handle: parsed.handle });
      channels = [ch];
      videos = ch.uploadsPlaylist ? await yt.channelUploads(store, ch.uploadsPlaylist, 30) : [];
    } else {
      if (!parsed.q) throw httpError(400, "Type a keyword, topic, channel name or YouTube link.");
      const tracked = body.channelRowId ? store.getInWs("channels", ws, body.channelRowId) : null;
      if (body.mode === "channels") channels = await yt.searchChannels(store, parsed.q);
      else videos = await yt.searchVideos(store, { q: parsed.q, channelId: tracked?.ytChannelId, publishedAfter, videoDuration: duration === "short" ? "short" : duration, order: body.order || "relevance", maxResults: 25 });
    }
    if (body.format === "short") videos = videos.filter((v) => v.format === "short");
    if (body.format === "long") videos = videos.filter((v) => v.format === "long");
    if (publishedAfter && parsed.type !== "query") videos = videos.filter((v) => v.publishedAt >= publishedAfter);
    let out = annotate(store, ws, videos);
    if (body.minScore) out = out.filter((v) => v.score?.score >= Number(body.minScore));
    return { videos: out, channels, quotaUsed: yt.quotaUsed(store), fetchedAt: new Date().toISOString() };
  }],

  // A single video by link: full data with the API key, otherwise oEmbed (title, channel, thumbnail).
  ["POST", "/api/ws/:ws/videos/lookup", "viewer", async ({ store, ws, body }) => {
    const parsed = yt.parseInput(body.url);
    if (parsed.type !== "video") throw httpError(400, "Paste a YouTube video link.");
    if (yt.youtubeConfigured()) {
      const [v] = await yt.videosByIds(store, [parsed.id]);
      if (!v) throw httpError(404, "Video not found or private.");
      return { video: annotate(store, ws, [v])[0] };
    }
    const v = await yt.oembed(parsed.id);
    return { video: { ...v, source: "imported", partial: true, scoreText: "Only title, channel and thumbnail are available without the YouTube API key." } };
  }],

  // CSV import (YouTube Studio export or a simple sheet) into a channel.
  ["POST", "/api/ws/:ws/videos/import-csv", "editor", ({ store, ws, body }) => {
    const ch = store.getInWs("channels", ws, body.channelRowId);
    if (!ch) throw httpError(400, "Choose the channel these videos belong to.");
    const { videos, mapped, unmapped } = mapVideoRows(toObjects(body.csv || ""));
    if (!videos.length) throw httpError(400, "No video rows found. The CSV needs at least a video ID (or URL) and title column.");
    for (const v of videos) upsertVideo(store, ws, { ...v, channelTitle: ch.title, channelId: ch.ytChannelId }, { source: "imported", channelRowId: ch.id });
    store.update("channels", ch.id, { lastImported: new Date().toISOString() });
    rescoreChannel(store, ws, ch.id);
    return { imported: videos.length, mapped, unmapped };
  }],

  ["GET", "/api/ws/:ws/videos/:videoId", "viewer", ({ store, ws, params }) => {
    const v = store.get("videos", videoKey(ws, params.videoId));
    if (!v) throw httpError(404, "This video isn't stored in the workspace yet.");
    return withScoreText(v);
  }],
];
