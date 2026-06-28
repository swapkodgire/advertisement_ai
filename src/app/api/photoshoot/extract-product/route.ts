import { NextResponse } from "next/server";
import { runExtractProduct } from "@/lib/photoshoot/generate";
import { isSafeSegment } from "@/lib/storage/product-storage";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { brandId, productId } = await req.json();

    if (!brandId || !productId || !isSafeSegment(brandId) || !isSafeSegment(productId)) {
      return NextResponse.json({ error: "brandId and productId required" }, { status: 400 });
    }

    const result = await runExtractProduct(brandId, productId);

    return NextResponse.json({
      isolatedUrl: result.isolatedUrl,
      redesignedUrl: result.url,
      width: result.width,
      height: result.height,
      method: result.method,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Product extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
