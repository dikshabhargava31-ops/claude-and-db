// Claude API access. The key stays on the server (ANTHROPIC_API_KEY in .env).
// Every call is checked against the workspace's monthly AI budget, which the owner approves in
// Settings; with no approved budget, AI calls are blocked rather than spending money.
import Anthropic from "@anthropic-ai/sdk";
import { httpError } from "./auth.js";

export const MODEL = () => process.env.CLAUDE_MODEL || "claude-opus-5-5";
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

// USD per million tokens (input, output) and per web search, used for the budget estimate.
const PRICES = {
  "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5],
  "claude-fable-5-1": [10, 50], "claude-opus-5": [5, 25], "claude-sonnet-5": [2, 10],
};
const SEARCH_USD = 0.01;
// Server-side refusal fallback ("default" picks the fallback model by refusal category).
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

let client;
function getClient() {
  client ??= new Anthropic({ maxRetries: 2, timeout: 10 * 60e3 });
  return client;
}

const month = () => new Date().toISOString().slice(0, 7);

export function aiSpend(store, ws) {
  return store.get("usage", `ai-${ws}-${month()}`) || { usd: 0, inputTokens: 0, outputTokens: 0, searches: 0, calls: 0 };
}

function record(store, ws, usage, model) {
  const [pin, pout] = PRICES[model] || PRICES["claude-opus-5-5"];
  const input = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * 0.1;
  const searches = usage.server_tool_use?.web_search_requests || 0;
  const usd = (input * pin + (usage.output_tokens || 0) * pout) / 1e6 + searches * SEARCH_USD;
  const id = `ai-${ws}-${month()}`;
  const row = store.get("usage", id);
  const next = {
    usd: (row?.usd || 0) + usd, inputTokens: (row?.inputTokens || 0) + (usage.input_tokens || 0),
    outputTokens: (row?.outputTokens || 0) + (usage.output_tokens || 0), searches: (row?.searches || 0) + searches, calls: (row?.calls || 0) + 1,
  };
  if (row) store.update("usage", id, next); else store.insert("usage", { id, ...next });
}

export function checkBudget(store, ws) {
  if (!aiConfigured()) throw httpError(503, "AI isn't connected. Add ANTHROPIC_API_KEY to the server's .env file.", { integration: "ai" });
  const w = store.get("workspaces", ws);
  const budget = w?.settings?.aiBudgetUsd;
  if (!(budget > 0)) throw httpError(402, "AI spending isn't approved for this workspace yet. The owner can set a monthly AI budget in Settings → AI & budget.", { integration: "ai", needsApproval: "aiBudget" });
  const spent = aiSpend(store, ws).usd;
  if (spent >= budget) throw httpError(402, `This month's approved AI budget ($${budget}) is used up ($${spent.toFixed(2)} spent). The owner can raise it in Settings.`, { integration: "ai", needsApproval: "aiBudget" });
}

export const RULES = `You are the research and writing assistant inside Creator Research Studio, working for a creator team.
Hard rules:
- Never invent analytics, view counts, CTR, retention, watch time, transcripts, search results, quotes or sources. Use only data given to you or found with your tools, and say when data is missing.
- Competitor CTR, retention and watch time are not public. Never state or estimate them as facts.
- Separate what was observed from likely explanations. Label explanations as hypotheses with a confidence level; never present a guess as the proven cause.
- Write original material. Learn structure, pacing and principles from references, but never copy their distinctive wording, jokes, stories or titles.
- Mark every factual claim that needs checking before recording (dates, numbers, rules, exam or regulator details, quotes).
- Prefer substantive, relatable ideas with a clear discussion point. Avoid generic motivation, forced controversy and repeating ideas the team already covered or rejected.
- Controversies and debates are fine when relevant to the audience and backed by credible sources; present them fairly.`;

export function profileBlock(w) {
  const p = w.profile || {};
  return `Workspace: ${w.name}
Niche: ${p.niche || "(not set)"}
Target audience: ${p.audience || "(not set)"}
Content pillars: ${(p.pillars || []).join("; ") || "(not set)"}
Script language: ${p.scriptLanguage || "Hindi-English (Hinglish)"}; titles and thumbnail text: ${p.titleLanguage || "English"}
Tone and speaking style: ${p.tone || "(not set)"}
Preferred formats and lengths: ${(p.formats || []).join("; ") || "(not set)"} ${p.lengths ? "— " + p.lengths : ""}
YouTube: ${p.youtubeUrl || "(not set)"}; Instagram: ${(p.instagramUrls || []).join(", ") || "(not set)"}
Other notes: ${p.notes || "-"}`;
}

