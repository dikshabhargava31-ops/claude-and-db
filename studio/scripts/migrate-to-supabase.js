// Copies everything from the local app (data/db.json and data/files/) into Supabase, so the
// hosted app starts with your accounts, workspaces, research and scripts.
// Usage: put SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env, then run `npm run migrate`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RemoteStore, COLLECTIONS } from "../lib/store.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#")) process.env[m[1]] ??= m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env first.");
  process.exit(1);
}
const dataDir = path.resolve(root, process.env.DATA_DIR || "data");
const dbFile = path.join(dataDir, "db.json");
if (!fs.existsSync(dbFile)) {
  console.error(`No local data found at ${dbFile}. Nothing to copy.`);
  process.exit(1);
}

const local = JSON.parse(fs.readFileSync(dbFile, "utf8"));
const remote = new RemoteStore({ url: SUPABASE_URL, key: SUPABASE_SERVICE_ROLE_KEY });
await remote.sync();
const counts = {};
for (const c of COLLECTIONS) {
  for (const row of Object.values(local[c] || {})) {
    remote.data[c][row.id] = row;
    remote.dirty.set(`${c}/${row.id}`, { collection: c, id: row.id, deleted: false });
    counts[c] = (counts[c] || 0) + 1;
  }
}
await remote.persist();
console.log("Copied rows:", counts);

let files = 0;
const filesDir = path.join(dataDir, "files");
if (fs.existsSync(filesDir)) {
  for (const name of fs.readdirSync(filesDir)) {
    await remote.writeFile(name, fs.readFileSync(path.join(filesDir, name)));
    files++;
  }
}
console.log(`Copied ${files} uploaded files. Done.`);
