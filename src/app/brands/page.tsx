"use client";

import { Trash2 } from "lucide-react";
import {
  Card,
  DashboardLayout,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/layout/DashboardLayout";
import { useAppStore } from "@/lib/store";

export default function BrandsPage() {
  const { brands, activeBrandId, setActiveBrand, createBrand, deleteBrand, renameBrand } =
    useAppStore();

  const handleCreate = () => {
    const name = prompt("Brand name:");
    if (name?.trim()) createBrand(name.trim());
  };

  const handleRename = (id: string, current: string) => {
    const name = prompt("Rename brand:", current);
    if (name?.trim()) renameBrand(id, name.trim());
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <PageHeader
          title="Brands"
          subtitle="Manage multiple brands. Each brand has its own Business DNA and product catalog."
        />

        <PrimaryButton onClick={handleCreate} className="mb-6">
          + New Brand
        </PrimaryButton>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Card
              key={brand.id}
              className={
                brand.id === activeBrandId ? "border-accent ring-1 ring-accent/20" : ""
              }
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-hover text-lg font-bold text-white">
                  {brand.name.charAt(0).toUpperCase()}
                </div>
                {brands.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${brand.name}" and all its products?`)) {
                        deleteBrand(brand.id);
                      }
                    }}
                    className="text-muted hover:text-danger"
                    aria-label="Delete brand"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{brand.name}</h3>
              <p className="mt-1 text-sm text-muted">
                {brand.products.length} product{brand.products.length !== 1 ? "s" : ""}
              </p>
              <p className="mt-1 truncate text-xs text-muted">
                {brand.businessDNA.brandOverview.tagline || "No tagline yet"}
              </p>
              <div className="mt-4 flex gap-2">
                <SecondaryButton
                  onClick={() => setActiveBrand(brand.id)}
                  className="flex-1 text-xs"
                >
                  {brand.id === activeBrandId ? "Active" : "Switch to"}
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => handleRename(brand.id, brand.name)}
                  className="text-xs"
                >
                  Rename
                </SecondaryButton>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
