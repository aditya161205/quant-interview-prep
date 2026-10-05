import { redirect } from "next/navigation";

/** The Study section became Paths; old links land there. */
export default function StudyPage() {
  redirect("/paths");
}
