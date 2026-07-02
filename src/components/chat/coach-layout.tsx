"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chat } from "./chat";
import type { UIMessage } from "ai";

type Session = { id: string; title: string; updatedAt: Date; archivedAt: Date | null };

type Props = {
  sessionId: string;
  sessions: Session[];
  archivedSessions: Session[];
  initialMessages: UIMessage[];
  settings: { provider: string | null; model: string | null } | null;
};

export function CoachLayout({
  sessionId,
  sessions,
  archivedSessions,
  initialMessages,
  settings,
}: Props) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [myTeamLoading, setMyTeamLoading] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleNewSession() {
    setSidebarOpen(false);
    const res = await fetch("/api/chat/sessions", { method: "POST" });
    const { id } = await res.json();
    router.push(`/coach?session=${id}`);
  }

  async function setSessionArchived(id: string, archived: boolean) {
    await fetch(`/api/chat/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });

    if (archived && id === sessionId) {
      const nextSession = sessions.find((s) => s.id !== id);
      router.push(nextSession ? `/coach?session=${nextSession.id}` : "/coach");
      return;
    }

    router.refresh();
  }

  async function handleMyTeam() {
    setMyTeamLoading(true);
    try {
      const res = await fetch("/api/myteam");
      const { summary } = await res.json();
      setMyTeam(summary);
    } finally {
      setMyTeamLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshStatus(null);
    try {
      await fetch("/api/refresh", { method: "POST" });
      setRefreshStatus("League data refreshed.");
    } catch {
      setRefreshStatus("Refresh failed.");
    } finally {
      setRefreshing(false);
      window.setTimeout(() => setRefreshStatus(null), 3000);
    }
  }

  return (
    <div className="flex gap-4" style={{ height: "calc(100dvh - 8rem)" }}>
      {/* Backdrop (mobile only, when drawer is open) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 sm:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static column on desktop, slide-over drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 flex flex-col gap-1 overflow-y-auto bg-white p-3 shadow-lg transition-transform sm:static sm:z-auto sm:w-52 sm:overflow-visible sm:bg-transparent sm:p-0 sm:shadow-none sm:translate-x-0 min-h-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={handleNewSession}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 text-left"
        >
          + New session
        </button>
        <div className="flex gap-1 mt-1">
          <button
            onClick={handleMyTeam}
            disabled={myTeamLoading}
            className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-40"
          >
            {myTeamLoading ? "Loading…" : "My team"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-40"
          >
            {refreshing ? "Refreshing…" : "Refresh data"}
          </button>
        </div>
        {refreshStatus && <p className="text-[11px] text-zinc-500 px-1">{refreshStatus}</p>}
        <nav className="flex-1 overflow-y-auto space-y-0.5 mt-1">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-center gap-1 rounded hover:bg-zinc-100 ${
                s.id === sessionId ? "bg-zinc-200 font-medium" : "text-zinc-700"
              }`}
            >
              <Link
                href={`/coach?session=${s.id}`}
                onClick={() => setSidebarOpen(false)}
                className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm"
                title={s.title}
              >
                {s.title}
              </Link>
              <button
                type="button"
                onClick={() => setSessionArchived(s.id, true)}
                className="mr-1 rounded px-1.5 py-1 text-[11px] font-normal text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                title="Archive session"
              >
                Archive
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-zinc-400">No sessions yet</p>
          )}
          {archivedSessions.length > 0 && (
            <div className="pt-3">
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Archived
              </p>
              <div className="space-y-0.5">
                {archivedSessions.map((s) => (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-1 rounded hover:bg-zinc-100 ${
                      s.id === sessionId ? "bg-zinc-200 font-medium" : "text-zinc-500"
                    }`}
                  >
                    <Link
                      href={`/coach?session=${s.id}`}
                      onClick={() => setSidebarOpen(false)}
                      className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm"
                      title={s.title}
                    >
                      {s.title}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSessionArchived(s.id, false)}
                      className="mr-1 rounded px-1.5 py-1 text-[11px] font-normal text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                      title="Restore session"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* Chat area */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 sm:hidden"
        >
          ☰ Sessions
        </button>
        <div className="flex items-baseline justify-between text-xs text-zinc-500">
          <span>
            using {settings?.provider ?? "—"} / {settings?.model ?? "—"}
          </span>
          <Link href="/settings" className="underline">
            change
          </Link>
        </div>
        {myTeam && (
          <div className="rounded border border-zinc-200 bg-white p-3 text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                My team
              </span>
              <button
                type="button"
                onClick={() => setMyTeam(null)}
                className="text-[11px] text-zinc-500 hover:text-zinc-900"
              >
                dismiss
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-800">{myTeam}</pre>
          </div>
        )}
        <Chat key={sessionId} sessionId={sessionId} initialMessages={initialMessages} />
      </div>
    </div>
  );
}
