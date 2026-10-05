import Link from "next/link";
import { BrainCircuit, LineChart, ArrowRight, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconCard } from "@/components/icon-card";

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      {/* The one place big display type earns its size — everywhere else
          headings are sentence case, so this reads as the brand moment
          rather than one more shouting element. */}
      <section className="pb-2 pt-2 sm:pt-6">
        <h1 className="max-w-4xl text-[2.75rem] font-black uppercase leading-[0.95] tracking-[-0.02em] sm:text-6xl">
          Crack the
          <br />
          <span className="text-accent">trading desk</span> interview
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
          Interview problems, market-making games and structured paths for trader and researcher roles.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/paths">
            <Button size="lg">
              Start a path <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/practice">
            <Button size="lg" variant="outline">
              Practice problems
            </Button>
          </Link>
        </div>
      </section>

      {/* Modules */}
      <section>
        <h2 className="mb-4 text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
          Modules
        </h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <IconCard
            href="/practice"
            icon={BrainCircuit}
            color="accent"
            title="Practice Problems"
            kicker="Probability · EV · Brainteasers"
            watermark="PR"
          />
          <IconCard
            href="/market-making"
            icon={LineChart}
            color="emerald"
            title="Market Making Games"
            kicker="6 interactive games"
            watermark="MM"
          />
          <IconCard
            href="/paths"
            icon={Route}
            color="sky"
            title="Trader & Researcher Paths"
            kicker="Lessons · graded Python · projects"
            watermark="QP"
          />
        </div>
      </section>
    </div>
  );
}
