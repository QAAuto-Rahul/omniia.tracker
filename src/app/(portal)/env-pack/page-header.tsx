/** Title on the left, environment switcher (or other actions) on the right. */
export function EnvPackHeader({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      {title ?? (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">EnvPack</h1>
          <p className="text-sm text-muted-foreground">
            Environment variables for every service. Pick an environment to see its values.
          </p>
        </div>
      )}
      {children}
    </div>
  );
}
