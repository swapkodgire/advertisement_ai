import sharp from "sharp";

const EYEWEAR_KEYWORDS = ["eyewear", "frame", "glass", "sunglass", "optical"];

export function isEyewearCategory(category: string): boolean {
  const c = category.toLowerCase();
  return EYEWEAR_KEYWORDS.some((k) => c.includes(k));
}

/** Gentle trim — lower threshold preserves faint temple-arm alpha */
export async function gentleTrimPng(buffer: Buffer, threshold = 2): Promise<Buffer> {
  return sharp(buffer).ensureAlpha().trim({ threshold }).png().toBuffer();
}

/** Add transparent padding so thin extremities (temple tips) are never clipped at composite time */
export async function addIsolationPadding(
  buffer: Buffer,
  paddingPct = 0.08
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) return buffer;

  const padX = Math.max(12, Math.round(w * paddingPct));
  const padY = Math.max(12, Math.round(h * paddingPct));

  return sharp(buffer)
    .extend({
      top: padY,
      bottom: padY,
      left: padX,
      right: padX,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

export interface IsolationBoundsCheck {
  ok: boolean;
  touchesLeft: boolean;
  touchesRight: boolean;
  touchesTop: boolean;
  touchesBottom: boolean;
}

/** Detect if opaque pixels touch canvas edges — indicates cropped temples/edges */
export async function checkIsolationBounds(
  buffer: Buffer,
  edgeMarginPx = 3
): Promise<IsolationBoundsCheck> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  let touchesLeft = false;
  let touchesRight = false;
  let touchesTop = false;
  let touchesBottom = false;

  const isOpaque = (x: number, y: number) => {
    const i = (y * w + x) * 4 + 3;
    return data[i] > 32;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isOpaque(x, y)) continue;
      if (x <= edgeMarginPx) touchesLeft = true;
      if (x >= w - 1 - edgeMarginPx) touchesRight = true;
      if (y <= edgeMarginPx) touchesTop = true;
      if (y >= h - 1 - edgeMarginPx) touchesBottom = true;
    }
  }

  const ok = !(touchesLeft || touchesRight || touchesTop || touchesBottom);
  return { ok, touchesLeft, touchesRight, touchesTop, touchesBottom };
}

/**
 * Post-process isolated cutout: gentle trim, validate bounds, re-pad if edges touched.
 */
export async function finalizeIsolationCutout(
  buffer: Buffer,
  productCategory?: string
): Promise<Buffer> {
  const eyewear = productCategory ? isEyewearCategory(productCategory) : false;
  let result = await gentleTrimPng(buffer, eyewear ? 2 : 5);

  const bounds = await checkIsolationBounds(result);
  if (!bounds.ok || eyewear) {
    const padPct = eyewear ? 0.1 : 0.06;
    result = await addIsolationPadding(result, padPct);
  }

  return result;
}
