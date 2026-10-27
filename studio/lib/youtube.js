// YouTube Data API v3 (public data, API key on the server) plus oEmbed for key-less link imports.
// Quota: 10,000 units a day by default. search.list costs 100 units; videos, channels,
// playlistItems and commentThreads cost 1 unit per call. Usage is counted per Pacific day,
// which is when YouTube resets the quota.
import { httpError } from "./auth.js";
import { formatOf } from "./outliers.js";

const BASE = () => process.env.YT_API_BASE || "https://www.googleapis.com/youtube/v3";
export const DAILY_QUOTA = Number(process.env.YT_DAILY_QUOTA || 10000);

export const youtubeConfigured = () => !!process.env.YOUTUBE_API_KEY;

function pacificDay() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export function quotaUsed(store) {
  return store.get("usage", "yt-" + pacificDay())?.units || 0;
}

function spend(store, units) {
  const id = "yt-" + pacificDay();
  const row = store.get("usage", id);
  if (row) store.update("usage", id, { units: row.units + units });
  else store.insert("usage", { id, units });
}

async function call(store, path, params, units) {
  if (!youtubeConfigured()) {
    throw httpError(503, "YouTube Data API is not connected. Add YOUTUBE_API_KEY to the server's .env file.", { integration: "youtubeData" });
  }
  if (quotaUsed(store) + units > DAILY_QUOTA) {
    throw httpError(429, `This would pass today's YouTube quota (${DAILY_QUOTA} units). It resets at midnight Pacific time.`, { integration: "youtubeData" });
  }
  const url = new URL(BASE() + path);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") url.searchParams.set(k, v);
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY);
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (e) {
    throw httpError(502, `Couldn't reach the YouTube API (${e.cause?.code || e.message}).`, { integration: "youtubeData" });
  }
  spend(store, units);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body.error?.errors?.[0]?.reason;
    const msg = {
      quotaExceeded: "YouTube says today's API quota is used up. It resets at midnight Pacific time.",
      keyInvalid: "YouTube rejected the API key. Check YOUTUBE_API_KEY.",
      forbidden: "YouTube refused this request (it may be private or restricted).",
    }[reason] || `YouTube API error: ${body.error?.message || res.status}`;
    throw httpError(res.status === 403 ? 502 : res.status, msg, { integration: "youtubeData" });
  }
  return body;
}

export function isoDurationToSeconds(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return null;
  const [, d, h, min, s] = m.map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

// Works out what a pasted search box value is.
export function parseInput(raw) {
  const s = String(raw || "").trim();
  let m;
  if ((m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/))) return { type: "video", id: m[1] };
  if ((m = s.match(/youtube\.com\/channel\/(UC[\w-]{22})/))) return { type: "channel", id: m[1] };
  if ((m = s.match(/youtube\.com\/@([\w.\-]+)/)) || (m = s.match(/^@([\w.\-]+)$/))) return { type: "handle", handle: m[1] };
  if ((m = s.match(/^(UC[\w-]{22})$/))) return { type: "channel", id: m[1] };
  return { type: "query", q: s };
}

export function normaliseVideo(item) {
  const durationSec = isoDurationToSeconds(item.contentDetails?.duration);
  const st = item.statistics || {};
  const n = (x) => (x == null ? null : Number(x));
  return {
    videoId: item.id,
    title: item.snippet?.title || "",
    description: item.snippet?.description || "",
    channelId: item.snippet?.channelId,
    channelTitle: item.snippet?.channelTitle,
    publishedAt: item.snippet?.publishedAt,
    thumb: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
    tags: item.snippet?.tags || [],
    durationSec,
    format: formatOf(durationSec),
    views: n(st.viewCount),
    likes: n(st.likeCount), // null when the channel hides likes
    comments: n(st.commentCount),
    url: `https://www.youtube.com/watch?v=${item.id}`,
  };
}

