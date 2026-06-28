/** Target pixel dimensions for AI generation (Cursor/OpenAI caps) */
export function generationDimensions(
  aspectRatio: string,
  maxLongEdge = 1536
): { width: number; height: number } {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return { width: 1024, height: 1024 };

  if (w >= h) {
    const width = maxLongEdge;
    return { width, height: Math.round((maxLongEdge * h) / w) };
  }

  const height = maxLongEdge;
  return { width: Math.round((maxLongEdge * w) / h), height };
}

/** Cap export size to avoid memory issues while honoring platform targets */
export function exportDimensions(
  resolution: string,
  maxLongEdge = 8192
): { width: number; height: number } {
  const [w, h] = resolution.split("x").map(Number);
  if (!w || !h) return { width: 2048, height: 2048 };

  const longEdge = Math.max(w, h);
  if (longEdge <= maxLongEdge) return { width: w, height: h };

  const scale = maxLongEdge / longEdge;
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  };
}

export function aspectRatioHint(aspectRatio: string, width: number, height: number): string {
  return `${aspectRatio} aspect ratio — output exactly ${width}×${height} pixels, no letterboxing`;
}
