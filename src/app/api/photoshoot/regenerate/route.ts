import { NextResponse } from "next/server";
import {
  runRegeneratePhase,
  type RegeneratePhase,
  type PhotoshootGenerationInput,
} from "@/lib/photoshoot/generate";
import { isSafeSegment } from "@/lib/storage/product-storage";
import type { BusinessDNA, ImageViewId, PlatformPostTypeId, SceneId } from "@/types";
import type { PhotoshootAgentPlan } from "@/lib/photoshoot/prompt-agent";

export const runtime = "nodejs";
export const maxDuration = 600;

interface RegenerateBody {
  phase: RegeneratePhase;
  brandId: string;
  productId: string;
  brandName?: string;
  productName?: string;
  productCategory?: string;
  productDescription?: string;
  businessDNA?: BusinessDNA;
  platformPostTypeId: PlatformPostTypeId;
  viewId: ImageViewId;
  sceneId: SceneId;
  genId?: string;
  sceneBgFilename?: string;
  sceneImagePrompt?: string;
  agentPlan?: PhotoshootAgentPlan;
  modifyInstruction?: string;
  stream?: boolean;
}

function validateBody(body: RegenerateBody) {
  const { brandId, productId, platformPostTypeId, viewId, sceneId, phase } = body;

  if (
    !phase ||
    !brandId ||
    !productId ||
    !platformPostTypeId ||
    !viewId ||
    !sceneId ||
    !isSafeSegment(brandId) ||
    !isSafeSegment(productId)
  ) {
    return "Missing required fields for regeneration";
  }

  if (!["isolate", "scene", "composite"].includes(phase)) {
    return "Invalid regenerate phase";
  }

  if (phase !== "isolate" && !body.businessDNA) {
    return "businessDNA is required for scene and composite regeneration";
  }

  return null;
}

function buildInput(body: RegenerateBody): PhotoshootGenerationInput & {
  genId?: string;
  sceneBgFilename?: string;
  sceneImagePrompt?: string;
  agentPlan?: PhotoshootAgentPlan;
} {
  return {
    brandId: body.brandId,
    productId: body.productId,
    brandName: body.brandName ?? "Brand",
    productName: body.productName ?? "Product",
    productCategory: body.productCategory ?? "Other",
    productDescription: body.productDescription ?? "",
    businessDNA: (body.businessDNA ?? {}) as BusinessDNA,
    platformPostTypeId: body.platformPostTypeId,
    viewId: body.viewId,
    sceneId: body.sceneId,
    genId: body.genId,
    sceneBgFilename: body.sceneBgFilename,
    sceneImagePrompt: body.sceneImagePrompt,
    agentPlan: body.agentPlan,
    modifyInstruction: body.modifyInstruction,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RegenerateBody;
    const validationError = validateBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const input = buildInput(body);

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (data: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            const result = await runRegeneratePhase(body.phase, {
              ...input,
              onProgress: (event) => send({ type: "progress", ...event }),
            });

            if (body.phase === "composite" && "url" in result && "meta" in result) {
              send({
                type: "done",
                phase: body.phase,
                id: result.id,
                url: result.url,
                meta: result.meta,
                genId: result.id,
                sceneBgFilename: result.sceneBgFilename,
                agentPlan: result.agentPlan,
                message: result.message,
              });
            } else {
              send({
                type: "done",
                phase: body.phase,
                genId: "genId" in result ? result.genId : input.genId,
                sceneBgFilename: "sceneBgFilename" in result ? result.sceneBgFilename : input.sceneBgFilename,
                isolatedUrl: "isolatedUrl" in result ? result.isolatedUrl : undefined,
                sceneBgUrl: "sceneBgUrl" in result ? result.sceneBgUrl : undefined,
                agentPlan: "agentPlan" in result ? result.agentPlan : undefined,
                message: result.message,
              });
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "Regeneration failed";
            send({ type: "error", error: message });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const result = await runRegeneratePhase(body.phase, input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Regeneration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
