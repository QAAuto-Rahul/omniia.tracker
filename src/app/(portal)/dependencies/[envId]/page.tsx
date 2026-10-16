import Link from "next/link";
import { DependencyMap } from "@/components/dependencies/dependency-map";
import { EnvSwitcher } from "@/components/envpack/env-switcher";
import { buttonVariants } from "@/components/ui/button";
import { getDependencyGraph, listEnvironments } from "@/lib/envpack/queries";

export const metadata = { title: "Service Dependencies" };

export default async function EnvironmentDependenciesPage({ params }: PageProps<"/dependencies/[envId]">) {
  const envId = Number((await params).envId);
  const environments = await listEnvironments();
  const environment = environments.find((item) => item.id === envId);
  if (!environment) return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Service Dependencies</h1><EnvSwitcher environments={environments} basePath="/dependencies" /></header>
      <div className="rounded-xl border border-dashed bg-background px-6 py-16 text-center">
        <p className="font-medium">Environment not found</p>
        <Link href="/dependencies" className={buttonVariants({ variant: "outline", className: "mt-4" })}>Choose an environment</Link>
      </div>
    </div>
  );
  const graph = await getDependencyGraph(envId);
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Service Dependencies</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Each dot is a service. Hover over one to see which services use it; arrows point from the calling service to the service it uses. Connections are inferred by matching environment URLs to service health-check URLs.
          </p>
        </div>
        <div className="ml-auto flex justify-end">
          <EnvSwitcher environments={environments} currentId={envId} basePath="/dependencies" />
        </div>
      </header>
      <DependencyMap environment={environment} graph={graph} />
    </div>
  );
}
