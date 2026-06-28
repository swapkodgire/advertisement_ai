import type { ImageViewId, PlatformPostTypeId, SceneCategory } from "@/types";
import { getImageView } from "@/lib/data/image-views";
import { getPlatformPostType } from "@/lib/data/platform-post-types";

export interface ProductFramingLimits {
  maxWidthPct: number;
  maxHeightPct: number;
  marginXPct: number;
  marginYPct: number;
  verticalAnchor: number;
  horizontalAnchor: number;
}

/** Safe product scale + margins by platform aspect ratio, camera view, and scene type */
export function getProductFramingLimits(
  aspectRatio: string,
  viewName: string,
  sceneContext?: { sceneCategory?: SceneCategory; backgroundType?: string; isOutdoor?: boolean }
): ProductFramingLimits {
  const [aw, ah] = aspectRatio.split(":").map(Number);
  const isPortrait = aw > 0 && ah > aw;
  const outdoor =
    sceneContext?.isOutdoor ||
    sceneContext?.sceneCategory === "outdoor" ||
    /desert|beach|garden|outdoor|sand|dune/.test((sceneContext?.backgroundType ?? "").toLowerCase());

  // Product is the hero of a product photoshoot — prominent and in-focus, but ALWAYS
  // fully visible. Scales are intentionally < (1 - 2*margin) on both axes so the whole
  // product (incl. wide temple arms / tall packaging) fits inside the safe area on every
  // platform and aspect ratio with no cropping.
  if (isPortrait) {
    return {
      maxWidthPct: outdoor ? 0.66 : 0.74,
      maxHeightPct: outdoor ? 0.46 : 0.54,
      marginXPct: 0.09,
      marginYPct: 0.1,
      verticalAnchor: outdoor
        ? 0.54
        : viewName.toLowerCase().includes("top") || viewName.toLowerCase().includes("flat lay")
          ? 0.36
          : 0.45,
      horizontalAnchor: 0.5,
    };
  }

  if (aw > 0 && ah < aw) {
    return {
      maxWidthPct: outdoor ? 0.5 : 0.58,
      maxHeightPct: outdoor ? 0.6 : 0.74,
      marginXPct: 0.09,
      marginYPct: 0.09,
      verticalAnchor: outdoor ? 0.54 : 0.47,
      horizontalAnchor: 0.5,
    };
  }

  if (aw === ah) {
    return {
      maxWidthPct: outdoor ? 0.6 : 0.7,
      maxHeightPct: outdoor ? 0.54 : 0.68,
      marginXPct: 0.09,
      marginYPct: 0.09,
      verticalAnchor: outdoor ? 0.54 : viewName.toLowerCase().includes("hero") ? 0.46 : 0.48,
      horizontalAnchor: 0.5,
    };
  }

  return {
    maxWidthPct: outdoor ? 0.58 : 0.68,
    maxHeightPct: outdoor ? 0.56 : 0.66,
    marginXPct: 0.09,
    marginYPct: 0.09,
    verticalAnchor: outdoor ? 0.54 : 0.46,
    horizontalAnchor: 0.5,
  };
}

export function clampProductPlacement(
  canvasW: number,
  canvasH: number,
  pw: number,
  ph: number,
  limits: ProductFramingLimits,
  profile?: { groundAnchorY?: number }
): { left: number; top: number } {
  const marginX = Math.round(canvasW * limits.marginXPct);
  const marginY = Math.round(canvasH * limits.marginYPct);

  const anchorY = profile?.groundAnchorY ?? limits.verticalAnchor;

  let left = Math.round(canvasW * limits.horizontalAnchor - pw / 2);
  let top = Math.round(canvasH * anchorY - ph / 2);

  left = Math.max(marginX, Math.min(left, canvasW - pw - marginX));
  top = Math.max(marginY, Math.min(top, canvasH - ph - marginY));

  return { left, top };
}

export function buildProductFramingPrompt(input: {
  platformPostTypeId: PlatformPostTypeId;
  viewId: ImageViewId;
  productCategory: string;
  productName: string;
}): string {
  const platform = getPlatformPostType(input.platformPostTypeId)!;
  const view = getImageView(input.viewId)!;
  const limits = getProductFramingLimits(platform.aspectRatio, view.viewName);
  const [aw, ah] = platform.aspectRatio.split(":").map(Number);
  const isPortrait = aw > 0 && ah > aw;

  return `=== PRODUCT FRAMING & SCALE (CRITICAL — NO CROPPING) ===
Platform: ${platform.platformName} · ${platform.aspectRatio} · ${platform.resolution}
Camera view: ${view.viewName} — ${view.cameraAngle}

PRODUCT-PHOTOSHOOT FRAMING (the product is the HERO subject):
- This is a commercial PRODUCT photoshoot — the ${input.productName} (${input.productCategory}) is the dominant, in-focus subject and must command the frame
- The ENTIRE product must be fully visible — no cropped temples, lenses, hinges, logos, or edges
- Include FULL temple arms / packaging edges — isolation must preserve extremities with transparent padding
- Product fills the frame as the hero: ~${Math.round(limits.maxWidthPct * 100)}% of frame width · ~${Math.round(limits.maxHeightPct * 100)}% of frame height (scale UP to this hero size, do not leave it small or distant)
- Keep ${Math.round(limits.marginXPct * 100)}% horizontal and ${Math.round(limits.marginYPct * 100)}% vertical safe margins so nothing clips the edges
- ${isPortrait ? "Portrait format: product sits in upper-middle hero zone — leave headroom for Reels/Story UI overlays at top and bottom" : "Center hero placement, large and prominent, with controlled breathing room"}
- Product is TACK-SHARP and in crisp focus; the environment may fall into shallow depth-of-field behind it — the product must never be soft, distant, or competing with the background
- Never crop the product to make it bigger — if it would clip, scale slightly down, but keep it the clear hero

COMPOSITING ZONE:
- Horizontal center · vertical anchor at ${Math.round(limits.verticalAnchor * 100)}% of frame height
- Scene environment fills edges; the hero product sits prominently in the safe compositing zone`;
}

export function aspectRatiosMatch(a: string, width: number, height: number, tolerance = 0.02): boolean {
  const [aw, ah] = a.split(":").map(Number);
  if (!aw || !ah || !width || !height) return false;
  const target = aw / ah;
  const actual = width / height;
  return Math.abs(target - actual) / target < tolerance;
}
