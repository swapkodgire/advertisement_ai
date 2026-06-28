import type { Brand, BusinessDNA } from "@/types";

export const DEFAULT_BRAND_VALUES = [
  "Strategic Creativity",
  "Modern Simplicity",
  "Precision & Quality",
  "Human-Centered Design",
  "Innovation with Practicality",
];

export const DEFAULT_BRAND_AESTHETICS = [
  "Scandinavian-inspired minimalism",
  "Premium digital studio feel",
  "Modern editorial layouts",
];

export const DEFAULT_BRAND_TONE = [
  "Intelligent",
  "Modern",
  "Confident",
  "Calm",
  "Clear",
  "Premium",
];

export const PRODUCT_CATEGORIES = [
  "Eyewear",
  "Sunglasses",
  "Bags",
  "Purses",
  "Lenses",
  "Accessories",
  "Pouches",
  "Fashion",
  "Beauty",
  "Home",
  "Consumables",
  "Electronics",
  "Other",
];

export function createDefaultBusinessDNA(name = ""): BusinessDNA {
  return {
    brandOverview: {
      businessName: name,
      tagline: "",
      logoUrl: "",
      fontFamily: "Montserrat",
      colors: [
        { name: "Primary", hex: "#FF9447" },
        { name: "Black", hex: "#000000" },
        { name: "White", hex: "#FFFFFF" },
        { name: "Accent", hex: "#1D5D68" },
        { name: "Grey", hex: "#D1D3D4" },
      ],
      brandValues: [...DEFAULT_BRAND_VALUES],
      brandAesthetics: [...DEFAULT_BRAND_AESTHETICS],
      brandTone: [...DEFAULT_BRAND_TONE],
      businessOverview: "",
    },
    businessDetails: {
      location: "",
      phone: "",
      businessHours: "",
      keywords: [],
      ctaLinks: [],
      socialLinks: {
        facebook: "",
        instagram: "",
        linkedin: "",
        x: "",
        youtube: "",
        pinterest: "",
      },
      testimonials: [],
    },
  };
}

export function createBrand(name: string): Brand {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    businessDNA: createDefaultBusinessDNA(name),
    products: [],
  };
}
