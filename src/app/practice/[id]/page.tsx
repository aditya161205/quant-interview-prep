import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { problems } from "@/data/problems";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { SolutionReveal } from "@/components/solution-reveal";
import { ProblemActions } from "@/components/problem-actions";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return problems.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = problems.find((p) => p.id === id);
  return { title: problem ? `${problem.title} — QuantPrep` : "Problem — QuantPrep" };
}

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const index = problems.findIndex((p) => p.id === id);
  if (index === -1) notFound();

  const problem = problems[index];
  const prev = problems[index - 1];
  const next = problems[index + 1];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Top bar: back link + prev/next, above the question card */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/practice"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All problems
        </Link>

        <div className="flex items-center gap-2">
          <NavButton problem={prev} direction="prev" />
          <NavButton problem={next} direction="next" />
        </div>
      </div>

      <Card className="obsidian-glow">
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="outline">#{index + 1}</Badge>
              <Badge tone="default">{problem.topic}</Badge>
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>
            <ProblemActions id={problem.id} />
          </div>

          <h1 className="text-xl font-semibold leading-snug sm:text-2xl">
            {problem.title}
          </h1>

          <p className="text-base leading-relaxed text-foreground/90">
            {problem.question}
          </p>

          <SolutionReveal answer={problem.answer} solution={problem.solution} />
        </CardContent>
      </Card>
    </div>
  );
}

function NavButton({
  problem,
  direction,
}: {
  problem?: (typeof problems)[number];
  direction: "prev" | "next";
}) {
  const isNext = direction === "next";
  if (!problem) {
    return (
      <span className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted/40">
        {!isNext && <ArrowLeft className="h-4 w-4" />}
        {isNext ? "Next" : "Prev"}
        {isNext && <ArrowRight className="h-4 w-4" />}
      </span>
    );
  }
  return (
    <Link
      href={`/practice/${problem.id}`}
      title={problem.title}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:border-accent/50 hover:text-accent",
      )}
    >
      {!isNext && <ArrowLeft className="h-4 w-4" />}
      {isNext ? "Next" : "Prev"}
      {isNext && <ArrowRight className="h-4 w-4" />}
    </Link>
  );
}
