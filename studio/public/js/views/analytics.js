// Analytics: YouTube long-form, YouTube Shorts and Instagram, each against its own baseline,
// with evidence → hypotheses → experiments, and the idea-to-results chain for each item.
import { get, post } from "../api.js";
import { esc, num, date, ago, source, scorePill, loading, empty, errorBox, toast, modal, busy } from "../ui.js";

const TABS = { "youtube-long": "YouTube long-form", "youtube-short": "YouTube Shorts", instagram: "Instagram" };
const r = (x) => (x == null ? "" : ` <span class="${x >= 1.2 ? "up" : x <= 0.8 ? "down" : "faint"}">(${x}×)</span>`);

function lineageHtml(l) {
  if (!l) return '<p class="faint">Not linked to a planner item. Add the publication link to the item in the Content Planner to connect idea → results.</p>';
  return `<div class="lineage">
    <div><b>Idea</b>${l.idea.id ? `<a href="#/opportunities?open=${l.idea.id}">${esc(l.idea.title)}</a>` : esc(l.idea.title)}</div>
    <div><b>Hook</b>${esc(l.hook || "—")}</div>
    <div><b>Title & thumbnail</b>${esc(l.title)}<br><span class="faint">${esc(l.thumbnail || "")}</span></div>
    <div><b>Script</b>${l.script ? `<a href="#/scripts/${l.script.id}">${esc(l.script.status)}, v${l.script.versions}</a>` : "—"}</div>
    <div><b>Lessons</b>${esc(l.lessons || "—")} <a href="#/planner?open=${l.itemId}">edit</a></div></div>
    ${l.changes.length ? `<p class="faint" style="margin-top:6px">Changes after publishing: ${l.changes.map((c) => `${date(c.at)} ${esc(c.field)}: “${esc(c.from)}” → “${esc(c.to)}”`).join("; ")}</p>` : ""}
    ${l.experiments.length ? `<p class="faint">Experiments: ${l.experiments.map((x) => `${esc(x.change)} (${esc(x.status)})`).join("; ")}</p>` : ""}`;
}

