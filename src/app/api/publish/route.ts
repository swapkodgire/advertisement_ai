import { NextResponse } from "next/server";
import { isSafeSegment } from "@/lib/storage/product-storage";
import { listPublishRecords, runPublish } from "@/lib/publish/publish-service";

export const runtime = "nodejs";
export const maxDuration = 120;

interface PublishBody {
  brandId: string;
  productId: string;
  genId: string;
  platformPostTypeId: string;
  imageUrl: string;
  caption: string;
  hashtags?: string;
  scheduledAt?: string | null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PublishBody;
    const { brandId, productId, genId, platformPostTypeId, imageUrl } = body;

    if (
      !brandId ||
      !productId ||
      !genId ||
      !platformPostTypeId ||
      !imageUrl ||
      !isSafeSegment(brandId) ||
      !isSafeSegment(productId)
    ) {
      return NextResponse.json({ error: "Missing required fields for publishing" }, { status: 400 });
    }

    const record = await runPublish({
      brandId,
      productId,
      genId,
      platformPostTypeId,
      imageUrl,
      caption: body.caption ?? "",
      hashtags: body.hashtags,
      scheduledAt: body.scheduledAt ?? null,
    });

    const ok = record.status === "published" || record.status === "scheduled";
    return NextResponse.json({ ok, record }, { status: ok ? 200 : 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId");
  const productId = searchParams.get("productId");
  if (!brandId || !productId || !isSafeSegment(brandId) || !isSafeSegment(productId)) {
    return NextResponse.json({ error: "Invalid brand or product" }, { status: 400 });
  }
  const records = await listPublishRecords(brandId, productId);
  return NextResponse.json({ records });
}
