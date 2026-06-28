import { NextResponse } from "next/server";
import { verifyCursorApiKey, isCursorConfigured } from "@/lib/cursor-server";
import { getCursorImageModelLabel } from "@/lib/image/cursor-image";

export const runtime = "nodejs";

export async function GET() {
  const cursor = isCursorConfigured();

  if (!cursor) {
    return NextResponse.json({
      configured: false,
      message: "Add CURSOR_API_KEY to .env.local — this is the only key required",
      photoshoot: {
        cursorAgent: false,
        cursorImage: false,
        imageModel: getCursorImageModelLabel(),
      },
    });
  }

  const verification = await verifyCursorApiKey();

  return NextResponse.json({
    configured: true,
    valid: verification.ok,
    user: verification.user,
    error: verification.error,
    photoshoot: {
      cursorAgent: verification.ok,
      cursorImage: verification.ok,
      imageModel: getCursorImageModelLabel(),
    },
  });
}
