import { Suspense } from "react";
import { StudyField } from "@/components/study-field";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Study Field — QuantPrep",
};

export default function StudyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Study"
        title="Study Field"
        description="The techniques behind the problem bank — what each one is, when it's the right tool, and the mechanics. Read one, then drill it."
      />
      <Suspense fallback={<div className="py-16 text-center text-sm text-muted">Loading…</div>}>
        <StudyField />
      </Suspense>
    </div>
  );
}
