// CSV parsing (RFC 4180 quotes) and the column mapping for YouTube Studio / Instagram exports.

export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  text = String(text).replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export function toObjects(text) {
  const [head, ...rows] = parseCSV(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

export function csvField(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Header aliases for YouTube Studio's "Advanced mode" export and simple hand-made sheets.
const ALIASES = {
  videoId: ["content", "video id", "video", "videoid", "id"],
  title: ["video title", "title"],
  publishedAt: ["video publish time", "publish time", "published", "published at", "date", "upload date"],
  durationSec: ["duration", "duration (seconds)", "length"],
  views: ["views"],
  likes: ["likes"],
  comments: ["comments added", "comments"],
  watchHours: ["watch time (hours)", "watch time hours"],
  subscribersGained: ["subscribers gained", "subscribers"],
  impressions: ["impressions"],
  ctr: ["impressions click-through rate (%)", "impressions ctr", "ctr", "click-through rate"],
  avgViewDuration: ["average view duration", "avg view duration"],
  avgViewPercentage: ["average percentage viewed (%)", "average percentage viewed", "avg % viewed"],
  channel: ["channel", "channel name"],
  url: ["url", "link", "video url"],
};

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// "1:02:03", "12:30" or seconds -> seconds
export function durationToSeconds(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const parts = s.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function mapVideoRows(rows) {
  if (!rows.length) return { videos: [], unmapped: [] };
  const headers = Object.keys(rows[0]);
  const map = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    const h = headers.find((x) => names.includes(x.toLowerCase()));
    if (h) map[field] = h;
  }
  const videos = [];
  for (const r of rows) {
    const get = (f) => (map[f] ? r[map[f]] : undefined);
    let id = get("videoId") || "";
    const url = get("url") || "";
    const fromUrl = url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
    if (fromUrl) id = fromUrl[1];
    if (!id || /^total$/i.test(id) || !get("title")) continue; // Studio puts a "Total" row first
    const published = get("publishedAt") ? new Date(get("publishedAt")) : null;
    videos.push({
      videoId: id,
      title: get("title"),
      publishedAt: published && !isNaN(published) ? published.toISOString() : null,
      durationSec: durationToSeconds(get("durationSec")),
      views: num(get("views")),
      likes: num(get("likes")),
      comments: num(get("comments")),
      channel: get("channel") || null,
      analytics: Object.fromEntries(Object.entries({
        watchHours: num(get("watchHours")),
        subscribersGained: num(get("subscribersGained")),
        impressions: num(get("impressions")),
        ctr: num(get("ctr")),
        avgViewDurationSec: durationToSeconds(get("avgViewDuration")),
        avgViewPercentage: num(get("avgViewPercentage")),
      }).filter(([, v]) => v != null)),
    });
  }
  return { videos, mapped: map, unmapped: headers.filter((h) => !Object.values(map).includes(h)) };
}
