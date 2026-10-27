// A small JSON document store. Everything lives in data/db.json (git-ignored), written
// atomically (temp file + rename) shortly after each change. Uploaded files go to data/files/.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const COLLECTIONS = [
  "users", "sessions", "workspaces", "channels", "videos", "references", "preferences",
  "topics", "items", "scripts", "runs", "reviews", "chats", "files", "connections",
  "usage", "audit", "igMedia",
];

export function newId(prefix = "") {
  return prefix + crypto.randomBytes(9).toString("base64url");
}

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, "db.json");
    this.filesDir = path.join(dir, "files");
    fs.mkdirSync(this.filesDir, { recursive: true, mode: 0o700 });
    let data = {};
    if (fs.existsSync(this.file)) data = JSON.parse(fs.readFileSync(this.file, "utf8"));
    for (const c of COLLECTIONS) data[c] ??= {};
    this.data = data;
    this.timer = null;
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
    this.save();
    return full;
  }

  update(collection, id, patch) {
    const row = this.data[collection][id];
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    this.save();
    return row;
  }

  remove(collection, id) {
    delete this.data[collection][id];
    this.save();
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 150);
  }

  flush() {
    clearTimeout(this.timer);
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  writeFile(id, buffer) {
    fs.writeFileSync(path.join(this.filesDir, id), buffer, { mode: 0o600 });
  }

  readFile(id) {
    const p = path.join(this.filesDir, path.basename(id));
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  }

  deleteFile(id) {
    const p = path.join(this.filesDir, path.basename(id));
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
