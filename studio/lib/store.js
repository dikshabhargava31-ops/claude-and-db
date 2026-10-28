// Data storage with one interface and two back ends:
//  - Store: a JSON file in data/db.json (git-ignored), for running on your own computer.
//  - RemoteStore: a Supabase Postgres table plus a private Storage bucket, for hosting (Vercel),
//    where there's no permanent disk and several server instances may run at once.
// Reads are synchronous from an in-memory copy; RemoteStore refreshes that copy at the start of
// each request (only rows changed since the last refresh) and writes changed rows back.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const COLLECTIONS = [
  "users", "sessions", "workspaces", "channels", "videos", "references", "preferences",
  "topics", "items", "scripts", "runs", "reviews", "chats", "files", "connections",
  "usage", "audit", "igMedia", "oauthStates",
];

export function newId(prefix = "") {
  return prefix + crypto.randomBytes(9).toString("base64url");
}

class BaseStore {
  constructor() {
    this.data = Object.fromEntries(COLLECTIONS.map((c) => [c, {}]));
  }

  all(collection, filter) {
    const rows = Object.values(this.data[collection]);
    return filter ? rows.filter(filter) : rows;
  }

  // Rows of one workspace. Every workspace-owned row carries `ws`, which keeps workspaces apart.
  inWs(collection, ws, filter) {
    return this.all(collection, (r) => r.ws === ws && (!filter || filter(r)));
  }

  get(collection, id) {
    return this.data[collection][id] || null;
  }

  getInWs(collection, ws, id) {
    const row = this.get(collection, id);
    return row && row.ws === ws ? row : null;
  }

  insert(collection, row) {
    const now = new Date().toISOString();
    const full = { id: row.id || newId(), createdAt: now, updatedAt: now, ...row };
    this.data[collection][full.id] = full;
    this.changed(collection, full.id);
    return full;
  }

  update(collection, id, patch) {
    const row = this.data[collection][id];
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    this.changed(collection, id);
    return row;
  }

  remove(collection, id) {
    delete this.data[collection][id];
    this.changed(collection, id, true);
  }

  // Hooks used by the server around each request; no-ops for the file store.
  async sync() {}
  async persist() {}
}

export class Store extends BaseStore {
  constructor(dir) {
    super();
    this.dir = dir;
    this.file = path.join(dir, "db.json");
    this.filesDir = path.join(dir, "files");
    fs.mkdirSync(this.filesDir, { recursive: true, mode: 0o700 });
    if (fs.existsSync(this.file)) Object.assign(this.data, JSON.parse(fs.readFileSync(this.file, "utf8")));
    for (const c of COLLECTIONS) this.data[c] ??= {};
    this.timer = null;
  }

