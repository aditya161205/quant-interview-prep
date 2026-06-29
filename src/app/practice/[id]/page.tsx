import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Percent, Sigma, Lightbulb, Boxes, type LucideIcon } from "lucide-react";
import { problems, type Topic } from "@/data/problems";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { SolutionReveal } from "@/components/solution-reveal";
import { ProblemActions } from "@/components/problem-actions";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TOPIC_STYLE: Record<Topic, { tile: string; Icon: LucideIcon }> = {
  Probability: { tile: "bg-violet-600", Icon: Percent },
  "Expected Value": { tile: "bg-emerald-500", Icon: Sigma },
  Brainteaser: { tile: "bg-amber-500", Icon: Lightbulb },
  Combinatorics: { tile: "bg-rose-500", Icon: Boxes },
};

export function generateStaticParams() {
  return problems.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = problems.find((p) => p.id === id);
  return { title: problem ? `${problem.title} — QuantPrep` : "Problem — QuantPrep" };
}

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const index = problems.findIndex((p) => p.id === id);
  if (index === -1) notFound();

  const problem = problems[index];
  const prev = problems[index - 1];
  const next = problems[index + 1];
  const { tile, Icon } = TOPIC_STYLE[problem.topic];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Top bar: back link + prev/next */}
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

      <Card className="obsidian-glow overflow-hidden">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <span className={cn("grid h-12 w-12 place-items-center rounded-2xl text-white shadow-lg", tile)}>
              <Icon className="h-6 w-6" />
            </span>
            <ProblemActions id={problem.id} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">#{index + 1}</Badge>
            <DifficultyBadge difficulty={problem.difficulty} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{problem.topic}</span>
          </div>

          <h1 className="text-2xl font-black uppercase leading-[1.05] tracking-tight sm:text-3xl">
            {problem.title}
          </h1>

          <p className="text-base leading-relaxed text-foreground/90">{problem.question}</p>

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
      <span className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full border border-border px-3.5 text-sm text-muted/40">
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
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm transition-colors hover:border-accent/50 hover:text-accent"
    >
      {!isNext && <ArrowLeft className="h-4 w-4" />}
      {isNext ? "Next" : "Prev"}
      {isNext && <ArrowRight className="h-4 w-4" />}
    </Link>
  );
}
