import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          {eyebrow && (
            <span className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
              {eyebrow}
            </span>
          )}
          <h1 className="font-display text-4xl leading-none text-balance text-foreground sm:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {/* Halfway line + center spot: a pitch marking used as the section rule */}
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
        <span
          className="h-px flex-1"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, var(--border) 0, var(--border) 6px, transparent 6px, transparent 12px)",
          }}
        />
      </div>
    </div>
  );
}
