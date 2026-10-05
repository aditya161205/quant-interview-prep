import { ProfileView } from "@/components/profile-view";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Profile — QuantPrep",
};

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Profile"
        title="Your progress"
      />
      <ProfileView />
    </div>
  );
}
