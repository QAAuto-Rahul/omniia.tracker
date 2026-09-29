import { requireUser } from "@/lib/server/dal";
import { AppSidebar, MobileHeader } from "@/components/app-sidebar";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh w-full">
      <AppSidebar email={user.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader email={user.email} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
