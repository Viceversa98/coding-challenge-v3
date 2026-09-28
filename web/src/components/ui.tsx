import type { ReactNode } from "react";

export const cx = (...parts: Array<string | false | undefined>): string =>
  parts.filter(Boolean).join(" ");

export const buttonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButton = cx(
  buttonClass,
  "bg-accent text-accent-ink hover:bg-emerald-400",
);

export const quietButton = cx(
  buttonClass,
  "border border-line bg-panel text-ink hover:border-ink",
);

export const dangerButton = cx(
  buttonClass,
  "bg-danger text-danger-ink hover:bg-red-400",
);

export const fieldClass =
  "min-h-11 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

export const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
};

export const Notice = ({
  tone,
  children,
}: {
  tone: "error" | "ok";
  children: ReactNode;
}) => {
  const className =
    tone === "error"
      ? "rounded-md border border-danger bg-red-950/40 px-3 py-2 text-sm text-red-100"
      : "rounded-md border border-accent bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100";

  return (
    <p className={className} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
};

export const Pager = ({
  offset,
  limit,
  total,
  onPage,
}: {
  offset: number;
  limit: number;
  total: number;
  onPage: (offset: number) => void;
}) => {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Showing {from}-{to} of {total}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={quietButton}
          disabled={offset === 0}
          onClick={() => {
            onPage(Math.max(0, offset - limit));
          }}
        >
          Previous
        </button>
        <button
          type="button"
          className={quietButton}
          disabled={offset + limit >= total}
          onClick={() => {
            onPage(offset + limit);
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};
