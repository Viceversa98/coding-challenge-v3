import { useQuery } from "@tanstack/react-query";
import { Outlet, createRootRoute } from "@tanstack/react-router";

import { fetchHealth } from "../lib/api";

const RootLayout = () => {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  const isConnected = healthQuery.data?.database === "connected";
  const healthLabel = getHealthLabel(
    healthQuery.isPending,
    healthQuery.isError,
    isConnected,
  );
  const healthClassName = isConnected
    ? "rounded-full bg-emerald-950 px-3 py-1 text-sm font-medium text-accent"
    : "rounded-full bg-red-950 px-3 py-1 text-sm font-medium text-red-200";

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="font-mono text-xs tracking-wide text-muted uppercase">
              Vendor profitability
            </p>
            <h1 className="text-xl font-semibold sm:text-2xl">
              Fee workbench
            </h1>
          </div>
          <p className={healthClassName} role="status" aria-live="polite">
            {healthLabel}
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
};

const getHealthLabel = (
  isPending: boolean,
  isError: boolean,
  isConnected: boolean,
): string => {
  if (isPending) {
    return "Checking database";
  }
  if (isError) {
    return "Database unreachable";
  }
  if (isConnected) {
    return "Database connected";
  }
  return "Database disconnected";
};

export const Route = createRootRoute({
  component: RootLayout,
});
