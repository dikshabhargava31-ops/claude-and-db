// Content generation: topic cards, hooks, briefs, outlines, scripts, section revisions,
// reference analysis, tags and performance hypotheses. Each function returns
// { data, origin: "ai" | "template", informedBy, sources?, notice? }.
import * as ai from "./ai.js";
import { S } from "./ai.js";
import { relevantReferences, approvedPreferences, contextForPrompt } from "./retrieve.js";
import { templateHooks, templateOutline, templateBrief, templateScript } from "./templates.js";

const { str, strs, obj, arr, enumOf } = S;

// AI isn't connected or spending isn't approved: fall back to a labelled template.
function aiUnavailable(e) {
  return e?.integration === "ai" && (e.status === 503 || e.status === 402);
}

async function withFallback(fn, fallback) {
  try {
    return await fn();
  } catch (e) {
    if (!aiUnavailable(e) || !fallback) throw e;
    return { ...fallback(), origin: "template", notice: e.message };
  }
}

function topicText(t) {
  return [t.title, t.centralQuestion, t.angle, t.whyAudience, t.whyNow].filter(Boolean).join("\n");
}

function context(store, ws, query, categories) {
  const refs = relevantReferences(store, ws, query, { categories });
  const prefs = approvedPreferences(store, ws);
  return { refs, prefs, text: contextForPrompt(refs, prefs) };
}

function rejectedLines(store, ws) {
  const rejected = store.inWs("topics", ws, (t) => t.status === "rejected").slice(-30);
  return rejected.length ? "Ideas the team rejected (don't suggest these again; learn from the reasons):\n" + rejected.map((t) => `- ${t.title}${t.rejectReason ? ` — reason: ${t.rejectReason}` : ""}`).join("\n") : "";
}

const informed = (refs) => refs.map((r) => ({ id: r.id, title: r.title, reason: r.reason, approvedExample: r.approvedExample }));

// ---------- topic cards ----------
export const TOPIC_SCHEMA = obj({
  topics: arr(obj({
    title: str, centralQuestion: str, whyAudience: str, whyNow: str, angle: str,
    titles: strs, thumbnailConcept: str, hook: str, format: str,
    tags: arr(enumOf("evergreen", "timely", "controversial", "contrarian", "educational", "career", "student-relatable")),
    sources: arr(obj({ title: str, url: str })), referenceVideoIds: strs, referenceIds: strs,
    researchGaps: str, confidence: enumOf("high", "medium", "low"),
  })),
});

export async function topicCards(store, ws, { evidence, count = 6, focus = "" }) {
  const ctx = context(store, ws, evidence.slice(0, 3000) + " " + focus, ["topic-research", "titles", "hooks"]);
  const data = await ai.json(store, ws, {
    effort: "high",
    system: "You turn research evidence into video opportunity cards for this channel.",
    schema: TOPIC_SCHEMA,
    prompt: `${ctx.text}\n\n${rejectedLines(store, ws)}\n\nEvidence gathered by the research run (outliers, audience questions, search results, current developments, our own performance). Use only this evidence; cite source URLs and video IDs exactly as given:\n${evidence}\n\n${focus ? "Focus: " + focus + "\n" : ""}Propose ${count} distinct video opportunities, best first. For each: a proposed topic and central question; why this audience would care; why now (or "evergreen"); sources and reference video IDs from the evidence; an original angle for this channel; exactly three title options (English); a thumbnail concept (English text on thumbnail, max 4 words); a possible opening hook in the channel's script language; the recommended format (long-form, Short, Reel, or both); research gaps; and confidence (high only when the evidence is strong). Prefer substantive, relatable ideas with a clear discussion point. No generic motivation, no forced controversy.`,
  });
  return { data: data.topics, origin: "ai", informedBy: informed(ctx.refs) };
}

// ---------- hooks ----------
const HOOK_SCHEMA = obj({ hooks: arr(obj({ approach: enumOf("Relatable situation", "Contradiction", "Direct question", "Evidence-led surprise", "Short story", "Strong claim"), text: str, whyItWorks: str, claimsToVerify: strs, referenceIds: strs })) });

