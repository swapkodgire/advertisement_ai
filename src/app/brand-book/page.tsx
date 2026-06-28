"use client";

import {
  Card,
  DashboardLayout,
  PageHeader,
} from "@/components/layout/DashboardLayout";
import { useActiveBrand } from "@/lib/store";

export default function BrandBookPage() {
  const activeBrand = useActiveBrand();
  const brandOverview = activeBrand?.businessDNA.brandOverview;

  if (!brandOverview) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[40vh] items-center justify-center p-8 text-muted">
          Select a brand to view its brand book.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <PageHeader
          title={`Brand Book — ${activeBrand.name}`}
          subtitle="Consolidated brand identity — logo, colors, fonts, values, and tone."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">
              Logo & Name
            </h2>
            <div className="flex min-h-[120px] items-center justify-center rounded-xl bg-background">
              <div className="text-center">
                <p className="text-2xl font-bold tracking-widest">
                  {brandOverview.businessName || activeBrand.name}
                </p>
                {brandOverview.tagline && (
                  <p className="mt-2 text-sm text-muted">{brandOverview.tagline}</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">
              Typography
            </h2>
            <p className="text-6xl" style={{ fontFamily: brandOverview.fontFamily }}>
              Aa
            </p>
            <p className="mt-2 text-sm">{brandOverview.fontFamily}</p>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">
              Color Palette
            </h2>
            <div className="flex flex-wrap gap-6">
              {brandOverview.colors.map((c, i) => (
                <div key={i} className="text-center">
                  <div
                    className="mx-auto h-16 w-16 rounded-full border-2 border-border"
                    style={{ backgroundColor: c.hex }}
                  />
                  <p className="mt-2 text-xs">{c.hex}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">
              Brand Values
            </h2>
            <div className="flex flex-wrap gap-2">
              {brandOverview.brandValues.map((v) => (
                <span
                  key={v}
                  className="rounded-md bg-accent-muted px-3 py-1 text-xs font-medium text-accent"
                >
                  {v}
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">
              Products
            </h2>
            <p className="text-2xl font-semibold">{activeBrand.products.length}</p>
            <p className="text-sm text-muted">items in catalog</p>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
