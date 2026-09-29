// One-time copy of the old SQLite database (data/omniia.db) into MongoDB.
// Env values are encrypted with ENV_ENCRYPTION_KEY on the way in.
//
//   node --env-file=.env scripts/migrate-sqlite-to-mongo.mjs [path/to/omniia.db]
//
// Safe to re-run: documents are upserted by id.
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { MongoClient } from "mongodb";

const file = process.argv[2] || process.env.DB_PATH || "data/omniia.db";
const uri = process.env.MONGODB_URI;
const keyB64 = process.env.ENV_ENCRYPTION_KEY;
if (!uri || uri.includes("<db_password>")) throw new Error("Set MONGODB_URI (with your password) first.");
const key = Buffer.from(keyB64 ?? "", "base64");
if (key.length !== 32) throw new Error("ENV_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}
const date = (s) => (s ? new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`) : new Date());
const has = (sqlite, table) => !!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);

const sqlite = new DatabaseSync(file, { readOnly: true });
const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "omniia_tracker");

async function copy(table, collection, map) {
  if (!has(sqlite, table)) return console.log(`- ${table}: not present, skipped`);
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  for (const row of rows) {
    const doc = map(row);
    await db.collection(collection).replaceOne({ _id: doc._id }, doc, { upsert: true });
  }
  const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id)), 0);
  if (maxId) {
    await db.collection("counters").updateOne({ _id: collection }, { $max: { seq: maxId } }, { upsert: true });
  }
  console.log(`- ${table}: ${rows.length} copied`);
}

await copy("users", "users", (r) => ({
  _id: r.id,
  email: r.email,
  created_at: date(r.created_at),
  last_login_at: r.last_login_at ? date(r.last_login_at) : null,
}));
await copy("environments", "environments", (r) => ({
  _id: r.id,
  name: r.name,
  description: r.description ?? "",
  created_by: r.created_by ?? "",
  created_at: date(r.created_at),
  updated_at: date(r.updated_at),
}));
await copy("services", "services", (r) => ({
  _id: r.id,
  name: r.name,
  description: r.description ?? "",
  created_by: r.created_by ?? "",
  created_at: date(r.created_at),
  updated_at: date(r.updated_at),
}));
await copy("env_vars", "env_vars", (r) => ({
  _id: r.id,
  service_id: r.service_id,
  environment_id: r.environment_id,
  key: r.key,
  value_enc: encrypt(r.value ?? ""),
  updated_by: r.updated_by ?? "",
  created_at: date(r.created_at),
  updated_at: date(r.updated_at),
}));
await copy("health_checks", "health_checks", (r) => ({
  _id: r.id,
  service_id: r.service_id,
  environment_id: r.environment_id,
  url: r.url,
  expected_status: r.expected_status,
  expect_text: r.expect_text ?? "",
  enabled: !!r.enabled,
  created_by: r.created_by ?? "",
  created_at: date(r.created_at),
  updated_at: date(r.updated_at),
}));

await client.close();
console.log("Done. Env values are stored encrypted (value_enc).");
