// The AI research assistant: a chat tied to the current workspace. It retrieves workspace data
// through tools (references, outliers, channel videos, analysis, topics), can search YouTube and
// the web, shows its sources, and lets the user save outputs as topics, references, tasks or scripts.
import { httpError } from "../auth.js";
import * as ai from "../ai.js";
import * as yt from "../youtube.js";
import { relevantReferences, approvedPreferences } from "../retrieve.js";
import { describeScore, ageDays } from "../outliers.js";
import { checkOverlap, videoKey } from "../domain.js";

const obj = (props, required = Object.keys(props)) => ({ type: "object", properties: props, required, additionalProperties: false });
const s = { type: "string" };
const i = { type: "integer" };

const TOOLS = [
  { name: "search_saved_references", description: "Search this workspace's saved reference library (links, transcripts, notes, approved hook/title examples). Use before writing hooks, titles or scripts, and whenever the user mentions a saved reference.", input_schema: obj({ query: s, category: { type: "string", enum: ["", "topic-research", "titles", "thumbnails", "hooks", "script-structures", "editing-styles", "visual-storytelling"] } }), strict: true },
  { name: "find_outliers", description: "List videos performing well above their own channel's baseline (age- and format-adjusted) among saved channels. Returns score, method and data source.", input_schema: obj({ days: i, list: { type: "string", enum: ["competitor", "inspiration", "own", "all"] }, format: { type: "string", enum: ["any", "long", "short"] } }), strict: true },
  { name: "get_channel_videos", description: "Recent stored videos of a saved channel with views, dates, duration and outlier scores. Use channel 'mine' for the workspace's own channel. Good for studying a channel's title and thumbnail patterns.", input_schema: obj({ channel: s, limit: i }), strict: true },
  { name: "get_video_details", description: "Stored data for one video: public stats, outlier score, and (for our own videos) any authorised analytics such as first-7/28-day views, CTR and average percentage viewed.", input_schema: obj({ video_id: s }), strict: true },
  { name: "my_performance_summary", description: "Our own channel's strongest and weakest videos relative to our baseline, per format.", input_schema: obj({}), strict: true },
  { name: "list_topics", description: "Topics in the workspace by status (suggested, shortlisted, rejected) — use to avoid repeating ideas.", input_schema: obj({ status: { type: "string", enum: ["suggested", "shortlisted", "rejected", "all"] } }), strict: true },
  { name: "search_youtube", description: "Live YouTube search (costs 100 of the daily 10,000 quota units). Use only when stored data isn't enough.", input_schema: obj({ query: s, days: i }), strict: true },
];

function compact(v) {
  return { video_id: v.videoId, title: v.title, channel: v.channelTitle, published: v.publishedAt?.slice(0, 10), duration_s: v.durationSec, format: v.format, views: v.views, likes: v.likes, comments: v.comments, data_source: v.source, outlier: v.score?.score ?? null, outlier_explained: describeScore(v.score) };
}

