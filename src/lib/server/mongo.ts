import "server-only";
import { MongoClient, type Collection, type Db, type ObjectId } from "mongodb";

export const CI = { locale: "en", strength: 2 } as const;

export type Docs = {
  counters: { _id: string; seq: number };
  users: { _id: number; email: string; created_at: Date; last_login_at: Date | null };
  otp_codes: { _id: string; code_hash: string; expires_at: Date; attempts: number; sent_at: Date };
  environments: { _id: number; name: string; description: string; created_by: string; created_at: Date; updated_at: Date };
  services: { _id: number; name: string; description: string; created_by: string; created_at: Date; updated_at: Date };
  documents: { _id: number; name: string; description: string; url: string; kind: "excel" | "document"; created_by: string; created_at: Date; updated_at: Date };
  env_vars: {
    _id: number;
    service_id: number;
    environment_id: number;
    key: string;
    /** AES-256-GCM ciphertext - never the plain value. */
    value_enc: string;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
  };
  audit_log: {
    _id?: ObjectId;
    user_email: string;
    action: string;
    entity: string;
    entity_id: number | null;
    detail: string | null;
    created_at: Date;
  };
  health_checks: {
    _id: number;
    service_id: number;
    environment_id: number;
    url: string;
    expected_status: number;
    expect_text: string;
    enabled: boolean;
    created_by: string;
    created_at: Date;
    updated_at: Date;
  };
  health_results: {
    _id?: ObjectId;
    check_id: number;
    ok: boolean;
    status_code: number | null;
    latency_ms: number;
    error: string | null;
    snippet: string | null;
    checked_at: Date;
  };
};

export const HEALTH_RETENTION_SECONDS = 7 * 24 * 60 * 60;

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("otp_codes").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    db.collection("environments").createIndex({ name: 1 }, { unique: true, collation: CI }),
    db.collection("services").createIndex({ name: 1 }, { unique: true, collation: CI }),
    db.collection("env_vars").createIndex({ service_id: 1, environment_id: 1, key: 1 }, { unique: true }),
    db.collection("env_vars").createIndex({ environment_id: 1 }),
    db.collection("audit_log").createIndex({ created_at: -1 }),
    db.collection("health_checks").createIndex({ service_id: 1, environment_id: 1 }, { unique: true }),
    db.collection("health_results").createIndex({ check_id: 1, checked_at: -1 }),
    db
      .collection("health_results")
      .createIndex({ checked_at: 1 }, { expireAfterSeconds: HEALTH_RETENTION_SECONDS }),
  ]);
}

async function connect(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  const client = new MongoClient(uri, { maxPoolSize: 10, appName: "omniia-tracker" });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "omniia_tracker");
  await ensureIndexes(db);
  return db;
}

const g = globalThis as unknown as { omniiaMongo?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.omniiaMongo ??= connect().catch((err) => {
    g.omniiaMongo = undefined;
    throw err;
  });
  return g.omniiaMongo;
}

export async function col<K extends keyof Docs>(name: K): Promise<Collection<Docs[K]>> {
  return (await getDb()).collection<Docs[K]>(name);
}

/** Next auto-increment id for a collection. */
export async function nextId(name: string): Promise<number> {
  const counters = await col("counters");
  const doc = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return doc!.seq;
}

/** Reserves `count` consecutive ids and returns the first. */
export async function reserveIds(name: string, count: number): Promise<number> {
  const counters = await col("counters");
  const doc = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: count } },
    { upsert: true, returnDocument: "after" },
  );
  return doc!.seq - count + 1;
}

export async function audit(
  userEmail: string,
  action: string,
  entity: string,
  entityId: number | null,
  detail?: string,
) {
  await (await col("audit_log")).insertOne({
    user_email: userEmail,
    action,
    entity,
    entity_id: entityId,
    detail: detail ?? null,
    created_at: new Date(),
  });
}

export const isDuplicateKey = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 11000;

export const iso = (d: Date) => d.toISOString();
