/** Brand-specific rules (BR001–BR052) */
export const BRAND_RULES: Record<string, string[]> = {
  nordic_monk: [
    "Use the logo exactly as provided without modification, recoloring, or restyling",
    "Place the logo subtly as a watermark without obstructing the product",
    "Maintain premium minimalist modern lifestyle aesthetic",
    "Ensure visuals are clean and suitable for social media marketing",
  ],
  french_eyewear: [
    "Use the logo exactly as provided without altering typography",
    "Ensure the product remains the hero element rather than the logo",
    "Maintain elegant sophisticated premium European styling",
    "Avoid overly bold or cluttered branding",
  ],
  polar_object: [
    "Use the brand logo exactly as provided; maintain clarity and proportions",
    "Place the logo subtly so the product remains the hero subject",
    "Maintain modern accessories clean composition aesthetic",
    "Avoid exaggerated brand placement or repeated logos",
  ],
  two_lenses: [
    "Use the logo exactly as provided; maintain typography and proportions",
    "Keep brand presentation minimal and professional",
    "Maintain contemporary tech-focused balanced composition",
  ],
  german_lenses: [
    "Use the logo exactly as provided without alteration",
    "Ensure lens technology remains the visual focus",
    "Maintain scientific precision clean technical presentation",
    "Avoid decorative lifestyle branding that conflicts with optical precision",
  ],
};

export function getBrandRulesText(brandId?: string, brandName?: string): string {
  const key = (brandId ?? brandName ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  for (const [id, rules] of Object.entries(BRAND_RULES)) {
    if (key.includes(id) || id.includes(key)) {
      return rules.map((r) => `- ${r}`).join("\n");
    }
  }
  return "- Maintain professional brand presentation\n- Product remains hero subject";
}