async function runTool(store, ws, name, input, log) {
  const own = store.inWs("channels", ws, (c) => c.list === "own").map((c) => c.id);
  switch (name) {
    case "search_saved_references": {
      const refs = relevantReferences(store, ws, input.query, { categories: input.category ? [input.category] : undefined, limit: 6 });
      refs.forEach((r) => log.push({ kind: "reference", id: r.id, title: r.title, url: r.url }));
      return { references: refs.map((r) => ({ id: r.id, title: r.title, approved_example: r.approvedExample, categories: r.categories, url: r.url, summary: r.summary, text_excerpt: r.text.slice(0, 1500), why_matched: r.reason })), approved_preferences: approvedPreferences(store, ws).map((p) => p.statement) };
    }
    case "find_outliers": {
      const lists = input.list === "all" ? ["competitor", "inspiration", "own"] : [input.list];
      const chans = store.inWs("channels", ws, (c) => lists.includes(c.list));
      const vids = store.inWs("videos", ws, (v) => chans.some((c) => c.id === v.channelRowId) && v.score?.score >= 2 && ageDays(v.publishedAt) <= (input.days || 90) && (input.format === "any" || v.format === input.format))
        .sort((a, b) => b.score.score - a.score.score).slice(0, 15);
      vids.forEach((v) => log.push({ kind: "video", id: v.videoId, title: v.title, url: v.url }));
      const stale = chans.filter((c) => !c.lastRefreshed || Date.now() - new Date(c.lastRefreshed) > 3 * 864e5).map((c) => c.title);
      return { outliers: vids.map(compact), channels_checked: chans.length, stale_channels: stale, note: chans.length ? "" : "No saved channels in this list." };
    }
    case "get_channel_videos": {
      const q = String(input.channel || "").toLowerCase();
      const ch = q === "mine" ? store.inWs("channels", ws, (c) => c.list === "own")[0] : store.inWs("channels", ws, (c) => (c.title || "").toLowerCase().includes(q) || (c.handle || "").toLowerCase().includes(q))[0];
      if (!ch) return { error: `No saved channel matches "${input.channel}". Saved: ${store.inWs("channels", ws).map((c) => c.title).join(", ") || "none"}` };
      const vids = store.inWs("videos", ws, (v) => v.channelRowId === ch.id).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "")).slice(0, Math.min(input.limit || 20, 50));
      log.push({ kind: "channel", id: ch.id, title: ch.title, url: ch.url });
      return { channel: ch.title, list: ch.list, last_refreshed: ch.lastRefreshed, videos: vids.map(compact) };
    }
    case "get_video_details": {
      const v = store.get("videos", videoKey(ws, input.video_id));
      if (!v) return { error: "Video not stored in this workspace." };
      log.push({ kind: "video", id: v.videoId, title: v.title, url: v.url });
      const isOwn = own.includes(v.channelRowId);
      return { ...compact(v), is_our_video: isOwn, authorised_analytics: isOwn ? v.analytics || {} : "not available for other channels (private to their owner)" };
    }
    case "my_performance_summary": {
      const vids = store.inWs("videos", ws, (v) => own.includes(v.channelRowId) && v.score?.score != null);
      const by = (f) => vids.filter((v) => v.format === f).sort((a, b) => b.score.score - a.score.score);
      const pack = (l) => ({ strongest: l.slice(0, 5).map(compact), weakest: l.slice(-5).reverse().map(compact) });
      log.push({ kind: "data", title: `Own channel performance (${vids.length} scored videos)` });
      return { long_form: pack(by("long")), shorts: pack(by("short")), scored_videos: vids.length };
    }
    case "list_topics": {
      const t = store.inWs("topics", ws, (x) => input.status === "all" || x.status === input.status).slice(-40);
      return { topics: t.map((x) => ({ id: x.id, title: x.title, question: x.centralQuestion, status: x.status, reject_reason: x.rejectReason || null })) };
    }
    case "search_youtube": {
      const vids = await yt.searchVideos(store, { q: input.query, publishedAfter: input.days ? new Date(Date.now() - input.days * 864e5).toISOString() : undefined, maxResults: 15 });
      vids.forEach((v) => log.push({ kind: "video", id: v.videoId, title: v.title, url: v.url }));
      return { results: vids.map((v) => ({ video_id: v.videoId, title: v.title, channel: v.channelTitle, published: v.publishedAt?.slice(0, 10), format: v.format, views: v.views, note: "raw views; channel baseline unknown unless the channel is saved" })) };
    }
    default:
      return { error: "Unknown tool." };
  }
}

const SYSTEM = `You are chatting with the creator team inside their workspace. Use the tools to look things up before answering questions about their channels, competitors, references or performance; use web search for current events and facts. Cite where each point came from (saved reference title, video, or web source). When data is missing or a connection is unavailable, say so plainly and suggest how to get it. Keep answers scannable: short paragraphs or lists. Write hooks and scripts in the workspace's script language; titles in its title language.`;

function getChat(store, ws, id, user) {
  const c = store.getInWs("chats", ws, id);
  if (!c || c.createdBy !== user.id) throw httpError(404, "Conversation not found.");
  return c;
}

