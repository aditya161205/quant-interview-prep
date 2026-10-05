"use client";

import * as React from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/paths";

type Load<T> = { status: "loading" | "ok" | "error"; data: T | null; error?: string };

/** Loads one Paths API endpoint; `reload` refetches while keeping the old data on screen. */
export function usePaths<T>(path: string) {
  const [state, setState] = React.useState<Load<T>>({ status: "loading", data: null });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    api<T>(path)
      .then((data) => live && setState({ status: "ok", data }))
      .catch((e: unknown) => live && setState({ status: "error", data: null, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [path, nonce]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

export function Spinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

/** Renders loading and error states; children only once data has arrived. */
export function Gate<T>({ load, children }: { load: Load<T> & { reload: () => void }; children: (data: T) => React.ReactNode }) {
  if (load.data) return <>{children(load.data)}</>;
  if (load.status === "loading") return <Spinner />;
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <p className="text-sm text-muted">{load.error ?? "Something went wrong."}</p>
      <Button variant="outline" size="sm" onClick={load.reload}>
        <RotateCcw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
