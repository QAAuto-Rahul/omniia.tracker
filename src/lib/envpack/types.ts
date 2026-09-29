export type Environment = {
  id: number;
  name: string;
  description: string;
  var_count: number;
};

export type ServiceSummary = {
  id: number;
  name: string;
  description: string;
  var_count: number;
  total_var_count: number;
  updated_at: string;
};

export type EnvVar = {
  id: number;
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
};

export type ServiceDetail = {
  service: { id: number; name: string; description: string };
  environment: { id: number; name: string };
  vars: EnvVar[];
  envCounts: { id: number; name: string; var_count: number }[];
};

export type EnvTone = "prod" | "staging" | "qa" | "dev" | "other";

export function envTone(name: string): EnvTone {
  const n = name.toLowerCase();
  if (/prod|live/.test(n)) return "prod";
  if (/stag|uat|pre/.test(n)) return "staging";
  if (/qa|test/.test(n)) return "qa";
  if (/dev|local/.test(n)) return "dev";
  return "other";
}
