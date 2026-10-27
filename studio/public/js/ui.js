// Small UI helpers: escaping, formatting, data-source labels, modals, toasts and states.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function num(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  n = Number(n);
  if (n >= 1e7) return (n / 1e7).toFixed(1).replace(/\.0$/, "") + " Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(1).replace(/\.0$/, "") + " L";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

export function date(d, withTime = false) {
  if (!d) return "—";
  const x = new Date(d);
  if (isNaN(x)) return esc(d);
  return x.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

export function ago(d) {
  if (!d) return "never";
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

export function dur(sec) {
  if (sec == null) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}

const SOURCE_LABEL = { live: "Live data", imported: "Imported data", demo: "Demo data", unavailable: "Unavailable", manual: "Manual", "not connected": "Not connected", "awaiting approval": "Awaiting approval" };
export function source(state) {
  const cls = String(state || "unavailable").replace(/\s+/g, "").replace("awaitingapproval", "awaiting");
  return `<span class="pill ${esc(cls)}" title="Data source">${esc(SOURCE_LABEL[state] || state || "Unknown")}</span>`;
}

export function scorePill(score) {
  if (!score || score.score == null) return "";
  const cls = score.score >= 2 ? "accent" : score.score <= 0.5 ? "bad failed" : "";
  return `<span class="pill ${cls}" title="Compared with the channel's own baseline">${score.score}×</span>`;
}

export function overlapNote(overlap) {
  if (!overlap?.length) return "";
  return `<div class="notice">${overlap.some((o) => o.level === "strong") ? "<b>Likely duplicate.</b>" : "<b>Possible overlap.</b>"} Similar to: ${overlap.map((o) => `${esc(o.title)} <span class="faint">(${esc(o.kind)}${o.status ? ", " + esc(o.status) : ""}, ${Math.round(o.score * 100)}%)</span>`).join("; ")}</div>`;
}

export const loading = (text = "Loading…") => `<p class="loading">${esc(text)}</p>`;
export const empty = (text) => `<div class="empty">${text}</div>`;
export const errorBox = (e) => `<div class="notice error">${esc(e.message || e)}${e.integration ? ` <a href="#/settings">Open connections</a>` : ""}</div>`;

let toastTimer;
export function toast(msg, isError = false) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast" + (isError ? " error" : "");
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), isError ? 9000 : 4000);
}

// Opens a modal. `render(box, close)` fills it. Returns a promise resolved on close.
export function modal(render, { wide = false } = {}) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "modal-back";
    const box = document.createElement("div");
    box.className = "modal" + (wide ? " wide" : "");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    back.append(box);
    const close = (v) => { back.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
    document.addEventListener("keydown", onKey);
    document.body.append(back);
    render(box, close);
    box.querySelector("input, textarea, select, button")?.focus();
  });
}

export function confirmBox(title, text, okLabel = "Confirm") {
  return modal((box, close) => {
    box.innerHTML = `<h2>${esc(title)}</h2><p>${text}</p><div class="row"><button class="btn primary" data-ok>${esc(okLabel)}</button><button class="btn ghost" data-no>Cancel</button></div>`;
    box.querySelector("[data-ok]").onclick = () => close(true);
    box.querySelector("[data-no]").onclick = () => close(false);
  });
}

// Reads a form into an object; checkboxes with the same name become arrays.
export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") { (out[el.name] ??= []); if (el.checked) out[el.name].push(el.value); }
    else if (el.type === "radio") { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// Turns a button into a busy state while an async task runs.
export async function busy(btn, fn, text = "Working…") {
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = esc(text); }
  try { return await fn(); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
}

export const CATEGORY_LABELS = { "topic-research": "Topic research & sources", titles: "Titles", thumbnails: "Thumbnails", hooks: "Hooks", "script-structures": "Script structures", "editing-styles": "Editing styles", "visual-storytelling": "Visual storytelling" };
export const TOPIC_TAGS = ["evergreen", "timely", "controversial", "contrarian", "educational", "career", "student-relatable"];
export const STAGES = ["Idea", "Shortlisted", "Researching", "Scripting", "Ready to Record", "Editing", "Scheduled", "Published"];
export const PLATFORMS = { youtube: "YouTube long-form", "youtube-short": "YouTube Shorts", instagram: "Instagram" };

export function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s<)"]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
}
