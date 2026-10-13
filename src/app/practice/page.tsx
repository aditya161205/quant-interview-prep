import { Suspense } from "react";
import { ProblemBrowser } from "@/components/problem-browser";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Practice Problems — QuantPrep",
};

export default function PracticePage() {
  return (
    <div>
      <PageHeader title="Practice" description="Interview problems from the desks that ask them. Filter by level, topic or firm." />
      <Suspense fallback={<div className="py-16 text-center text-sm text-muted">Loading…</div>}>
        <ProblemBrowser />
      </Suspense>
    </div>
  );
}
