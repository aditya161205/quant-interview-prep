import { api, type RunResult } from "@/lib/paths";

/*
 * Grades code in a Web Worker running Pyodide (public/paths-worker.js), so Python runs in the visitor's
 * browser and nothing executes on the server. The first run downloads Python and the packages a task
 * needs; the browser caches them after that.
 */

type Waiter = { done: (r: RunResult) => void; onStatus?: (s: string) => void };

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, Waiter>();
const gradingCache = new Map<string, Promise<Record<string, string>>>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker("/paths-worker.js", { type: "module" });
  worker.onmessage = ({ data }: MessageEvent<{ id: number; status?: string; result?: RunResult }>) => {
    const w = waiting.get(data.id);
    if (!w) return;
    if (data.status) w.onStatus?.(data.status);
    if (data.result) {
      waiting.delete(data.id);
      w.done(data.result);
    }
  };
  worker.onerror = (e) => {
    for (const w of waiting.values()) w.done({ error: `Python failed to start: ${e.message || "worker error"}` });
    waiting.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Starts downloading Python in the background, so the first run is quicker. */
export function warmUp() {
  getWorker().postMessage({ id: 0, warm: true });
}

function gradingFiles(module: string) {
  if (!gradingCache.has(module)) {
    const p = api<{ files: Record<string, string> }>(`grading?module=${encodeURIComponent(module)}`).then((g) => g.files);
    p.catch(() => gradingCache.delete(module));
    gradingCache.set(module, p);
  }
  return gradingCache.get(module)!;
}

/** Earlier tasks' saved code that this code imports, e.g. `from r13_weights import target_weights`. */
function importedCode(code: string) {
  const ids = [...new Set([...code.matchAll(/^\s*(?:from|import)\s+([a-z]\d+_\w+)/gm)].map((m) => m[1]))];
  return ids.length ? api<Record<string, string>>(`code?ids=${ids.join(",")}`) : Promise.resolve({});
}

export async function runPython(
  task: { id: string; module: string; code: string; mode: "run" | "submit"; timeout: number },
  onStatus?: (s: string) => void,
): Promise<RunResult> {
  const [files, imports] = await Promise.all([gradingFiles(task.module), importedCode(task.code)]);
  // Python in WebAssembly is a few times slower than native, and the first run also downloads it.
  const seconds = Math.max(300, 3 * task.timeout);
  return new Promise((resolve) => {
    const id = nextId++;
    const w = getWorker();
    const timer = setTimeout(() => {
      waiting.delete(id);
      w.terminate();
      if (worker === w) worker = null;
      resolve({ error: `Stopped after ${seconds}s. An infinite loop, or something much slower than it needs to be?` });
    }, seconds * 1000);
    waiting.set(id, {
      onStatus,
      done: (r) => {
        clearTimeout(timer);
        resolve(r);
      },
    });
    w.postMessage({ id, files, module: task.module, pid: task.id, code: task.code, mode: task.mode, imports });
  });
}
