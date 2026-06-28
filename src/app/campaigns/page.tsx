"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GenerationSelector } from "@/components/generation/GenerationSelector";

function CampaignsContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("product") ?? undefined;
  return <GenerationSelector mode="campaign" productId={productId} />;
}

export default function CampaignsPage() {
  return (
    <DashboardLayout>
      <Suspense>
        <CampaignsContent />
      </Suspense>
    </DashboardLayout>
  );
}
