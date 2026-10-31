"use client";

import { useActionState } from "react";
import { startRun, type StartRunState } from "./actions";

const initialState: StartRunState = { message: null, input: "" };

export function StartRunForm() {
  const [state, formAction, isPending] = useActionState(startRun, initialState);
  const hasError = state.message !== null;

  return (
    <form action={formAction} className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
      <div className="flex items-center gap-2">
        <label htmlFor="thread" className="sr-only">
          HN thread ID or link
        </label>
        <input
          id="thread"
          name="thread"
          defaultValue={state.input}
          placeholder="49922569 or https://news.ycombinator.com/item?id=49922569"
          aria-invalid={hasError}
          aria-describedby={hasError ? "thread-error" : undefined}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {isPending ? "Starting…" : "Analyse thread"}
        </button>
      </div>
      {hasError && (
        <p id="thread-error" role="alert" className="px-3 pt-2 pb-1 text-sm text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