function systemBlocks(w, extra = "") {
  // Stable blocks first so they can be cached across calls; volatile instructions go in messages.
  return [
    { type: "text", text: RULES },
    { type: "text", text: profileBlock(w), cache_control: { type: "ephemeral" } },
    ...(extra ? [{ type: "text", text: extra }] : []),
  ];
}

function refusalError(msg) {
  const why = msg.stop_details?.explanation ? ` (${msg.stop_details.explanation})` : "";
  return httpError(422, `The AI declined this request${why}. Try rephrasing it.`, { integration: "ai" });
}

// One request (or several when a server tool pauses). Returns the final message plus all content.
export async function ask(store, ws, { system = "", messages, tools, effort = "medium", maxTokens = 16000, format }) {
  checkBudget(store, ws);
  const w = store.get("workspaces", ws);
  const model = MODEL();
  const params = {
    model, max_tokens: maxTokens, system: systemBlocks(w, system), messages: [...messages],
    output_config: { effort, ...(format ? { format } : {}) },
    ...(tools?.length ? { tools } : {}),
  };
  if (FALLBACK_MODELS.has(model)) Object.assign(params, { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  const content = [];
  let msg;
  for (let turn = 0; turn < 5; turn++) {
    try {
      msg = await getClient().beta.messages.stream(params).finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw httpError(503, "Anthropic rejected the API key. Check ANTHROPIC_API_KEY.", { integration: "ai" });
      if (e instanceof Anthropic.RateLimitError) throw httpError(429, "The AI service is rate-limiting requests. Try again in a minute.", { integration: "ai" });
      if (e instanceof Anthropic.APIError) throw httpError(502, `AI request failed (${e.status ?? "network"}): ${e.message}`, { integration: "ai" });
      throw e;
    }
    record(store, ws, msg.usage || {}, model);
    content.push(...msg.content);
    if (msg.stop_reason === "refusal") throw refusalError(msg);
    if (msg.stop_reason !== "pause_turn") break;
    params.messages = [...params.messages, { role: "assistant", content: msg.content }];
  }
  return { message: msg, content };
}

export function textOf(content) {
  return content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

// Sources from web search results and citations, de-duplicated by URL.
export function sourcesOf(content) {
  const seen = new Map();
  for (const b of content) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url && !seen.has(r.url)) seen.set(r.url, { title: r.title, url: r.url, pageAge: r.page_age || null, cited: false });
    }
    if (b.type === "text") {
      for (const c of b.citations || []) {
        if (!c.url) continue;
        const s = seen.get(c.url) || { title: c.title, url: c.url, pageAge: null };
        s.cited = true;
        s.quote ??= c.cited_text;
        seen.set(c.url, s);
      }
    }
  }
  return [...seen.values()].sort((a, b) => b.cited - a.cited);
}

export const WEB_SEARCH = (maxUses = 5) => ({ type: "web_search_20260209", name: "web_search", max_uses: maxUses, user_location: { type: "approximate", country: "IN", timezone: "Asia/Kolkata" } });

// Web research with sources. Text answer + the list of pages it used.
export async function research(store, ws, question, { maxUses = 5, effort = "medium" } = {}) {
  const { content } = await ask(store, ws, {
    system: "Research with web search. Prefer official and credible sources (regulators, institutes, reputable news). Give dates for anything time-sensitive. If sources disagree or are thin, say so.",
    messages: [{ role: "user", content: question }],
    tools: [WEB_SEARCH(maxUses)], effort,
  });
  return { text: textOf(content), sources: sourcesOf(content) };
}

// Structured JSON output that matches `schema` (JSON Schema, additionalProperties false everywhere).
export async function json(store, ws, { system, prompt, schema, effort = "medium", maxTokens = 16000 }) {
  const { content, message } = await ask(store, ws, {
    system, effort, maxTokens,
    messages: [{ role: "user", content: prompt }],
    format: { type: "json_schema", schema },
  });
  if (message.stop_reason === "max_tokens") throw httpError(502, "The AI response was cut off. Try a smaller request.", { integration: "ai" });
  try {
    return JSON.parse(textOf(content));
  } catch {
    throw httpError(502, "The AI returned something that wasn't valid JSON. Try again.", { integration: "ai" });
  }
}

// Helpers for writing schemas compactly.
export const S = {
  str: { type: "string" },
  strs: { type: "array", items: { type: "string" } },
  enumOf: (...v) => ({ type: "string", enum: v }),
  obj: (props) => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false }),
  arr: (items) => ({ type: "array", items }),
};
