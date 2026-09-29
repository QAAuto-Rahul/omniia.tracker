"use server";

import { revalidatePath } from "next/cache";
import { decryptValue, encryptValue } from "@/lib/server/crypto";
import { requireUser, type CurrentUser } from "@/lib/server/dal";
import { audit, col, isDuplicateKey, nextId, reserveIds } from "@/lib/server/mongo";
import type { EnvEntry } from "./dotenv";
import {
  IMPORT_MAX_ENTRIES,
  ValidationError,
  validateDescription,
  validateKey,
  validateName,
  validateValue,
} from "./validation";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
export type ImportCounts = { created: number; updated: number; skipped: number };

async function run<T extends object>(
  fn: (user: CurrentUser) => Promise<T>,
  duplicateMessage = "That name is already taken.",
): Promise<ActionResult<T>> {
  const user = await requireUser();
  try {
    const data = await fn(user);
    revalidatePath("/env-pack", "layout");
    return { ok: true, ...data };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, error: err.message };
    if (isDuplicateKey(err)) return { ok: false, error: duplicateMessage };
    console.error("[envpack]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function parseId(input: unknown): number {
  const id = Number(input);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationError("Invalid id.");
  return id;
}

async function mustExist(name: "environments" | "services" | "env_vars", id: number, label: string) {
  const found = await (await col(name)).countDocuments({ _id: id }, { limit: 1 });
  if (!found) throw new ValidationError(`${label} not found. It may have been deleted - refresh the page.`);
}

async function deleteHealthChecks(filter: { service_id?: number; environment_id?: number }) {
  const checks = await col("health_checks");
  const ids = (await checks.find(filter, { projection: { _id: 1 } }).toArray()).map((c) => c._id);
  if (!ids.length) return;
  await (await col("health_results")).deleteMany({ check_id: { $in: ids } });
  await checks.deleteMany({ _id: { $in: ids } });
}

async function upsertVars(
  user: CurrentUser,
  serviceId: number,
  environmentId: number,
  entries: EnvEntry[],
  overwrite: boolean,
): Promise<ImportCounts> {
  const envVars = await col("env_vars");
  const existing = new Map(
    (await envVars.find({ service_id: serviceId, environment_id: environmentId }).toArray()).map((v) => [
      v.key,
      decryptValue(v.value_enc),
    ]),
  );

  const counts: ImportCounts = { created: 0, updated: 0, skipped: 0 };
  const toInsert: EnvEntry[] = [];
  const now = new Date();
  for (const entry of entries) {
    if (!existing.has(entry.key)) {
      toInsert.push(entry);
      counts.created++;
    } else if (overwrite && existing.get(entry.key) !== entry.value) {
      await envVars.updateOne(
        { service_id: serviceId, environment_id: environmentId, key: entry.key },
        { $set: { value_enc: encryptValue(entry.value), updated_by: user.email, updated_at: now } },
      );
      counts.updated++;
    } else {
      counts.skipped++;
    }
  }

  if (toInsert.length) {
    const first = await reserveIds("env_vars", toInsert.length);
    await envVars.insertMany(
      toInsert.map((e, i) => ({
        _id: first + i,
        service_id: serviceId,
        environment_id: environmentId,
        key: e.key,
        value_enc: encryptValue(e.value),
        updated_by: user.email,
        created_at: now,
        updated_at: now,
      })),
    );
  }
  return counts;
}


export async function createEnvironment(input: {
  name: string;
  description?: string;
  cloneFromId?: number | null;
  includeValues?: boolean;
}): Promise<ActionResult<{ id: number }>> {
  return run(async (user) => {
    const name = validateName(input.name, "Environment name");
    const description = validateDescription(input.description);
    const cloneFromId = input.cloneFromId ? parseId(input.cloneFromId) : null;
    if (cloneFromId) await mustExist("environments", cloneFromId, "Source environment");

    const now = new Date();
    const id = await nextId("environments");
    await (await col("environments")).insertOne({
      _id: id,
      name,
      description,
      created_by: user.email,
      created_at: now,
      updated_at: now,
    });

    let copied = 0;
    if (cloneFromId) {
      const envVars = await col("env_vars");
      const source = await envVars.find({ environment_id: cloneFromId }).toArray();
      if (source.length) {
        const first = await reserveIds("env_vars", source.length);
        const empty = encryptValue("");
        await envVars.insertMany(
          source.map((v, i) => ({
            _id: first + i,
            service_id: v.service_id,
            environment_id: id,
            key: v.key,
            value_enc: input.includeValues ? encryptValue(decryptValue(v.value_enc)) : empty,
            updated_by: user.email,
            created_at: now,
            updated_at: now,
          })),
        );
        copied = source.length;
      }
    }

    await audit(user.email, "create", "environment", id, cloneFromId ? `${name} (copied ${copied} keys from #${cloneFromId})` : name);
    return { id };
  }, "An environment with that name already exists.");
}

export async function updateEnvironment(id: number, input: { name: string; description?: string }): Promise<ActionResult> {
  return run(async (user) => {
    const envId = parseId(id);
    const name = validateName(input.name, "Environment name");
    const description = validateDescription(input.description);
    const res = await (await col("environments")).updateOne(
      { _id: envId },
      { $set: { name, description, updated_at: new Date() } },
    );
    if (!res.matchedCount) throw new ValidationError("Environment not found.");
    await audit(user.email, "update", "environment", envId, name);
    return {};
  }, "An environment with that name already exists.");
}

export async function deleteEnvironment(id: number): Promise<ActionResult> {
  return run(async (user) => {
    const envId = parseId(id);
    const env = await (await col("environments")).findOne({ _id: envId });
    if (!env) throw new ValidationError("Environment not found.");
    await (await col("env_vars")).deleteMany({ environment_id: envId });
    await deleteHealthChecks({ environment_id: envId });
    await (await col("environments")).deleteOne({ _id: envId });
    await audit(user.email, "delete", "environment", envId, env.name);
    return {};
  });
}


export async function createService(input: { name: string; description?: string }): Promise<ActionResult<{ id: number }>> {
  return run(async (user) => {
    const name = validateName(input.name, "Service name");
    const description = validateDescription(input.description);
    const now = new Date();
    const id = await nextId("services");
    await (await col("services")).insertOne({
      _id: id,
      name,
      description,
      created_by: user.email,
      created_at: now,
      updated_at: now,
    });
    await audit(user.email, "create", "service", id, name);
    return { id };
  }, "A service with that name already exists.");
}

export async function updateService(id: number, input: { name: string; description?: string }): Promise<ActionResult> {
  return run(async (user) => {
    const serviceId = parseId(id);
    const name = validateName(input.name, "Service name");
    const description = validateDescription(input.description);
    const res = await (await col("services")).updateOne(
      { _id: serviceId },
      { $set: { name, description, updated_at: new Date() } },
    );
    if (!res.matchedCount) throw new ValidationError("Service not found.");
    await audit(user.email, "update", "service", serviceId, name);
    return {};
  }, "A service with that name already exists.");
}

export async function deleteService(id: number): Promise<ActionResult> {
  return run(async (user) => {
    const serviceId = parseId(id);
    const service = await (await col("services")).findOne({ _id: serviceId });
    if (!service) throw new ValidationError("Service not found.");
    await (await col("env_vars")).deleteMany({ service_id: serviceId });
    await deleteHealthChecks({ service_id: serviceId });
    await (await col("services")).deleteOne({ _id: serviceId });
    await audit(user.email, "delete", "service", serviceId, service.name);
    return {};
  });
}


export async function createVar(serviceId: number, environmentId: number, input: EnvEntry): Promise<ActionResult> {
  return run(async (user) => {
    const sId = parseId(serviceId);
    const eId = parseId(environmentId);
    const key = validateKey(input.key);
    const value = validateValue(input.value);
    await mustExist("services", sId, "Service");
    await mustExist("environments", eId, "Environment");
    const now = new Date();
    const id = await nextId("env_vars");
    await (await col("env_vars")).insertOne({
      _id: id,
      service_id: sId,
      environment_id: eId,
      key,
      value_enc: encryptValue(value),
      updated_by: user.email,
      created_at: now,
      updated_at: now,
    });
    await audit(user.email, "create", "env_var", id, key);
    return {};
  }, "That key already exists in this environment. Edit the existing value instead.");
}

export async function updateVar(id: number, input: EnvEntry): Promise<ActionResult> {
  return run(async (user) => {
    const varId = parseId(id);
    const key = validateKey(input.key);
    const value = validateValue(input.value);
    const res = await (await col("env_vars")).updateOne(
      { _id: varId },
      { $set: { key, value_enc: encryptValue(value), updated_by: user.email, updated_at: new Date() } },
    );
    if (!res.matchedCount) throw new ValidationError("Variable not found. It may have been deleted - refresh the page.");
    await audit(user.email, "update", "env_var", varId, key);
    return {};
  }, "That key already exists in this environment.");
}

export async function deleteVar(id: number): Promise<ActionResult> {
  return run(async (user) => {
    const varId = parseId(id);
    const row = await (await col("env_vars")).findOneAndDelete({ _id: varId });
    if (!row) throw new ValidationError("Variable not found.");
    await audit(user.email, "delete", "env_var", varId, row.key);
    return {};
  });
}

export async function importVars(
  serviceId: number,
  environmentId: number,
  entries: EnvEntry[],
  overwrite: boolean,
): Promise<ActionResult<ImportCounts>> {
  return run(async (user) => {
    const sId = parseId(serviceId);
    const eId = parseId(environmentId);
    await mustExist("services", sId, "Service");
    await mustExist("environments", eId, "Environment");
    if (!Array.isArray(entries) || entries.length === 0) throw new ValidationError("Nothing to import.");
    if (entries.length > IMPORT_MAX_ENTRIES) {
      throw new ValidationError(`Import at most ${IMPORT_MAX_ENTRIES} variables at a time.`);
    }
    const clean = entries.map((e) => ({ key: validateKey(e?.key), value: validateValue(e?.value) }));
    const counts = await upsertVars(user, sId, eId, clean, overwrite);
    await audit(user.email, "import", "service", sId, `env #${eId}: ${counts.created} created, ${counts.updated} updated`);
    return counts;
  });
}

export async function copyVarsFromEnvironment(
  serviceId: number,
  fromEnvironmentId: number,
  toEnvironmentId: number,
  includeValues: boolean,
): Promise<ActionResult<ImportCounts>> {
  return run(async (user) => {
    const sId = parseId(serviceId);
    const fromId = parseId(fromEnvironmentId);
    const toId = parseId(toEnvironmentId);
    if (fromId === toId) throw new ValidationError("Pick a different environment to copy from.");
    await mustExist("services", sId, "Service");
    await mustExist("environments", fromId, "Source environment");
    await mustExist("environments", toId, "Environment");

    const source = (await (await col("env_vars")).find({ service_id: sId, environment_id: fromId }).toArray()).map((v) => ({
      key: v.key,
      value: includeValues ? decryptValue(v.value_enc) : "",
    }));
    if (source.length === 0) throw new ValidationError("That environment has no variables for this service.");

    const counts = await upsertVars(user, sId, toId, source, false);
    await audit(user.email, "copy", "service", sId, `env #${fromId} -> #${toId}: ${counts.created} created`);
    return counts;
  });
}
