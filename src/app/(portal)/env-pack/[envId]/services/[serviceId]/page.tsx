import type { Metadata } from "next";
import Link from "next/link";
import { EnvSwitcher } from "@/components/envpack/env-switcher";
import { ServiceHeader } from "@/components/envpack/service-header";
import { VarsTable } from "@/components/envpack/vars-table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { getServiceDetail, listEnvironments } from "@/lib/envpack/queries";
import { EnvPackHeader } from "../../../page-header";

export const metadata: Metadata = { title: "EnvPack" };

export default async function ServicePage({ params }: PageProps<"/env-pack/[envId]/services/[serviceId]">) {
  const { envId, serviceId } = await params;
  const [detail, environments] = await Promise.all([
    getServiceDetail(Number(serviceId), Number(envId)),
    listEnvironments(),
  ]);

  if (!detail) {
    return (
      <div className="rounded-xl border border-dashed bg-background px-6 py-16 text-center">
        <p className="font-medium">Service or environment not found</p>
        <p className="mb-4 text-sm text-muted-foreground">It may have been deleted.</p>
        <Link href="/env-pack" className={buttonVariants({ variant: "outline" })}>
          Back to EnvPack
        </Link>
      </div>
    );
  }

  const counts = Object.fromEntries(detail.envCounts.map((e) => [e.id, e.var_count]));

  return (
    <div className="grid gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/env-pack/${detail.environment.id}`} />}>EnvPack</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/env-pack/${detail.environment.id}`} />}>Services</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{detail.service.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <EnvPackHeader title={<ServiceHeader detail={detail} />}>
        <EnvSwitcher
          environments={environments}
          currentId={detail.environment.id}
          serviceId={detail.service.id}
          counts={counts}
        />
      </EnvPackHeader>

      <VarsTable
        serviceId={detail.service.id}
        serviceName={detail.service.name}
        environment={detail.environment}
        vars={detail.vars}
        envCounts={detail.envCounts}
      />
    </div>
  );
}
