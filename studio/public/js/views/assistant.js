// AI Assistant: a chat connected to the current workspace, with sources and save actions.
import { get, post, del } from "../api.js";
import { esc, loading, empty, errorBox, toast, busy, linkify, source } from "../ui.js";

const EXAMPLES = [
  "Find recent outliers among my saved competitors.",
  "Why might my latest weak video have underperformed?",
  "Suggest five topics based on our strongest videos.",
  "Study this channel's title and thumbnail patterns: ",
  "Turn this saved reference into an original CA video angle: ",
  "Improve this hook using my approved examples: ",
];

function message(m, i, ctx) {
  if (m.role === "user") return `<div class="msg user">${esc(m.text)}</div>`;
  return `<div class="msg assistant">${linkify(m.text)}
    ${m.used?.length ? `<div class="src"><b>Workspace data used:</b> ${m.used.map((u) => (u.url ? `<a href="${esc(u.url)}" target="_blank" rel="noopener noreferrer">${esc(u.title)}</a>` : esc(u.title))).join("; ")}</div>` : ""}
    ${m.sources?.length ? `<div class="src"><b>Web sources:</b><ol style="margin:4px 0;padding-left:18px">${m.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a>${s.pageAge ? ` <span class="faint">(${esc(s.pageAge)})</span>` : ""}</li>`).join("")}</ol></div>` : ""}
    ${ctx.canEdit ? `<div class="row" style="margin-top:8px;white-space:normal"><span class="faint">Save as:</span>${["topic", "reference", "task", "script"].map((k) => `<button class="btn small" data-act="save" data-i="${i}" data-as="${k}">${{ topic: "Topic", reference: "Reference", task: "Planner task", script: "Script draft" }[k]}</button>`).join("")}</div>` : ""}</div>`;
}

export default async function assistant(el, ctx) {
  const ai = ctx.ws.status.ai;
  const chats = await get(`${ctx.base}/chats`);
  let current = ctx.rest[0] || chats[0]?.id || null;
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;

  el.innerHTML = `
    <div class="row between"><h1>AI Assistant</h1>${source(ai.state)}</div>
    ${ai.state !== "live" ? `<div class="notice">${esc(ai.detail)}</div>` : '<p class="muted">Connected to this workspace: it can look up your saved references, channels, outliers, topics and performance, search YouTube and the web, and shows where each answer came from.</p>'}
    <div class="chat">
      <div class="card tight"><button class="btn" id="newChat" style="width:100%">New conversation</button>
        <div id="chatList" style="margin-top:8px">${chats.map((c) => `<div class="row between"><a href="#/assistant/${c.id}" style="flex:1">${esc(c.title)}</a><button class="btn small ghost" data-act="delChat" data-id="${c.id}" aria-label="Delete">✕</button></div>`).join("") || '<p class="faint">No conversations yet.</p>'}</div></div>
      <div>
        <div class="msgs" id="msgs">${current ? loading() : empty("Ask about your channel, competitors, references or topics.")}</div>
        <form id="ask" class="card" style="margin-top:12px">
          <textarea name="text" placeholder="Ask a question or give a task…" ${ai.state !== "live" ? "disabled" : ""}></textarea>
          <div class="row" style="margin-top:8px"><button class="btn primary" ${ai.state !== "live" ? "disabled" : ""}>Send</button>
          ${Speech ? `<button type="button" class="btn" id="mic" ${ai.state !== "live" ? "disabled" : ""}>🎤 Speak</button><select id="micLang" style="width:auto" aria-label="Voice language"><option value="en-IN">English (India)</option><option value="hi-IN">Hindi</option></select>` : '<span class="faint">Voice input isn\'t supported in this browser.</span>'}</div>
          <div class="row" style="margin-top:8px">${EXAMPLES.map((x) => `<button type="button" class="btn small ghost" data-act="example" data-text="${esc(x)}">${esc(x.replace(/: $/, "…"))}</button>`).join("")}</div>
        </form>
      </div>
    </div>`;

  const msgs = el.querySelector("#msgs");
  let display = [];
  const draw = () => { msgs.innerHTML = display.length ? display.map((m, i) => message(m, i, ctx)).join("") : empty("Start the conversation below."); };
  if (current) {
    try { display = (await get(`${ctx.base}/chats/${current}`)).display; draw(); }
    catch { current = null; display = []; draw(); }
  }

  const form = el.querySelector("#ask");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = form.text.value.trim();
    if (!text) return;
    try {
      if (!current) { current = (await post(`${ctx.base}/chats`)).id; history.replaceState(null, "", `#/assistant/${current}`); }
      display.push({ role: "user", text });
      draw();
      msgs.insertAdjacentHTML("beforeend", loading("Researching… (this can take a minute when it searches)"));
      form.text.value = "";
      const m = await busy(form.querySelector(".primary"), () => post(`${ctx.base}/chats/${current}/messages`, { text }), "Thinking…");
      display.push(m);
      draw();
    } catch (err) {
      display.pop();
      draw();
      form.text.value = text;
      msgs.insertAdjacentHTML("beforeend", errorBox(err));
    }
  };

  const mic = el.querySelector("#mic");
  if (mic) mic.onclick = () => {
    const rec = new Speech();
    rec.lang = el.querySelector("#micLang").value;
    rec.interimResults = false;
    mic.textContent = "Listening…";
    rec.onresult = (ev) => { form.text.value = (form.text.value + " " + ev.results[0][0].transcript).trim(); };
    rec.onerror = (ev) => toast(`Voice input: ${ev.error}`, true);
    rec.onend = () => { mic.textContent = "🎤 Speak"; };
    rec.start();
  };

  el.querySelector("#newChat").onclick = async () => {
    const c = await post(`${ctx.base}/chats`);
    ctx.nav(`assistant/${c.id}`);
  };

  el.onclick = async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "example") { form.text.value = b.dataset.text; form.text.focus(); }
    if (b.dataset.act === "delChat") { await del(`${ctx.base}/chats/${b.dataset.id}`); ctx.nav("assistant"); }
    if (b.dataset.act === "save") {
      try {
        const r = await busy(b, () => post(`${ctx.base}/chats/${current}/save`, { index: Number(b.dataset.i), as: b.dataset.as }), "Saving…");
        const where = { topic: ["Opportunities", `opportunities?open=${r.row.id}`], reference: ["Reference Library", `library?open=${r.row.id}`], task: ["Content Planner", `planner?open=${r.row.id}`], script: ["Script Studio", `scripts/${r.row.id}`] }[r.saved];
        b.outerHTML = `<a class="pill done" href="#/${where[1]}">Saved to ${where[0]}</a>`;
      } catch (err) { toast(err.message, true); }
    }
  };
}
