// Outlier scoring: each video is compared with its OWN channel's typical performance for the
// same format, never with raw views across channels. The method is returned with every score
// so the app can explain it.

export const SHORT_MAX_SECONDS = 180; // YouTube Shorts can be up to 3 minutes long.
export const MATURE_DAYS = 28;
export const MIN_PEERS = 5;

export const METHOD_TEXT = [
  "Each video is compared only with videos from the same channel and the same format (Shorts vs long-form).",
  "Format comes from duration: 3 minutes or less counts as a likely Short. The public API has no Shorts flag, so this is an estimate.",
  `Videos ${MATURE_DAYS}+ days old: score = views ÷ median views of the channel's other same-format videos that are also ${MATURE_DAYS}+ days old.`,
  "Younger videos, when the app has stored view snapshots: score = views ÷ median views the channel's other videos had at a similar age (±25%). This is the most comparable measure and builds up as the app refreshes channels over time.",
  "Younger videos without snapshots: score = views per day ÷ the channel's median views per day for same-format videos aged 3–60 days. Early views decay, so this is marked low confidence.",
  `A score needs at least ${MIN_PEERS} comparable videos; otherwise the baseline is reported as insufficient. Videos under 2 days old are not scored.`,
  "Labels: 3× or more = strong outlier, 2× = outlier, 0.5× or less = underperformer. Engagement = (likes + comments) ÷ views, where public counts exist.",
];

export function formatOf(durationSec) {
  if (durationSec == null) return "unknown";
  return durationSec <= SHORT_MAX_SECONDS ? "short" : "long";
}

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function ageDays(publishedAt, now = Date.now()) {
  return Math.max(0, (now - new Date(publishedAt).getTime()) / 864e5);
}

// Views a video had at a given age, interpolated from stored snapshots ({at, views}).
export function viewsAtAge(video, targetDays) {
  const pub = new Date(video.publishedAt).getTime();
  const points = (video.snapshots || [])
    .map((s) => ({ d: (new Date(s.at).getTime() - pub) / 864e5, v: s.views }))
    .filter((p) => Number.isFinite(p.v))
    .sort((a, b) => a.d - b.d);
  if (!points.length) return null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (Math.abs(p.d - targetDays) <= targetDays * 0.25) return p.v;
    if (p.d > targetDays && i > 0) {
      const a = points[i - 1];
      if (targetDays - a.d <= targetDays * 0.5) return a.v + ((p.v - a.v) * (targetDays - a.d)) / (p.d - a.d);
    }
  }
  return null;
}

export function label(score) {
  if (score == null) return "unscored";
  if (score >= 3) return "strong outlier";
  if (score >= 2) return "outlier";
  if (score <= 0.5) return "underperformer";
  return "typical";
}

export function engagement(v) {
  if (!v.views || (v.likes == null && v.comments == null)) return null;
  return ((v.likes || 0) + (v.comments || 0)) / v.views;
}

// Scores every video of one channel. `videos` are that channel's videos.
export function scoreChannel(videos, now = Date.now()) {
  const out = new Map();
  const byFormat = {};
  for (const v of videos) (byFormat[formatOf(v.durationSec)] ??= []).push(v);

  for (const v of videos) {
    const format = formatOf(v.durationSec);
    const peers = byFormat[format].filter((p) => p.id !== v.id && Number.isFinite(p.views) && p.publishedAt);
    const age = ageDays(v.publishedAt, now);
    const result = { score: null, label: "unscored", method: null, confidence: null, baseline: null, peers: 0, format, ageDays: Math.round(age), engagement: engagement(v) };
    out.set(v.id, result);
    if (!Number.isFinite(v.views)) { result.reason = "No view count available."; continue; }
    if (!v.publishedAt || isNaN(new Date(v.publishedAt))) { result.reason = "No publish date, so age can't be accounted for."; continue; }
    if (age < 2) { result.reason = "Too new to judge (under 2 days)."; continue; }

    if (age >= MATURE_DAYS) {
      const mature = peers.filter((p) => ageDays(p.publishedAt, now) >= MATURE_DAYS);
      result.peers = mature.length;
      if (mature.length < MIN_PEERS) { result.reason = `Only ${mature.length} comparable ${format} videos; need ${MIN_PEERS}.`; continue; }
      result.baseline = median(mature.map((p) => p.views));
      result.method = "mature-median";
      result.confidence = mature.length >= 15 ? "high" : "medium";
    } else {
      const atAge = peers.map((p) => viewsAtAge(p, age)).filter((x) => x != null);
      if (atAge.length >= MIN_PEERS) {
        result.peers = atAge.length;
        result.baseline = median(atAge);
        result.method = "same-age-snapshots";
        result.confidence = "high";
      } else {
        const young = peers.filter((p) => { const a = ageDays(p.publishedAt, now); return a >= 3 && a <= 60; });
        result.peers = young.length;
        if (young.length < MIN_PEERS) { result.reason = `Only ${young.length} same-format videos aged 3–60 days; need ${MIN_PEERS}.`; continue; }
        const rate = median(young.map((p) => p.views / ageDays(p.publishedAt, now)));
        result.baseline = rate * age;
        result.method = "views-per-day";
        result.confidence = "low";
      }
    }
    if (result.baseline > 0) {
      result.score = Math.round((v.views / result.baseline) * 100) / 100;
      result.label = label(result.score);
    }
  }
  return out;
}

export function describeScore(s) {
  if (!s || s.score == null) return s?.reason || "Not scored.";
  const how = {
    "mature-median": `median of ${s.peers} older ${s.format} videos on the same channel`,
    "same-age-snapshots": `median views of ${s.peers} same-channel ${s.format} videos at about ${s.ageDays} days old`,
    "views-per-day": `the channel's median daily views for ${s.peers} recent ${s.format} videos (early signal)`,
  }[s.method];
  return `${s.score}× ${how} (baseline ≈ ${Math.round(s.baseline).toLocaleString("en-IN")} views, ${s.confidence} confidence).`;
}
