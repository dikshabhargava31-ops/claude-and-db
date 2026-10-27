// Actions that appear on many pages and must behave the same everywhere:
// Save Reference, Develop Idea, Shortlist, Develop Script, Add to Planner.
import { post } from "./api.js";
import { esc, num, date, dur, source, scorePill, modal, toast, formData, busy, CATEGORY_LABELS, PLATFORMS, overlapNote } from "./ui.js";

export function videoCard(v, { actions = ["save", "develop"], extra = "" } = {}) {
  const key = encodeURIComponent(JSON.stringify({ videoId: v.videoId, title: v.title, channelTitle: v.channelTitle, channelId: v.channelId, thumb: v.thumb, views: v.views, likes: v.likes, comments: v.comments, publishedAt: v.publishedAt, durationSec: v.durationSec, scoreText: v.scoreText, source: v.source, url: v.url }));
  const eng = v.views && v.likes != null ? `${(((v.likes || 0) + (v.comments || 0)) / v.views * 100).toFixed(1)}% eng.` : "";
  return `<article class="vcard">
    <div class="thumb">${v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy">` : "No thumbnail"}
      ${v.durationSec != null ? `<span class="dur">${dur(v.durationSec)}${v.format === "short" ? " · Short" : ""}</span>` : ""}
      <span class="score">${scorePill(v.score)}</span></div>
    <div class="body">
      <a class="title" href="${esc(v.url || "https://www.youtube.com/watch?v=" + v.videoId)}" target="_blank" rel="noopener noreferrer">${esc(v.title)}</a>
      <div class="muted" style="font-size:.88rem">${esc(v.channelTitle || "")}${v.tracked ? ` <span class="tag">${esc(v.tracked)}</span>` : ""}</div>
      <div style="font-size:.88rem">${num(v.views)} views · ${v.likes != null ? num(v.likes) + " likes · " : ""}${v.comments != null ? num(v.comments) + " comments · " : ""}${date(v.publishedAt)} ${eng ? "· " + eng : ""}</div>
      ${v.scoreText ? `<div class="faint" style="font-size:.82rem">${esc(v.scoreText)}</div>` : ""}
      <div>${source(v.source)}${v.saved ? ' <span class="pill done">Saved</span>' : ""}</div>
      ${extra}
      <div class="actions">
        ${actions.includes("save") ? `<button class="btn small" data-act="saveRef" data-video="${key}">Save Reference</button>` : ""}
        ${actions.includes("develop") ? `<button class="btn small" data-act="develop" data-video="${key}">Develop Idea</button>` : ""}
        ${actions.includes("analyse") ? `<button class="btn small" data-act="analyse" data-id="${esc(v.videoId)}">Analyse</button>` : ""}
      </div>
    </div></article>`;
}

export const parseVideo = (btn) => JSON.parse(decodeURIComponent(btn.dataset.video));

export function saveReference(ctx, { video, url = "", title = "", text = "", categories = [] } = {}) {
  return modal((box, close) => {
    box.innerHTML = `<h2>Save Reference</h2>
      ${video ? `<p class="muted">${esc(video.title)} — ${esc(video.channelTitle || "")}</p>` : ""}
      <form>
        ${video ? "" : `<label>Link<input name="url" value="${esc(url)}" placeholder="https://…"></label><label>Title<input name="title" value="${esc(title)}"></label>`}
        <fieldset><legend>Why save it? (categories)</legend>${Object.entries(CATEGORY_LABELS).map(([k, l]) => `<label class="check"><input type="checkbox" name="categories" value="${k}" ${categories.includes(k) ? "checked" : ""}>${l}</label>`).join("")}</fieldset>
        <label>Notes (what to learn from it)<textarea name="notes"></textarea></label>
        ${video ? "" : `<label>Text or transcript (optional)<textarea name="text">${esc(text)}</textarea></label>`}
        <label>Tags (comma separated)<input name="tags"></label>
        <div class="row"><button class="btn primary">Save Reference</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div>
      </form>`;
    const form = box.querySelector("form");
    box.querySelector("[data-cancel]").onclick = () => close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = formData(form);
      const body = { kind: video ? "video" : d.text ? "transcript" : "link", url: video ? video.url || `https://www.youtube.com/watch?v=${video.videoId}` : d.url, title: video ? video.title : d.title, text: d.text || "", notes: d.notes, categories: d.categories, tags: d.tags, video };
      try {
        const r = await busy(form.querySelector(".btn.primary"), () => post(`${ctx.base}/references`, body));
        toast("Saved to the Reference Library.");
        close(r);
      } catch (err) { toast(err.message, true); }
    };
  });
}

