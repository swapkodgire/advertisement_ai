import { NextResponse } from "next/server";
import {
  getCategoryForType,
  getProductTypeLabel,
  isValidProductType,
} from "@/lib/data/product-taxonomy";
import {
  detectProductFromImage,
  toProductProfile,
} from "@/lib/photoshoot/detect-product";
import { readProductProfile, writeProductProfile } from "@/lib/storage/product-profile";
import { isSafeSegment } from "@/lib/storage/product-storage";
import type { ProductCategoryId, ProductTypeId } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId");
  const productId = searchParams.get("productId");

  if (!brandId || !productId || !isSafeSegment(brandId) || !isSafeSegment(productId)) {
    return NextResponse.json({ error: "brandId and productId required" }, { status: 400 });
  }

  const profile = await readProductProfile(brandId, productId);
  return NextResponse.json({ profile });
}

/** Auto-detect product from primary source photo */
export async function POST(req: Request) {
  try {
    const { brandId, productId } = await req.json();

    if (!brandId || !productId || !isSafeSegment(brandId) || !isSafeSegment(productId)) {
      return NextResponse.json({ error: "brandId and productId required" }, { status: 400 });
    }

    const result = await detectProductFromImage(brandId, productId);
    const profile = toProductProfile(result);
    await writeProductProfile(brandId, productId, profile);

    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Detection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Manual product type override */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { brandId, productId, categoryId, typeId } = body as {
      brandId: string;
      productId: string;
      categoryId: ProductCategoryId;
      typeId: ProductTypeId;
    };

    if (!brandId || !productId || !isSafeSegment(brandId) || !isSafeSegment(productId)) {
      return NextResponse.json({ error: "brandId and productId required" }, { status: 400 });
    }

    if (!categoryId || !typeId || !isValidProductType(categoryId, typeId)) {
      return NextResponse.json({ error: "Invalid category or type" }, { status: 400 });
    }

    const inferred = getCategoryForType(typeId);
    if (inferred !== categoryId) {
      return NextResponse.json({ error: "Type does not belong to category" }, { status: 400 });
    }

    const profile = {
      categoryId,
      typeId,
      confidence: 1,
      source: "manual" as const,
      label: getProductTypeLabel(typeId),
      detectedAt: new Date().toISOString(),
    };

    await writeProductProfile(brandId, productId, profile);
    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
