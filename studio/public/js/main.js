// App shell: sign-in, workspace switcher, navigation and routing.
import { get, post } from "./api.js";
import { esc, $, toast, loading, errorBox, busy } from "./ui.js";
import { authView } from "./views/auth.js";

const NAV = [
  ["dashboard", "Dashboard"], ["research", "Research"], ["channels", "Channels"], ["opportunities", "Opportunities"],
  ["assistant", "AI Assistant"], ["scripts", "Script Studio"], ["library", "Reference Library"], ["planner", "Content Planner"],
  ["analytics", "Analytics"], ["settings", "Settings"],
];
const VIEWS = {
  dashboard: () => import("./views/dashboard.js"), research: () => import("./views/research.js"), channels: () => import("./views/channels.js"),
  opportunities: () => import("./views/opportunities.js"), assistant: () => import("./views/assistant.js"), scripts: () => import("./views/scripts.js"),
  library: () => import("./views/library.js"), planner: () => import("./views/planner.js"), analytics: () => import("./views/analytics.js"), settings: () => import("./views/settings.js"),
};

const state = { user: null, workspaces: [], ws: null, pending: 0 };
const app = $("#app");
const WS_KEY = "studio.ws";

function route() {
  const [path, qs] = location.hash.replace(/^#\/?/, "").split("?");
  const [view, ...rest] = path.split("/");
  return { view: VIEWS[view] ? view : "dashboard", rest, query: Object.fromEntries(new URLSearchParams(qs || "")) };
}

export function nav(path) {
  location.hash = "#/" + path.replace(/^\/?#?\/?/, "");
}

async function loadWorkspace(id) {
  state.ws = await get(`/api/ws/${id}`);
  try { localStorage.setItem(WS_KEY, id); } catch { /* storage unavailable */ }
  const reviews = await get(`/api/ws/${id}/reviews?decision=pending`).catch(() => []);
  state.pending = reviews.length;
}

async function boot() {
  app.innerHTML = loading();
  const s = await get("/api/session");
  if (!s.user) return authView(app, s.needsSetup, boot);
  state.user = s.user;
  state.workspaces = await get("/api/workspaces");
  if (!state.workspaces.length) return firstWorkspace();
  const q = route().query;
  let saved = null;
  try { saved = localStorage.getItem(WS_KEY); } catch { /* ignore */ }
  const id = [q.ws, saved].find((x) => x && state.workspaces.some((w) => w.id === x)) || state.workspaces[0].id;
  await loadWorkspace(id);
  render();
}

function firstWorkspace() {
  app.innerHTML = `<div class="auth card"><h1>Create your first workspace</h1>
    <p class="muted">A workspace holds one brand or channel: its profile, competitors, references, ideas, scripts and plan. Each workspace's data and preferences stay separate.</p>
    <div class="stack">
      <button class="btn primary" data-preset="ca">Start with “CA Mahendra Sir” (@camahendrasir)</button>
      <form id="blank" class="row"><input name="name" placeholder="Or name a blank workspace" required><button class="btn">Create</button></form>
      <button class="btn ghost" data-demo>Explore a demo workspace (sample data only)</button>
    </div></div>`;
  app.querySelector("[data-preset]").onclick = async (e) => { await busy(e.target, () => post("/api/workspaces", { preset: "ca" })); boot(); };
  app.querySelector("[data-demo]").onclick = async (e) => { await busy(e.target, () => post("/api/workspaces", { demo: true })); boot(); };
  app.querySelector("#blank").onsubmit = async (e) => { e.preventDefault(); await post("/api/workspaces", { name: e.target.name.value }); boot(); };
}

function liveCount(st) {
  const keys = ["youtubeData", "youtubeAnalytics", "ai", "instagramPlanner", "instagramInsights"];
  return `${keys.filter((k) => st[k]?.state === "live").length}/${keys.length}`;
}

function shell() {
  const r = route();
  const ws = state.ws;
  const canEdit = ws.role !== "viewer";
  return `<div class="shell">
    <aside class="side" id="side">
      <div class="brand">Creator Research Studio<small class="muted">${esc(ws.name)}</small></div>
      <nav class="nav">${NAV.map(([k, label]) => `<a href="#/${k}" class="${r.view === k ? "on" : ""}">${label}${k === "dashboard" && state.pending ? `<span class="count" title="Waiting for your decision">${state.pending}</span>` : ""}</a>`).join("")}</nav>
      <hr class="sep"><div class="faint" style="padding:0 8px;font-size:.8rem">Signed in as ${esc(state.user.name)}<br><a href="#" id="signout">Sign out</a></div>
    </aside>
    <div class="main">
      <header class="top">
        <button class="btn menu-btn" id="menu" aria-label="Menu">☰</button>
        <select id="wsPick" aria-label="Workspace" style="max-width:260px">${state.workspaces.map((w) => `<option value="${w.id}" ${w.id === ws.id ? "selected" : ""}>${esc(w.name)}${w.demo ? " (demo)" : ""}</option>`).join("")}<option value="__new">+ New workspace…</option></select>
        ${ws.demo ? '<span class="pill demo">Demo data</span>' : ""}
        <a class="pill" href="#/settings" title="Live connections">Connections ${liveCount(ws.status)} live</a>
        <span class="grow"></span>
        ${ws.status.lastRun ? `<span class="faint" style="font-size:.85rem">Last research run ${esc(new Date(ws.status.lastRun.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }))}</span>` : ""}
        ${canEdit ? `<button class="btn primary" id="runResearch" ${ws.running ? "disabled" : ""}>${ws.running ? "Research running…" : "Run my content research"}</button>` : ""}
      </header>
      <main class="page" id="view"></main>
    </div></div>`;
}

let renderToken = 0;
export async function render() {
  const token = ++renderToken;
  app.innerHTML = shell();
  const r = route();
  $("#menu").onclick = () => $("#side").classList.toggle("open");
  $("#signout").onclick = async (e) => { e.preventDefault(); await post("/api/logout"); location.hash = ""; boot(); };
  $("#wsPick").onchange = async (e) => {
    if (e.target.value === "__new") {
      const name = prompt("Name of the new workspace (brand or channel):");
      if (!name) { e.target.value = state.ws.id; return; }
      const w = await post("/api/workspaces", { name });
      state.workspaces = await get("/api/workspaces");
      await loadWorkspace(w.id);
      return nav("settings");
    }
    await loadWorkspace(e.target.value);
    render();
  };
  const runBtn = $("#runResearch");
  if (runBtn) runBtn.onclick = async () => {
    try {
      await post(`/api/ws/${state.ws.id}/runs`);
      state.ws.running = true;
      toast("Research run started. Results will appear in the review queue.");
      nav("dashboard");
      render();
    } catch (e) { toast(e.message, true); }
  };
  const el = $("#view");
  el.innerHTML = loading();
  const ctx = {
    ws: state.ws, user: state.user, role: state.ws.role, canEdit: state.ws.role !== "viewer", isOwner: state.ws.role === "owner",
    base: `/api/ws/${state.ws.id}`, query: r.query, rest: r.rest, nav,
    refresh: async () => { await loadWorkspace(state.ws.id); render(); },
    reloadWs: async () => { await loadWorkspace(state.ws.id); },
    isCurrent: () => token === renderToken,
  };
  try {
    const mod = await VIEWS[r.view]();
    if (token !== renderToken) return;
    await mod.default(el, ctx);
  } catch (e) {
    if (token === renderToken) el.innerHTML = errorBox(e);
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", () => { if (state.ws) render(); });
window.addEventListener("studio:signedout", () => { state.user = null; boot(); });
boot().catch((e) => { app.innerHTML = `<div class="page">${errorBox(e)}</div>`; });
