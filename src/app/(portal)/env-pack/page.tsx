import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EnvSwitcher } from "@/components/envpack/env-switcher";
import { LAST_ENV_COOKIE } from "@/lib/envpack/constants";
import { listEnvironments } from "@/lib/envpack/queries";
import { EnvPackHeader } from "./page-header";

export const metadata: Metadata = { title: "EnvPack" };

export default async function EnvPackPage() {
  const environments = await listEnvironments();

  if (environments.length > 0) {
    // Reopen the environment the user last looked at.
    const lastId = Number((await cookies()).get(LAST_ENV_COOKIE)?.value);
    const target = environments.find((e) => e.id === lastId) ?? environments[0];
    redirect(`/env-pack/${target.id}`);
  }

  return (
    <div className="grid gap-6">
      <EnvPackHeader />
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
        <div>
          <p className="font-medium">No environments yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first environment (e.g. Development), then add services and their values.
          </p>
        </div>
        <EnvSwitcher environments={[]} />
      </div>
    </div>
  );
}
