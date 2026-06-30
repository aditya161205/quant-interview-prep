import { ProblemDetail } from "@/components/problem-detail";

export const metadata = {
  title: "Problem — QuantPrep",
};

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProblemDetail id={id} />;
}
