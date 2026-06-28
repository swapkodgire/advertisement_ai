import fs from "fs/promises";
import path from "path";
import { getProductDir } from "@/lib/storage/product-storage";
import type { ProductProfile } from "@/types";

const PROFILE_FILE = "product-profile.json";

function profilePath(brandId: string, productId: string) {
  return path.join(getProductDir(brandId, productId), PROFILE_FILE);
}

export async function readProductProfile(
  brandId: string,
  productId: string
): Promise<ProductProfile | null> {
  try {
    const raw = await fs.readFile(profilePath(brandId, productId), "utf-8");
    return JSON.parse(raw) as ProductProfile;
  } catch {
    return null;
  }
}

export async function writeProductProfile(
  brandId: string,
  productId: string,
  profile: ProductProfile
) {
  const dir = getProductDir(brandId, productId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(profilePath(brandId, productId), JSON.stringify(profile, null, 2));
}
