import { PageHeader } from "@/components/page-header";
import { DeskApp } from "@/components/desk/desk";
import { hasPro } from "@/lib/billing";

export const metadata = {
  title: "The Desk — QuantPrep",
};

export default async function DeskPage() {
  const pro = await hasPro();
  return (
    <div>
      <PageHeader
        code="DSK"
        title="The Desk"
        description="Live the job on an options desk, one day at a time: a quant trader's or researcher's day from the pre-market to the close, starting as a junior."
        compact
      />
      <DeskApp pro={pro} />
    </div>
  );
}
