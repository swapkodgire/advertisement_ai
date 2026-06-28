export async function* parseSSEStream(
  response: Response
): AsyncGenerator<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6)) as Record<string, unknown>;
        } catch {
          // skip malformed events
        }
      }
    }
  }
}

export interface CursorStatus {
  configured: boolean;
  valid?: boolean;
  user?: { apiKeyName: string; userEmail?: string };
  error?: string;
  message?: string;
}

export async function fetchCursorStatus(): Promise<CursorStatus> {
  const res = await fetch("/api/cursor/status");
  return res.json();
}
