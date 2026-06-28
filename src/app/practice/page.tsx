import { problems } from "@/data/problems";
import { Badge } from "@/components/ui/badge";
import { ProblemBrowser } from "@/components/problem-browser";

export const metadata = {
  title: "Practice Problems — QuantPrep",
};

export default function PracticePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Badge tone="accent">Practice</Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Quant Interview Problems
        </h1>
        <p className="max-w-2xl text-muted">
          Search and filter the set, mark problems solved, and bookmark the ones
          worth revisiting. Open any problem to reveal its worked solution.
        </p>
      </header>

      <ProblemBrowser problems={problems} />
    </div>
  );
}
