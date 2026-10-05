"use client";

import * as React from "react";
import katex from "katex";
import { marked } from "marked";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

/**
 * Markdown with $inline$ and $$display$$ math, for lessons and questions. Code is shielded from math
 * parsing and math from markdown, then each is restored. The content is the curriculum's own.
 */
function render(src: string, inline: boolean): string {
  const code: string[] = [];
  const math: [string, boolean][] = [];
  const text = src
    .replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => `%%C${code.push(m) - 1}%%`)
    .replace(/\\\$/g, "%%DOLLAR%%")
    .replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (_m, display?: string, inl?: string) =>
      `%%M${math.push([display ?? inl ?? "", display !== undefined]) - 1}%%`,
    )
    .replace(/%%C(\d+)%%/g, (_m, k: string) => code[Number(k)]);
  const html = inline ? marked.parseInline(text, { async: false }) : marked.parse(text, { async: false });
  return html
    .replace(/%%M(\d+)%%/g, (_m, k: string) => {
      const [tex, displayMode] = math[Number(k)];
      return katex.renderToString(tex, { displayMode, throwOnError: false });
    })
    .replace(/%%DOLLAR%%/g, "$");
}

export function Markdown({ text, inline, className }: { text: string; inline?: boolean; className?: string }) {
  const html = React.useMemo(() => render(text ?? "", Boolean(inline)), [text, inline]);
  return inline ? (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <div className={cn("md-prose", className)} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
