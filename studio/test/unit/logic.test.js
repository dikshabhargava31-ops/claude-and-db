import test from "node:test";
import assert from "node:assert/strict";
import { scoreChannel, formatOf, median, viewsAtAge } from "../../lib/outliers.js";
import { similarity, findOverlaps } from "../../lib/overlap.js";
import { parseCSV, mapVideoRows, toObjects, durationToSeconds } from "../../lib/csv.js";
import { validatePost, parseIST, makePostId, csvRow } from "../../lib/instagram.js";
import { dueNow } from "../../lib/research.js";
import { parseInput, isoDurationToSeconds } from "../../lib/youtube.js";
import { hashPassword, checkPassword } from "../../lib/auth.js";
import { dropOffs } from "../../lib/google.js";
import { claimsFrom } from "../../lib/routes/content.js";

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 27);
const vid = (id, ageDays, views, durationSec = 700, snapshots) => ({ id, publishedAt: new Date(NOW - ageDays * DAY).toISOString(), views, durationSec, snapshots });

test("format comes from duration (Shorts up to 3 minutes)", () => {
  assert.equal(formatOf(59), "short");
  assert.equal(formatOf(180), "short");
  assert.equal(formatOf(181), "long");
  assert.equal(formatOf(null), "unknown");
});

test("mature videos are compared with the channel's own same-format median", () => {
  const vids = [vid("a", 40, 1000), vid("b", 50, 1200), vid("c", 60, 800), vid("d", 70, 1000), vid("e", 80, 1100), vid("f", 90, 5000), vid("s1", 40, 90000, 30)];
  const s = scoreChannel(vids, NOW);
  assert.equal(s.get("f").method, "mature-median");
  assert.equal(s.get("f").score, 5); // 5000 / median(1000,1200,800,1000,1100)
  assert.equal(s.get("f").label, "strong outlier");
  // The Short is not compared with long videos, and has no Short peers.
  assert.equal(s.get("s1").score, null);
  assert.match(s.get("s1").reason, /comparable short/);
});

test("raw views alone never make an outlier across channels", () => {
  const big = scoreChannel([vid("a", 40, 1e6), vid("b", 41, 1e6), vid("c", 42, 1e6), vid("d", 43, 1e6), vid("e", 44, 1e6), vid("f", 45, 1e6)], NOW);
  assert.equal(big.get("f").score, 1);
  assert.equal(big.get("f").label, "typical");
});

test("too few comparable videos or too new: not scored", () => {
  const s = scoreChannel([vid("a", 40, 100), vid("b", 41, 100), vid("c", 1, 100)], NOW);
  assert.equal(s.get("a").score, null);
  assert.match(s.get("c").reason, /Too new/);
});

test("young videos use same-age snapshots when available", () => {
  const snap = (age, views) => ({ at: new Date(NOW - (40 - age) * DAY).toISOString(), views });
  const peers = ["p1", "p2", "p3", "p4", "p5"].map((id) => vid(id, 40, 10000, 700, [snap(9, 2000), snap(11, 2200)]));
  const s = scoreChannel([...peers, vid("new", 10, 8000)], NOW);
  assert.equal(s.get("new").method, "same-age-snapshots");
  assert.ok(s.get("new").score > 3);
  assert.equal(s.get("new").confidence, "high");
});

test("viewsAtAge interpolates between snapshots", () => {
  const v = vid("x", 30, 0, 700, [{ at: new Date(NOW - 25 * DAY).toISOString(), views: 100 }, { at: new Date(NOW - 15 * DAY).toISOString(), views: 300 }]);
  assert.equal(viewsAtAge(v, 10), 200);
  assert.equal(median([3, 1, 2]), 2);
});

test("duplicate detection across English and Hinglish wording", () => {
  assert.ok(similarity("CA Inter result ke baad kya karein", "What to do after the CA Inter result") >= 0.45);
  assert.ok(similarity("Articleship in Big 4 vs small firm", "Best budget phones 2026") < 0.2);
  const o = findOverlaps("Big 4 articleship vs small firm", [{ id: "1", kind: "published video", title: "Articleship: Big 4 or small firm?" }, { id: "2", kind: "topic", title: "Budget phones" }]);
  assert.equal(o.length, 1);
  assert.equal(o[0].id, "1");
});

test("CSV parsing with quotes, commas and line breaks", () => {
  const rows = parseCSV('a,b\n"x, y","line1\nline2"\n');
  assert.deepEqual(rows, [["a", "b"], ["x, y", "line1\nline2"]]);
});

