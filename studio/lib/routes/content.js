// Reference library, preferences, topics (opportunities), hooks, scripts and the content pipeline.
import { httpError } from "../auth.js";
import { newId } from "../store.js";
import * as gen from "../generate.js";
import * as google from "../google.js";
import * as ig from "../instagram.js";
import * as yt from "../youtube.js";
import { checkOverlap, videoKey, upsertVideo, addReview } from "../domain.js";
import { relevantReferences } from "../retrieve.js";

export const STAGES = ["Idea", "Shortlisted", "Researching", "Scripting", "Ready to Record", "Editing", "Scheduled", "Published"];
export const CATEGORIES = ["topic-research", "titles", "thumbnails", "hooks", "script-structures", "editing-styles", "visual-storytelling"];
const KINDS = ["link", "video", "image", "document", "transcript", "note"];
const TOPIC_TAGS = ["evergreen", "timely", "controversial", "contrarian", "educational", "career", "student-relatable"];
const PLATFORMS = ["youtube", "youtube-short", "instagram"];
const IMAGE_MIME = /^image\/(png|jpeg|gif|webp)$/;
// Vercel limits a request to 4.5 MB, so uploads on the hosted app are smaller (base64 adds a third).
const MAX_UPLOAD = (process.env.VERCEL ? 3 : 25) * 1024 * 1024;

const str = (v, n = 4000) => String(v ?? "").slice(0, n);
const strs = (v, n = 20) => (Array.isArray(v) ? v : String(v || "").split(/,|\n/)).map((s) => String(s).trim()).filter(Boolean).slice(0, n);
const notFound = (what) => httpError(404, `${what} not found.`);

function getRef(store, ws, id) { return store.getInWs("references", ws, id) || (() => { throw notFound("Reference"); })(); }
function getTopic(store, ws, id) { return store.getInWs("topics", ws, id) || (() => { throw notFound("Topic"); })(); }
function getItem(store, ws, id) { return store.getInWs("items", ws, id) || (() => { throw notFound("Content item"); })(); }
function getScript(store, ws, id) { return store.getInWs("scripts", ws, id) || (() => { throw notFound("Script"); })(); }

function topicFields(b) {
  const t = {};
  for (const k of ["title", "centralQuestion", "whyAudience", "whyNow", "angle", "thumbnailConcept", "hook", "format", "researchGaps", "notes"]) if (k in b) t[k] = str(b[k]);
  if ("titles" in b) t.titles = strs(b.titles, 6);
  if ("tags" in b) t.tags = strs(b.tags).filter((x) => TOPIC_TAGS.includes(x));
  if ("confidence" in b) t.confidence = ["high", "medium", "low"].includes(b.confidence) ? b.confidence : "low";
  if ("sources" in b) t.sources = (Array.isArray(b.sources) ? b.sources : []).filter((s) => s?.url).map((s) => ({ title: str(s.title, 300), url: str(s.url, 1000) })).slice(0, 20);
  if ("referenceIds" in b) t.referenceIds = strs(b.referenceIds, 20);
  if ("referenceVideoIds" in b) t.referenceVideoIds = strs(b.referenceVideoIds, 20);
  return t;
}

// [VERIFY: ...] markers in a script become a checklist.
export function claimsFrom(sections) {
  const out = [];
  for (const s of sections || []) for (const m of String(s.text || "").matchAll(/\[VERIFY:\s*([^\]]+)\]/gi)) out.push(m[1].trim());
  return [...new Set(out)];
}

function newVersion(script, patch, by, note) {
  const prev = script.versions[script.versions.length - 1] || {};
  const v = { v: (prev.v || 0) + 1, at: new Date().toISOString(), by, note, brief: prev.brief || null, outline: prev.outline || null, hooks: prev.hooks || [], sections: prev.sections || [], ...patch };
  v.claims = [...new Set([...(patch.claims || []), ...claimsFrom(v.sections)])];
  return [...script.versions, v];
}

function logHistory(item, by, note) {
  return [...(item.history || []), { at: new Date().toISOString(), by, note }].slice(-200);
}

