import { Badge } from "@/components/ui/badge";
import { ProfileView } from "@/components/profile-view";

export const metadata = {
  title: "Profile — QuantPrep",
};

export default function ProfilePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Badge tone="accent">Profile</Badge>
        <h1 className="text-3xl font-black uppercase tracking-tight sm:text-5xl">Your progress</h1>
        <p className="max-w-2xl text-muted">
          Track problems solved, games played, and your day-to-day activity. Your
          progress is saved locally in this browser.
        </p>
      </header>

      <ProfileView />
    </div>
  );
}
