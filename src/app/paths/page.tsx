import { PageHeader } from "@/components/page-header";
import { PathsHub } from "@/components/paths/paths-hub";

export const metadata = {
  title: "Paths — QuantPrep",
};

export default function PathsPage() {
  return (
    <div className="space-y-8">
      <PageHeader kicker="Paths" title="Choose your path" />
      <PathsHub />
    </div>
  );
}
