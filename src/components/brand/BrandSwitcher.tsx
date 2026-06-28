"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function BrandSwitcher() {
  const { brands, activeBrandId, setActiveBrand, createBrand } = useAppStore();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const activeBrand = brands.find((b) => b.id === activeBrandId);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createBrand(newName.trim());
    setNewName("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <div className="relative mb-4 px-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="glass-tile flex w-full items-center gap-3 !rounded-2xl px-3 py-2.5 text-left transition-transform hover:!translate-y-0"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#5856d6] text-xs font-bold text-white shadow-md shadow-accent/25">
          {(activeBrand?.name ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{activeBrand?.name ?? "Select brand"}</p>
          <p className="text-xs text-muted">
            {activeBrand?.products.length ?? 0} products
          </p>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="glass-dropdown absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl py-1">
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-light">
              Switch brand
            </p>
            {brands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => {
                  setActiveBrand(brand.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-white/50",
                  brand.id === activeBrandId && "bg-accent-muted font-semibold text-accent"
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent/90 to-[#5856d6] text-xs font-bold text-white shadow-sm">
                  {brand.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{brand.name}</span>
                <span className="ml-auto text-xs text-muted">{brand.products.length}</span>
              </button>
            ))}

            {creating ? (
              <div className="border-t border-border/50 px-3 py-3">
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Brand name"
                  className="glass-input mb-2 w-full rounded-xl px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="glass-btn-primary flex-1 rounded-xl py-2 text-xs font-semibold text-white"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="glass-btn-secondary flex-1 rounded-xl py-2 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 border-t border-border/50 px-3 py-3 text-sm font-semibold text-accent transition-colors hover:bg-white/50"
              >
                <Plus className="h-4 w-4" />
                New brand
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