export default [
  // ---------- reference library ----------
  ["GET", "/api/ws/:ws/references", "viewer", ({ store, ws, query }) => {
    let refs = store.inWs("references", ws, (r) => !r.archived);
    if (query.category) refs = refs.filter((r) => r.categories?.includes(query.category));
    if (query.kind) refs = refs.filter((r) => r.kind === query.kind);
    if (query.approved) refs = refs.filter((r) => r.approvedExample);
    if (query.q) {
      const ranked = relevantReferences(store, ws, query.q, { limit: 100 }).map((r) => r.id);
      const q = query.q.toLowerCase();
      refs = refs.filter((r) => ranked.includes(r.id) || [r.title, r.notes, r.summary, r.url, ...(r.tags || [])].join(" ").toLowerCase().includes(q));
    }
    return refs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => ({ ...r, text: r.text ? r.text.slice(0, 600) : "", hasMoreText: (r.text || "").length > 600 }));
  }],

  ["GET", "/api/ws/:ws/references/:id", "viewer", ({ store, ws, params }) => getRef(store, ws, params.id)],

  ["POST", "/api/ws/:ws/references", "editor", async ({ store, ws, body, user }) => {
    const kind = KINDS.includes(body.kind) ? body.kind : "note";
    const ref = { ws, kind, title: str(body.title, 300), url: str(body.url, 1000), notes: str(body.notes, 20000), text: str(body.text, 400000), categories: strs(body.categories).filter((c) => CATEGORIES.includes(c)), tags: strs(body.tags, 30).map((t) => t.toLowerCase()), createdBy: user.id, approvedExample: false };
    if (body.file?.data) {
      const buf = Buffer.from(body.file.data, "base64");
      if (buf.length > MAX_UPLOAD) throw httpError(413, `Files up to ${MAX_UPLOAD / 1024 / 1024} MB${process.env.VERCEL ? " on the hosted app" : ""}.`);
      const fileId = newId("f_");
      await store.writeFile(fileId, buf);
      store.insert("files", { id: fileId, ws, name: str(body.file.name, 200), mime: str(body.file.mime, 100), size: buf.length });
      ref.fileId = fileId;
      ref.fileName = body.file.name;
      ref.fileMime = body.file.mime;
      if (/^text\/|json|csv|srt|vtt/.test(body.file.mime || "") || /\.(txt|srt|vtt|md|csv)$/i.test(body.file.name || "")) ref.text ||= buf.toString("utf8").slice(0, 400000);
    }
    const parsed = yt.parseInput(ref.url);
    if (parsed.type === "video") {
      ref.videoId = parsed.id;
      if (body.video) {
        const v = body.video;
        ref.title ||= v.title;
        ref.video = { title: v.title, channelTitle: v.channelTitle, thumb: v.thumb, views: v.views ?? null, publishedAt: v.publishedAt ?? null, durationSec: v.durationSec ?? null, scoreText: v.scoreText || null, source: v.source || "imported" };
        if (v.views != null && !store.get("videos", videoKey(ws, v.videoId))) upsertVideo(store, ws, v, { source: v.source || "live" });
      }
    }
    if (!ref.title && !ref.url && !ref.text && !ref.fileId) throw httpError(400, "Add a title, link, text or file.");
    ref.title ||= ref.fileName || ref.url || "Untitled reference";
    return store.insert("references", ref);
  }],

  ["PATCH", "/api/ws/:ws/references/:id", "editor", ({ store, ws, params, body }) => {
    const r = getRef(store, ws, params.id);
    const patch = {};
    for (const k of ["title", "url", "notes", "summary"]) if (k in body) patch[k] = str(body[k], k === "notes" ? 20000 : 2000);
    if ("text" in body) patch.text = str(body.text, 400000);
    if ("categories" in body) patch.categories = strs(body.categories).filter((c) => CATEGORIES.includes(c));
    if ("tags" in body) patch.tags = strs(body.tags, 30).map((t) => t.toLowerCase());
    if (body.acceptSuggestion && r.suggestion) {
      patch.summary = r.suggestion.summary;
      patch.tags = [...new Set([...(r.tags || []), ...r.suggestion.tags])];
      patch.categories = [...new Set([...(r.categories || []), ...r.suggestion.categories])];
      patch.suggestion = null;
    }
    if ("approvedExample" in body) patch.approvedExample = !!body.approvedExample;
    if ("archived" in body) patch.archived = !!body.archived;
    return store.update("references", r.id, patch);
  }],

  ["DELETE", "/api/ws/:ws/references/:id", "editor", async ({ store, ws, params }) => {
    const r = getRef(store, ws, params.id);
    if (r.fileId) { await store.deleteFile(r.fileId); store.remove("files", r.fileId); }
    store.remove("references", r.id);
    return { ok: true };
  }],

  ["POST", "/api/ws/:ws/references/:id/suggest", "editor", async ({ store, ws, params }) => {
    const r = getRef(store, ws, params.id);
    let image = null;
    if (r.fileId && IMAGE_MIME.test(r.fileMime || "")) image = { mime: r.fileMime, data: await store.readFile(r.fileId) };
    const s = await gen.tagReference(store, ws, r, image);
    return store.update("references", r.id, { suggestion: { ...s, at: new Date().toISOString() } });
  }],

  ["POST", "/api/ws/:ws/references/:id/analyze", "editor", async ({ store, ws, params }) => {
    const r = getRef(store, ws, params.id);
    if (!r.text || r.text.length < 200) throw httpError(400, "Add the script or transcript text first (paste it, or upload a .txt/.srt file).");
    const { data } = await gen.analyzeReference(store, ws, r);
    return store.update("references", r.id, { analysis: { ...data, at: new Date().toISOString() } });
  }],

  // Transcripts only through permitted methods: captions of the workspace's OWN videos.
  ["POST", "/api/ws/:ws/references/:id/transcript", "editor", async ({ store, ws, params }) => {
    const r = getRef(store, ws, params.id);
    if (!r.videoId) throw httpError(400, "This reference isn't a YouTube video.");
    const conn = google.connection(store, ws);
    const ownIds = new Set(store.inWs("channels", ws, (c) => c.list === "own").map((c) => c.ytChannelId));
    const v = store.get("videos", videoKey(ws, r.videoId));
    if (!conn || !(v && ownIds.has(v.channelId) && v.channelId === conn.channelId)) {
      throw httpError(400, "YouTube only lets a channel's owner download its captions, so this transcript can't be fetched. Paste the transcript or upload a .txt/.srt file instead.", { integration: "captions" });
    }
    const cap = await google.ownCaption(store, ws, r.videoId);
    return store.update("references", r.id, { text: cap.text, transcriptSource: `YouTube captions (${cap.kind}, ${cap.language})` });
  }],

  ["GET", "/files/:ws/:id", "viewer", async ({ store, ws, params, send }) => {
    const f = store.getInWs("files", ws, params.id);
    if (!f) throw notFound("File");
    const safe = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain)$/.test(f.mime) ? f.mime : "application/octet-stream";
    const data = await store.readFile(f.id);
    if (!data) throw notFound("File");
    send(200, data, { "content-type": safe, "content-disposition": `${safe.startsWith("image/") ? "inline" : "attachment"}; filename="${encodeURIComponent(f.name)}"`, "cache-control": "private, max-age=3600" });
  }],

  // ---------- preferences (learned vs explicitly approved) ----------
  ["GET", "/api/ws/:ws/preferences", "viewer", ({ store, ws }) => store.inWs("preferences", ws).sort((a, b) => b.createdAt.localeCompare(a.createdAt))],

  ["POST", "/api/ws/:ws/preferences", "editor", ({ store, ws, body, user }) => {
    if (!str(body.statement).trim()) throw httpError(400, "Write the preference.");
    return store.insert("preferences", { ws, statement: str(body.statement, 600), kind: "explicit", status: "approved", createdBy: user.id, evidence: str(body.evidence, 600) });
  }],

  ["PATCH", "/api/ws/:ws/preferences/:id", "editor", ({ store, ws, params, body }) => {
    const p = store.getInWs("preferences", ws, params.id);
    if (!p) throw notFound("Preference");
    const patch = {};
    if ("statement" in body) patch.statement = str(body.statement, 600);
    if (["approved", "rejected", "proposed"].includes(body.status)) patch.status = body.status;
    return store.update("preferences", p.id, patch);
  }],

  ["DELETE", "/api/ws/:ws/preferences/:id", "editor", ({ store, ws, params }) => {
    if (!store.getInWs("preferences", ws, params.id)) throw notFound("Preference");
    store.remove("preferences", params.id);
    return { ok: true };
  }],

  // ---------- topics / opportunities ----------
  ["GET", "/api/ws/:ws/topics", "viewer", ({ store, ws, query }) => {
    let t = store.inWs("topics", ws);
    if (query.status) t = t.filter((x) => x.status === query.status);
    if (query.tag) t = t.filter((x) => x.tags?.includes(query.tag));
    return t.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }],

  ["POST", "/api/ws/:ws/topics", "editor", ({ store, ws, body, user }) => {
    const t = topicFields(body);
    if (!t.title) throw httpError(400, "Give the topic a title.");
    const overlap = checkOverlap(store, ws, `${t.title} ${t.centralQuestion || ""}`);
    return store.insert("topics", { ws, titles: [], tags: [], sources: [], confidence: "low", ...t, status: "suggested", origin: "manual", createdBy: user.id, overlap });
  }],

  // "Develop an original idea" from a saved reference or a video.
  ["POST", "/api/ws/:ws/topics/develop", "editor", async ({ store, ws, body, user }) => {
    let evidence = "", seed = {};
    if (body.referenceId) {
      const r = getRef(store, ws, body.referenceId);
      evidence = `SAVED REFERENCE [ref:${r.id}] "${r.title}" ${r.url || ""}\n${r.video ? `Video by ${r.video.channelTitle}, ${r.video.views ?? "?"} views. ${r.video.scoreText || ""}` : ""}\nNotes: ${r.notes || ""}\nSummary: ${r.summary || ""}\n${(r.text || "").slice(0, 6000)}`;
      seed = { title: `Our angle on: ${r.title}`, referenceIds: [r.id], referenceVideoIds: r.videoId ? [r.videoId] : [] };
    } else if (body.video) {
      const v = body.video;
      evidence = `REFERENCE VIDEO ${v.videoId} "${v.title}" by ${v.channelTitle}, ${v.views ?? "?"} views, published ${v.publishedAt?.slice(0, 10) || "?"}. ${v.scoreText || ""}`;
      seed = { title: `Our angle on: ${v.title}`, referenceVideoIds: [v.videoId] };
    } else throw httpError(400, "Choose a reference or video to develop.");
    if (body.instruction) evidence += `\nTeam's direction: ${str(body.instruction, 1000)}`;
    try {
      const { data, informedBy } = await gen.topicCards(store, ws, { evidence, count: 1, focus: "Turn this reference into ONE original video idea for our channel. Do not remake it: find our own angle, question and evidence." });
      const t = data[0];
      const overlap = checkOverlap(store, ws, `${t.title} ${t.centralQuestion}`);
      return store.insert("topics", { ws, ...t, referenceIds: [...new Set([...(t.referenceIds || []), ...(seed.referenceIds || [])])], referenceVideoIds: [...new Set([...(t.referenceVideoIds || []), ...(seed.referenceVideoIds || [])])], status: "suggested", origin: "ai", informedBy, createdBy: user.id, overlap });
    } catch (e) {
      if (e.integration !== "ai" || ![402, 503].includes(e.status)) throw e;
      // No AI: create a blank card linked to the reference for the team to fill in.
      const overlap = checkOverlap(store, ws, seed.title);
      return store.insert("topics", { ws, ...seed, centralQuestion: "", titles: [], tags: [], sources: [], confidence: "low", researchGaps: "Write the angle, question and sources.", status: "suggested", origin: "template", notice: e.message, createdBy: user.id, overlap });
    }
  }],

  ["PATCH", "/api/ws/:ws/topics/:id", "editor", ({ store, ws, params, body }) => {
    const t = getTopic(store, ws, params.id);
    const patch = topicFields(body);
    if ("favourite" in body) patch.favourite = !!body.favourite;
    if (patch.title || patch.centralQuestion) patch.overlap = checkOverlap(store, ws, `${patch.title || t.title} ${patch.centralQuestion || t.centralQuestion || ""}`, t.id);
    return store.update("topics", t.id, patch);
  }],

  ["POST", "/api/ws/:ws/topics/:id/shortlist", "editor", ({ store, ws, params, body, user }) => {
    const t = getTopic(store, ws, params.id);
    if (t.itemId && store.get("items", t.itemId)) return store.get("items", t.itemId);
    const platform = PLATFORMS.includes(body.platform) ? body.platform : /short|reel/i.test(t.format || "") ? "youtube-short" : "youtube";
    const item = store.insert("items", {
      ws, topicId: t.id, title: t.title, stage: "Shortlisted", platform, format: t.format || "", owner: body.owner || user.id,
      deadline: body.deadline || null, scriptId: null, referenceIds: t.referenceIds || [], titleOptions: t.titles || [],
      thumbnailBrief: t.thumbnailConcept || "", hook: t.hook || "", publicationLink: "", notes: "", favourite: false,
      history: [{ at: new Date().toISOString(), by: user.id, note: "Shortlisted from Opportunities" }], changes: [], experiments: [],
    });
    store.update("topics", t.id, { status: "shortlisted", itemId: item.id });
    return item;
  }],

  ["POST", "/api/ws/:ws/topics/:id/reject", "editor", ({ store, ws, params, body, user }) => {
    const t = getTopic(store, ws, params.id);
    const reason = str(body.reason, 600).trim();
    store.update("topics", t.id, { status: "rejected", rejectReason: reason, rejectedBy: user.id });
    // A reason becomes a *proposed* learned preference; it only shapes suggestions once approved.
    if (reason) store.insert("preferences", { ws, statement: `Avoid ideas like "${t.title}": ${reason}`, kind: "learned", status: "proposed", evidence: `Rejected topic "${t.title}"`, createdBy: user.id });
    return store.get("topics", t.id);
  }],

  ["POST", "/api/ws/:ws/topics/:id/restore", "editor", ({ store, ws, params }) => store.update("topics", getTopic(store, ws, params.id).id, { status: "suggested" })],

  ["POST", "/api/ws/:ws/overlap", "viewer", ({ store, ws, body }) => ({ overlap: checkOverlap(store, ws, str(body.text, 2000), body.excludeId) })],

  // ---------- hooks ----------
  ["POST", "/api/ws/:ws/hooks", "editor", async ({ store, ws, body }) => {
    const topic = body.topicId ? getTopic(store, ws, body.topicId) : body.itemId ? (() => { const i = getItem(store, ws, body.itemId); return i.topicId ? store.get("topics", i.topicId) || { title: i.title } : { title: i.title, format: i.format }; })() : { title: str(body.title), centralQuestion: str(body.centralQuestion), format: str(body.format) };
    if (!topic.title && !body.existingHook) throw httpError(400, "Give a topic or a hook to improve.");
    return gen.hooks(store, ws, topic, { instruction: str(body.instruction, 1000), existingHook: str(body.existingHook, 2000) });
  }],

  // Approving a hook stores it as an approved example in the library (category: hooks).
  ["POST", "/api/ws/:ws/hooks/approve", "editor", ({ store, ws, body, user }) => store.insert("references", {
    ws, kind: "note", title: `Approved hook: ${str(body.topicTitle, 200) || "untitled"}`, text: str(body.text, 4000), notes: str(body.approach, 200),
    categories: ["hooks"], tags: ["approved-hook"], approvedExample: true, createdBy: user.id,
  })],

  // ---------- scripts ----------
  ["GET", "/api/ws/:ws/scripts", "viewer", ({ store, ws }) => store.inWs("scripts", ws).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((s) => ({ id: s.id, title: s.title, status: s.status, itemId: s.itemId, topicId: s.topicId, versions: s.versions.length, updatedAt: s.updatedAt, language: s.language }))],

  ["GET", "/api/ws/:ws/scripts/:id", "viewer", ({ store, ws, params }) => getScript(store, ws, params.id)],

  ["POST", "/api/ws/:ws/scripts", "editor", ({ store, ws, body, user, workspace }) => {
    let topicId = body.topicId || null, itemId = body.itemId || null, title = str(body.title, 300);
    if (itemId) { const i = getItem(store, ws, itemId); topicId ||= i.topicId; title ||= i.title; if (i.scriptId && store.get("scripts", i.scriptId)) return store.get("scripts", i.scriptId); }
    if (topicId) title ||= getTopic(store, ws, topicId).title;
    if (!title) throw httpError(400, "Give the script a title.");
    const topic = topicId ? store.get("topics", topicId) : null;
    const initial = { v: 1, at: new Date().toISOString(), by: user.id, note: "Created", brief: null, outline: topic?.prepared?.outline || null, hooks: topic?.prepared?.hooks || [], sections: body.text ? [{ heading: "Script", text: str(body.text, 400000) }] : [], claims: [] };
    const s = store.insert("scripts", { ws, title, topicId, itemId, language: workspace.profile?.scriptLanguage || "Hindi-English", status: "draft", versions: [initial], comments: [], informedBy: topic?.prepared?.informedBy || [] });
    if (itemId) { const i = store.get("items", itemId); store.update("items", itemId, { scriptId: s.id, stage: STAGES.indexOf(i.stage) < 3 ? "Scripting" : i.stage, history: logHistory(i, user.id, "Script started") }); }
    return s;
  }],

  ["POST", "/api/ws/:ws/scripts/:id/generate", "editor", async ({ store, ws, params, body, user }) => {
    const s = getScript(store, ws, params.id);
    const topic = (s.topicId && store.get("topics", s.topicId)) || { title: s.title };
    const cur = s.versions[s.versions.length - 1];
    let result, patch;
    if (body.what === "brief") { result = await gen.brief(store, ws, topic, { useWeb: body.useWeb !== false }); patch = { brief: { ...result.data, sources: result.sources || [] } }; }
    else if (body.what === "hooks") { result = await gen.hooks(store, ws, topic, { instruction: str(body.instruction, 1000) }); patch = { hooks: result.data }; }
    else if (body.what === "outline") { result = await gen.outline(store, ws, topic, { brief: cur.brief, hook: body.hook || cur.chosenHook || cur.hooks?.[0]?.text }); patch = { outline: result.data }; }
    else if (body.what === "script") { result = await gen.script(store, ws, topic, { outline: cur.outline, brief: cur.brief, hook: body.hook || cur.chosenHook || cur.hooks?.[0]?.text }); patch = { sections: result.data.sections, claims: result.data.claimsToVerify }; }
    else throw httpError(400, "Choose brief, hooks, outline or script.");
    const note = `${body.what} ${result.origin === "ai" ? "generated" : "template added"}`;
    return store.update("scripts", s.id, { versions: newVersion(s, patch, user.id, note), informedBy: result.informedBy?.length ? result.informedBy : s.informedBy, lastNotice: result.notice || null, lastOrigin: result.origin });
  }],

  // Manual edits create a new version; old versions stay in the history.
  ["POST", "/api/ws/:ws/scripts/:id/versions", "editor", ({ store, ws, params, body, user }) => {
    const s = getScript(store, ws, params.id);
    const patch = {};
    if (body.sections) patch.sections = body.sections.map((x) => ({ heading: str(x.heading, 300), text: str(x.text, 100000) }));
    if (body.outline) patch.outline = body.outline;
    if (body.brief) patch.brief = body.brief;
    if ("chosenHook" in body) patch.chosenHook = str(body.chosenHook, 2000);
    return store.update("scripts", s.id, { versions: newVersion(s, patch, user.id, str(body.note, 200) || "Edited") });
  }],

  ["POST", "/api/ws/:ws/scripts/:id/revise", "editor", async ({ store, ws, params, body, user }) => {
    const s = getScript(store, ws, params.id);
    const cur = s.versions[s.versions.length - 1];
    const idx = Number(body.sectionIndex);
    const section = cur.sections[idx];
    if (!section) throw httpError(400, "Section not found.");
    if (!str(body.instruction).trim()) throw httpError(400, "Say how to revise the section.");
    const topic = (s.topicId && store.get("topics", s.topicId)) || { title: s.title };
    const { data } = await gen.reviseSection(store, ws, { topic, section, instruction: str(body.instruction, 1000), fullScript: cur.sections.map((x) => `## ${x.heading}\n${x.text}`).join("\n\n") });
    const sections = cur.sections.map((x, i) => (i === idx ? { ...x, text: data.text } : x));
    return store.update("scripts", s.id, { versions: newVersion(s, { sections, claims: [...(cur.claims || []), ...data.claimsToVerify] }, user.id, `Revised "${section.heading}": ${data.changeNote}`) });
  }],

  ["POST", "/api/ws/:ws/scripts/:id/restore", "editor", ({ store, ws, params, body, user }) => {
    const s = getScript(store, ws, params.id);
    const old = s.versions.find((v) => v.v === Number(body.v));
    if (!old) throw httpError(404, "Version not found.");
    const { v, at, by, note, ...content } = old;
    return store.update("scripts", s.id, { versions: newVersion(s, content, user.id, `Restored version ${old.v}`) });
  }],

  ["POST", "/api/ws/:ws/scripts/:id/comments", "viewer", ({ store, ws, params, body, user }) => {
    const s = getScript(store, ws, params.id);
    if (!str(body.text).trim()) throw httpError(400, "Write a comment.");
    return store.update("scripts", s.id, { comments: [...s.comments, { id: newId("c_"), by: user.id, byName: user.name, at: new Date().toISOString(), text: str(body.text, 4000), section: str(body.section, 300), v: s.versions.length }] });
  }],

  ["PATCH", "/api/ws/:ws/scripts/:id", "editor", ({ store, ws, params, body, user }) => {
    const s = getScript(store, ws, params.id);
    const patch = {};
    if (["draft", "in-review", "changes-requested", "approved"].includes(body.status)) {
      patch.status = body.status;
      patch.statusBy = user.id;
      patch.statusAt = new Date().toISOString();
    }
    if (body.title) patch.title = str(body.title, 300);
    if (body.language) patch.language = str(body.language, 100);
    if (body.claimStatus) {
      const cs = { ...(s.claimStatus || {}) };
      cs[str(body.claimStatus.claim, 1000)] = { status: body.claimStatus.status === "verified" ? "verified" : "open", source: str(body.claimStatus.source, 1000), by: user.id };
      patch.claimStatus = cs;
    }
    return store.update("scripts", s.id, patch);
  }],

  // ---------- content pipeline ----------
  ["GET", "/api/ws/:ws/items", "viewer", ({ store, ws }) => store.inWs("items", ws).sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"))],

  ["GET", "/api/ws/:ws/items/:id", "viewer", ({ store, ws, params }) => {
    const i = getItem(store, ws, params.id);
    return { ...i, topic: i.topicId ? store.get("topics", i.topicId) : null, script: i.scriptId ? store.get("scripts", i.scriptId) : null, references: (i.referenceIds || []).map((id) => store.get("references", id)).filter(Boolean), video: i.videoId ? store.get("videos", videoKey(ws, i.videoId)) : null };
  }],

  ["POST", "/api/ws/:ws/items", "editor", ({ store, ws, body, user }) => {
    const title = str(body.title, 300).trim();
    if (!title) throw httpError(400, "Give the item a title.");
    const overlap = checkOverlap(store, ws, title);
    return { ...store.insert("items", { ws, title, stage: STAGES.includes(body.stage) ? body.stage : "Idea", platform: PLATFORMS.includes(body.platform) ? body.platform : "youtube", format: str(body.format, 100), owner: body.owner || user.id, deadline: body.deadline || null, scriptId: null, topicId: null, referenceIds: [], titleOptions: [], thumbnailBrief: "", hook: "", publicationLink: "", notes: str(body.notes), favourite: false, history: [{ at: new Date().toISOString(), by: user.id, note: "Created" }], changes: [], experiments: [] }), overlap };
  }],

  ["PATCH", "/api/ws/:ws/items/:id", "editor", ({ store, ws, params, body, user }) => {
    const i = getItem(store, ws, params.id);
    const patch = {};
    for (const k of ["title", "format", "thumbnailBrief", "hook", "notes", "lessons", "publicationLink", "finalTitle", "thumbnailUrl"]) if (k in body) patch[k] = str(body[k], k === "notes" || k === "lessons" ? 20000 : 1000);
    if ("deadline" in body) patch.deadline = body.deadline || null;
    if ("owner" in body) patch.owner = body.owner || null;
    if ("favourite" in body) patch.favourite = !!body.favourite;
    if ("platform" in body && PLATFORMS.includes(body.platform)) patch.platform = body.platform;
    if ("titleOptions" in body) patch.titleOptions = strs(body.titleOptions, 10);
    if ("referenceIds" in body) patch.referenceIds = strs(body.referenceIds, 50).filter((id) => store.getInWs("references", ws, id));
    const notes = [];
    if (body.stage && body.stage !== i.stage) {
      if (!STAGES.includes(body.stage)) throw httpError(400, "Unknown stage.");
      patch.stage = body.stage;
      notes.push(`Moved ${i.stage} → ${body.stage}`);
      if (body.stage === "Published" && !i.publishedAt) patch.publishedAt = new Date().toISOString();
    }
    // A published link connects the item to its video so results can be tracked.
    if (patch.publicationLink) {
      const p = yt.parseInput(patch.publicationLink);
      if (p.type === "video") patch.videoId = p.id;
    }
    // After publishing, title and thumbnail changes are logged with dates so results can be read properly.
    if (i.stage === "Published" || patch.stage === "Published") {
      const changes = [...(i.changes || [])];
      for (const f of ["finalTitle", "thumbnailUrl", "thumbnailBrief"]) {
        if (f in patch && patch[f] !== (i[f] || "") && i[f]) changes.push({ at: new Date().toISOString(), by: user.id, field: f, from: i[f], to: patch[f] });
      }
      patch.changes = changes;
    }
    if (patch.title && patch.title !== i.title) notes.push("Renamed");
    if (notes.length) patch.history = logHistory(i, user.id, notes.join("; "));
    const updated = store.update("items", i.id, patch);
    if (patch.title) return { ...updated, overlap: checkOverlap(store, ws, patch.title, i.id).filter((o) => o.id !== i.topicId) };
    return updated;
  }],

  ["POST", "/api/ws/:ws/items/:id/changes", "editor", ({ store, ws, params, body, user }) => {
    const i = getItem(store, ws, params.id);
    const field = str(body.field, 100).trim();
    if (!field) throw httpError(400, "Say what changed (for example title or thumbnail).");
    return store.update("items", i.id, { changes: [...(i.changes || []), { at: body.date ? new Date(body.date).toISOString() : new Date().toISOString(), by: user.id, field, from: str(body.from, 1000), to: str(body.to, 1000), note: str(body.note, 1000) }] });
  }],

  ["POST", "/api/ws/:ws/items/:id/experiments", "editor", ({ store, ws, params, body, user }) => {
    const i = getItem(store, ws, params.id);
    if (!str(body.change).trim()) throw httpError(400, "Describe the experiment.");
    return store.update("items", i.id, { experiments: [...(i.experiments || []), { id: newId("x_"), at: new Date().toISOString(), by: user.id, change: str(body.change, 1000), measure: str(body.measure, 1000), status: "planned", result: "" }] });
  }],

  ["PATCH", "/api/ws/:ws/items/:id/experiments/:xid", "editor", ({ store, ws, params, body }) => {
    const i = getItem(store, ws, params.id);
    return store.update("items", i.id, { experiments: (i.experiments || []).map((x) => (x.id === params.xid ? { ...x, ...("status" in body ? { status: str(body.status, 40) } : {}), ...("result" in body ? { result: str(body.result, 2000) } : {}) } : x)) });
  }],

  ["DELETE", "/api/ws/:ws/items/:id", "editor", ({ store, ws, params }) => {
    const i = getItem(store, ws, params.id);
    if (i.topicId && store.get("topics", i.topicId)) store.update("topics", i.topicId, { status: "suggested", itemId: null });
    store.remove("items", i.id);
    return { ok: true };
  }],

  // ---------- Instagram Planner bridge ----------
  ["GET", "/api/ws/:ws/instagram/planner", "viewer", async ({ query }) => ig.plannerState({ fresh: query.fresh === "1" })],

  // Prepares an Instagram post for the existing scheduler. Nothing is scheduled until the
  // owner approves it in the review queue.
  ["POST", "/api/ws/:ws/items/:id/instagram", "editor", async ({ store, ws, params, body, user }) => {
    const i = getItem(store, ws, params.id);
    const state = await ig.plannerState();
    const post = { account: str(body.account, 50), publish_at: str(body.publish_at, 20).replace("T", " "), type: str(body.type, 20), media: strs(body.media, 10).join("|"), caption: str(body.caption, 2300), first_comment: str(body.first_comment, 2300) };
    const problems = ig.validatePost(post, state.accounts);
    if (problems.length) throw httpError(400, problems.join(" "));
    post.id = ig.makePostId(post.account, post.publish_at);
    const r = addReview(store, ws, { type: "ig-schedule", itemId: i.id, post, csvRow: ig.csvRow(post), title: `Schedule on Instagram @${state.accounts[post.account]}: ${i.title}`, why: `${post.type} at ${post.publish_at} IST`, needs: ig.plannerWritable() ? "Owner approval: this adds the row to posts.csv on main, and the scheduler publishes it at that time." : "GITHUB_TOKEN isn't set, so this can't be sent automatically. Copy the CSV row into posts.csv, or create it in the Instagram Planner.", requestedBy: user.id });
    store.update("items", i.id, { history: logHistory(i, user.id, `Instagram post prepared for approval (${post.id})`) });
    return r;
  }],
];