export async function developIdea(ctx, { video, referenceId }, btn) {
  const instruction = await modal((box, close) => {
    box.innerHTML = `<h2>Develop an original idea</h2><p class="muted">The assistant uses this reference as a starting point and proposes our own angle, question and evidence — not a remake.</p>
      <form><label>Direction for the angle (optional)<input name="i" placeholder="e.g. focus on CA Inter students after results"></label>
      <div class="row"><button class="btn primary">Develop Idea</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div></form>`;
    box.querySelector("[data-cancel]").onclick = () => close(null);
    box.querySelector("form").onsubmit = (e) => { e.preventDefault(); close(e.target.i.value); };
  });
  if (instruction === null || instruction === undefined) return null;
  try {
    const t = await busy(btn, () => post(`${ctx.base}/topics/develop`, { video, referenceId, instruction }), "Developing…");
    toast(t.origin === "template" ? "Topic card created for you to fill in (AI not available)." : "Original topic idea created in Opportunities.");
    ctx.nav(`opportunities?open=${t.id}`);
    return t;
  } catch (e) { toast(e.message, true); return null; }
}

export async function shortlist(ctx, topicId, btn) {
  try {
    const item = await busy(btn, () => post(`${ctx.base}/topics/${topicId}/shortlist`), "Shortlisting…");
    toast("Shortlisted — added to the Content Planner.");
    return item;
  } catch (e) { toast(e.message, true); return null; }
}

// Opens the Script Studio for a topic or a planner item, creating the planner item and script as needed.
export async function developScript(ctx, { topicId, itemId }, btn) {
  try {
    const script = await busy(btn, async () => {
      if (!itemId && topicId) itemId = (await post(`${ctx.base}/topics/${topicId}/shortlist`)).id;
      return post(`${ctx.base}/scripts`, { itemId });
    }, "Opening…");
    ctx.nav(`scripts/${script.id}`);
  } catch (e) { toast(e.message, true); }
}

export function addToPlanner(ctx, { title = "", notes = "" } = {}) {
  return modal((box, close) => {
    box.innerHTML = `<h2>Add to Planner</h2><form>
      <label>Title<input name="title" required value="${esc(title)}"></label>
      <div class="grid g2"><label>Platform<select name="platform">${Object.entries(PLATFORMS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
      <label>Deadline<input type="date" name="deadline"></label></div>
      <label>Notes<textarea name="notes">${esc(notes)}</textarea></label>
      <div id="ov"></div>
      <div class="row"><button class="btn primary">Add to Planner</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div></form>`;
    const form = box.querySelector("form");
    box.querySelector("[data-cancel]").onclick = () => close();
    form.title.onblur = async () => {
      if (!form.title.value.trim()) return;
      const r = await post(`${ctx.base}/overlap`, { text: form.title.value }).catch(() => ({ overlap: [] }));
      box.querySelector("#ov").innerHTML = overlapNote(r.overlap);
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const item = await busy(form.querySelector(".btn.primary"), () => post(`${ctx.base}/items`, formData(form)));
        toast("Added to the Content Planner (Idea).");
        close(item);
      } catch (err) { toast(err.message, true); }
    };
  });
}
