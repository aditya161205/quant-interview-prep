"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { basicSetup, EditorView } from "codemirror";
import { keymap } from "@codemirror/view";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { cn } from "@/lib/utils";

export interface EditorHandle {
  get(): string;
  set(text: string): void;
}

// The editor sits on the site's own surface in both themes, so it reads as part of the panel.
const surface = Prec.highest(
  EditorView.theme({
    "&": { height: "100%", fontSize: "0.8125rem", backgroundColor: "var(--surface)" },
    ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
    ".cm-gutters": { backgroundColor: "var(--surface)", borderRight: "1px solid var(--border)", color: "var(--muted)" },
    ".cm-activeLineGutter, .cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)" },
    "&.cm-focused": { outline: "none" },
  }),
);

/** A Python editor (CodeMirror 6): ⌘↵ runs, ⇧⌘↵ submits, ⌘S saves, Tab indents. */
export function CodeEditor({
  initial,
  onChange,
  onRun,
  onSubmit,
  onSave,
  ref,
  className,
}: {
  initial: string;
  onChange?: () => void;
  onRun?: () => void;
  onSubmit?: () => void;
  onSave?: () => void;
  ref?: React.Ref<EditorHandle>;
  className?: string;
}) {
  const host = React.useRef<HTMLDivElement>(null);
  const view = React.useRef<EditorView | null>(null);
  const themeSlot = React.useRef(new Compartment());
  const callbacks = React.useRef({ onChange, onRun, onSubmit, onSave });
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";

  React.useLayoutEffect(() => {
    callbacks.current = { onChange, onRun, onSubmit, onSave };
  });

  React.useEffect(() => {
    const run = (name: "onRun" | "onSubmit" | "onSave") => () => {
      callbacks.current[name]?.();
      return true;
    };
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initial,
        extensions: [
          Prec.highest(
            keymap.of([
              { key: "Mod-Enter", run: run("onRun") },
              { key: "Shift-Mod-Enter", run: run("onSubmit") },
              { key: "Mod-s", run: run("onSave"), preventDefault: true },
            ]),
          ),
          basicSetup,
          keymap.of([indentWithTab]),
          python(),
          indentUnit.of("    "),
          themeSlot.current.of(dark ? oneDark : []),
          surface,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) callbacks.current.onChange?.();
          }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // The document is seeded once; later content changes go through the handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    view.current?.dispatch({ effects: themeSlot.current.reconfigure(dark ? oneDark : []) });
  }, [dark]);

  React.useImperativeHandle(
    ref,
    () => ({
      get: () => view.current?.state.doc.toString() ?? "",
      set: (text: string) => {
        const v = view.current;
        if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } });
      },
    }),
    [],
  );

  return <div ref={host} className={cn("h-full min-h-0 overflow-hidden", className)} />;
}
