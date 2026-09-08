import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "brand" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "bg-secondary text-foreground",
    brand: "bg-accent text-accent-foreground",
    success: "bg-success/12 text-success",
    warning: "bg-warning/18 text-warning-foreground",
    danger: "bg-destructive/10 text-destructive",
  } as const;

  return (
    <div className="card-surface p-3.5 transition-shadow hover:shadow-raised sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
        <p className="min-w-0 pt-0.5 text-[0.72rem] leading-snug font-medium tracking-wide text-muted-foreground uppercase sm:text-[0.68rem] sm:tracking-[0.14em]">
          {label}
        </p>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-xl sm:size-9 ${tones[tone]}`}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2.5 font-display text-[1.05rem] leading-none font-semibold tabular-nums sm:mt-3 sm:text-2xl">
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-[0.72rem] leading-snug text-muted-foreground sm:mt-2 sm:text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

