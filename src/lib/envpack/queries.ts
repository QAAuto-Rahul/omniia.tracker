import "server-only";
import { decryptValue } from "@/lib/server/crypto";
import { requireUser } from "@/lib/server/dal";
import { CI, col, iso } from "@/lib/server/mongo";
import type { EnvVar, Environment, ServiceDetail, ServiceSummary } from "./types";

export async function listEnvironments(): Promise<Environment[]> {
  await requireUser();
  const [envs, counts] = await Promise.all([
    (await col("environments")).find().sort({ _id: 1 }).toArray(),
    (await col("env_vars"))
      .aggregate<{ _id: number; n: number }>([{ $group: { _id: "$environment_id", n: { $sum: 1 } } }])
      .toArray(),
  ]);
  const countBy = new Map(counts.map((c) => [c._id, c.n]));
  return envs.map((e) => ({ id: e._id, name: e.name, description: e.description, var_count: countBy.get(e._id) ?? 0 }));
}

/** Every service, with variable counts for the given environment. */
export async function listServices(environmentId: number): Promise<ServiceSummary[]> {
  await requireUser();
  const [services, stats] = await Promise.all([
    (await col("services")).find().sort({ name: 1 }).collation(CI).toArray(),
    (await col("env_vars"))
      .aggregate<{ _id: number; total: number; inEnv: number; lastInEnv: Date | null }>([
        {
          $group: {
            _id: "$service_id",
            total: { $sum: 1 },
            inEnv: { $sum: { $cond: [{ $eq: ["$environment_id", environmentId] }, 1, 0] } },
            lastInEnv: { $max: { $cond: [{ $eq: ["$environment_id", environmentId] }, "$updated_at", null] } },
          },
        },
      ])
      .toArray(),
  ]);
  const statBy = new Map(stats.map((s) => [s._id, s]));
  return services.map((s) => {
    const st = statBy.get(s._id);
    const updated = st?.lastInEnv && st.lastInEnv > s.updated_at ? st.lastInEnv : s.updated_at;
    return {
      id: s._id,
      name: s.name,
      description: s.description,
      var_count: st?.inEnv ?? 0,
      total_var_count: st?.total ?? 0,
      updated_at: iso(updated),
    };
  });
}

export async function getServiceDetail(serviceId: number, environmentId: number): Promise<ServiceDetail | null> {
  await requireUser();
  if (!Number.isSafeInteger(serviceId) || !Number.isSafeInteger(environmentId)) return null;

  const [service, environment] = await Promise.all([
    (await col("services")).findOne({ _id: serviceId }),
    (await col("environments")).findOne({ _id: environmentId }),
  ]);
  if (!service || !environment) return null;

  const [rows, envs, counts] = await Promise.all([
    (await col("env_vars")).find({ service_id: serviceId, environment_id: environmentId }).sort({ key: 1 }).toArray(),
    (await col("environments")).find().sort({ _id: 1 }).toArray(),
    (await col("env_vars"))
      .aggregate<{ _id: number; n: number }>([
        { $match: { service_id: serviceId } },
        { $group: { _id: "$environment_id", n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const vars: EnvVar[] = rows.map((v) => ({
    id: v._id,
    key: v.key,
    value: decryptValue(v.value_enc),
    updated_by: v.updated_by,
    updated_at: iso(v.updated_at),
  }));
  const countBy = new Map(counts.map((c) => [c._id, c.n]));

  return {
    service: { id: service._id, name: service.name, description: service.description },
    environment: { id: environment._id, name: environment.name },
    vars,
    envCounts: envs.map((e) => ({ id: e._id, name: e.name, var_count: countBy.get(e._id) ?? 0 })),
  };
}