  changed() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 150);
  }

  flush() {
    clearTimeout(this.timer);
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  async writeFile(id, buffer) {
    fs.writeFileSync(path.join(this.filesDir, path.basename(id)), buffer, { mode: 0o600 });
  }

  async readFile(id) {
    const p = path.join(this.filesDir, path.basename(id));
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  }

  async deleteFile(id) {
    const p = path.join(this.filesDir, path.basename(id));
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

const TABLE = "studio_docs";
const BUCKET = "studio-files";

export class RemoteStore extends BaseStore {
  constructor({ url, key }) {
    super();
    this.url = url.replace(/\/$/, "");
    this.key = key;
    this.dirty = new Map(); // "collection/id" -> { collection, id, deleted }
    this.lastSeen = null; // newest updated_at received from the database
    this.timer = null;
    this.saving = Promise.resolve();
  }

  // Legacy service_role keys are JWTs and also go in Authorization; newer "sb_secret_" keys go
  // only in the apikey header.
  headers(extra = {}) {
    return { apikey: this.key, ...(this.key.startsWith("eyJ") ? { authorization: `Bearer ${this.key}` } : {}), ...extra };
  }

  async request(pathname, opts = {}) {
    let res;
    try {
      res = await fetch(this.url + pathname, { ...opts, headers: this.headers(opts.headers), signal: AbortSignal.timeout(30000) });
    } catch (e) {
      throw storeError(`Couldn't reach the database (${e.cause?.code || e.message}).`);
    }
    if (!res.ok) {
      const body = await res.text();
      throw storeError(`Database error ${res.status}: ${body.slice(0, 300)}`, res.status);
    }
    return res;
  }

  changed(collection, id, deleted = false) {
    this.dirty.set(`${collection}/${id}`, { collection, id, deleted });
    clearTimeout(this.timer);
    // Background work (research runs) keeps saving as it goes; requests also persist before replying.
    this.timer = setTimeout(() => this.persist().catch((e) => console.error(e.message)), 100);
  }

  // Loads rows changed since the last sync (a few seconds of overlap covers rows committed late).
  async sync() {
    await this.saving;
    const since = this.lastSeen ? new Date(new Date(this.lastSeen).getTime() - 5000).toISOString() : null;
    for (let offset = 0; ; offset += 1000) {
      const q = `select=collection,id,data,deleted,updated_at&order=updated_at.asc&limit=1000&offset=${offset}${since ? `&updated_at=gt.${encodeURIComponent(since)}` : ""}`;
      const rows = await (await this.request(`/rest/v1/${TABLE}?${q}`)).json();
      for (const r of rows) {
        if (!this.data[r.collection]) continue;
        if (this.dirty.has(`${r.collection}/${r.id}`)) continue; // a newer local change is waiting to be saved
        const local = this.data[r.collection][r.id];
        if (r.deleted) delete this.data[r.collection][r.id];
        else if (!local || !local.updatedAt || !r.data.updatedAt || r.data.updatedAt >= local.updatedAt) this.data[r.collection][r.id] = r.data;
        if (!this.lastSeen || r.updated_at > this.lastSeen) this.lastSeen = r.updated_at;
      }
      if (rows.length < 1000) break;
    }
  }

  // Writes every changed row (upsert; deletions are kept as tombstones so other instances see them).
  persist() {
    clearTimeout(this.timer);
    this.saving = this.saving.then(async () => {
      if (!this.dirty.size) return;
      const batch = [...this.dirty.values()];
      this.dirty.clear();
      const rows = batch.map(({ collection, id, deleted }) => ({ collection, id, deleted: deleted || !this.data[collection][id], data: deleted ? null : this.data[collection][id] || null }));
      try {
        for (let i = 0; i < rows.length; i += 500) {
          await this.request(`/rest/v1/${TABLE}?on_conflict=collection,id`, {
            method: "POST",
            headers: { "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(rows.slice(i, i + 500)),
          });
        }
      } catch (e) {
        for (const b of batch) if (!this.dirty.has(`${b.collection}/${b.id}`)) this.dirty.set(`${b.collection}/${b.id}`, b);
        throw e;
      }
    });
    return this.saving;
  }

  async writeFile(id, buffer) {
    await this.request(`/storage/v1/object/${BUCKET}/${encodeURIComponent(id)}`, { method: "POST", headers: { "content-type": "application/octet-stream", "x-upsert": "true" }, body: buffer });
  }

  async readFile(id) {
    try {
      return Buffer.from(await (await this.request(`/storage/v1/object/authenticated/${BUCKET}/${encodeURIComponent(id)}`)).arrayBuffer());
    } catch (e) {
      if (e.status === 404 || e.status === 400) return null;
      throw e;
    }
  }

  async deleteFile(id) {
    await this.request(`/storage/v1/object/${BUCKET}/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }
}

function storeError(message, status) {
  const e = new Error(message);
  e.status = 503;
  e.dbStatus = status;
  e.integration = "database";
  return e;
}

export function createStore(dataDir) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new RemoteStore({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
  }
  return new Store(dataDir);
}
