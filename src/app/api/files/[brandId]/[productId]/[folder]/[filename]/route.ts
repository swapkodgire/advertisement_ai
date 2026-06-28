import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafeFilePath } from "@/lib/storage/product-storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
};

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      brandId: string;
      productId: string;
      folder: string;
      filename: string;
    }>;
  }
) {
  const { brandId, productId, folder, filename } = await params;

  const filePath = resolveSafeFilePath(brandId, productId, folder, filename);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
