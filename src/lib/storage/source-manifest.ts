import fs from "fs/promises";
import path from "path";
import { getRawDir, getProductDir } from "@/lib/storage/product-storage";

export interface SourcePhotoEntry {
  id: string;
  filename: string;
  label: string;
  isPrimary: boolean;
  width?: number;
  height?: number;
  uploadedAt: string;
}

export interface SourceManifest {
  sources: SourcePhotoEntry[];
  primaryId: string | null;
}

const MANIFEST = "sources-manifest.json";

function manifestPath(brandId: string, productId: string) {
  return path.join(getRawDir(brandId, productId), MANIFEST);
}

export async function readSourceManifest(
  brandId: string,
  productId: string
): Promise<SourceManifest> {
  try {
    const raw = await fs.readFile(manifestPath(brandId, productId), "utf-8");
    return JSON.parse(raw) as SourceManifest;
  } catch {
    return { sources: [], primaryId: null };
  }
}

export async function writeSourceManifest(
  brandId: string,
  productId: string,
  manifest: SourceManifest
) {
  const dir = getRawDir(brandId, productId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(manifestPath(brandId, productId), JSON.stringify(manifest, null, 2));
}

export async function addSourceToManifest(
  brandId: string,
  productId: string,
  entry: SourcePhotoEntry,
  setPrimary = false
): Promise<SourceManifest> {
  const manifest = await readSourceManifest(brandId, productId);
  manifest.sources.push(entry);
  if (setPrimary || !manifest.primaryId) {
    manifest.primaryId = entry.id;
    manifest.sources = manifest.sources.map((s) => ({
      ...s,
      isPrimary: s.id === entry.id,
    }));
  }
  await writeSourceManifest(brandId, productId, manifest);
  return manifest;
}

export async function setPrimarySource(
  brandId: string,
  productId: string,
  sourceId: string
): Promise<SourceManifest> {
  const manifest = await readSourceManifest(brandId, productId);
  if (!manifest.sources.some((s) => s.id === sourceId)) {
    throw new Error("Source not found");
  }
  manifest.primaryId = sourceId;
  manifest.sources = manifest.sources.map((s) => ({
    ...s,
    isPrimary: s.id === sourceId,
  }));
  await writeSourceManifest(brandId, productId, manifest);
  return manifest;
}

export async function removeSourceFromManifest(
  brandId: string,
  productId: string,
  sourceId: string
): Promise<SourceManifest> {
  const manifest = await readSourceManifest(brandId, productId);
  const removed = manifest.sources.find((s) => s.id === sourceId);
  manifest.sources = manifest.sources.filter((s) => s.id !== sourceId);

  if (manifest.primaryId === sourceId) {
    manifest.primaryId = manifest.sources[0]?.id ?? null;
    manifest.sources = manifest.sources.map((s, i) => ({
      ...s,
      isPrimary: i === 0,
    }));
  }

  if (removed) {
    try {
      await fs.unlink(path.join(getRawDir(brandId, productId), removed.filename));
    } catch {
      // ignore
    }
  }

  await writeSourceManifest(brandId, productId, manifest);
  return manifest;
}

export async function migrateLegacyOriginal(
  brandId: string,
  productId: string,
  originalFilename: string
): Promise<SourceManifest | null> {
  const manifest = await readSourceManifest(brandId, productId);
  if (manifest.sources.length > 0) return null;

  const id = "legacy";
  const entry: SourcePhotoEntry = {
    id,
    filename: originalFilename,
    label: "Source 1",
    isPrimary: true,
    uploadedAt: new Date().toISOString(),
  };
  const next = { sources: [entry], primaryId: id };
  await writeSourceManifest(brandId, productId, next);
  return next;
}

export function getPrimarySource(manifest: SourceManifest): SourcePhotoEntry | null {
  if (!manifest.sources.length) return null;
  return manifest.sources.find((s) => s.id === manifest.primaryId) ?? manifest.sources[0];
}