export async function hooks(store, ws, topic, { instruction = "", existingHook = "" } = {}) {
  const w = store.get("workspaces", ws);
  const ctx = context(store, ws, topicText(topic) + " " + existingHook, ["hooks"]);
  return withFallback(async () => {
    const data = await ai.json(store, ws, {
      schema: HOOK_SCHEMA,
      prompt: `${ctx.text}\n\nTopic:\n${topicText(topic)}\nFormat: ${topic.format || "long-form"}\n${existingHook ? `Current hook to improve:\n${existingHook}\n` : ""}${instruction ? `Instruction: ${instruction}\n` : ""}\nWrite opening hooks in the channel's script language (${w.profile?.scriptLanguage || "natural Hindi-English"}), in its speaking style, using the approved examples as a style guide without copying them. Give at least one of each approach: relatable situation, contradiction, direct question, evidence-led surprise, short story, strong claim the video can substantiate. Each hook: 1–3 spoken sentences. List claims that need verification. referenceIds: the [ref:ID] values that informed it.`,
    });
    return { data: data.hooks, origin: "ai", informedBy: informed(ctx.refs) };
  }, () => ({ data: templateHooks(topic, w.profile), informedBy: informed(ctx.refs) }));
}

// ---------- research brief ----------
const BRIEF_SCHEMA = obj({ summary: str, keyFacts: arr(obj({ claim: str, source: str, needsVerification: { type: "boolean" } })), audienceQuestions: strs, angle: str, openQuestions: strs });

export async function brief(store, ws, topic, { useWeb = true } = {}) {
  const ctx = context(store, ws, topicText(topic), ["topic-research"]);
  return withFallback(async () => {
    let web = { text: "", sources: [] };
    if (useWeb) web = await ai.research(store, ws, `Research this video topic for an Indian audience. Find current, credible facts (official bodies first), recent developments, and the main debate.\n\n${topicText(topic)}`);
    const data = await ai.json(store, ws, {
      schema: BRIEF_SCHEMA,
      prompt: `${ctx.text}\n\nTopic:\n${topicText(topic)}\n\nWeb research notes:\n${web.text || "(no web research)"}\n\nSources found:\n${web.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n") || "(none)"}\n\nWrite a research brief. keyFacts: each claim with the URL it came from (or "" if from saved references), needsVerification true unless it comes from an official or primary source above. Never add facts not in the notes or references.`,
    });
    return { data, origin: "ai", informedBy: informed(ctx.refs), sources: web.sources };
  }, () => ({ data: templateBrief(topic), informedBy: informed(ctx.refs), sources: [] }));
}

// ---------- outline ----------
const OUTLINE_SCHEMA = obj({ sections: arr(obj({ heading: str, purpose: str, beats: strs })), payoff: str });

export async function outline(store, ws, topic, { brief: b, hook } = {}) {
  const ctx = context(store, ws, topicText(topic), ["script-structures", "hooks"]);
  return withFallback(async () => {
    const data = await ai.json(store, ws, {
      schema: OUTLINE_SCHEMA,
      prompt: `${ctx.text}\n\nTopic:\n${topicText(topic)}\nFormat: ${topic.format || "long-form"}\nChosen hook: ${hook || topic.hook || "(none yet)"}\nResearch brief: ${b ? JSON.stringify(b) : "(none)"}\n\nWrite an outline: sections with purpose and beats, pacing suited to the format, a retention device between sections, and a clear payoff that answers the central question. Use structure principles from the references, not their content.`,
    });
    return { data, origin: "ai", informedBy: informed(ctx.refs) };
  }, () => ({ data: templateOutline(topic), informedBy: informed(ctx.refs) }));
}

// ---------- full script ----------
const SCRIPT_SCHEMA = obj({ sections: arr(obj({ heading: str, text: str })), claimsToVerify: strs });

