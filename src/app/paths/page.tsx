import { PageHeader } from "@/components/page-header";
import { PathsHub } from "@/components/paths/paths-hub";

export const metadata = {
  title: "Paths — QuantPrep",
};

export default function PathsPage() {
  return (
    <div>
      <PageHeader
        title="Paths"
        description="Two routes to a graduate quant seat. Each step is a lesson, interview questions and code that is graded as you run it."
      />
      <PathsHub />
    </div>
  );
}
