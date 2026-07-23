import { cn } from "@/lib/utils";

/** Renders a referee-card-shaped swatch next to a count, so yellow/red tallies read at a glance. */
export function CardChip({
  color,
  count,
  label,
  className,
}: {
  color: "yellow" | "red";
  count: number;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={label}>
      <span
        className={cn(
          "inline-block h-3.5 w-2.5 shrink-0 rounded-[2px]",
          color === "yellow" ? "bg-card-yellow" : "bg-card-red"
        )}
        aria-hidden="true"
      />
      <span className="font-mono text-sm tabular-figures">{count}</span>
    </span>
  );
}
