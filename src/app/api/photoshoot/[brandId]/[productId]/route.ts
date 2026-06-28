import { NextResponse } from "next/server";
import fs from "fs/promises";
import {
  listGenerations,
  listRawFiles,
  filePublicUrl,
  isSafeSegment,
} from "@/lib/storage/product-storage";
import {
  migrateLegacyOriginal,
  readSourceManifest,
} from "@/lib/storage/source-manifest";
import { readProductProfile } from "@/lib/storage/product-profile";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string; productId: string }> }
) {
  const { brandId, productId } = await params;

  if (!isSafeSegment(brandId) || !isSafeSegment(productId)) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  const rawFiles = await listRawFiles(brandId, productId);
  const generations = await listGenerations(brandId, productId);

  const original = rawFiles.find((f) => f.startsWith("original."));
  if (original) {
    await migrateLegacyOriginal(brandId, productId, original);
  }

  const manifest = await readSourceManifest(brandId, productId);
  const sources = manifest.sources.map((s) => ({
    ...s,
    url: filePublicUrl(brandId, productId, "raw", s.filename),
  }));
  const primary = sources.find((s) => s.id === manifest.primaryId) ?? sources[0];

  const isolated =
    rawFiles.includes("product-isolated.png") || rawFiles.includes("redesigned.png");

  const profile = await readProductProfile(brandId, productId);

  return NextResponse.json({
    originalUrl: primary?.url ?? (original
      ? filePublicUrl(brandId, productId, "raw", original)
      : null),
    primaryId: manifest.primaryId,
    sources,
    isolatedUrl: rawFiles.includes("product-isolated.png")
      ? filePublicUrl(brandId, productId, "raw", "product-isolated.png")
      : rawFiles.includes("redesigned.png")
        ? filePublicUrl(brandId, productId, "raw", "redesigned.png")
        : null,
    redesignedUrl: isolated
      ? rawFiles.includes("product-isolated.png")
        ? filePublicUrl(brandId, productId, "raw", "product-isolated.png")
        : filePublicUrl(brandId, productId, "raw", "redesigned.png")
      : null,
    generations: generations.map((g) => ({
      ...g,
      url: filePublicUrl(brandId, productId, "generated", g.filename),
    })),
    profile,
  });
}
