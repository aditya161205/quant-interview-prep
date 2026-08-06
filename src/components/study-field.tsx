"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { STUDY, studyBySlug } from "@/lib/study";
import { MathText } from "@/components/math-text";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Concept library: a rail of techniques beside one open entry, mirroring the
 * question page so the two halves of the app feel like one product. The open
 * entry lives in the URL (?c=slug) so a concept can be linked to directly.
 */
export function StudyField() {
  const router = useRouter();
  const sp = useSearchParams();
  const slug = sp.get("c") ?? STUDY[0].slug;
  const entry = studyBySlug(slug) ?? STUDY[0];

  const open = (next: string) =>
    router.replace(next === STUDY[0].slug ? "/study" : `/study?c=${next}`, { scroll: false });

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-60">
        <Card className="p-4">
          <span className="mb-3 block text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
            Techniques
          </span>
          <ul className="space-y-1">
            {STUDY.map((e) => {
              const active = e.slug === entry.slug;
              return (
                <li key={e.slug}>
                  <button
                    onClick={() => open(e.slug)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-accent/15 font-semibold text-accent"
                        : "text-muted hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    {e.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </aside>

      <Card className="obsidian-glow flex min-h-[34rem] w-full flex-col overflow-hidden lg:min-h-[38rem]">
        <CardContent className="flex flex-1 flex-col p-6 sm:p-9">
          <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
            Technique / {entry.category}
          </span>

          <h1 className="mt-4 max-w-3xl text-[2.25rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[3rem]">
            {entry.title}
          </h1>

          <p className="mt-4 max-w-3xl text-[1.0625rem] leading-[1.65] text-muted">{entry.summary}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {entry.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full border border-border bg-surface-2/70 px-3.5 py-1.5 text-sm text-muted"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="mt-8 space-y-5">
            {entry.sections.map((s, i) => (
              <section key={s.label} className="rounded-xl border border-border bg-surface-2/30 p-5">
                <div className="mb-2 flex items-baseline gap-2.5">
                  <span className="font-mono text-2xs font-bold tabular-nums text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-2xs font-semibold uppercase tracking-[0.18em]">{s.label}</h2>
                </div>
                <MathText
                  text={s.body}
                  className="max-w-3xl text-[0.9375rem] leading-[1.7] text-foreground/90"
                />
              </section>
            ))}
          </div>

          {/* Hand the reader straight into the questions that exercise it. */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-6 sm:pt-8">
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <BookOpen className="h-4 w-4" /> Then drill it
            </span>
            <Link href={`/practice?category=${encodeURIComponent(entry.category)}`}>
              <Button>
                Practise {entry.category} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
