"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
import type { RunResult } from "@/lib/paths";
import { cn } from "@/lib/utils";

const pre = "overflow-auto rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre";

/** Shows a run in progress with a live seconds counter. */
export function Running({ label, since }: { label: string; since: number }) {
  const [now, setNow] = React.useState(since);
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="flex items-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}… {Math.max(0, Math.round((now - since) / 1000))}s
    </p>
  );
}

/** Test verdicts, failing cases with your output next to the expected one, printed output and plots. */
export function RunOutput({ result, mode }: { result: RunResult; mode: "run" | "submit" }) {
  const blocks: React.ReactNode[] = [];
  if (result.total != null) {
    const all = result.passed === result.total;
    blocks.push(
      <div key="verdict" className={cn("flex flex-wrap items-center gap-x-2 text-[0.9375rem] font-semibold", all ? "text-positive" : "text-negative")}>
        {all ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        {result.passed} / {result.total} tests passed
        {mode === "run" ? (
          <span className="text-xs font-normal text-muted">(sample tests; Submit runs all)</span>
        ) : (
          all && <span>· Solved</span>
        )}
        <span className="text-xs font-normal text-muted">{result.seconds}s</span>
      </div>,
    );
    for (const c of result.cases ?? []) {
      blocks.push(
        <details key={`case-${c.name}`} open={!c.ok || c.got != null} className="rounded-xl border border-border">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
            {c.ok ? <Check className="h-4 w-4 text-positive" /> : <X className="h-4 w-4 text-negative" />}
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <span className="font-mono text-xs text-muted">{c.seconds}s</span>
          </summary>
          <div className="space-y-2 px-3 pb-3">
            {c.message && <pre className={cn(pre, "whitespace-pre-wrap text-negative")}>{c.message}</pre>}
            {c.got != null && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="min-w-0">
                  <div className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted">Your output</div>
                  <pre className={pre}>{c.got}</pre>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted">Expected</div>
                  <pre className={pre}>{c.expected}</pre>
                </div>
              </div>
            )}
          </div>
        </details>,
      );
    }
  }
  if (result.error) {
    blocks.push(
      <div key="error" className="space-y-1">
        <div className="text-sm font-semibold text-negative">Error</div>
        <pre className={cn(pre, "whitespace-pre-wrap text-negative")}>{result.error}</pre>
      </div>,
    );
  }
  if (result.stdout) {
    blocks.push(
      <div key="stdout" className="space-y-1">
        <div className="text-2xs font-semibold uppercase tracking-wider text-muted">Output</div>
        <pre className={pre}>{result.stdout}</pre>
      </div>,
    );
  }
  for (const [k, f] of (result.figures ?? []).entries()) {
    // eslint-disable-next-line @next/next/no-img-element -- a base64 plot from the run, not a static asset
    blocks.push(<img key={`fig-${k}`} alt={`Figure ${k + 1}`} src={`data:image/png;base64,${f}`} className="w-full rounded-lg bg-white" />);
  }
  if (!blocks.length) {
    return <p className="text-sm text-muted">Ran in {result.seconds ?? 0}s with no output. Use print() or make a plot.</p>;
  }
  return <div className="space-y-3">{blocks}</div>;
}
