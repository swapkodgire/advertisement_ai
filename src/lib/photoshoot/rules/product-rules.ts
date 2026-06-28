/** Product category rules (PR001–PR053) */
export const PRODUCT_RULES: Record<string, string[]> = {
  eyewear: [
    "Do not modify frame geometry",
    "Preserve exact frame proportions and dimensions",
    "Maintain hinge placement exactly as in the reference product",
    "Preserve lens shape exactly as provided",
    "Maintain lens tint, transparency, and reflectivity",
    "Avoid redesigning or stylizing the eyewear frame",
    "Ensure all views represent the same exact product",
  ],
  sunglasses: [
    "Preserve exact lens curvature and frame contour",
    "Maintain correct sunglass lens tint and opacity",
    "Avoid altering frame color or material",
    "Maintain original bridge design and nose pad structure",
  ],
  bag: [
    "Preserve original bag shape and silhouette",
    "Maintain accurate handle placement and structure",
    "Preserve stitching patterns and seam locations",
    "Maintain original material appearance",
  ],
  pouch: [
    "Maintain original pouch shape and closure mechanism",
    "Preserve zipper alignment and stitching details",
    "Maintain material texture such as leather or fabric",
  ],
  purse: [
    "Maintain purse silhouette and proportions",
    "Preserve strap or chain design exactly",
    "Maintain clasp or closure mechanism placement",
  ],
  accessory: [
    "Preserve accessory shape and structural details",
    "Maintain material appearance such as leather, metal, or fabric",
    "Avoid exaggerated scaling or distortion",
  ],
  optical_lens: [
    "Maintain exact optical lens curvature and thickness",
    "Preserve lens transparency and clarity",
    "Avoid altering optical coating appearance",
    "Avoid distortion of optical lens geometry",
  ],
  general: [
    "Use the exact uploaded product without modification",
    "Preserve all visible product features from the source photo",
  ],
};

export function getProductRulesForCategory(category: string): string[] {
  const key = category.toLowerCase().replace(/\s+/g, "_");
  for (const [cat, rules] of Object.entries(PRODUCT_RULES)) {
    if (key.includes(cat) || cat.includes(key)) return rules;
  }
  if (key.includes("eye") || key.includes("glass") || key.includes("lens")) {
    return [...PRODUCT_RULES.eyewear, ...PRODUCT_RULES.sunglasses];
  }
  if (key.includes("bag") || key.includes("pouch") || key.includes("purse")) {
    return [...PRODUCT_RULES.bag, ...PRODUCT_RULES.pouch];
  }
  return PRODUCT_RULES.general;
}

export function getProductRulesText(category: string): string {
  return getProductRulesForCategory(category).map((r) => `- ${r}`).join("\n");
}
