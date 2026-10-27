// Shared operations on channels, videos and topics used by the API routes and the research run.
import * as yt from "./youtube.js";
import { scoreChannel, formatOf } from "./outliers.js";
import { findOverlaps } from "./overlap.js";

export const videoKey = (ws, videoId) => `${ws}:${videoId}`;

// Inserts or updates a video and keeps a view-count snapshot history, which later allows
// "views at the same age" comparisons.
export function upsertVideo(store, ws, v, { source, channelRowId = null }) {
  const id = videoKey(ws, v.videoId);
  const now = new Date().toISOString();
  const prev = store.get("videos", id);
  const snapshots = [...(prev?.snapshots || [])];
  if (Number.isFinite(v.views)) {
    const last = snapshots[snapshots.length - 1];
    if (!last || last.views !== v.views || Date.now() - new Date(last.at) > 12 * 3600e3) snapshots.push({ at: now, views: v.views });
  }
  const row = {
    ws, videoId: v.videoId, title: v.title ?? prev?.title, description: v.description ?? prev?.description ?? "",
    channelId: v.channelId ?? prev?.channelId ?? null, channelTitle: v.channelTitle ?? prev?.channelTitle ?? null,
    channelRowId: channelRowId ?? prev?.channelRowId ?? null,
    publishedAt: v.publishedAt ?? prev?.publishedAt ?? null, thumb: v.thumb ?? prev?.thumb ?? `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
    durationSec: v.durationSec ?? prev?.durationSec ?? null, format: formatOf(v.durationSec ?? prev?.durationSec),
    views: v.views ?? prev?.views ?? null, likes: v.likes ?? prev?.likes ?? null, comments: v.comments ?? prev?.comments ?? null,
    tags: v.tags ?? prev?.tags ?? [], url: `https://www.youtube.com/watch?v=${v.videoId}`,
    source: source === "live" || prev?.source !== "live" ? source : prev.source,
    fetchedAt: now, snapshots: snapshots.slice(-60),
    analytics: { ...(prev?.analytics || {}), ...(v.analytics || {}) },
  };
  return prev ? store.update("videos", id, row) : store.insert("videos", { id, ...row });
}

export function rescoreChannel(store, ws, channelRowId) {
  const vids = store.inWs("videos", ws, (v) => v.channelRowId === channelRowId);
  const scores = scoreChannel(vids);
  for (const v of vids) store.update("videos", v.id, { score: scores.get(v.id) });
  return vids;
}

export async function refreshChannel(store, ws, ch, { max = 50 } = {}) {
  const fresh = await yt.channelBy(store, { id: ch.ytChannelId });
  const videos = fresh.uploadsPlaylist ? await yt.channelUploads(store, fresh.uploadsPlaylist, max) : [];
  for (const v of videos) upsertVideo(store, ws, v, { source: "live", channelRowId: ch.id });
  store.update("channels", ch.id, { ...fresh, source: "live", lastRefreshed: new Date().toISOString(), lastError: null });
  return rescoreChannel(store, ws, ch.id);
}

export function overlapCandidates(store, ws) {
  const own = store.inWs("channels", ws, (c) => c.list === "own").map((c) => c.id);
  return [
    ...store.inWs("videos", ws, (v) => own.includes(v.channelRowId)).map((v) => ({ id: v.id, kind: "published video", title: v.title })),
    ...store.inWs("items", ws).map((i) => ({ id: i.id, kind: i.stage === "Published" ? "published item" : "pipeline item", title: i.title, status: i.stage })),
    ...store.inWs("topics", ws).map((t) => ({ id: t.id, kind: t.status === "rejected" ? "rejected idea" : "topic", title: t.title, text: t.centralQuestion, status: t.status })),
  ];
}

export function checkOverlap(store, ws, text, excludeId) {
  return findOverlaps(text, overlapCandidates(store, ws), { excludeId });
}

const QUESTION = /\?|^(kya|kaise|kyu|kyun|kab|kaun|kitna|kitne|how|what|why|when|which|should|can|is|are|does|do)\b/i;
export function extractQuestions(comments) {
  return comments
    .map((c) => ({ ...c, text: c.text.replace(/\s+/g, " ").trim() }))
    .filter((c) => c.text.length >= 15 && c.text.length <= 400 && QUESTION.test(c.text))
    .sort((a, b) => (b.likes || 0) - (a.likes || 0));
}

export function addReview(store, ws, item) {
  return store.insert("reviews", { ws, decision: "pending", ...item });
}
