import { TrackView } from "@/components/paths/track-view";

export const metadata = {
  title: "Path — QuantPrep",
};

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  return <TrackView trackId={track} />;
}
