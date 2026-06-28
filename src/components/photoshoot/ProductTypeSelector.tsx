"use client";

import { ChevronDown, Loader2, ScanSearch, Sparkles } from "lucide-react";
import {
  PRODUCT_CATEGORIES,
  getCategoryDef,
  getProductCategoryLabel,
  getProductTypeLabel,
} from "@/lib/data/product-taxonomy";
import type { ProductCategoryId, ProductProfile, ProductTypeId } from "@/types";
import { cn } from "@/lib/utils";

interface ProductTypeSelectorProps {
  profile: ProductProfile | null;
  detecting: boolean;
  onDetect: () => void;
  onCategoryChange: (categoryId: ProductCategoryId) => void;
  onTypeChange: (typeId: ProductTypeId) => void;
  disabled?: boolean;
}

export function ProductTypeSelector({
  profile,
  detecting,
  onDetect,
  onCategoryChange,
  onTypeChange,
  disabled,
}: ProductTypeSelectorProps) {
  const categoryId = profile?.categoryId ?? null;
  const typeId = profile?.typeId ?? null;
  const categoryDef = categoryId ? getCategoryDef(categoryId) : null;
  const types = categoryDef?.types ?? [];

  const confidencePct =
    profile && profile.confidence > 0 ? Math.round(profile.confidence * 100) : null;

  return (
    <div className="glass-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ScanSearch className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold">Product Type</h3>
          </div>
          <p className="text-xs text-muted">
            We detect the product from your primary photo to recommend relevant camera views in Step 3.
            Change it below if we got it wrong.
          </p>
        </div>
        <button
          type="button"
          onClick={onDetect}
          disabled={disabled || detecting}
          className="glass-chip flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/60 disabled:opacity-50"
        >
          {detecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-accent" />
          )}
          Re-detect
        </button>
      </div>

      {detecting && !profile && (
        <div className="flex items-center gap-2 rounded-xl bg-accent/5 px-4 py-3 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Analyzing primary photo…
        </div>
      )}

      {profile && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            profile.source === "manual"
              ? "border-accent/30 bg-accent/5"
              : profile.source === "auto" && confidencePct && confidencePct >= 70
                ? "border-[var(--success)]/30 bg-[var(--success-bg)]"
                : "border-border/50 bg-white/30"
          )}
        >
          <p className="font-medium text-foreground">
            {profile.source === "manual" ? "Selected" : "Detected"}:{" "}
            <span className="text-accent">{profile.label}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {getProductCategoryLabel(profile.categoryId)}
            {profile.source === "auto" && confidencePct !== null && confidencePct > 0 && (
              <> · {confidencePct}% confidence</>
            )}
            {profile.source === "default" && <> · auto-detect unavailable, please confirm below</>}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Category</span>
          <div className="relative">
            <select
              value={categoryId ?? ""}
              onChange={(e) => onCategoryChange(e.target.value as ProductCategoryId)}
              disabled={disabled || detecting}
              className="glass-input w-full appearance-none rounded-xl px-4 py-2.5 pr-10 text-sm"
            >
              <option value="" disabled>
                Select category…
              </option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Product type</span>
          <div className="relative">
            <select
              value={typeId ?? ""}
              onChange={(e) => {
                const nextType = e.target.value as ProductTypeId;
                if (categoryId) onTypeChange(nextType);
              }}
              disabled={disabled || detecting || !categoryId}
              className="glass-input w-full appearance-none rounded-xl px-4 py-2.5 pr-10 text-sm disabled:opacity-50"
            >
              <option value="" disabled>
                {categoryId ? "Select type…" : "Pick category first"}
              </option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        </label>
      </div>

      {typeId && (
        <p className="text-[10px] text-muted-light">
          Step 3 will show camera views recommended for {getProductTypeLabel(typeId)}.
        </p>
      )}
    </div>
  );
}