export async function videosByIds(store, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const body = await call(store, "/videos", { part: "snippet,contentDetails,statistics", id: ids.slice(i, i + 50).join(",") }, 1);
    out.push(...(body.items || []).map(normaliseVideo));
  }
  return out;
}

export function normaliseChannel(item) {
  return {
    ytChannelId: item.id,
    title: item.snippet?.title,
    handle: item.snippet?.customUrl || null,
    description: item.snippet?.description || "",
    thumb: item.snippet?.thumbnails?.default?.url || null,
    subscribers: item.statistics?.hiddenSubscriberCount ? null : Number(item.statistics?.subscriberCount ?? NaN) || null,
    videoCount: Number(item.statistics?.videoCount ?? 0),
    uploadsPlaylist: item.contentDetails?.relatedPlaylists?.uploads || null,
    url: `https://www.youtube.com/channel/${item.id}`,
  };
}

export async function channelBy(store, { id, handle }) {
  const params = { part: "snippet,statistics,contentDetails" };
  if (id) params.id = id;
  else params.forHandle = handle.startsWith("@") ? handle : "@" + handle;
  const body = await call(store, "/channels", params, 1);
  const item = body.items?.[0];
  if (!item) throw httpError(404, `No YouTube channel found for ${id || "@" + handle}.`);
  return normaliseChannel(item);
}

export async function searchChannels(store, q) {
  const body = await call(store, "/search", { part: "snippet", q, type: "channel", maxResults: 10 }, 100);
  const ids = (body.items || []).map((i) => i.id.channelId).filter(Boolean);
  if (!ids.length) return [];
  const full = await call(store, "/channels", { part: "snippet,statistics,contentDetails", id: ids.join(",") }, 1);
  return (full.items || []).map(normaliseChannel);
}

// options: q, channelId, publishedAfter (ISO), videoDuration (any|short|medium|long), order, maxResults
export async function searchVideos(store, opts) {
  const body = await call(store, "/search", {
    part: "snippet", type: "video", q: opts.q, channelId: opts.channelId,
    publishedAfter: opts.publishedAfter, videoDuration: opts.videoDuration || "any",
    order: opts.order || "relevance", maxResults: Math.min(opts.maxResults || 25, 50),
    relevanceLanguage: opts.relevanceLanguage, regionCode: opts.regionCode,
  }, 100);
  const ids = (body.items || []).map((i) => i.id.videoId).filter(Boolean);
  return ids.length ? videosByIds(store, ids) : [];
}

export async function channelUploads(store, uploadsPlaylist, max = 50) {
  const ids = [];
  let pageToken;
  while (ids.length < max) {
    const body = await call(store, "/playlistItems", { part: "contentDetails", playlistId: uploadsPlaylist, maxResults: 50, pageToken }, 1);
    ids.push(...(body.items || []).map((i) => i.contentDetails.videoId));
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return videosByIds(store, ids.slice(0, max));
}

export async function videoComments(store, videoId, max = 50) {
  const body = await call(store, "/commentThreads", { part: "snippet", videoId, maxResults: Math.min(max, 100), order: "relevance", textFormat: "plainText" }, 1);
  return (body.items || []).map((t) => {
    const c = t.snippet.topLevelComment.snippet;
    return { text: c.textDisplay, likes: c.likeCount, publishedAt: c.publishedAt, videoId };
  });
}

// oEmbed gives title, channel name and thumbnail for any public video without an API key or quota.
export async function oembed(videoId) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + videoId)}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (e) {
    throw httpError(502, `Couldn't reach YouTube to read this link (${e.cause?.code || e.message}).`);
  }
  if (!res.ok) throw httpError(404, "YouTube didn't return details for this link (it may be private or removed).");
  const b = await res.json();
  return { videoId, title: b.title, channelTitle: b.author_name, channelUrl: b.author_url, thumb: b.thumbnail_url, url: `https://www.youtube.com/watch?v=${videoId}` };
}
