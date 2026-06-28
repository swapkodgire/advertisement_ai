import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { resolveProductImage } from "@/lib/scraper/product-url";
import { normalizeUploadedImage, sourceFilename } from "@/lib/image/normalize-upload";
import { addSourceToManifest } from "@/lib/storage/source-manifest";
import { saveFile, isSafeSegment, getRawDir } from "@/lib/storage/product-storage";
import fs from "fs/promises";
import path from "path";
import { primaryOriginalFilename } from "@/lib/image/normalize-upload";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { brandId, productId: existingProductId, url, name, category } = body;

    if (!brandId || !url || !isSafeSegment(brandId)) {
      return NextResponse.json({ error: "brandId and url required" }, { status: 400 });
    }

    const productId =
      existingProductId && isSafeSegment(existingProductId)
        ? existingProductId
        : randomUUID();

    const extracted = await resolveProductImage(url);
    const normalized = await normalizeUploadedImage(extracted.buffer, extracted.ext);
    const id = randomUUID();
    const filename = sourceFilename(id, normalized.ext);
    const { url: imageUrl } = await saveFile(brandId, productId, "raw", filename, normalized.buffer);

    const entry = {
      id,
      filename,
      label: extracted.title || "Imported",
      isPrimary: true,
      width: normalized.width,
      height: normalized.height,
      uploadedAt: new Date().toISOString(),
    };
    await addSourceToManifest(brandId, productId, entry, true);

    const destName = primaryOriginalFilename(normalized.ext);
    await fs.copyFile(path.join(getRawDir(brandId, productId), filename), path.join(getRawDir(brandId, productId), destName));

    const manifest = await import("@/lib/storage/source-manifest").then((m) =>
      m.readSourceManifest(brandId, productId)
    );

    return NextResponse.json({
      productId,
      url: imageUrl,
      originalUrl: imageUrl,
      primaryId: id,
      sources: manifest.sources.map((s) => ({
        ...s,
        url: `/api/files/${brandId}/${productId}/raw/${s.filename}`,
      })),
      suggestedName: name || extracted.title || "Imported Product",
      suggestedDescription: extracted.description || "",
      suggestedCategory: category || "Other",
      sourceUrl: url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
