// Sample data for the separate "Demo workspace". Every row is marked source "demo", the channels
// are fictional, and none of it is ever mixed into a real workspace.
import { upsertVideo, rescoreChannel } from "./domain.js";

const DAY = 864e5;

function series(n, base, seed) {
  let x = seed;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, (_, i) => ({ age: 6 + i * 5, views: Math.round(base * (0.55 + rnd() * 0.9)) }));
}

export function seedDemo(store, ws, userId) {
  store.update("workspaces", ws, { profile: {
    youtubeUrl: "", instagramUrls: [], niche: "Demo: exam preparation and careers for commerce students",
    audience: "Demo audience: commerce students preparing for professional exams", pillars: ["Exam strategy", "Career choices", "Student life"],
    scriptLanguage: "Natural Hindi-English (Hinglish, Roman script)", titleLanguage: "English", tone: "Friendly mentor", formats: ["Long-form 12 min", "Shorts 45 s"], lengths: "", notes: "This workspace contains sample data only.",
  } });
  const channels = [
    { list: "own", title: "Demo Own Channel", base: 40000, seed: 3 },
    { list: "competitor", title: "Demo Competitor One", base: 25000, seed: 7 },
    { list: "inspiration", title: "Demo Storytelling Channel", base: 300000, seed: 11 },
  ];
  const topics = ["How to plan the last 30 days", "Is this career path worth it", "Mistakes students make in mock tests", "What toppers do differently", "Articleship vs job", "Should you take a drop year", "Revision system that works", "Exam day routine", "Why results feel unfair", "How to handle parents' pressure", "Self-study vs coaching", "Salary reality check"];
  for (const c of channels) {
    const ch = store.insert("channels", { ws, list: c.list, title: c.title, handle: null, ytChannelId: null, source: "demo", lastRefreshed: new Date().toISOString(), notes: "Sample channel" });
    series(12, c.base, c.seed).forEach((s, i) => {
      const views = i === 1 ? s.views * 4 : i === 4 ? Math.round(s.views * 0.35) : s.views;
      upsertVideo(store, ws, { videoId: `demo${c.seed}x${i}`.padEnd(11, "0").slice(0, 11), title: `${topics[i]} (sample)`, channelTitle: c.title, publishedAt: new Date(Date.now() - s.age * DAY).toISOString(), durationSec: i % 4 === 3 ? 50 : 720, views, likes: Math.round(views * 0.04), comments: Math.round(views * 0.004), thumb: null }, { source: "demo", channelRowId: ch.id });
    });
    rescoreChannel(store, ws, ch.id);
  }
  store.insert("references", { ws, kind: "note", title: "Sample hook example", text: "Agar aapka mock test score gir raha hai, toh problem padhai nahi — revision ka system hai.", categories: ["hooks"], tags: ["sample"], approvedExample: true, createdBy: userId, source: "demo" });
  store.insert("topics", { ws, title: "Sample: Why mock test scores drop before the exam", centralQuestion: "Is a falling mock score a bad sign?", whyAudience: "Sample card", whyNow: "Sample card", angle: "Sample card", titles: ["Sample title A", "Sample title B", "Sample title C"], thumbnailConcept: "Sample", hook: "Sample hook", format: "long-form", tags: ["educational"], sources: [], researchGaps: "Sample data — not real research.", confidence: "low", status: "suggested", origin: "demo", overlap: [] });
}
