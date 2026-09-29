import type { Metadata } from "next";
import Link from "next/link";
import { EnvSwitcher } from "@/components/envpack/env-switcher";
import { ServicesPanel } from "@/components/envpack/services-panel";
import { buttonVariants } from "@/components/ui/button";
import { listEnvironments, listServices } from "@/lib/envpack/queries";
import { EnvPackHeader } from "../page-header";

export const metadata: Metadata = { title: "EnvPack" };

export default async function EnvironmentPage({ params }: PageProps<"/env-pack/[envId]">) {
  const envId = Number((await params).envId);
  const environments = await listEnvironments();
  const environment = environments.find((e) => e.id === envId);

  if (!environment) {
    return (
      <div className="grid gap-6">
        <EnvPackHeader>
          <EnvSwitcher environments={environments} />
        </EnvPackHeader>
        <div className="rounded-xl border border-dashed bg-background px-6 py-16 text-center">
          <p className="font-medium">Environment not found</p>
          <p className="mb-4 text-sm text-muted-foreground">It may have been deleted.</p>
          <Link href="/env-pack" className={buttonVariants({ variant: "outline" })}>
            Back to EnvPack
          </Link>
        </div>
      </div>
    );
  }

  const services = await listServices(envId);

  return (
    <div className="grid gap-6">
      <EnvPackHeader>
        <EnvSwitcher environments={environments} currentId={envId} />
      </EnvPackHeader>
      <ServicesPanel environment={environment} services={services} />
    </div>
  );
}
