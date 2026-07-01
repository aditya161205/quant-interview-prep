import { Suspense } from "react";
import { ProblemBrowser } from "@/components/problem-browser";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Practice Problems — QuantPrep",
};

export default function PracticePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Practice"
        title="Quant Interview Problems"
        description="Filter by category, company, and difficulty. Open a problem to check your answer or reveal the worked solution."
      />
      <Suspense fallback={<div className="py-16 text-center text-sm text-muted">Loading…</div>}>
        <ProblemBrowser />
      </Suspense>
    </div>
  );
}
