import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { normalizeUploadedImage, sourceFilename } from "@/lib/image/normalize-upload";
import {
  readSourceManifest,
  writeSourceManifest,
  getPrimarySource,
} from "@/lib/storage/source-manifest";
import { saveFile, isSafeSegment, getRawDir } from "@/lib/storage/product-storage";
import fs from "fs/promises";
import path from "path";
import { primaryOriginalFilename } from "@/lib/image/normalize-upload";

export const runtime = "nodejs";

/** Save client-edited image (crop / rotate / zoom applied in browser) */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const brandId = formData.get("brandId") as string;
    const productId = formData.get("productId") as string;
    const sourceId = formData.get("sourceId") as string;
    const file = formData.get("file") as File | null;

    if (
      !brandId ||
      !productId ||
      !sourceId ||
      !file ||
      !isSafeSegment(brandId) ||
      !isSafeSegment(productId)
    ) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const normalized = await normalizeUploadedImage(buffer, "png");
    const filename = sourceFilename(sourceId, normalized.ext);

    const { url } = await saveFile(brandId, productId, "raw", filename, normalized.buffer);

    const manifest = await readSourceManifest(brandId, productId);
    manifest.sources = manifest.sources.map((s) =>
      s.id === sourceId
        ? { ...s, filename, width: normalized.width, height: normalized.height }
        : s
    );
    await writeSourceManifest(brandId, productId, manifest);

    const primary = getPrimarySource(manifest);
    let primaryUrl: string | null = null;
    if (primary?.id === sourceId) {
      const rawDir = getRawDir(brandId, productId);
      const destName = primaryOriginalFilename(normalized.ext);
      await fs.copyFile(path.join(rawDir, filename), path.join(rawDir, destName));
      primaryUrl = `/api/files/${brandId}/${productId}/raw/${destName}`;
    }

    return NextResponse.json({
      sourceId,
      url,
      primaryUrl,
      width: normalized.width,
      height: normalized.height,
      sources: manifest.sources.map((s) => ({
        ...s,
        url: `/api/files/${brandId}/${productId}/raw/${s.filename}`,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
