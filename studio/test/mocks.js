// Local stand-ins for the YouTube Data API, the Claude Messages API (streaming) and the GitHub
// contents API, used only by the end-to-end test. They return clearly fake test data.
import http from "node:http";

const DAY = 864e5;
const pad = (s) => s.padEnd(11, "x").slice(0, 11);

function makeChannel(id, title, handle, base, seed) {
  const videos = Array.from({ length: 14 }, (_, i) => {
    const age = 3 + i * 6;
    let views = Math.round(base * (0.7 + ((seed * (i + 3)) % 7) / 10));
    if (i === 2) views *= 5; // an outlier
    return { id: pad(`${id.slice(2, 6)}${i}v`), title: `${title} test video ${i}: CA exam ${["result", "strategy", "articleship", "career"][i % 4]}`, age, views, dur: i % 5 === 4 ? "PT55S" : "PT14M3S" };
  });
  return { id, title, handle, videos };
}

const CHANNELS = [
  makeChannel("UCown000000000000000000a", "Test Own Channel", "camahendrasir", 30000, 3),
  makeChannel("UCcomp00000000000000000b", "Test Competitor", "testcompetitor", 20000, 5),
  makeChannel("UCinsp00000000000000000c", "Test Inspiration", "testinspiration", 200000, 7),
];
const allVideos = () => CHANNELS.flatMap((c) => c.videos.map((v) => ({ ...v, ch: c })));

function videoItem(v) {
  return { id: v.id, snippet: { title: v.title, description: "", channelId: v.ch.id, channelTitle: v.ch.title, publishedAt: new Date(Date.now() - v.age * DAY).toISOString(), thumbnails: {} }, contentDetails: { duration: v.dur }, statistics: { viewCount: String(v.views), likeCount: String(Math.round(v.views * 0.05)), commentCount: String(Math.round(v.views * 0.005)) } };
}
function channelItem(c) {
  return { id: c.id, snippet: { title: c.title, customUrl: "@" + c.handle, description: "", thumbnails: {} }, statistics: { subscriberCount: "100000", videoCount: String(c.videos.length) }, contentDetails: { relatedPlaylists: { uploads: "UU" + c.id.slice(2) } } };
}

