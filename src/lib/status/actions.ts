"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/dal";
import { audit, col, isDuplicateKey, nextId, reserveIds } from "@/lib/server/mongo";
import { ValidationError } from "@/lib/envpack/validation";
import { runAllChecks, runCheck } from "./monitor";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof ValidationError) return { ok: false, error: err.message };
  if (isDuplicateKey(err)) return { ok: false, error: "This service already has a check in that environment." };
  console.error("[health]", err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function parseId(input: unknown): number {
  const id = Number(input);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationError("Invalid id.");
  return id;
}

function validateUrl(input: unknown): string {
  const raw = String(input ?? "").trim();
  if (!raw) throw new ValidationError("URL is required.");
  if (raw.length > 2000) throw new ValidationError("URL is too long.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError(`"${raw}" is not a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ValidationError("URL must start with http:// or https://");
  return url.toString();
}

function validateStatus(input: unknown): number {
  const status = Number(input ?? 200);
  if (!Number.isInteger(status) || status < 100 || status > 599) throw new ValidationError("Expected status must be 100-599.");
  return status;
}

export type CheckInput = { url: string; expectedStatus?: number; expectText?: string; enabled?: boolean };

/** Creates or updates the check for (service, environment) and runs it immediately. */
export async function saveCheck(serviceId: number, environmentId: number, input: CheckInput): Promise<Result> {
  const user = await requireUser();
  try {
    const sId = parseId(serviceId);
    const eId = parseId(environmentId);
    const url = validateUrl(input.url);
    const expected_status = validateStatus(input.expectedStatus);
    const expect_text = String(input.expectText ?? "").slice(0, 500);
    const enabled = input.enabled !== false;

    const checks = await col("health_checks");
    const now = new Date();
    let check = await checks.findOneAndUpdate(
      { service_id: sId, environment_id: eId },
      { $set: { url, expected_status, expect_text, enabled, deployed: true, updated_at: now } },
      { returnDocument: "after" },
    );
    if (!check) {
      check = {
        _id: await nextId("health_checks"),
        service_id: sId,
        environment_id: eId,
        url,
        expected_status,
        expect_text,
        enabled,
        deployed: true,
        created_by: user.email,
        created_at: now,
        updated_at: now,
      };
      await checks.insertOne(check);
    }
    await audit(user.email, "save", "health_check", check._id, url);
    if (enabled) await runCheck(check._id);
    revalidatePath("/status");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Marks a service/environment as intentionally not deployed, creating a placeholder if needed. */
export async function markNotDeployed(serviceId: number, environmentId: number, notDeployed: boolean): Promise<Result> {
  const user = await requireUser();
  try {
    const sId = parseId(serviceId);
    const eId = parseId(environmentId);
    const now = new Date();
    const checks = await col("health_checks");
    let check = await checks.findOneAndUpdate(
      { service_id: sId, environment_id: eId },
      { $set: { deployed: !notDeployed, enabled: !notDeployed, updated_at: now } },
      { returnDocument: "after" },
    );
    if (!check) {
      check = {
        _id: await nextId("health_checks"), service_id: sId, environment_id: eId,
        url: "", expected_status: 200, expect_text: "", enabled: false, deployed: false,
        created_by: user.email, created_at: now, updated_at: now,
      };
      await checks.insertOne(check);
    }
    await audit(user.email, "deployment_status", "health_check", check._id, notDeployed ? "not deployed" : "deployed");
    revalidatePath("/status");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteCheck(checkId: number): Promise<Result> {
  const user = await requireUser();
  try {
    const id = parseId(checkId);
    await (await col("health_results")).deleteMany({ check_id: id });
    await (await col("health_checks")).deleteOne({ _id: id });
    await audit(user.email, "delete", "health_check", id);
    revalidatePath("/status");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function checkNow(checkId: number): Promise<Result> {
  await requireUser();
  try {
    await runCheck(parseId(checkId));
    revalidatePath("/status");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function checkAllNow(): Promise<Result<{ count: number }>> {
  await requireUser();
  try {
    const count = await runAllChecks();
    revalidatePath("/status");
    return { ok: true, count };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Adds checks for every service that doesn't have one in this environment yet,
 * from a pattern like https://{service}.testsdlc.in/ ({env} is also supported).
 */
export async function addChecksFromPattern(
  environmentId: number,
  pattern: string,
  expectText?: string,
): Promise<Result<{ added: number }>> {
  const user = await requireUser();
  try {
    const eId = parseId(environmentId);
    const env = await (await col("environments")).findOne({ _id: eId });
    if (!env) throw new ValidationError("Environment not found.");
    if (!String(pattern).includes("{service}")) throw new ValidationError("Pattern must include {service}.");

    const checks = await col("health_checks");
    const covered = new Set(
      (await checks.find({ environment_id: eId }, { projection: { service_id: 1 } }).toArray()).map((c) => c.service_id),
    );
    const missing = (await (await col("services")).find().toArray()).filter((s) => !covered.has(s._id));

    const now = new Date();
    const expect_text = String(expectText ?? "").slice(0, 500);
    const docs = missing.map((s) => ({
      service_id: s._id,
      environment_id: eId,
      url: validateUrl(pattern.replaceAll("{service}", s.name).replaceAll("{env}", env.name.toLowerCase())),
      expected_status: 200,
      expect_text,
      enabled: true,
      created_by: user.email,
      created_at: now,
      updated_at: now,
    }));

    if (docs.length) {
      const first = await reserveIds("health_checks", docs.length);
      const withIds = docs.map((d, i) => ({ _id: first + i, ...d }));
      await checks.insertMany(withIds);
      await runAllChecks(withIds.map((d) => d._id));
    }
    await audit(user.email, "pattern", "health_check", eId, `${pattern} (${docs.length} added)`);
    revalidatePath("/status");
    return { ok: true, added: docs.length };
  } catch (err) {
    return fail(err);
  }
}
