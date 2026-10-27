// Research: YouTube search (keywords, topics, channel names, links), link import and outliers.
import { get, post } from "../api.js";
import { esc, num, source, loading, empty, errorBox, toast, formData, busy } from "../ui.js";
import { videoCard, parseVideo, saveReference, developIdea } from "../actions.js";

export default async function research(el, ctx) {
  const [channels, method] = await Promise.all([get(`${ctx.base}/channels`), get(`${ctx.base}/method`)]);
  const yt = ctx.ws.status.youtubeData;
  el.innerHTML = `
    <div class="row between"><h1>Research</h1>${source(yt.state)}</div>
    ${yt.state !== "live" ? `<div class="notice">YouTube search needs the YouTube Data API key (server .env). You can still import a single video by link below (title, channel and thumbnail only), or import a CSV of videos in Channels.</div>` : `<p class="faint">${esc(yt.detail)} Searches cost 100 units; links and channel lookups cost 1–3.</p>`}
    <form class="card" id="searchForm">
      <label>Search YouTube<input name="input" placeholder="Keywords, a topic, a channel name, @handle, or a video/channel link" required></label>
      <div class="grid g4">
        <label>Look for<select name="mode"><option value="videos">Videos</option><option value="channels">Channels</option></select></label>
        <label>Published<select name="period"><option value="">Any time</option><option value="week">Past week</option><option value="month">Past month</option><option value="quarter">Past 3 months</option><option value="year">Past year</option></select></label>
        <label>Format<select name="format"><option value="">Any</option><option value="long">Long-form</option><option value="short">Shorts (≤3 min)</option></select></label>
        <label>Sort<select name="order"><option value="relevance">Relevance</option><option value="date">Newest</option><option value="viewCount">Most viewed</option></select></label>
        <label>Channel<select name="channelRowId"><option value="">All of YouTube</option>${channels.filter((c) => c.ytChannelId).map((c) => `<option value="${c.id}">${esc(c.title)} (${c.list})</option>`).join("")}</select></label>
        <label>Performance<select name="minScore"><option value="">Any</option><option value="1.5">1.5× own baseline or more</option><option value="2">2× (outliers)</option><option value="3">3× (strong outliers)</option></select></label>
      </div>
      <div class="row"><button class="btn primary" ${yt.state !== "live" ? "disabled" : ""}>Search</button><span class="faint">Performance filtering works for channels saved in this workspace, because each video is compared with its own channel.</span></div>
    </form>
    <form class="card row" id="linkForm"><input name="url" placeholder="Paste one YouTube video link to import it" style="flex:1;min-width:220px" required><button class="btn">Import link</button></form>
    <div id="results"></div>
    <div class="card">
      <div class="row between"><h2>Outliers among saved channels</h2>
        <form class="row" id="outForm">
          <select name="list"><option value="">Competitors + inspiration</option><option value="competitor">Competitors</option><option value="inspiration">Inspiration</option><option value="own">My channel</option></select>
          <select name="days"><option value="30">30 days</option><option value="90" selected>90 days</option><option value="365">1 year</option></select>
          <select name="format"><option value="">Any format</option><option value="long">Long-form</option><option value="short">Shorts</option></select>
          <select name="min"><option value="2">2×+</option><option value="3">3×+</option><option value="1.5">1.5×+</option></select>
        </form></div>
      <details><summary>How outliers are measured</summary><ul>${method.method.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></details>
      <div id="outliers">${loading()}</div>
    </div>`;

  const results = el.querySelector("#results");
  const showVideos = (videos, channelsFound, meta = "") => {
    results.innerHTML = `<div class="card"><div class="row between"><h2>Results</h2><span class="faint">${meta}</span></div>
      ${channelsFound?.length ? `<h3>Channels</h3><div class="table-wrap"><table><tbody>${channelsFound.map((c) => `<tr><td>${c.thumb ? `<img src="${esc(c.thumb)}" alt="" width="36" height="36" style="border-radius:50%">` : ""}</td><td><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.title)}</a><div class="faint">${esc(c.handle || "")}</div></td><td class="num">${num(c.subscribers)} subs</td><td class="num">${num(c.videoCount)} videos</td><td>${ctx.canEdit ? `<button class="btn small" data-act="addCh" data-id="${esc(c.ytChannelId)}" data-list="competitor">Add competitor</button> <button class="btn small" data-act="addCh" data-id="${esc(c.ytChannelId)}" data-list="inspiration">Add inspiration</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : ""}
      ${videos.length ? `<div class="videos">${videos.map((v) => videoCard(v, { actions: ctx.canEdit ? ["save", "develop"] : [] })).join("")}</div>` : channelsFound?.length ? "" : empty("No videos matched. Try fewer filters or other words.")}</div>`;
  };

  el.querySelector("#searchForm").onsubmit = async (e) => {
    e.preventDefault();
    const body = formData(e.target);
    results.innerHTML = loading("Searching YouTube…");
    try {
      const r = await post(`${ctx.base}/search`, body);
      showVideos(r.videos, r.channels, `Live data · fetched ${new Date(r.fetchedAt).toLocaleTimeString("en-IN")} · quota used today ${num(r.quotaUsed)}`);
    } catch (err) { results.innerHTML = errorBox(err); }
  };

  el.querySelector("#linkForm").onsubmit = async (e) => {
    e.preventDefault();
    results.innerHTML = loading("Reading the link…");
    try {
      const r = await post(`${ctx.base}/videos/lookup`, { url: e.target.url.value });
      showVideos([r.video], [], r.video.partial ? "Imported via YouTube oEmbed: views, date and duration need the API key." : "Live data");
    } catch (err) { results.innerHTML = errorBox(err); }
  };

  const outForm = el.querySelector("#outForm");
  const loadOutliers = async () => {
    const box = el.querySelector("#outliers");
    box.innerHTML = loading();
    const q = new URLSearchParams(Object.entries(formData(outForm)).filter(([, v]) => v));
    try {
      const r = await get(`${ctx.base}/outliers?${q}`);
      box.innerHTML = r.videos.length ? `<div class="videos">${r.videos.map((v) => videoCard(v, { actions: ctx.canEdit ? ["save", "develop"] : [] })).join("")}</div>` : empty(channels.length ? "No outliers match these filters. Refresh channels (Channels page) or run research to update data." : "Add competitor and inspiration channels in <a href='#/channels'>Channels</a> to find their outliers.");
    } catch (err) { box.innerHTML = errorBox(err); }
  };
  outForm.onchange = loadOutliers;
  loadOutliers();

  el.onclick = async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "saveRef") { const r = await saveReference(ctx, { video: parseVideo(b) }); if (r) b.outerHTML = '<span class="pill done">Saved</span>'; }
    if (b.dataset.act === "develop") await developIdea(ctx, { video: parseVideo(b) }, b);
    if (b.dataset.act === "addCh") {
      try { const c = await busy(b, () => post(`${ctx.base}/channels`, { input: b.dataset.id, list: b.dataset.list }), "Adding…"); toast(`${c.title} added to ${b.dataset.list} channels.`); b.parentElement.innerHTML = `<span class="pill done">Added</span>`; }
      catch (err) { toast(err.message, true); }
    }
  };
}
