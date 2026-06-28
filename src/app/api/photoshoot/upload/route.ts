import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  normalizeUploadedImage,
  primaryOriginalFilename,
  sourceFilename,
} from "@/lib/image/normalize-upload";
import {
  addSourceToManifest,
  readSourceManifest,
  setPrimarySource,
  type SourcePhotoEntry,
} from "@/lib/storage/source-manifest";
import { saveFile, isSafeSegment } from "@/lib/storage/product-storage";
import fs from "fs/promises";
import path from "path";
import { getRawDir } from "@/lib/storage/product-storage";

export const runtime = "nodejs";

async function syncPrimaryOriginal(
  brandId: string,
  productId: string,
  filename: string
) {
  const rawDir = getRawDir(brandId, productId);
  const srcPath = path.join(rawDir, filename);
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const destName = primaryOriginalFilename(ext);
  const destPath = path.join(rawDir, destName);

  // Remove other original.* files
  const files = await fs.readdir(rawDir).catch(() => [] as string[]);
  for (const f of files) {
    if (f.startsWith("original.") && f !== destName) {
      await fs.unlink(path.join(rawDir, f)).catch(() => {});
    }
  }

  await fs.copyFile(srcPath, destPath);
  return destName;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const brandId = formData.get("brandId") as string;
    const productId = formData.get("productId") as string;
    const setPrimary = formData.get("setPrimary") === "true";
    const sourceId = (formData.get("sourceId") as string) || randomUUID();

    if (!brandId || !productId || !isSafeSegment(brandId) || !isSafeSegment(productId)) {
      return NextResponse.json({ error: "brandId and productId required" }, { status: 400 });
    }

    const files = formData.getAll("file").filter((f): f is File => f instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "At least one file required" }, { status: 400 });
    }

    let manifest = await readSourceManifest(brandId, productId);
    let sourceIndex = manifest.sources.length;
    const uploaded: (SourcePhotoEntry & { url: string; isPrimary: boolean })[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rawExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const allowed = ["jpg", "jpeg", "png", "webp"];
      if (!allowed.includes(rawExt)) {
        return NextResponse.json({ error: "Allowed: jpg, png, webp" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const normalized = await normalizeUploadedImage(buffer, rawExt);
      const id = files.length === 1 && formData.get("sourceId") ? sourceId : randomUUID();
      const filename = sourceFilename(id, normalized.ext);

      const { url } = await saveFile(brandId, productId, "raw", filename, normalized.buffer);
      sourceIndex += 1;

      const entry: SourcePhotoEntry = {
        id,
        filename,
        label: file.name.replace(/\.[^.]+$/, "") || `Source ${sourceIndex}`,
        isPrimary: false,
        width: normalized.width,
        height: normalized.height,
        uploadedAt: new Date().toISOString(),
      };

      const isFirstEver = manifest.sources.length === 0 && i === 0;
      const makePrimary = setPrimary || isFirstEver;

      manifest = await addSourceToManifest(brandId, productId, entry, makePrimary);
      if (makePrimary) {
        await syncPrimaryOriginal(brandId, productId, filename);
      }

      uploaded.push({ ...entry, url, isPrimary: makePrimary });
    }

    const updated = await readSourceManifest(brandId, productId);
    const primary = updated.sources.find((s) => s.id === updated.primaryId);

    return NextResponse.json({
      productId,
      sources: updated.sources.map((s) => ({
        ...s,
        url: `/api/files/${brandId}/${productId}/raw/${s.filename}`,
      })),
      primaryId: updated.primaryId,
      url: primary
        ? `/api/files/${brandId}/${productId}/raw/${primary.filename}`
        : uploaded[0]?.url,
      uploaded,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { brandId, productId, primaryId } = body;

    if (!brandId || !productId || !primaryId || !isSafeSegment(brandId) || !isSafeSegment(productId)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const manifest = await setPrimarySource(brandId, productId, primaryId);
    const primary = manifest.sources.find((s) => s.id === primaryId);
    if (primary) {
      await syncPrimaryOriginal(brandId, productId, primary.filename);
    }

    return NextResponse.json({
      primaryId: manifest.primaryId,
      sources: manifest.sources.map((s) => ({
        ...s,
        url: `/api/files/${brandId}/${productId}/raw/${s.filename}`,
      })),
      url: primary
        ? `/api/files/${brandId}/${productId}/raw/${primary.filename}`
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId");
    const productId = searchParams.get("productId");
    const sourceId = searchParams.get("sourceId");

    if (
      !brandId ||
      !productId ||
      !sourceId ||
      !isSafeSegment(brandId) ||
      !isSafeSegment(productId)
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { removeSourceFromManifest } = await import("@/lib/storage/source-manifest");
    const manifest = await removeSourceFromManifest(brandId, productId, sourceId);
    const primary = manifest.sources.find((s) => s.id === manifest.primaryId);
    if (primary) {
      await syncPrimaryOriginal(brandId, productId, primary.filename);
    }

    return NextResponse.json({
      sources: manifest.sources.map((s) => ({
        ...s,
        url: `/api/files/${brandId}/${productId}/raw/${s.filename}`,
      })),
      primaryId: manifest.primaryId,
      url: primary
        ? `/api/files/${brandId}/${productId}/raw/${primary.filename}`
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