export default [
  ["GET", "/api/ws/:ws/chats", "viewer", ({ store, ws, user }) => store.inWs("chats", ws, (c) => c.createdBy === user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))],

  ["POST", "/api/ws/:ws/chats", "viewer", ({ store, ws, user }) => store.insert("chats", { ws, createdBy: user.id, title: "New conversation", display: [], api: [] })],

  ["GET", "/api/ws/:ws/chats/:id", "viewer", ({ store, ws, params, user }) => { const c = getChat(store, ws, params.id, user); return { id: c.id, title: c.title, display: c.display }; }],

  ["DELETE", "/api/ws/:ws/chats/:id", "viewer", ({ store, ws, params, user }) => { getChat(store, ws, params.id, user); store.remove("chats", params.id); return { ok: true }; }],

  ["POST", "/api/ws/:ws/chats/:id/messages", "viewer", async ({ store, ws, params, body, user }) => {
    const chat = getChat(store, ws, params.id, user);
    const text = String(body.text || "").trim().slice(0, 8000);
    if (!text) throw httpError(400, "Type a message.");
    ai.checkBudget(store, ws);
    // The API history is append-only (thinking and tool blocks are replayed unchanged).
    const api = [...chat.api, { role: "user", content: text }];
    const log = [];
    let sources = [], answer = "";
    for (let turn = 0; turn < 8; turn++) {
      const { message, content } = await ai.ask(store, ws, { system: SYSTEM, messages: api, tools: [...TOOLS, ai.WEB_SEARCH(4)], effort: "medium" });
      api.push({ role: "assistant", content });
      sources = [...sources, ...ai.sourcesOf(content)];
      answer += ai.textOf(content);
      if (message.stop_reason !== "tool_use") break;
      const results = [];
      for (const b of content.filter((x) => x.type === "tool_use")) {
        try {
          results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(await runTool(store, ws, b.name, b.input, log)) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: b.id, content: e.message, is_error: true });
        }
      }
      api.push({ role: "user", content: results });
      answer += "\n\n";
    }
    const uniq = (arr, k) => [...new Map(arr.map((x) => [k(x), x])).values()];
    const msg = { role: "assistant", text: answer.trim(), sources: uniq(sources, (x) => x.url), used: uniq(log, (x) => x.kind + (x.id || x.title)), at: new Date().toISOString() };
    store.update("chats", chat.id, { api, display: [...chat.display, { role: "user", text, at: new Date().toISOString() }, msg], title: chat.display.length ? chat.title : text.slice(0, 60) });
    return msg;
  }],

  // Saves an assistant answer (or an edited part of it) into the workspace.
  ["POST", "/api/ws/:ws/chats/:id/save", "editor", ({ store, ws, params, body, user }) => {
    const chat = getChat(store, ws, params.id, user);
    const m = chat.display[Number(body.index)];
    if (!m || m.role !== "assistant") throw httpError(400, "Message not found.");
    const text = String(body.text || m.text).slice(0, 100000);
    const title = String(body.title || text.split("\n")[0].replace(/^[#*\s-]+/, "")).slice(0, 200) || "From AI assistant";
    const sourceNote = m.sources?.length ? "\n\nSources:\n" + m.sources.map((x) => `- ${x.title}: ${x.url}`).join("\n") : "";
    if (body.as === "topic") return { saved: "topic", row: store.insert("topics", { ws, title, centralQuestion: "", notes: text + sourceNote, sources: (m.sources || []).slice(0, 10).map((x) => ({ title: x.title, url: x.url })), titles: [], tags: [], confidence: "low", status: "suggested", origin: "assistant", createdBy: user.id, overlap: checkOverlap(store, ws, title) }) };
    if (body.as === "reference") return { saved: "reference", row: store.insert("references", { ws, kind: "note", title, text: text + sourceNote, notes: "Saved from the AI assistant", categories: body.category ? [body.category] : ["topic-research"], tags: ["assistant"], createdBy: user.id, approvedExample: false }) };
    if (body.as === "task") return { saved: "task", row: store.insert("items", { ws, title, stage: "Idea", platform: "youtube", format: "", owner: user.id, deadline: null, notes: text + sourceNote, referenceIds: [], titleOptions: [], thumbnailBrief: "", hook: "", publicationLink: "", favourite: false, history: [{ at: new Date().toISOString(), by: user.id, note: "Created from AI assistant" }], changes: [], experiments: [] }) };
    if (body.as === "script") return { saved: "script", row: store.insert("scripts", { ws, title, topicId: null, itemId: null, language: store.get("workspaces", ws).profile?.scriptLanguage, status: "draft", versions: [{ v: 1, at: new Date().toISOString(), by: user.id, note: "From AI assistant", brief: null, outline: null, hooks: [], sections: [{ heading: "Draft", text }], claims: [] }], comments: [], informedBy: [] }) };
    throw httpError(400, "Save as topic, reference, task or script.");
  }],
];
