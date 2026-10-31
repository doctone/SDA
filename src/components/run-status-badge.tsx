import type { RunStatus } from "@/lib/thread-data";

const STYLES: Record<RunStatus, { label: string; className: string }> = {
  running: { label: "Running", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  completed: { label: "Completed", className: "bg-green-50 text-green-700 ring-green-200" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 ring-red-200" },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const style = STYLES[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}>
      {style.label}
    </span>
  );
}
