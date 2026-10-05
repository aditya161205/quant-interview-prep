"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, Play, RotateCcw, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { CodeEditor, type EditorHandle } from "@/components/paths/code-editor";
import { Gate, usePaths } from "@/components/paths/load";
import { Markdown } from "@/components/paths/markdown";
import { RunOutput, Running } from "@/components/paths/run-output";
import { SplitPane } from "@/components/paths/split-pane";
import { useAutosave } from "@/components/paths/use-autosave";
import { useStored } from "@/components/paths/use-stored";
import { api, type RunResult, type Task, type TaskStatus } from "@/lib/paths";
import { runPython, warmUp } from "@/lib/run-python";

const STATUS_BADGE: Record<TaskStatus, [string, "default" | "accent" | "positive"]> = {
  solved: ["Solved", "positive"],
  attempted: ["In progress", "accent"],
  new: ["Not started", "default"],
};

/** Which path a task's back link should return to: the one you came from, else the step's own. */
function guessTrack(step: string, param: string | null, remembered: string | null): string {
  if (param) return param;
  if (step.startsWith("r")) return "researcher";
  if (step.startsWith("t") && !["t7_volatility", "t8_hedging"].includes(step)) return "trader";
  return remembered || "trader";
}

export function TaskView({ id }: { id: string }) {
  const load = usePaths<Task>(`problem?id=${encodeURIComponent(id)}`);
  React.useEffect(() => warmUp(), []);
  return <Gate load={load}>{(task) => <Workspace key={task.id} task={task} />}</Gate>;
}

function Workspace({ task }: { task: Task }) {
  const track = guessTrack(task.step, useSearchParams().get("t"), useStored("qp-track"));
  const editor = React.useRef<EditorHandle>(null);
  const autosave = useAutosave(task.id, editor);
  const [status, setStatus] = React.useState<TaskStatus>(task.status);
  const [solution, setSolution] = React.useState<string | null>(task.solution);
  const [running, setRunning] = React.useState<{ label: string; since: number } | null>(null);
  const [result, setResult] = React.useState<{ r: RunResult; mode: "run" | "submit" } | null>(null);

  const k = task.siblings.indexOf(task.id);
  const nextId = task.siblings[k + 1];

  const run = async (mode: "run" | "submit") => {
    if (running || !editor.current) return;
    const code = editor.current.get();
    autosave.cancel();
    setRunning({ label: "Preparing", since: Date.now() });
    try {
      const saved = api("save", { id: task.id, code }).catch(() => {});
      const r = await runPython({ id: task.id, module: task.step, code, mode, timeout: task.timeout }, (label) =>
        setRunning((x) => (x ? { ...x, label } : x)),
      );
      setResult({ r, mode });
      await saved;
      if (r.total != null) {
        const rep = await api<{ status: TaskStatus }>("result", { id: task.id, mode, passed: r.passed ?? 0, total: r.total });
        setStatus(rep.status);
        if (rep.status === "solved" && !solution) setSolution((await api<Task>(`problem?id=${task.id}`)).solution);
      }
    } catch (e) {
      setResult({ r: { error: e instanceof Error ? e.message : String(e) }, mode });
    } finally {
      setRunning(null);
    }
  };

  const reveal = async () => {
    if (!confirm("Show the reference solution?")) return;
    setSolution((await api<{ solution: string }>("solution", { id: task.id })).solution);
  };

  const reset = () => {
    if (!confirm("Replace your code with the starter code?")) return;
    editor.current?.set(task.starter);
    autosave.changed();
  };

  const [statusLabel, statusTone] = STATUS_BADGE[status];

  const description = (
    <Card className="min-w-0 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-2 text-sm">
        <Link href={`/paths/${track}/${task.step}`} className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {task.step_title}
        </Link>
        <span className="font-mono text-xs tabular-nums text-muted">
          {k + 1}/{task.siblings.length}
        </span>
      </div>
      <h1 className="mt-5 text-[1.75rem] font-bold leading-tight tracking-[-0.02em]">{task.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={task.difficulty} />
        {task.libs.map((l) => (
          <span key={l} className="inline-flex items-center rounded-full border border-border bg-surface-2/70 px-3 py-1 text-xs text-muted">
            {l}
          </span>
        ))}
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>

      <Markdown text={task.description} className="mt-6 text-[0.9375rem] text-foreground/90" />

      {task.hints.length > 0 && (
        <div className="mt-8 space-y-2">
          {task.hints.map((h, j) => (
            <details key={j} className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-amber-700 dark:text-amber-400">Hint {j + 1}</summary>
              <Markdown text={h} className="mt-2 text-sm text-muted" />
            </details>
          ))}
        </div>
      )}

      <div className="mt-8 border-t border-border/70 pt-6">
        {solution ? (
          <>
            <h2 className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-muted">Reference solution</h2>
            <pre className="overflow-x-auto rounded-xl border border-accent/30 bg-accent/5 p-4 font-mono text-xs leading-relaxed">{solution}</pre>
          </>
        ) : (
          <button onClick={reveal} className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground">
            <Lock className="h-4 w-4" /> Reveal reference solution
          </button>
        )}
      </div>
    </Card>
  );

  const workspace = (
    <Card className="flex min-w-0 flex-col overflow-hidden lg:sticky lg:top-24 lg:self-start">
      <div className="h-[46vh] min-h-[20rem] border-b border-border">
        <CodeEditor
          ref={editor}
          initial={task.code}
          onChange={autosave.changed}
          onSave={autosave.save}
          onRun={() => run("run")}
          onSubmit={() => run("submit")}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <Button size="sm" variant="outline" onClick={() => run("run")} disabled={!!running} title="Run sample tests (⌘↵)">
          <Play className="h-4 w-4" /> Run
        </Button>
        <Button size="sm" onClick={() => run("submit")} disabled={!!running} title="Run all tests (⇧⌘↵)">
          <Send className="h-4 w-4" /> Submit
        </Button>
        <span className="text-xs text-muted">{autosave.saved}</span>
        <span className="flex-1" />
        {nextId && (
          <Link href={`/paths/task/${nextId}?t=${track}`} className="inline-flex items-center gap-1 text-sm text-accent">
            Next <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        <Button size="sm" variant="ghost" onClick={reset} title="Restore the starter code" aria-label="Restore the starter code">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      <div className="max-h-[38vh] min-h-[8rem] overflow-auto p-4">
        {running ? (
          <Running label={running.label} since={running.since} />
        ) : result ? (
          <RunOutput result={result.r} mode={result.mode} />
        ) : (
          <p className="text-sm text-muted">Results appear here.</p>
        )}
      </div>
    </Card>
  );

  return <SplitPane storageKey="qp-split-task" initial={48} left={description} right={workspace} />;
}
