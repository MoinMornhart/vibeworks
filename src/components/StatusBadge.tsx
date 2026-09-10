import type { ProjectStatus } from "@prisma/client";
import { PROJECT_STATUS_MAP } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const s = PROJECT_STATUS_MAP[status];
  const c = `var(${s.cssVar})`;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", className)}
      style={{
        color: `color-mix(in srgb, ${c} 65%, var(--vw-text))`,
        borderColor: `color-mix(in srgb, ${c} 45%, transparent)`,
        background: `color-mix(in srgb, ${c} 14%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {s.label}
    </span>
  );
}