export function youtubeMock() {
  const calls = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    calls.push(u.pathname);
    const q = Object.fromEntries(u.searchParams);
    if (q.key !== "test-yt-key") { res.writeHead(403); return res.end(JSON.stringify({ error: { errors: [{ reason: "keyInvalid" }] } })); }
    let body = { items: [] };
    if (u.pathname.endsWith("/channels")) {
      const c = q.forHandle ? CHANNELS.find((x) => "@" + x.handle === q.forHandle) : CHANNELS.filter((x) => q.id?.split(",").includes(x.id));
      body.items = (Array.isArray(c) ? c : c ? [c] : []).map(channelItem);
    } else if (u.pathname.endsWith("/playlistItems")) {
      const c = CHANNELS.find((x) => "UU" + x.id.slice(2) === q.playlistId);
      body.items = (c?.videos || []).map((v) => ({ contentDetails: { videoId: v.id } }));
    } else if (u.pathname.endsWith("/videos")) {
      body.items = allVideos().filter((v) => q.id.split(",").includes(v.id)).map(videoItem);
    } else if (u.pathname.endsWith("/search")) {
      if (q.type === "channel") body.items = CHANNELS.map((c) => ({ id: { channelId: c.id } }));
      else body.items = allVideos().filter((v) => !q.channelId || v.ch.id === q.channelId).slice(0, 10).map((v) => ({ id: { videoId: v.id } }));
    } else if (u.pathname.endsWith("/commentThreads")) {
      body.items = [
        { snippet: { topLevelComment: { snippet: { textDisplay: "Sir CA Inter result ke baad articleship kaise choose karein?", likeCount: 40, publishedAt: new Date().toISOString() } } } },
        { snippet: { topLevelComment: { snippet: { textDisplay: "Great video", likeCount: 3, publishedAt: new Date().toISOString() } } } },
      ];
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  return { server, calls };
}

// ---- Claude Messages API (SSE streaming) ----
function fakeJson(schema) {
  const p = schema.properties || {};
  if (p.topics) return { topics: [
    { title: "Test topic: articleship choices after CA Inter results", centralQuestion: "Big firm or small firm articleship — which builds a better career?", whyAudience: "Test reason", whyNow: "Test: results season", angle: "Test angle", titles: ["Test title one", "Test title two", "Test title three"], thumbnailConcept: "BIG4 vs SMALL", hook: "Test hook line", format: "long-form", tags: ["career", "timely"], sources: [{ title: "Test source", url: "https://example.org/test-source" }], referenceVideoIds: [], referenceIds: [], researchGaps: "Test gaps", confidence: "high" },
    { title: "Test topic: why mock scores fall before the exam", centralQuestion: "Is a falling mock score a warning sign?", whyAudience: "Test", whyNow: "evergreen", angle: "Test", titles: ["A", "B", "C"], thumbnailConcept: "SCORE DROP?", hook: "Test hook", format: "Short", tags: ["educational"], sources: [], referenceVideoIds: [], referenceIds: [], researchGaps: "Test", confidence: "medium" },
  ] };
  if (p.hooks) return { hooks: ["Relatable situation", "Contradiction", "Direct question", "Evidence-led surprise", "Short story", "Strong claim"].map((a, i) => ({ approach: a, text: `Test hook ${i + 1} (${a})`, whyItWorks: "Test", claimsToVerify: i === 3 ? ["Test statistic"] : [], referenceIds: [] })) };
  if (p.keyFacts) return { summary: "Test brief summary", keyFacts: [{ claim: "Test fact", source: "https://example.org/test-source", needsVerification: false }, { claim: "Unsourced test claim", source: "", needsVerification: true }], audienceQuestions: ["Test question?"], angle: "Test angle", openQuestions: ["Test open question"] };
  if (p.payoff) return { sections: [{ heading: "Hook", purpose: "Test", beats: ["Test beat"] }, { heading: "Point 1", purpose: "Test", beats: ["Test beat 2"] }], payoff: "Test payoff" };
  if (p.claimsToVerify && p.sections) return { sections: [{ heading: "Hook", text: "Test script hook. [VERIFY: test statistic]" }, { heading: "Body", text: "Test script body." }], claimsToVerify: ["test statistic"] };
  if (p.changeNote) return { text: "Revised test section.", claimsToVerify: [], changeNote: "Made it shorter (test)" };
  if (p.structure) return { hook: "Test", structure: [{ part: "Intro", whatItDoes: "Test", approxShare: "10%" }], pacing: "Test", transitions: "Test", payoff: "Test", principles: ["Test principle"], avoidCopying: ["Test phrase"] };
  if (p.tags && p.categories) return { summary: "Test summary", tags: ["test"], categories: ["hooks"] };
  if (p.likelyExplanations) return { likelyExplanations: [{ hypothesis: "Test hypothesis", basedOn: "Test observation", confidence: "low" }], experiments: [{ change: "Test change", measure: "Test measure", expectedSignal: "Test" }], dataGaps: ["Test gap"] };
  return {};
}

function sse(res, content, stopReason) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
  send("message_start", { message: { id: "msg_test", type: "message", role: "assistant", model: "test", content: [], stop_reason: null, usage: { input_tokens: 100, output_tokens: 0 } } });
  content.forEach((b, index) => {
    if (b.type === "text") {
      send("content_block_start", { index, content_block: { type: "text", text: "" } });
      send("content_block_delta", { index, delta: { type: "text_delta", text: b.text } });
    } else if (b.type === "tool_use") {
      send("content_block_start", { index, content_block: { ...b, input: {} } });
      send("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input) } });
    } else send("content_block_start", { index, content_block: b });
    send("content_block_stop", { index });
  });
  send("message_delta", { delta: { stop_reason: stopReason }, usage: { output_tokens: 50, server_tool_use: { web_search_requests: content.some((b) => b.type === "web_search_tool_result") ? 1 : 0 } } });
  send("message_stop", {});
  res.end();
}

export function claudeMock() {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw || "{}");
    requests.push({ url: req.url, headers: req.headers, body });
    if (req.headers["x-api-key"] !== "test-anthropic-key" && req.headers.authorization !== "Bearer test-anthropic-key") { res.writeHead(401, { "content-type": "application/json" }); return res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "bad key" } })); }
    const fmt = body.output_config?.format;
    if (fmt) return sse(res, [{ type: "text", text: JSON.stringify(fakeJson(fmt.schema)) }], "end_turn");
    const tools = (body.tools || []).map((t) => t.name);
    const last = body.messages[body.messages.length - 1];
    const hasToolResult = Array.isArray(last.content) && last.content.some((b) => b.type === "tool_result");
    if (tools.includes("find_outliers") && !hasToolResult) {
      return sse(res, [{ type: "text", text: "Let me check your saved competitors. " }, { type: "tool_use", id: "toolu_test1", name: "find_outliers", input: { days: 90, list: "competitor", format: "any" } }], "tool_use");
    }
    const search = tools.includes("web_search") ? [{ type: "server_tool_use", id: "srvtoolu_test", name: "web_search", input: { query: "test" } }, { type: "web_search_tool_result", tool_use_id: "srvtoolu_test", content: [{ type: "web_search_result", url: "https://example.org/test-news", title: "Test news source", encrypted_content: "x", page_age: "1 day" }] }] : [];
    return sse(res, [...search, { type: "text", text: hasToolResult ? "Test answer: your competitors' outliers are listed above (test data)." : "Test research notes: an official test announcement on 2026-10-20." }], "end_turn");
  });
  return { server, requests };
}

