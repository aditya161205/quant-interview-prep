import { HomeFloor } from "@/components/pit/home-floor";
import { hasPro } from "@/lib/billing";

export default async function DashboardPage() {
  return <HomeFloor pro={await hasPro()} />;
}
