// Duplicate-topic detection for English and Hindi-English (Hinglish) titles.
// Compares word sets and word pairs; reports the closest existing items with a score 0–1.

const STOP = new Set(`a an the and or but of to in on for with at by from is are was were be been it this that these those
as how what why when who which your you my our we i me us do does did can will should would could not no vs versus
about into than then so if all any more most very just new video full part episode ep live
kya hai hain ho ke ki ka ko se me mein main aur bhi to toh kaise kyun kyu kab kaun ye yeh wo woh hum aap tum ek
par pe tak sab koi kuch bahut nahi nahin na hi jo raha rahe rahi wala wale wali`.split(/\s+/));

// Folds common spelling variants so "C.A." and "CA", "exams" and "exam" match.
export function tokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/c\.a\./g, "ca")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
}

function features(text) {
  const t = tokens(text);
  const set = new Set(t);
  for (let i = 0; i < t.length - 1; i++) set.add(t[i] + "_" + t[i + 1]);
  return { set, words: new Set(t) };
}

export function similarity(a, b) {
  const fa = features(a), fb = features(b);
  if (!fa.words.size || !fb.words.size) return 0;
  let inter = 0;
  for (const x of fa.set) if (fb.set.has(x)) inter++;
  const jaccard = inter / (fa.set.size + fb.set.size - inter);
  let wordInter = 0;
  for (const w of fa.words) if (fb.words.has(w)) wordInter++;
  // Containment catches a short idea that sits inside a longer published title.
  const containment = wordInter / Math.min(fa.words.size, fb.words.size);
  return Math.round(Math.max(jaccard, containment * 0.8) * 100) / 100;
}

export const WARN_AT = 0.45;
export const STRONG_AT = 0.65;

// candidates: [{id, kind, title, text?, status?}] — returns the matches above WARN_AT, best first.
export function findOverlaps(text, candidates, { excludeId, limit = 5 } = {}) {
  return candidates
    .filter((c) => c.id !== excludeId)
    .map((c) => ({ ...c, score: similarity(text, [c.title, c.text].filter(Boolean).join(" ")) }))
    .filter((c) => c.score >= WARN_AT)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => ({ id: c.id, kind: c.kind, title: c.title, status: c.status, score: c.score, level: c.score >= STRONG_AT ? "strong" : "possible" }));
}
