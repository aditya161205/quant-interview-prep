"use client";

import * as React from "react";
import { api } from "@/lib/paths";
import type { EditorHandle } from "@/components/paths/code-editor";

/** Saves the editor's code to your account 700ms after typing stops, on demand, and when leaving the page. */
export function useAutosave(id: string, editor: React.RefObject<EditorHandle | null>) {
  const [saved, setSaved] = React.useState<"" | "editing…" | "saved">("");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = React.useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!editor.current) return;
    await api("save", { id, code: editor.current.get() }).catch(() => {});
    setSaved("saved");
  }, [id, editor]);

  const changed = React.useCallback(() => {
    setSaved("editing…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
  }, [save]);

  /** A run saves the code itself, so drop any pending save. */
  const cancel = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSaved("saved");
  }, []);

  React.useEffect(
    () => () => {
      if (timer.current && editor.current) {
        clearTimeout(timer.current);
        api("save", { id, code: editor.current.get() }).catch(() => {});
      }
    },
    [id, editor],
  );

  return { saved, save, changed, cancel };
}
