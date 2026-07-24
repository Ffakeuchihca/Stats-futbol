import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_ACCENT: Record<string, string> = {
  default: "bg-primary",
  warning: "bg-card-yellow",
  danger: "bg-card-red",
};

const TONE_TEXT: Record<string, string> = {
  default: "text-foreground",
  warning: "text-amber-700 dark:text-card-yellow",
  danger: "text-card-red",
};

const TONE_ICON: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  warning: "bg-card-yellow/15 text-amber-700 dark:text-card-yellow",
  danger: "bg-card-red/10 text-card-red",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <Card className="relative overflow-hidden">
      <span className={cn("absolute inset-y-0 left-0 w-1", TONE_ACCENT[tone])} aria-hidden="true" />
      <CardContent className="flex items-start justify-between gap-3 pl-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          <span
            className={cn(
              "font-display text-3xl leading-none tabular-figures",
              TONE_TEXT[tone]
            )}
          >
            {value}
          </span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            TONE_ICON[tone]
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