export async function script(store, ws, topic, { outline: o, brief: b, hook } = {}) {
  const w = store.get("workspaces", ws);
  const ctx = context(store, ws, topicText(topic), ["script-structures", "hooks"]);
  return withFallback(async () => {
    const data = await ai.json(store, ws, {
      effort: "high", maxTokens: 32000, schema: SCRIPT_SCHEMA,
      prompt: `${ctx.text}\n\nTopic:\n${topicText(topic)}\nFormat: ${topic.format || "long-form"}\nHook: ${hook || topic.hook || ""}\nOutline: ${JSON.stringify(o || {})}\nBrief: ${JSON.stringify(b || {})}\n\nWrite the full spoken script in ${w.profile?.scriptLanguage || "natural Hindi-English (Hinglish, Roman script)"}, conversational, in the channel's tone. Follow the outline's sections. Mark each fact needing a check inline with [VERIFY: ...] and list them in claimsToVerify. Original wording only.`,
    });
    return { data, origin: "ai", informedBy: informed(ctx.refs) };
  }, () => ({ data: templateScript(o || templateOutline(topic)), informedBy: informed(ctx.refs) }));
}

export async function reviseSection(store, ws, { topic, section, instruction, fullScript }) {
  const data = await ai.json(store, ws, {
    schema: obj({ text: str, claimsToVerify: strs, changeNote: str }),
    prompt: `Topic: ${topicText(topic)}\n\nWhole script for context:\n${fullScript.slice(0, 12000)}\n\nRevise only this section, keeping the language and tone:\n## ${section.heading}\n${section.text}\n\nInstruction: ${instruction}\nReturn the new section text, claims needing verification, and a one-line note of what changed.`,
  });
  return { data, origin: "ai" };
}

// ---------- references ----------
export async function analyzeReference(store, ws, { title, text }) {
  const data = await ai.json(store, ws, {
    schema: obj({ hook: str, structure: arr(obj({ part: str, whatItDoes: str, approxShare: str })), pacing: str, transitions: str, payoff: str, principles: strs, avoidCopying: strs }),
    prompt: `Analyse this reference script or transcript for craft, so the team can apply the principles in original work.\nTitle: ${title || "(untitled)"}\n\n${text.slice(0, 60000)}\n\nDescribe: how the hook works; the structure (parts, what each does, rough share of runtime); pacing; transitions; payoff. List transferable principles, and list distinctive phrases/stories that must NOT be copied.`,
  });
  return { data, origin: "ai" };
}

const CATEGORIES = ["topic-research", "titles", "thumbnails", "hooks", "script-structures", "editing-styles", "visual-storytelling"];

export async function tagReference(store, ws, ref, image) {
  const content = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mime, data: image.data.toString("base64") } });
  content.push({ type: "text", text: `Suggest a 1–2 sentence summary, 3–8 short lowercase tags, and categories for this saved reference.\nTitle: ${ref.title || ""}\nLink: ${ref.url || ""}\nNotes/text: ${(ref.text || ref.notes || "").slice(0, 8000)}` });
  const { content: out } = await ai.ask(store, ws, {
    effort: "low", maxTokens: 2000,
    messages: [{ role: "user", content }],
    format: { type: "json_schema", schema: obj({ summary: str, tags: strs, categories: arr(enumOf(...CATEGORIES)) }) },
  });
  return JSON.parse(ai.textOf(out));
}

// ---------- performance ----------
export async function explainPerformance(store, ws, { subject, observed, isCompetitor }) {
  const data = await ai.json(store, ws, {
    schema: obj({ likelyExplanations: arr(obj({ hypothesis: str, basedOn: str, confidence: enumOf("high", "medium", "low") })), experiments: arr(obj({ change: str, measure: str, expectedSignal: str })), dataGaps: strs }),
    prompt: `${subject}\n\nObserved evidence (the only data available — do not add numbers):\n${observed.map((o) => "- " + o).join("\n")}\n\n${isCompetitor ? "This is a competitor's video: only public data exists. Do not infer its CTR, retention or watch time.\n" : ""}Give likely explanations as hypotheses (each tied to a specific observation), recommended experiments for our next videos with what to measure, and the data gaps that limit this analysis.`,
  });
  return { data, origin: "ai" };
}
