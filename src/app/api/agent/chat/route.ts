import { CursorAgentError } from "@cursor/sdk";
import { streamAgentResponse, isCursorConfigured } from "@/lib/cursor-server";
import type { BusinessDNA } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ChatRequestBody {
  message: string;
  agentId?: string;
  businessDNA?: BusinessDNA;
}

export async function POST(req: Request) {
  if (!isCursorConfigured()) {
    return Response.json(
      {
        error:
          "CURSOR_API_KEY is not configured. Add it to .env.local — get a key at cursor.com/dashboard/integrations",
      },
      { status: 503 }
    );
  }

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, agentId, businessDNA } = body;
  if (!message?.trim()) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let resolvedAgentId = agentId ?? "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const result = await streamAgentResponse(message.trim(), {
          agentId,
          businessDNA,
          onAgentId: (id) => {
            resolvedAgentId = id;
            send({ type: "agent_id", agentId: id });
          },
          onChunk: (text) => {
            send({ type: "chunk", text });
          },
        });

        send({
          type: "done",
          agentId: result.agentId || resolvedAgentId,
          status: result.status,
          error: result.error,
        });
      } catch (err) {
        const message =
          err instanceof CursorAgentError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Agent error";
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
