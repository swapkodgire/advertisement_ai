"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Brand, BusinessDNA, GeneratedImage, Product } from "@/types";
import { createBrand, createDefaultBusinessDNA } from "./brand-utils";

interface AppStore {
  brands: Brand[];
  activeBrandId: string | null;
  agentId: string | null;

  getActiveBrand: () => Brand | undefined;
  getActiveProducts: () => Product[];

  createBrand: (name: string) => string;
  deleteBrand: (id: string) => void;
  setActiveBrand: (id: string) => void;
  renameBrand: (id: string, name: string) => void;

  updateBrandOverview: (data: Partial<BusinessDNA["brandOverview"]>) => void;
  updateBusinessDetails: (data: Partial<BusinessDNA["businessDetails"]>) => void;
  resetActiveBrandDNA: () => void;

  addProduct: (item: Omit<Product, "id" | "createdAt" | "generatedImages">) => string;
  addProductWithId: (
    id: string,
    item: Omit<Product, "id" | "createdAt" | "generatedImages">
  ) => void;
  removeProduct: (id: string) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  addGeneratedImage: (productId: string, image: GeneratedImage) => void;

  setAgentId: (id: string | null) => void;
}

function updateActiveBrand(
  state: AppStore,
  updater: (brand: Brand) => Brand
): Partial<AppStore> {
  if (!state.activeBrandId) return {};
  return {
    brands: state.brands.map((b) =>
      b.id === state.activeBrandId ? updater(b) : b
    ),
  };
}

function ensureDefaultBrand(brands: Brand[]): { brands: Brand[]; activeBrandId: string } {
  if (brands.length > 0) {
    return { brands, activeBrandId: brands[0].id };
  }
  const brand = createBrand("My Brand");
  return { brands: [brand], activeBrandId: brand.id };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      brands: [],
      activeBrandId: null,
      agentId: null,

      getActiveBrand: () => {
        const { brands, activeBrandId } = get();
        return brands.find((b) => b.id === activeBrandId);
      },

      getActiveProducts: () => get().getActiveBrand()?.products ?? [],

      createBrand: (name) => {
        const brand = createBrand(name);
        set((state) => ({
          brands: [...state.brands, brand],
          activeBrandId: brand.id,
        }));
        return brand.id;
      },

      deleteBrand: (id) =>
        set((state) => {
          const brands = state.brands.filter((b) => b.id !== id);
          if (brands.length === 0) {
            const brand = createBrand("My Brand");
            return { brands: [brand], activeBrandId: brand.id, agentId: null };
          }
          const activeBrandId =
            state.activeBrandId === id ? brands[0].id : state.activeBrandId;
          return { brands, activeBrandId };
        }),

      setActiveBrand: (id) => set({ activeBrandId: id, agentId: null }),

      renameBrand: (id, name) =>
        set((state) => ({
          brands: state.brands.map((b) =>
            b.id === id
              ? {
                  ...b,
                  name,
                  businessDNA: {
                    ...b.businessDNA,
                    brandOverview: { ...b.businessDNA.brandOverview, businessName: name },
                  },
                }
              : b
          ),
        })),

      updateBrandOverview: (data) =>
        set((state) =>
          updateActiveBrand(state, (brand) => ({
            ...brand,
            businessDNA: {
              ...brand.businessDNA,
              brandOverview: { ...brand.businessDNA.brandOverview, ...data },
            },
          }))
        ),

      updateBusinessDetails: (data) =>
        set((state) =>
          updateActiveBrand(state, (brand) => ({
            ...brand,
            businessDNA: {
              ...brand.businessDNA,
              businessDetails: { ...brand.businessDNA.businessDetails, ...data },
            },
          }))
        ),

      resetActiveBrandDNA: () =>
        set((state) => {
          const active = state.getActiveBrand();
          if (!active) return {};
          return updateActiveBrand(state, (brand) => ({
            ...brand,
            businessDNA: createDefaultBusinessDNA(brand.name),
          }));
        }),

      addProduct: (item) => {
        const id = crypto.randomUUID();
        set((state) =>
          updateActiveBrand(state, (brand) => ({
            ...brand,
            products: [
              {
                ...item,
                id,
                createdAt: new Date().toISOString(),
                generatedImages: [],
              },
              ...brand.products,
            ],
          }))
        );
        return id;
      },

      addProductWithId: (id, item) =>
        set((state) =>
          updateActiveBrand(state, (brand) => ({
            ...brand,
            products: [
              {
                ...item,
                id,
                createdAt: new Date().toISOString(),
                generatedImages: [],
              },
              ...brand.products,
            ],
          }))
        ),

      removeProduct: (id) =>
        set((state) =>
          updateActiveBrand(state, (brand) => ({
            ...brand,
            products: brand.products.filter((p) => p.id !== id),
          }))
        ),

      updateProduct: (id, data) =>
        set((state) =>
          updateActiveBrand(state, (brand) => ({
            ...brand,
            products: brand.products.map((p) =>
              p.id === id ? { ...p, ...data } : p
            ),
          }))
        ),

      addGeneratedImage: (productId, image) =>
        set((state) =>
          updateActiveBrand(state, (brand) => ({
            ...brand,
            products: brand.products.map((p) =>
              p.id === productId
                ? { ...p, generatedImages: [image, ...p.generatedImages] }
                : p
            ),
          }))
        ),

      setAgentId: (id) => set({ agentId: id }),
    }),
    {
      name: "advertisement-ai-store-v2",
      version: 2,
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>;
        // Migrate from v1 single-brand store
        if (state.businessDNA && state.catalog) {
          const oldDNA = state.businessDNA as BusinessDNA;
          const oldCatalog = state.catalog as Product[];
          const brand = createBrand(
            oldDNA.brandOverview.businessName || "My Brand"
          );
          brand.businessDNA = oldDNA;
          brand.products = oldCatalog.map((p) => ({
            ...p,
            category: (p as Product & { category?: string }).category ?? "Other",
          }));
          return {
            brands: [brand],
            activeBrandId: brand.id,
            agentId: state.agentId ?? null,
          };
        }
        if (!state.brands || (state.brands as Brand[]).length === 0) {
          const { brands, activeBrandId } = ensureDefaultBrand([]);
          return { ...state, brands, activeBrandId };
        }
        return state;
      },
      onRehydrateStorage: () => (state) => {
        if (state && state.brands.length === 0) {
          const brand = createBrand("My Brand");
          state.brands = [brand];
          state.activeBrandId = brand.id;
        } else if (state && !state.activeBrandId && state.brands.length > 0) {
          state.activeBrandId = state.brands[0].id;
        }
      },
    }
  )
);

// Convenience hooks
export function useActiveBrand() {
  return useAppStore((s) => s.brands.find((b) => b.id === s.activeBrandId));
}

export function useActiveBusinessDNA() {
  return useAppStore((s) => s.brands.find((b) => b.id === s.activeBrandId)?.businessDNA);
}

export function useActiveProducts() {
  return useAppStore((s) => s.brands.find((b) => b.id === s.activeBrandId)?.products ?? []);
}
