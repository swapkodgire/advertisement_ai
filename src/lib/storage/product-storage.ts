import fs from "fs/promises";
import path from "path";

export const OUTPUT_ROOT = path.join(process.cwd(), "output");

export function getProductDir(brandId: string, productId: string) {
  return path.join(OUTPUT_ROOT, brandId, productId);
}

export function getRawDir(brandId: string, productId: string) {
  return path.join(getProductDir(brandId, productId), "raw");
}

export function getGeneratedDir(brandId: string, productId: string) {
  return path.join(getProductDir(brandId, productId), "generated");
}

export async function ensureProductDirs(brandId: string, productId: string) {
  await fs.mkdir(getRawDir(brandId, productId), { recursive: true });
  await fs.mkdir(getGeneratedDir(brandId, productId), { recursive: true });
}

export function filePublicUrl(
  brandId: string,
  productId: string,
  folder: "raw" | "generated",
  filename: string
) {
  return `/api/files/${brandId}/${productId}/${folder}/${filename}`;
}

export async function saveFile(
  brandId: string,
  productId: string,
  folder: "raw" | "generated",
  filename: string,
  buffer: Buffer
) {
  await ensureProductDirs(brandId, productId);
  const dir = folder === "raw" ? getRawDir(brandId, productId) : getGeneratedDir(brandId, productId);
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return { filePath, url: filePublicUrl(brandId, productId, folder, filename) };
}

export async function readFile(
  brandId: string,
  productId: string,
  folder: "raw" | "generated",
  filename: string
) {
  const dir = folder === "raw" ? getRawDir(brandId, productId) : getGeneratedDir(brandId, productId);
  return fs.readFile(path.join(dir, filename));
}

export async function fileExists(
  brandId: string,
  productId: string,
  folder: "raw" | "generated",
  filename: string
) {
  try {
    const dir = folder === "raw" ? getRawDir(brandId, productId) : getGeneratedDir(brandId, productId);
    await fs.access(path.join(dir, filename));
    return true;
  } catch {
    return false;
  }
}

export interface GenerationMeta {
  id: string;
  createdAt: string;
  platformPostTypeId: string;
  viewId: string;
  sceneId: string;
  filename: string;
  prompt: string;
  resolution: string;
  aspectRatio: string;
}

export async function appendGenerationMeta(
  brandId: string,
  productId: string,
  meta: GenerationMeta
) {
  const metaPath = path.join(getProductDir(brandId, productId), "generations.json");
  let list: GenerationMeta[] = [];
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    list = JSON.parse(raw) as GenerationMeta[];
  } catch {
    // new file
  }
  list.unshift(meta);
  await fs.writeFile(metaPath, JSON.stringify(list, null, 2));
  return list;
}

export async function listGenerations(brandId: string, productId: string) {
  const metaPath = path.join(getProductDir(brandId, productId), "generations.json");
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(raw) as GenerationMeta[];
  } catch {
    return [];
  }
}

export async function listRawFiles(brandId: string, productId: string) {
  try {
    const dir = getRawDir(brandId, productId);
    return fs.readdir(dir);
  } catch {
    return [];
  }
}

export async function listGeneratedFiles(brandId: string, productId: string) {
  try {
    const dir = getGeneratedDir(brandId, productId);
    const files = await fs.readdir(dir);
    return files.filter((f) => !f.endsWith(".json"));
  } catch {
    return [];
  }
}

/** Validate path segments to prevent directory traversal */
export function isSafeSegment(segment: string) {
  return /^[a-zA-Z0-9_-]+$/.test(segment);
}

export function resolveSafeFilePath(
  brandId: string,
  productId: string,
  folder: string,
  filename: string
) {
  if (!isSafeSegment(brandId) || !isSafeSegment(productId)) return null;
  if (folder !== "raw" && folder !== "generated") return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;

  const base = folder === "raw" ? getRawDir(brandId, productId) : getGeneratedDir(brandId, productId);
  const resolved = path.resolve(base, filename);
  if (!resolved.startsWith(path.resolve(base))) return null;
  return resolved;
}
