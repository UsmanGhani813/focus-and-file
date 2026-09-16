import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { WorkDetailDialog } from "@/components/WorkDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatDuration, initials, type WorkSession } from "@/lib/work";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Work history — Tempo" },
      {
        name: "description",
        content: "Browse completed work sessions by person, with durations, notes and attached evidence.",
      },
      { property: "og:title", content: "Work history — Tempo" },
      {
        property: "og:description",
        content: "Browse completed work sessions by person, with durations, notes and attached evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<WorkSession | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["public-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_sessions")
        .select(
          "id, user_id, title, description, started_at, stopped_at, duration_seconds, is_public, created_at, profiles(id, full_name, email, phone, avatar_url), attachments(id, file_name, file_path, file_type, file_size)",
        )
        .eq("is_public", true)
        .order("stopped_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as WorkSession[];
    },
  });

  const sessions = sessionsQuery.data ?? [];

  const people = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; seconds: number }>();
    for (const s of sessions) {
      const name = s.profiles?.full_name ?? "Unnamed";
      const entry = map.get(s.user_id) ?? { id: s.user_id, name, count: 0, seconds: 0 };
      entry.count += 1;
      entry.seconds += s.duration_seconds;
      map.set(s.user_id, entry);
    }
    return [...map.values()].sort((a, b) => b.seconds - a.seconds);
  }, [sessions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (selectedUser && s.user_id !== selectedUser) return false;
      if (!term) return true;
      return (
        s.title.toLowerCase().includes(term) ||
        (s.description ?? "").toLowerCase().includes(term) ||
        (s.profiles?.full_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [sessions, selectedUser, search]);

  const activePerson = people.find((p) => p.id === selectedUser) ?? null;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Work history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Completed sessions people chose to share, newest first.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Chip active={selectedUser === null} onClick={() => setSelectedUser(null)}>
            All
          </Chip>
          {people.map((p) => (
            <Chip key={p.id} active={selectedUser === p.id} onClick={() => setSelectedUser(p.id)}>
              <span className="grid size-5 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                {initials(p.name)}
              </span>
              {p.name}
              <span className="font-mono text-[10px] opacity-70">{p.count}</span>
            </Chip>
          ))}
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles, notes or people"
            className="h-11 rounded-full pl-10"
          />
        </div>

        {activePerson && (
          <div className="mt-6 rounded-2xl bg-secondary p-4">
            <p className="text-lg font-semibold tracking-tight">{activePerson.name}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {activePerson.count} session{activePerson.count > 1 ? "s" : ""} ·{" "}
              {formatDuration(activePerson.seconds)} tracked
            </p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {sessionsQuery.isLoading ? (
            <>
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </>
          ) : sessionsQuery.isError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <p className="font-medium">We couldn't load the history</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check your connection and try again.
              </p>
              <Button
                variant="outline"
                onClick={() => sessionsQuery.refetch()}
                className="mt-4 rounded-full"
              >
                Try again
              </Button>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setDetail(s)}
                className="flex w-full items-start gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 sm:p-5"
              >
                <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {initials(s.profiles?.full_name ?? "?")}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold tracking-tight">{s.title}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {s.profiles?.full_name ?? "Unnamed"}
                  </p>
                  {s.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {s.description}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {formatDateTime(s.stopped_at)}
                    {s.attachments && s.attachments.length > 0
                      ? ` · ${s.attachments.length} file${s.attachments.length > 1 ? "s" : ""}`
                      : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-base font-medium tnum">
                  {formatDuration(s.duration_seconds)}
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="font-medium">Nothing to show yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search || selectedUser
                  ? "Try a different search or clear the filters."
                  : "Shared work sessions will appear here as soon as they're submitted."}
              </p>
            </div>
          )}
        </div>
      </main>

      <WorkDetailDialog session={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}
