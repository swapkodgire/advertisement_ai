/** Global generation rules (GR001–GR050) */
export const GLOBAL_RULES: { id: string; category: string; text: string }[] = [
  { id: "GR001", category: "product_integrity", text: "Always use the exact uploaded product as the hero subject without modifying its structure." },
  { id: "GR002", category: "product_integrity", text: "Preserve the original geometry, proportions, and dimensions of the product." },
  { id: "GR003", category: "product_integrity", text: "Do not change frame shape, thickness, hinges, or structural components." },
  { id: "GR004", category: "product_integrity", text: "Maintain the original lens color, transparency, and reflections." },
  { id: "GR005", category: "product_integrity", text: "Retain every visible product feature exactly as provided in the reference images." },
  { id: "GR006", category: "product_integrity", text: "Ensure all product views represent the same exact product without variation." },
  { id: "GR007", category: "product_integrity", text: "Avoid stylizing, redesigning, or simplifying the product appearance." },
  { id: "GR008", category: "product_integrity", text: "Maintain accurate scale and perspective for the product relative to the scene." },
  { id: "GR009", category: "product_integrity", text: "Ensure product materials and textures match the reference images exactly." },
  { id: "GR015", category: "composition", text: "Ensure the product remains the primary focal point of the composition." },
  { id: "GR016", category: "composition", text: "Use clean and balanced composition suitable for professional product photography." },
  { id: "GR018", category: "composition", text: "Avoid cluttered backgrounds that distract from the product." },
  { id: "GR021", category: "lighting", text: "Use professional studio or natural lighting that highlights product details clearly." },
  { id: "GR026", category: "realism", text: "Maintain photorealistic rendering consistent with high-end commercial photography." },
  { id: "GR031", category: "camera", text: "Use distortion-free product photography perspective." },
  { id: "GR036", category: "scene_design", text: "Ensure the scene environment complements the product without overpowering it." },
  { id: "GR041", category: "marketing", text: "Produce visuals suitable for premium advertising and marketing campaigns." },
  { id: "GR049", category: "quality_control", text: "Avoid motion blur, noise, or compression artifacts." },
  { id: "GR050", category: "quality_control", text: "Ensure the final output maintains high visual clarity and sharpness." },
];

export function getGlobalRulesText(): string {
  return GLOBAL_RULES.map((r) => `- ${r.text}`).join("\n");
}
