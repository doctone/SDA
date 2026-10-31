"use client";

import { useActionState } from "react";
import { startRun, type StartRunState } from "../../actions";

export function RerunButton({ threadId, label }: { threadId: number; label: string }) {
  const [state, formAction, isPending] = useActionState(startRun, { message: null, input: "" } satisfies StartRunState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="thread" value={threadId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
      >
        {isPending ? "Starting…" : label}
      </button>
      {state.message && (
        <p role="alert" className="text-xs text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
