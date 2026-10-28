// Creator Research Studio — private web app server.
// Plain Node (22.5+). Run on your computer with `npm start`; on Vercel, api/index.js exports `handler`.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./lib/store.js";
import { sessionUser, requireRole, httpError } from "./lib/auth.js";
import { routes } from "./lib/api.js";
import { startScheduler } from "./lib/research.js";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(here, ".env"));

const PORT = Number(process.env.PORT || 4317);
// Private by default: only this computer can open the app unless HOST is changed on purpose.
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = path.resolve(here, process.env.DATA_DIR || "data");
const PUBLIC = path.join(here, "public");
const COOKIE = "studio_session";
const secureCookie = () => (process.env.PUBLIC_URL || "").startsWith("https://");

// Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, otherwise a local file.
// Vercel has no permanent disk, so there the app refuses to run without Supabase.
export const store = process.env.VERCEL && !process.env.SUPABASE_URL ? null : createStore(DATA_DIR);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    process.env[m[1]] ??= v;
  }
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };

function securityHeaders(res) {
  res.setHeader("content-security-policy", "default-src 'self'; img-src 'self' data: blob: https://i.ytimg.com https://*.ytimg.com https://yt3.ggpht.com https://*.ggpht.com https://*.cdninstagram.com https://*.fbcdn.net https://raw.githubusercontent.com; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "same-origin");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("x-robots-tag", "noindex, nofollow");
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
}

export function setSessionCookie(res, token) {
  const attrs = [`${COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${token ? 14 * 86400 : 0}`];
  if (secureCookie()) attrs.push("Secure");
  res.setHeader("set-cookie", attrs.join("; "));
}

function send(res, status, body, headers = {}) {
  if (Buffer.isBuffer(body) || typeof body === "string") {
    res.writeHead(status, headers);
    return res.end(body);
  }
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit = 30 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw httpError(413, "That upload is too large (30 MB max).");
    chunks.push(c);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw httpError(400, "The request body isn't valid JSON."); }
}

function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC, pathname === "/" ? "index.html" : pathname));
  if (!file.startsWith(PUBLIC)) return send(res, 404, "Not found");
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, "index.html"); // SPA routes
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}

const compiled = routes.map(([method, pattern, access, handler]) => {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "$");
  return { method, re, keys, access, handler };
});

async function handle(req, res) {
  securityHeaders(res);
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;
  const isApi = pathname.startsWith("/api/") || pathname.startsWith("/oauth/") || pathname.startsWith("/files/");
  if (!isApi) return serveStatic(req, res, pathname);

  if (!store) return send(res, 503, { error: "The database isn't set up. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables, then redeploy." });
  const route = compiled.find((r) => r.method === req.method && r.re.test(pathname));
  if (!route) return send(res, 404, { error: "Not found." });
  const m = route.re.exec(pathname);
  const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));

  // Cross-site request protection: state-changing API calls must carry a header that a page on
  // another site can't add without a CORS preflight, which this server never allows.
  if (req.method !== "GET" && req.headers["x-studio"] !== "1") return send(res, 403, { error: "Missing request header." });

  await store.sync();
  const token = cookies(req)[COOKIE];
  const user = sessionUser(store, token);
  const ctx = { req, res, url, params, query: Object.fromEntries(url.searchParams), user, token, store, send: (s, b, h) => send(res, s, b, h), setSession: (t) => setSessionCookie(res, t) };
  if (route.access !== "public" && !user) {
    if (req.method === "GET" && !pathname.startsWith("/api/")) { res.writeHead(302, { location: "/" }); return res.end(); }
    return send(res, 401, { error: "Please sign in." });
  }
  if (params.ws) {
    ctx.workspace = store.get("workspaces", params.ws);
    ctx.ws = params.ws;
    ctx.role = requireRole(ctx.workspace, user, route.access === "auth" ? "viewer" : route.access);
  }
  ctx.body = req.method === "GET" ? {} : await readBody(req);
  const out = await route.handler(ctx);
  await store.persist();
  if (out !== undefined && !res.headersSent) send(res, 200, out);
}

export async function handler(req, res) {
  try {
    await handle(req, res);
  } catch (e) {
    await store?.persist().catch(() => {});
    const status = e.status || 500;
    if (status >= 500 && !e.integration) console.error(e);
    if (!res.headersSent) send(res, status, { error: status === 500 && !e.status ? "Something went wrong on the server. Check the server log." : e.message, integration: e.integration || null, needsApproval: e.needsApproval || null });
  }
}

export const server = http.createServer(handler);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, HOST, () => {
    console.log(`Creator Research Studio: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
    store.sync().then(() => { if (!store.all("users").length) console.log("No accounts yet: open the app to create the owner account."); });
  });
  startScheduler(store);
  const stop = async () => { store.flush?.(); await store.persist().catch(() => {}); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
