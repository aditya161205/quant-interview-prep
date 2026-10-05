import { Suspense } from "react";
import { Spinner } from "@/components/paths/load";
import { TaskView } from "@/components/paths/task-view";

export const metadata = {
  title: "Coding task — QuantPrep",
};

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Spinner />}>
      <TaskView id={id} />
    </Suspense>
  );
}
