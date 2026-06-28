import sharp from "sharp";
import type { SceneLightingProfile } from "@/lib/image/scene-lighting";

export interface ShadowLayers {
  contactShadow: Buffer;
  castShadow: Buffer;
  contactLeft: number;
  contactTop: number;
  castLeft: number;
  castTop: number;
}

async function alphaToShadowMask(productBuf: Buffer, opacity: number): Promise<Buffer> {
  const { data, info } = await sharp(productBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const a = (data[i + 3] / 255) * opacity;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = Math.round(Math.min(255, a * 255));
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Build contact + directional cast shadows for scene-motivated lighting.
 * Replaces omnidirectional alpha glow with sun-aligned ground shadow.
 */
export async function buildDirectionalShadowLayers(
  productBuf: Buffer,
  profile: SceneLightingProfile,
  canvasScale: number
): Promise<ShadowLayers> {
  const meta = await sharp(productBuf).metadata();
  const pw = meta.width ?? 100;
  const ph = meta.height ?? 100;

  const blurScale = Math.max(1, canvasScale);

  const contactRaw = await alphaToShadowMask(productBuf, profile.contactShadowOpacity);
  const contactShadow = await sharp(contactRaw)
    .blur(Math.max(3, 6 * blurScale))
    .png()
    .toBuffer();

  const castSquashH = Math.max(8, Math.round(ph * (profile.isOutdoor ? 0.14 : 0.1)));
  const castRaw = await alphaToShadowMask(productBuf, profile.castShadowOpacity);
  const castShadow = await sharp(castRaw)
    .resize(Math.round(pw * 1.05), castSquashH, { fit: "fill" })
    .blur(Math.max(6, 14 * blurScale))
    .png()
    .toBuffer();

  const rad = (profile.shadowAngleDeg * Math.PI) / 180;
  const castLen = Math.round(ph * profile.castShadowLength);
  const castOffsetX = Math.round(Math.cos(rad) * castLen);
  const castOffsetY = Math.round(Math.sin(rad) * castLen * 0.45);

  const contactOffsetX = Math.round(Math.cos(rad) * ph * 0.04);
  const contactOffsetY = Math.round(ph * 0.03 + Math.sin(rad) * ph * 0.02);

  return {
    contactShadow,
    castShadow,
    contactLeft: contactOffsetX,
    contactTop: contactOffsetY,
    castLeft: castOffsetX,
    castTop: castOffsetY,
  };
}

export function shadowPlacement(
  productLeft: number,
  productTop: number,
  pw: number,
  ph: number,
  layers: ShadowLayers
): {
  contact: { left: number; top: number };
  cast: { left: number; top: number };
} {
  const baseX = productLeft + Math.round(pw / 2);
  const baseY = productTop + ph;

  return {
    contact: {
      left: productLeft + layers.contactLeft,
      top: productTop + ph - Math.round(ph * 0.08) + layers.contactTop,
    },
    cast: {
      left: baseX - Math.round(pw * 0.5) + layers.castLeft,
      top: baseY - Math.round(ph * 0.06) + layers.castTop,
    },
  };
}

/** Apply directional shadows onto a background buffer before product layer */
export async function compositeWithDirectionalShadows(
  backgroundBuf: Buffer,
  productBuf: Buffer,
  productLeft: number,
  productTop: number,
  profile: SceneLightingProfile,
  canvasW: number,
  canvasH: number
): Promise<Buffer> {
  const meta = await sharp(productBuf).metadata();
  const pw = meta.width ?? 100;
  const ph = meta.height ?? 100;
  const canvasScale = Math.max(canvasW, canvasH) / 1536;

  const layers = await buildDirectionalShadowLayers(productBuf, profile, canvasScale);
  const placement = shadowPlacement(productLeft, productTop, pw, ph, layers);

  const castMeta = await sharp(layers.castShadow).metadata();
  const castW = castMeta.width ?? pw;
  const castLeft = Math.max(0, Math.min(placement.cast.left, canvasW - castW));
  const castTop = Math.max(0, Math.min(placement.cast.top, canvasH - (castMeta.height ?? 10)));

  return sharp(backgroundBuf)
    .composite([
      { input: layers.castShadow, left: castLeft, top: castTop, blend: "multiply" },
      {
        input: layers.contactShadow,
        left: Math.max(0, placement.contact.left),
        top: Math.max(0, placement.contact.top),
        blend: "multiply",
      },
      { input: productBuf, left: productLeft, top: productTop },
    ])
    .png({ quality: 95 })
    .toBuffer();
}

/** Step 6 — re-apply directional shadow on near-final composite (post Cursor relight) */
export async function applyDirectionalShadowPass(
  compositeBuf: Buffer,
  productBuf: Buffer,
  placement: { left: number; top: number; width: number; height: number },
  profile: SceneLightingProfile
): Promise<Buffer> {
  const meta = await sharp(compositeBuf).metadata();
  const cw = meta.width ?? 1024;
  const ch = meta.height ?? 1024;

  const scaledProduct = await sharp(productBuf)
    .resize(placement.width, placement.height, { fit: "fill" })
    .png()
    .toBuffer();

  const canvasScale = Math.max(cw, ch) / 1536;
  const layers = await buildDirectionalShadowLayers(scaledProduct, profile, canvasScale);
  const pos = shadowPlacement(placement.left, placement.top, placement.width, placement.height, layers);

  const castMeta = await sharp(layers.castShadow).metadata();
  const castW = castMeta.width ?? placement.width;

  return sharp(compositeBuf)
    .composite([
      { input: layers.castShadow, left: Math.max(0, pos.cast.left), top: Math.max(0, pos.cast.top), blend: "multiply" },
      {
        input: layers.contactShadow,
        left: Math.max(0, pos.contact.left),
        top: Math.max(0, pos.contact.top),
        blend: "multiply",
      },
    ])
    .png({ quality: 95 })
    .toBuffer();
}