export function openAnalysis(ctx, videoId) {
  return modal(async (box, close) => {
    box.innerHTML = loading("Gathering evidence…");
    let a;
    try { a = await get(`${ctx.base}/videos/${encodeURIComponent(videoId)}/analysis`); } catch (err) { box.innerHTML = errorBox(err); return; }
    const draw = (ex) => {
      box.innerHTML = `<div class="row between"><h2>${esc(a.video.title)}</h2><button class="btn ghost" data-close>Close</button></div>
        <p class="faint">${esc(a.channel?.title || "")} · ${a.isOwn ? "our video" : esc(a.channel?.list || "") + " channel"} · ${source(a.video.source)}</p>
        <div class="grid g2" style="align-items:start">
          <div class="card"><h3>1. Observed evidence</h3><ul>${a.observed.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
            ${a.retention ? `<p class="faint">Retention curve from YouTube Analytics (organic views).</p>` : ""}</div>
          <div class="card"><h3>Limits of this analysis</h3>${a.limits.length ? `<ul>${a.limits.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : '<p class="faint">Authorised analytics available.</p>'}</div>
        </div>
        <div class="card"><div class="row between"><h3>2. Likely explanations (hypotheses, not proven causes)</h3>${ctx.canEdit && !ex ? '<button class="btn primary" data-act="explain">Suggest explanations and experiments</button>' : ""}</div>
          ${ex ? `${ex.origin === "rules" ? `<div class="notice">Rule-based hypotheses (AI unavailable: ${esc(ex.notice || "")}).</div>` : ""}
            ${ex.likelyExplanations.length ? `<ul>${ex.likelyExplanations.map((h) => `<li>${esc(h.hypothesis)} <span class="pill ${h.confidence === "high" ? "done" : "warn"}">${esc(h.confidence)}</span><div class="faint">Based on: ${esc(h.basedOn)}</div></li>`).join("")}</ul>` : '<p class="faint">Not enough evidence to suggest a likely explanation.</p>'}
            <h3>3. Recommended experiments</h3>${ex.experiments?.length ? `<ul>${ex.experiments.map((x) => `<li><b>${esc(x.change)}</b> — measure ${esc(x.measure)}${x.expectedSignal ? `; look for ${esc(x.expectedSignal)}` : ""}</li>`).join("")}</ul>` : '<p class="faint">None suggested.</p>'}
            ${ex.dataGaps?.length ? `<p class="faint">Data gaps: ${ex.dataGaps.map(esc).join("; ")}</p>` : ""}` : '<p class="faint">Explanations are generated only on request and are always labelled as hypotheses.</p>'}
        </div>
        <details><summary>How the comparison works</summary><ul>${a.method.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></details>`;
      box.querySelector("[data-close]").onclick = () => close();
      const b = box.querySelector("[data-act=explain]");
      if (b) b.onclick = async () => {
        try { const res = await busy(b, () => post(`${ctx.base}/videos/${encodeURIComponent(videoId)}/explain`), "Thinking…"); a = res; draw(res.explanation); }
        catch (err) { toast(err.message, true); }
      };
    };
    draw(null);
  }, { wide: true });
}

export default async function analytics(el, ctx) {
  const platform = TABS[ctx.query.platform] ? ctx.query.platform : "youtube-long";
  const st = ctx.ws.status;
  el.innerHTML = `
    <div class="row between"><h1>Analytics</h1>${ctx.canEdit ? `<button class="btn primary" id="refresh">${platform === "instagram" ? "Refresh Instagram insights" : "Refresh my channel data"}</button>` : ""}</div>
    <div class="row" style="margin-bottom:10px">YouTube public ${source(st.youtubeData.state)} · YouTube Analytics ${source(st.youtubeAnalytics.state)} · Impressions/CTR ${source(st.impressions.state)} · Instagram insights ${source(st.instagramInsights.state)} <a href="#/settings">Connections</a></div>
    <div class="tabs">${Object.entries(TABS).map(([k, l]) => `<button data-p="${k}" class="${k === platform ? "on" : ""}">${l}</button>`).join("")}</div>
    <div id="report"></div><div id="body">${loading()}</div>`;
  el.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => ctx.nav(`analytics?platform=${b.dataset.p}`)));
  const body = el.querySelector("#body");
  let data;
  try { data = await get(`${ctx.base}/analytics?platform=${platform}`); } catch (err) { body.innerHTML = errorBox(err); return; }

  if (platform === "instagram") {
    body.innerHTML = `<p class="muted">${esc(data.metricsNote)}</p>
      ${data.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Post</th><th>Type</th><th>Published</th><th class="num">Reach</th><th class="num">Views</th><th class="num">Saves</th><th class="num">Shares</th><th class="num">Likes</th><th>Source</th></tr></thead><tbody>
      ${data.rows.map((m) => `<tr><td>${m.permalink ? `<a href="${esc(m.permalink)}" target="_blank" rel="noopener noreferrer">${esc((m.caption || "(no caption)").slice(0, 70))}</a>` : esc((m.caption || "").slice(0, 70))}${m.metricsError ? `<div class="down" style="font-size:.8rem">${esc(m.metricsError)}</div>` : ""}<details><summary>Idea → results</summary>${lineageHtml(m.lineage)}</details></td>
        <td>${esc(m.type)}</td><td>${date(m.publishedAt)}${m.comparable ? "" : '<div class="faint">under 7 days: not compared</div>'}</td>
        <td class="num">${num(m.metrics?.reach)}${r(m.reachRatio)}</td><td class="num">${num(m.metrics?.views)}${r(m.viewsRatio)}</td><td class="num">${num(m.metrics?.saved)}${r(m.savesRatio)}</td><td class="num">${num(m.metrics?.shares)}${r(m.sharesRatio)}</td><td class="num">${num(m.likes)}</td><td>${source(m.source)}</td></tr>`).join("")}</tbody></table></div>` : empty("No Instagram results yet. Connect insights (Settings) or import a CSV below.")}
      ${ctx.canEdit ? `<div class="card" style="margin-top:14px"><h3>Import Instagram results (CSV)</h3><p class="faint">Columns: permalink (or id), date, type (reel/post/carousel), reach, views, likes, comments, saves, shares, caption. Rows are labelled "Imported data".</p><div class="row"><input type="file" id="igCsv" accept=".csv"><input id="igAcc" placeholder="account short name (optional)" style="width:220px"><button class="btn" id="igImport">Import</button></div></div>` : ""}`;
    const imp = el.querySelector("#igImport");
    if (imp) imp.onclick = async () => {
      const f = el.querySelector("#igCsv").files[0];
      if (!f) return toast("Choose a CSV file.", true);
      try { const res = await busy(imp, async () => post(`${ctx.base}/instagram/import-csv`, { csv: await f.text(), account: el.querySelector("#igAcc").value })); toast(`Imported ${res.imported} posts.`); ctx.refresh(); }
      catch (err) { toast(err.message, true); }
    };
  } else {
    const b = data.baseline;
    body.innerHTML = `<p class="muted">${esc(data.metricsNote)} ${data.lastRefreshed ? `Public data refreshed ${ago(data.lastRefreshed)}.` : ""}</p>
      <div class="grid g4" style="margin-bottom:12px">
        <div class="card tight"><div class="muted">Median first-7-day views</div><div class="stat">${num(b.first7)}</div></div>
        <div class="card tight"><div class="muted">Median first-28-day views</div><div class="stat">${num(b.first28)}</div></div>
        <div class="card tight"><div class="muted">Median impressions CTR</div><div class="stat">${b.ctr != null ? b.ctr + "%" : "—"}</div></div>
        <div class="card tight"><div class="muted">Median avg % viewed</div><div class="stat">${b.avgViewPercentage != null ? Math.round(b.avgViewPercentage) + "%" : "—"}</div></div></div>
      ${data.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Video</th><th>Published</th><th class="num">Views</th><th>Vs my baseline</th><th class="num">First 7 days</th><th class="num">First 28 days</th><th class="num">CTR</th><th class="num">Avg % viewed</th><th class="num">Subs</th><th>Source</th></tr></thead><tbody>
      ${data.rows.map((v) => `<tr><td><a href="#" data-video="${esc(v.videoId)}">${esc(v.title)}</a><details><summary>Idea → results</summary>${lineageHtml(v.lineage)}</details></td>
        <td>${date(v.publishedAt)}<div class="faint">${v.ageDays} days</div></td><td class="num">${num(v.views)}</td><td>${scorePill(v.score)} <span class="faint" style="font-size:.8rem">${v.score?.score == null ? esc(v.scoreText) : esc(v.score.confidence || "") + " conf."}</span></td>
        <td class="num">${num(v.first7)}${r(v.first7Ratio)}</td><td class="num">${num(v.first28)}${r(v.first28Ratio)}</td><td class="num">${v.ctr != null ? v.ctr + "%" : "—"}</td><td class="num">${v.avgViewPercentage != null ? v.avgViewPercentage + "%" : "—"}</td><td class="num">${num(v.subscribersGained)}</td>
        <td>${source(v.source)}${v.analyticsSource ? `<div>${source(v.analyticsSource)} <span class="faint">analytics</span></div>` : ""}</td></tr>`).join("")}</tbody></table></div>` : empty("No videos for your channel yet. Add your channel in <a href='#/channels'>Channels</a>, then refresh — or import a YouTube Studio CSV export there.")}`;
  }

  el.onclick = (e) => { const a = e.target.closest("[data-video]"); if (a) { e.preventDefault(); openAnalysis(ctx, a.dataset.video); } };
  const refresh = el.querySelector("#refresh");
  if (refresh) refresh.onclick = async () => {
    try {
      const res = await busy(refresh, () => post(platform === "instagram" ? `${ctx.base}/instagram/insights/refresh` : `${ctx.base}/analytics/refresh`), "Refreshing…");
      if (res.report) el.querySelector("#report").innerHTML = `<div class="notice info">${res.report.map(esc).join("<br>")}</div>`;
      else toast(`Refreshed ${res.refreshed} posts.`);
      const again = await get(`${ctx.base}/analytics?platform=${platform}`);
      if (again.rows.length !== data.rows.length || res.refreshed) ctx.refresh();
    } catch (err) { el.querySelector("#report").innerHTML = errorBox(err); }
  };
  if (ctx.query.video) openAnalysis(ctx, ctx.query.video);
}
