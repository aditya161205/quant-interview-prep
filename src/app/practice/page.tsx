import { problems } from "@/data/problems";
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
        description="Search and filter the set, mark problems solved, and bookmark the ones worth revisiting. Open any problem to reveal its worked solution."
      />
      <ProblemBrowser problems={problems} />
    </div>
  );
}
