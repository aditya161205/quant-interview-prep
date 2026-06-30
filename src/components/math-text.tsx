"use client";

import * as React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renders text that mixes prose and LaTeX. Supports $$display$$ and $inline$
 * math; everything else keeps its line breaks.
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  const html = React.useMemo(() => renderMixed(text ?? ""), [text]);
  return (
    <div
      className={className}
      style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMath(tex: string, displayMode: boolean) {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch {
    return escapeHtml(tex);
  }
}

function renderMixed(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    if (input[i] === "$") {
      const display = input[i + 1] === "$";
      const open = display ? "$$" : "$";
      const end = input.indexOf(open, i + open.length);
      if (end !== -1) {
        const tex = input.slice(i + open.length, end);
        out += renderMath(tex, display);
        i = end + open.length;
        continue;
      }
    }
    // plain text run until next '$'
    const nextDollar = input.indexOf("$", i);
    const stop = nextDollar === -1 ? input.length : nextDollar;
    out += escapeHtml(input.slice(i, stop));
    i = stop;
    if (nextDollar === -1) break;
    if (input[i] !== "$") continue;
    // a lone '$' with no closing — emit literally and move on
    if (input.indexOf("$", i + (input[i + 1] === "$" ? 2 : 1)) === -1) {
      out += escapeHtml(input[i]);
      i += 1;
    }
  }
  return out;
}
