import { Suspense } from "react";
import { ProblemDetail } from "@/components/problem-detail";

export const metadata = {
  title: "Problem — QuantPrep",
};

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-muted">Loading…</div>}>
      <ProblemDetail id={id} />
    </Suspense>
  );
}
