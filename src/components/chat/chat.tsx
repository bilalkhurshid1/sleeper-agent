"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import type { UIMessage } from "ai";

type Props = {
  sessionId: string;
  initialMessages: UIMessage[];
};

export function Chat({ sessionId, initialMessages }: Props) {
  const router = useRouter();
  const hasRefreshedRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { sessionId },
    }),
    messages: initialMessages,
    onFinish: () => {
      if (!hasRefreshedRef.current) {
        hasRefreshedRef.current = true;
        router.refresh();
      }
    },
  });

  const [input, setInput] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const isStreaming = status === "submitted" || status === "streaming";

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [sessionId, messages.length]);

  function submitMessage() {
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input });
    setInput("");
  }

  async function writeClipboardText(text: string) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Fall back for browsers that block Clipboard API writes in embedded contexts.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const didCopy = document.execCommand("copy");
      if (!didCopy) throw new Error("Copy command failed");
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async function copyMessage(id: string, text: string) {
    try {
      await writeClipboardText(text);
    } catch {
      return;
    }

    setCopiedMessageId(id);
    window.setTimeout(() => {
      setCopiedMessageId((currentId) => (currentId === id ? null : currentId));
    }, 1500);
  }

  return (
    <div className="rounded border border-zinc-200 bg-white flex flex-col flex-1 min-h-0">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-sm text-zinc-500">
            Ask the coach anything about your dynasty league — trades, waivers, start/sit, rookie
            picks. They have your full roster, standings, and recent league activity.
          </div>
        )}
        {messages.map((m) => {
          const isUser = m.role === "user";
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("");
          return (
            <div
              key={m.id}
              className={`flex text-sm ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[82%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`mb-1 flex w-full items-center gap-2 ${
                    isUser ? "justify-end" : "justify-between"
                  }`}
                >
                  <span
                    className={`text-xs uppercase tracking-wide ${
                      isUser ? "font-semibold text-zinc-700" : "text-zinc-500"
                    }`}
                  >
                    {isUser ? "You" : "Coach"}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyMessage(m.id, text)}
                    className="rounded px-1.5 py-0.5 text-[11px] font-normal text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    aria-label={`Copy ${isUser ? "your" : "coach"} message`}
                  >
                    {copiedMessageId === m.id ? "Copied" : "Copy"}
                  </button>
                </div>
                {isUser ? (
                  <div className="rounded-lg bg-zinc-900 px-3 py-2 text-white shadow-sm">
                    <span className="whitespace-pre-wrap">{text}</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <div className="prose prose-sm prose-zinc max-w-none">
                      <Markdown>{text}</Markdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isStreaming && <div className="text-xs text-zinc-400">…</div>}
        {error && (
          <div className="text-xs text-red-600 whitespace-pre-wrap">
            error: {error.message}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="border-t border-zinc-200 p-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitMessage();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitMessage();
            }
          }}
          placeholder="ask the coach…"
          rows={2}
          className="max-h-32 min-h-10 flex-1 resize-none rounded border border-zinc-300 bg-white px-3 py-2 text-base leading-5 focus:outline-none focus:border-zinc-500 sm:text-sm"
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          send
        </button>
      </form>
    </div>
  );
}
