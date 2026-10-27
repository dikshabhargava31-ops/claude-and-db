// Fill-in-the-blank drafts used when AI isn't connected or approved. They're built only from what
// the team typed (topic, question, audience) and leave [brackets] wherever a fact is needed,
// so nothing is invented. They're always labelled "Template" in the app.

const pick = (s, fallback) => (s && String(s).trim()) || fallback;

export function templateHooks(topic, profile = {}) {
  const q = pick(topic.centralQuestion, topic.title);
  const aud = pick(profile.audience, "[your viewer]");
  const subject = pick(topic.title, "[topic]");
  return [
    { approach: "Relatable situation", text: `Agar aap bhi ${aud} ho aur [specific moment they face — e.g. result day, articleship interview], toh yeh video aapke liye hai. ${q}`, whyItWorks: "Opens on a moment the viewer has lived, then states the question.", claimsToVerify: [] },
    { approach: "Contradiction", text: `Sab kehte hain [common belief about ${subject}]. Lekin [the fact that contradicts it]. Toh sach kya hai?`, whyItWorks: "Sets up tension between what people believe and what's true.", claimsToVerify: ["[the fact that contradicts it]"] },
    { approach: "Direct question", text: `${q} Seedha jawab: [one-line answer]. Par ek catch hai.`, whyItWorks: "Answers fast, then promises the nuance the video delivers.", claimsToVerify: [] },
    { approach: "Evidence-led surprise", text: `[Number or official data point] — yeh number [source] ka hai, aur iska matlab hai [implication for ${aud}].`, whyItWorks: "Leads with verifiable evidence the viewer didn't know.", claimsToVerify: ["[Number or official data point] from [source]"] },
    { approach: "Short story", text: `[Name/student] ne [what they did]. [Turn of events]. Unki galti se aap kya seekh sakte ho — ${subject}.`, whyItWorks: "A small story with a turn earns attention before the lesson.", claimsToVerify: ["Story details and consent to share them"] },
    { approach: "Strong claim", text: `${subject} ke baare mein [bold but defensible claim]. Aur is video ke end tak main yeh prove karunga with [evidence].`, whyItWorks: "Makes a promise the video must then substantiate.", claimsToVerify: ["[bold but defensible claim] — needs evidence in the video"] },
  ];
}

export function templateOutline(topic, profile = {}) {
  const fmt = pick(topic.format, "long-form");
  const short = /short|reel/i.test(fmt);
  if (short) {
    return { sections: [
      { heading: "Hook (0–3s)", purpose: "Stop the scroll with the central question or result.", beats: [pick(topic.hook, "[hook line]")] },
      { heading: "Point (3–35s)", purpose: "One idea, one example.", beats: ["[the single key point]", "[quick example or proof]"] },
      { heading: "Payoff (35–50s)", purpose: "Answer the question clearly.", beats: ["[the answer / takeaway]"] },
      { heading: "Loop / CTA", purpose: "Send to the long video or ask a comment question.", beats: ["[comment prompt or link to long video]"] },
    ], payoff: "[What the viewer knows or can do after watching]" };
  }
  return { sections: [
    { heading: "Hook (0–30s)", purpose: "Promise the answer to the central question.", beats: [pick(topic.hook, "[hook line]"), pick(topic.centralQuestion, "[central question]")] },
    { heading: "Why this matters now", purpose: "Context and stakes for the audience.", beats: [pick(topic.whyNow, "[what changed / why now]"), pick(topic.whyAudience, "[why the audience cares]")] },
    { heading: "Point 1", purpose: "Strongest evidence first.", beats: ["[claim]", "[evidence + source]", "[example]"] },
    { heading: "Point 2", purpose: "Second angle or common mistake.", beats: ["[claim]", "[evidence + source]"] },
    { heading: "The other side", purpose: "Fair counterpoint so the take is credible.", beats: ["[strongest opposing view]", "[response]"] },
    { heading: "Payoff", purpose: "Answer the central question clearly.", beats: [pick(topic.angle, "[your original take]")] },
    { heading: "Close / CTA", purpose: "One next step and a discussion question.", beats: ["[comment question]", "[next video]"] },
  ], payoff: pick(topic.angle, "[What the viewer should conclude]") };
}

export function templateBrief(topic) {
  return {
    summary: `${pick(topic.title, "[topic]")}: ${pick(topic.centralQuestion, "[central question]")}`,
    keyFacts: [{ claim: "[fact 1 — add from an official source]", source: "", needsVerification: true }],
    audienceQuestions: ["[question viewers ask about this]"],
    angle: pick(topic.angle, "[original angle]"),
    openQuestions: [pick(topic.researchGaps, "[what we still need to find out]")],
  };
}

export function templateScript(outline) {
  return {
    sections: (outline?.sections || []).map((s) => ({ heading: s.heading, text: (s.beats || []).map((b) => `${b}`).join("\n") })),
    claimsToVerify: ["Every [bracketed] line needs a sourced fact before recording."],
  };
}
