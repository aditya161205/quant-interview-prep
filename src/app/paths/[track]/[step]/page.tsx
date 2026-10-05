import { StepView } from "@/components/paths/step-view";

export const metadata = {
  title: "Step — QuantPrep",
};

export default async function StepPage({ params }: { params: Promise<{ track: string; step: string }> }) {
  const { track, step } = await params;
  return <StepView trackId={track} stepId={step} />;
}
