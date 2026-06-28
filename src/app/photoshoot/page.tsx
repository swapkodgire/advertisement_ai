"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PhotoshootWizard } from "@/components/photoshoot/PhotoshootWizard";

function PhotoshootContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("product") ?? undefined;
  return <PhotoshootWizard initialProductId={productId} />;
}

export default function PhotoshootPage() {
  return (
    <DashboardLayout>
      <Suspense>
        <PhotoshootContent />
      </Suspense>
    </DashboardLayout>
  );
}
