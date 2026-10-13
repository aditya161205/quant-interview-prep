"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { usePaths } from "@/components/paths/load";
import { GAMES, SECTIONS } from "@/components/shells/nav-data";
import { nextStep, stepPct, type PathsState } from "@/lib/paths";

export type Item = { href: string; label: string; group: string; hint?: string };

/** Everything you can go to: sections, both paths and their steps, and the games. */
export function useItems(): Item[] {
  const { data } = usePaths<PathsState>("state");
  return React.useMemo(() => {
    const items: Item[] = SECTIONS.map((s) => ({ href: s.href, label: s.label, group: "Go to" }));
    for (const t of data?.tracks ?? []) {
      const next = nextStep(t);
      items.push({ href: `/paths/${t.id}/${next.id}`, label: `Continue ${t.title}`, group: "Continue", hint: next.title });
    }
    for (const g of GAMES) items.push({ href: g.href, label: g.title, group: "Games" });
    for (const t of data?.tracks ?? []) {
      t.steps.forEach((s, i) =>
        items.push({
          href: `/paths/${t.id}/${s.id}`,
          label: s.title,
          group: t.title,
          hint: `${i + 1} · ${Math.round(100 * stepPct(s))}%${s.locked ? " · Pro" : ""}`,
        }),
      );
    }
    return items;
  }, [data]);
}

/** Search box plus results, keyboard driven. Used inline on the Slate home and inside the ⌘K dialog. */
export function CommandList({
  items,
  autoFocus = false,
  onPick,
  limit = 12,
}: {
  items: Item[];
  autoFocus?: boolean;
  onPick?: () => void;
  limit?: number;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const listId = React.useId();

  const results = React.useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (it: Item) => words.every((w) => `${it.label} ${it.group} ${it.hint ?? ""}`.toLowerCase().includes(w));
    return (words.length ? items.filter(hit) : items.filter((it) => it.group !== "Quant Trader" && it.group !== "Quant Researcher")).slice(0, limit);
  }, [items, q, limit]);

  const go = (it: Item | undefined) => {
    if (!it) return;
    router.push(it.href);
    onPick?.();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setSel((i) => Math.min(results.length - 1, i + 1));
    else if (e.key === "ArrowUp") setSel((i) => Math.max(0, i - 1));
    else if (e.key === "Enter") go(results[sel]);
    else return;
    e.preventDefault();
  };

  return (
    <div className="cmd">
      <label className="cmd-field">
        <Search className="h-5 w-5 shrink-0" aria-hidden />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={onKey}
          placeholder="Search steps, games, pages…"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={results[sel] ? `${listId}-${sel}` : undefined}
          aria-label="Go to"
        />
      </label>
      <ul id={listId} role="listbox" className="cmd-list">
        {results.map((it, i) => (
          <li
            key={`${it.group}-${it.href}-${it.label}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === sel}
            onMouseEnter={() => setSel(i)}
            onClick={() => go(it)}
            className="cmd-item"
          >
            <span className="cmd-group">{it.group}</span>
            <span className="cmd-label">{it.label}</span>
            {it.hint && <span className="cmd-hint">{it.hint}</span>}
            {i === sel ? <CornerDownLeft className="cmd-enter h-4 w-4" aria-hidden /> : <ArrowRight className="cmd-enter h-4 w-4 opacity-0" aria-hidden />}
          </li>
        ))}
        {results.length === 0 && <li className="cmd-empty">Nothing matches “{q}”. Try a topic like “options” or “Kelly”.</li>}
      </ul>
    </div>
  );
}