test("YouTube Studio export columns map to video fields; Total row skipped", () => {
  const csv = "Content,Video title,Video publish time,Duration,Views,Impressions,Impressions click-through rate (%),Average percentage viewed (%)\nTotal,,,,1000,,,\nabcdefghijk,My video,\"Oct 1, 2026\",754,500,10000,5.1,42.3\n";
  const { videos } = mapVideoRows(toObjects(csv));
  assert.equal(videos.length, 1);
  assert.equal(videos[0].videoId, "abcdefghijk");
  assert.equal(videos[0].durationSec, 754);
  assert.equal(videos[0].analytics.ctr, 5.1);
  assert.equal(videos[0].analytics.avgViewPercentage, 42.3);
  assert.equal(durationToSeconds("1:02:03"), 3723);
});

test("Instagram post validation mirrors the scheduler's rules", () => {
  const accounts = { ipa: "ipa_institute_ajmer" };
  const future = new Date(Date.now() + 3 * DAY + 5.5 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
  assert.deepEqual(validatePost({ account: "ipa", publish_at: future, type: "reel", media: "https://x.org/a.mp4", caption: "Hi" }, accounts), []);
  assert.ok(validatePost({ account: "ipa", publish_at: future, type: "reel", media: "https://x.org/a.jpg" }, accounts).some((p) => /reel needs/.test(p)));
  assert.ok(validatePost({ account: "nope", publish_at: future, type: "post", media: "http://x.org/a.jpg" }, accounts).length >= 2);
  assert.ok(validatePost({ account: "ipa", publish_at: "2020-01-01 10:00", type: "post", media: "https://x.org/a.jpg" }, accounts).some((p) => /past/.test(p)));
  assert.ok(validatePost({ account: "ipa", publish_at: future, type: "carousel", media: "https://x.org/a.jpg" }, accounts).some((p) => /carousel/.test(p)));
  assert.equal(parseIST("2026-11-01 18:30").toISOString(), "2026-11-01T13:00:00.000Z");
  assert.match(makePostId("ipa", "2026-11-01 18:30"), /^ipa-20261101-1830-[a-z0-9]{4}$/);
  assert.equal(csvRow({ id: "x", account: "ipa", publish_at: "2026-11-01 18:30", type: "post", media: "https://a", caption: "a, b", first_comment: "" }), 'x,ipa,2026-11-01 18:30,post,https://a,"a, b",');
});

test("scheduled research runs: daily and weekly in India time, once per day", () => {
  const at = (iso) => new Date(iso);
  const daily = { frequency: "daily", time: "07:30" };
  assert.equal(dueNow(daily, null, at("2026-10-27T01:59:00Z")), false); // 07:29 IST
  assert.equal(dueNow(daily, null, at("2026-10-27T02:00:00Z")), true); // 07:30 IST
  assert.equal(dueNow(daily, "2026-10-27T02:00:00Z", at("2026-10-27T05:00:00Z")), false);
  assert.equal(dueNow({ frequency: "weekly", time: "07:30", weekday: 1 }, null, at("2026-10-27T03:00:00Z")), false); // Tuesday
  assert.equal(dueNow({ frequency: "off" }, null, at("2026-10-27T03:00:00Z")), false);
});

test("YouTube inputs and durations", () => {
  assert.deepEqual(parseInput("https://youtu.be/dQw4w9WgXcQ"), { type: "video", id: "dQw4w9WgXcQ" });
  assert.deepEqual(parseInput("https://www.youtube.com/shorts/dQw4w9WgXcQ"), { type: "video", id: "dQw4w9WgXcQ" });
  assert.deepEqual(parseInput("@camahendrasir"), { type: "handle", handle: "camahendrasir" });
  assert.deepEqual(parseInput("https://www.youtube.com/@camahendrasir/videos"), { type: "handle", handle: "camahendrasir" });
  assert.deepEqual(parseInput("CA result analysis"), { type: "query", q: "CA result analysis" });
  assert.equal(isoDurationToSeconds("PT1H2M3S"), 3723);
  assert.equal(isoDurationToSeconds("PT45S"), 45);
});

test("passwords are hashed and checked", () => {
  const h = hashPassword("correct horse battery");
  assert.ok(!h.includes("correct"));
  assert.ok(checkPassword("correct horse battery", h));
  assert.ok(!checkPassword("wrong", h));
});

test("retention drop-offs and claims to verify", () => {
  const curve = [0, 0.1, 0.2, 0.3].map((r, i) => ({ elapsedVideoTimeRatio: r, audienceWatchRatio: [1, 0.7, 0.66, 0.5][i] }));
  const d = dropOffs(curve);
  assert.equal(d.introRetention, 70);
  assert.equal(d.drops[0].fall, 30);
  assert.deepEqual(claimsFrom([{ text: "As per ICAI [VERIFY: pass rate 12%] and [verify: exam date]" }]), ["pass rate 12%", "exam date"]);
});
