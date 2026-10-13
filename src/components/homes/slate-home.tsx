"use client";

import { CommandList, useItems } from "@/components/shells/command-list";

/** The dashboard is the command line: say what you want to work on and go. */
export function SlateHome() {
  const items = useItems();
  return (
    <div className="slate-home">
      <h1 className="slate-h1">What are we working on?</h1>
      <CommandList items={items} autoFocus limit={9} />
      <p className="slate-tip">
        Press <kbd>⌘K</kbd> on any page to jump again.
      </p>
    </div>
  );
}
