import {
  DashboardLayout,
  PageHeader,
  PrimaryButton,
} from "@/components/layout/DashboardLayout";
import { Globe } from "lucide-react";

export default function WebsitesPage() {
  return (
    <DashboardLayout>
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <Globe className="mb-4 h-12 w-12 text-accent" />
        <PageHeader
          title="Websites"
          subtitle="Generate an on-brand e-commerce website from your Business DNA. Coming soon — connect AI website builder API."
        />
        <PrimaryButton disabled>Create Website</PrimaryButton>
      </div>
    </DashboardLayout>
  );
}
