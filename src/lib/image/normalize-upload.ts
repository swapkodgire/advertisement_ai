import sharp from "sharp";

/** Normalize upload: apply EXIF orientation, strip metadata, consistent output */
export async function normalizeUploadedImage(
  buffer: Buffer,
  ext: string
): Promise<{ buffer: Buffer; ext: string; width: number; height: number }> {
  const input = sharp(buffer).rotate(); // auto-apply EXIF orientation

  const meta = await input.metadata();
  const format = ext === "png" ? "png" : ext === "webp" ? "webp" : "jpeg";

  const normalized =
    format === "png"
      ? await input.png({ quality: 95 }).toBuffer({ resolveWithObject: true })
      : format === "webp"
        ? await input.webp({ quality: 92 }).toBuffer({ resolveWithObject: true })
        : await input.jpeg({ quality: 92, mozjpeg: true }).toBuffer({ resolveWithObject: true });

  const outExt = format === "jpeg" ? "jpg" : format;

  return {
    buffer: normalized.data,
    ext: outExt,
    width: normalized.info.width,
    height: normalized.info.height,
  };
}

export function sourceFilename(sourceId: string, ext: string): string {
  return `source-${sourceId}.${ext === "jpeg" ? "jpg" : ext}`;
}

export function primaryOriginalFilename(ext: string): string {
  return `original.${ext === "jpeg" ? "jpg" : ext}`;
}
