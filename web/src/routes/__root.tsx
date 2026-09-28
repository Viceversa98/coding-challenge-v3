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
    ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-900"
    : "rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-900";

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
              Vendor profitability
            </p>
            <h1 className="text-2xl font-semibold">Process deduction</h1>
          </div>
          <div className="text-right">
            <p className={healthClassName} role="status" aria-live="polite">
              {healthLabel}
            </p>
            {healthQuery.data?.timestamp ? (
              <p className="mt-2 text-xs text-stone-500">
                {healthQuery.data.timestamp}
              </p>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
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