// ---- GitHub contents API for the Instagram Planner ----
export function githubMock() {
  const files = {
    "instagram/accounts.json": JSON.stringify({ ipa: "ipa_institute_ajmer", parthu: "parthuai.06" }),
    "instagram/posts.csv": "id,account,publish_at,type,media,caption,first_comment\nparthu-20261025-1330-8b2b,parthu,2026-10-25 13:30,carousel,https://example.org/1.jpg|https://example.org/2.jpg,Test,\n",
    "instagram/published.json": JSON.stringify({ published: { "parthu-20261025-1330-8b2b": { account: "parthu", permalink: "https://www.instagram.com/p/test/", published_at: "2026-10-25T08:00+00:00" } }, failed: {} }),
  };
  const writes = [];
  const dispatches = [];
  let sha = 1;
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const m = /\/repos\/[^/]+\/[^/]+\/contents\/([^?]+)/.exec(req.url);
    res.setHeader("content-type", "application/json");
    if (req.method === "GET" && m && files[m[1]] != null) return res.end(JSON.stringify({ sha: "sha" + sha, content: Buffer.from(files[m[1]]).toString("base64") }));
    if (req.method === "PUT" && m) {
      const b = JSON.parse(raw);
      if (b.sha !== "sha" + sha) { res.writeHead(409); return res.end(JSON.stringify({ message: "conflict" })); }
      files[m[1]] = Buffer.from(b.content, "base64").toString("utf8");
      sha++;
      writes.push({ path: m[1], message: b.message, auth: req.headers.authorization });
      return res.end(JSON.stringify({ commit: { html_url: "https://github.com/test/commit" } }));
    }
    if (req.method === "POST" && req.url.includes("/dispatches")) { dispatches.push(JSON.parse(raw)); res.writeHead(204); return res.end(); }
    res.writeHead(404);
    res.end(JSON.stringify({ message: "Not Found" }));
  });
  return { server, files, writes, dispatches };
}

export const listen = (server) => new Promise((r) => server.listen(0, "127.0.0.1", () => r(`http://127.0.0.1:${server.address().port}`)));

// ---- Supabase (PostgREST table + Storage) for the hosted-mode test ----
export function supabaseMock() {
  const rows = new Map(); // "collection/id" -> row
  const files = new Map();
  let clock = Date.parse("2026-01-01T00:00:00Z");
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const u = new URL(req.url, "http://x");
    if (req.headers.apikey !== "test-service-key") { res.writeHead(401); return res.end("{}"); }
    res.setHeader("content-type", "application/json");
    if (u.pathname === "/rest/v1/studio_docs" && req.method === "GET") {
      const gt = u.searchParams.get("updated_at")?.replace(/^gt\./, "");
      let list = [...rows.values()].filter((r) => !gt || r.updated_at > new Date(gt).toISOString()).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      const offset = Number(u.searchParams.get("offset") || 0), limit = Number(u.searchParams.get("limit") || 1000);
      return res.end(JSON.stringify(list.slice(offset, offset + limit)));
    }
    if (u.pathname === "/rest/v1/studio_docs" && req.method === "POST") {
      for (const r of JSON.parse(raw)) rows.set(`${r.collection}/${r.id}`, { ...r, updated_at: new Date(clock += 1).toISOString() });
      res.writeHead(201);
      return res.end();
    }
    const m = /^\/storage\/v1\/object\/(?:authenticated\/)?studio-files\/(.+)$/.exec(u.pathname);
    if (m) {
      if (req.method === "POST") { files.set(m[1], raw); return res.end("{}"); }
      if (req.method === "DELETE") { files.delete(m[1]); return res.end("{}"); }
      if (!files.has(m[1])) { res.writeHead(400); return res.end('{"error":"not found"}'); }
      res.setHeader("content-type", "application/octet-stream");
      return res.end(files.get(m[1]));
    }
    res.writeHead(404);
    res.end("{}");
  });
  return { server, rows, files };
}
