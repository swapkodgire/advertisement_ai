"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useActiveBrand, useAppStore } from "@/lib/store";
import { fetchCursorStatus, parseSSEStream } from "@/lib/cursor-client";
import type { CursorStatus } from "@/lib/cursor-client";

const SUGGESTIONS = ["Nordic Vision", "Monk Eyewear", "The Nordic Studio"];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AgentPanel() {
  const activeBrand = useActiveBrand();
  const { agentId, setAgentId, updateBrandOverview } = useAppStore();
  const businessDNA = activeBrand?.businessDNA;
  const hasName = Boolean(businessDNA?.brandOverview.businessName);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cursorStatus, setCursorStatus] = useState<CursorStatus | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCursorStatus().then(setCursorStatus);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading || !businessDNA) return;

      const userMessage = text.trim();
      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
      setLoading(true);

      let assistantContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            agentId: agentId ?? undefined,
            businessDNA,
            brandName: activeBrand?.name,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Chat request failed");
        }

        for await (const event of parseSSEStream(res)) {
          if (event.type === "agent_id" && typeof event.agentId === "string") {
            setAgentId(event.agentId);
          }
          if (event.type === "chunk" && typeof event.text === "string") {
            assistantContent += event.text;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: assistantContent };
              return next;
            });
          }
          if (event.type === "error") throw new Error(String(event.error));
        }
      } catch (err) {
        const errorText = err instanceof Error ? err.message : "Something went wrong";
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `⚠️ ${errorText}` };
          return next;
        });
      } finally {
        setLoading(false);
      }
    },
    [loading, agentId, businessDNA, activeBrand?.name, setAgentId]
  );

  const apiReady = cursorStatus?.configured && cursorStatus?.valid;

  return (
    <aside className="glass-sidebar hidden w-80 shrink-0 flex-col border-l border-border/50 xl:flex">
      <div className="border-b border-border/40 px-5 py-4">
        <h2 className="text-sm font-semibold">AI Assistant</h2>
        {activeBrand && (
          <p className="text-xs text-muted">{activeBrand.name}</p>
        )}
        {cursorStatus && (
          <p className="mt-1 text-xs text-muted">
            {apiReady ? (
              <span className="font-medium text-success">Connected</span>
            ) : cursorStatus.configured ? (
              <span className="text-danger">Invalid API key</span>
            ) : (
              <span>Add CURSOR_API_KEY to .env.local</span>
            )}
          </p>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.length === 0 && (
          <>
            {hasName ? (
              <p className="text-muted">
                Ask about photoshoots, campaigns, or platform formats for {activeBrand?.name}.
              </p>
            ) : (
              <>
                <p className="text-muted">Define your brand or pick a suggestion:</p>
                <div className="space-y-2">
                  {SUGGESTIONS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => updateBrandOverview({ businessName: name })}
                      className="glass-tile block w-full px-4 py-3 text-left text-sm transition-transform hover:!translate-y-[-2px]"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-2xl px-4 py-2.5 ${
              msg.role === "user"
                ? "ml-6 bg-gradient-to-br from-accent to-[#5856d6] text-white shadow-md shadow-accent/20"
                : "mr-6 glass-panel text-foreground"
            }`}
          >
            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="border-t border-border/40 p-4"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!apiReady || loading || !businessDNA}
            placeholder="Message…"
            className="glass-input flex-1 rounded-full px-4 py-2.5 text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!apiReady || loading || !input.trim()}
            className="glass-btn-primary flex h-10 w-10 shrink-0 items-center justify-center !rounded-full !p-0 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </aside>
  );
}
