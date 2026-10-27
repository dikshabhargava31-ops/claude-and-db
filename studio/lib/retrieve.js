// Finds the saved references and approved preferences relevant to a piece of work, and says why,
// so every generated suggestion can show which references informed it.
import { tokens } from "./overlap.js";

export function refText(r) {
  return [r.title, r.summary, (r.tags || []).join(" "), (r.categories || []).join(" "), r.notes, (r.text || "").slice(0, 4000)].filter(Boolean).join(" ");
}

export function relevantReferences(store, ws, query, { categories, limit = 6 } = {}) {
  const q = new Set(tokens(query));
  const refs = store.inWs("references", ws, (r) => !r.archived);
  const scored = refs.map((r) => {
    const t = tokens(refText(r));
    const matched = [...new Set(t.filter((w) => q.has(w)))];
    let score = matched.length / Math.sqrt(t.length + 5);
    const catMatch = categories?.filter((c) => r.categories?.includes(c)) || [];
    if (catMatch.length) score += 0.6;
    if (r.approvedExample) score += 0.4;
    return { ref: r, score, matched: matched.slice(0, 6), catMatch };
  }).filter((x) => x.score > 0.15);
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => ({
    id: x.ref.id, title: x.ref.title, categories: x.ref.categories, approvedExample: !!x.ref.approvedExample,
    url: x.ref.url || null, summary: x.ref.summary || "", text: (x.ref.text || "").slice(0, 3000),
    reason: [
      x.ref.approvedExample ? "approved example" : null,
      x.catMatch.length ? `category: ${x.catMatch.join(", ")}` : null,
      x.matched.length ? `matches: ${x.matched.join(", ")}` : null,
    ].filter(Boolean).join(" · "),
  }));
}

export function approvedPreferences(store, ws) {
  return store.inWs("preferences", ws, (p) => p.status === "approved");
}

export function contextForPrompt(refs, prefs) {
  const parts = [];
  if (prefs.length) parts.push("Approved style preferences (follow these):\n" + prefs.map((p) => `- ${p.statement}`).join("\n"));
  if (refs.length) {
    parts.push("Saved references (learn principles only; do not copy wording). Cite them by [ref:ID] when they inform a suggestion:\n" +
      refs.map((r) => `[ref:${r.id}] ${r.approvedExample ? "(APPROVED EXAMPLE) " : ""}${r.title} — ${r.categories?.join(", ") || ""}\n${r.summary || ""}\n${r.text ? r.text.slice(0, 1500) : ""}`).join("\n---\n"));
  }
  return parts.join("\n\n");
}
