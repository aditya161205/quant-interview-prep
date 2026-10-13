"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/auth-button";
import { CommandList, useItems } from "@/components/shells/command-list";
import { isActive, SECTIONS } from "@/components/shells/nav-data";

/** No navigation bar: a quiet corner mark, the current place, and ⌘K to go anywhere. */
export function SlateShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const items = useItems(); // loaded up front so the palette can search path steps the moment it opens
  const dialog = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);

  const show = React.useCallback(() => {
    dialog.current?.showModal();
    setOpen(true);
  }, []);
  const hide = React.useCallback(() => dialog.current?.close(), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) hide();
        else show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, hide]);

  const here = SECTIONS.filter((s) => s.href !== "/").find((s) => isActive(s.href, pathname));

  return (
    <>
      <header className="slate-bar">
        <Link href="/" className="slate-brand">
          QuantPrep
        </Link>
        {here && <span className="slate-here">{here.label}</span>}
        <div className="slate-tools">
          <button type="button" className="slate-go" onClick={show}>
            Go to… <kbd>⌘K</kbd>
          </button>
          <AuthButton />
        </div>
      </header>
      <dialog
        ref={dialog}
        className="slate-dialog"
        aria-label="Go to"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && hide()}
      >
        {open && <CommandList items={items} autoFocus onPick={hide} />}
      </dialog>
      <main id="main-content" tabIndex={-1} className="slate-main">
        {children}
      </main>
    </>
  );
}
