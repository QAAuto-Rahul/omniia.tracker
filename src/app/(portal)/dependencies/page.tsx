import { redirect } from "next/navigation";
import { listEnvironments } from "@/lib/envpack/queries";

export const metadata = { title: "Service Dependencies" };

export default async function DependenciesPage() {
  const environments = await listEnvironments();
  if (environments.length) redirect(`/dependencies/${environments[0].id}`);
  return (
    <div className="grid gap-3 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Service Dependencies</h1>
      <p className="text-sm text-muted-foreground">Create an environment and add services to map their dependencies.</p>
    </div>
  );
}
