import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, ListChecks, Search, Users as UsersIcon, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { WorkDetailDialog } from "@/components/WorkDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/** Predefined day ranges */
const RANGE_PRESETS: { label: string; days: number }[] = [
  { label: "Today", days: 1 },
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

function toDateInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function HistoryPage() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<WorkSession | null>(null);
  const [rangeDays, setRangeDays] = useState<number | null>(null);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

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

  // Live "who is working right now" list. Refetches every 20s so the roster stays fresh,
  // and the per-second display counter below reads from these started_at timestamps.
  const activeQuery = useQuery({
    queryKey: ["active-timers-public"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data: timers, error } = await supabase
        .from("active_timers")
        .select("user_id, started_at");
      if (error) throw error;
      const ids = (timers ?? []).map((t) => t.user_id);
      if (ids.length === 0) return [] as { user_id: string; started_at: string; name: string }[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const nameMap = new Map<string, string>();
      for (const p of profiles ?? []) nameMap.set(p.id, p.full_name);
      return (timers ?? []).map((t) => ({
        user_id: t.user_id,
        started_at: t.started_at,
        name: nameMap.get(t.user_id) ?? "Unnamed",
      }));
    },
  });

  // A per-second ticker so the live durations count up smoothly.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeById = useMemo(() => {
    const map = new Map<string, number>(); // user_id -> started_at ms
    for (const t of activeQuery.data ?? []) {
      map.set(t.user_id, new Date(t.started_at).getTime());
    }
    return map;
  }, [activeQuery.data]);

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

  /** Active time window in ms (or null for "all time") */
  const timeWindow = useMemo<{ start: number | null; end: number | null }>(() => {
    if (customStart && customEnd) {
      const s = new Date(`${customStart}T00:00:00`);
      const e = new Date(`${customEnd}T23:59:59.999`);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s.getTime() <= e.getTime()) {
        return { start: s.getTime(), end: e.getTime() };
      }
    }
    if (rangeDays !== null) {
      const end = Date.now();
      const start = end - rangeDays * 24 * 60 * 60 * 1000;
      return { start, end };
    }
    return { start: null, end: null };
  }, [rangeDays, customStart, customEnd]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (selectedUser && s.user_id !== selectedUser) return false;
      if (timeWindow.start !== null || timeWindow.end !== null) {
        const stoppedAt = new Date(s.stopped_at).getTime();
        if (timeWindow.start !== null && stoppedAt < timeWindow.start) return false;
        if (timeWindow.end !== null && stoppedAt > timeWindow.end) return false;
      }
      if (!term) return true;
      return (
        s.title.toLowerCase().includes(term) ||
        (s.description ?? "").toLowerCase().includes(term) ||
        (s.profiles?.full_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [sessions, selectedUser, search, timeWindow]);

  const analytics = useMemo(() => {
    const total = filtered.length;
    const totalSeconds = filtered.reduce((sum, s) => sum + s.duration_seconds, 0);
    return { total, totalSeconds };
  }, [filtered]);

  const activePerson = people.find((p) => p.id === selectedUser) ?? null;
  const hasAnyFilter =
    !!selectedUser || rangeDays !== null || (!!customStart && !!customEnd) || !!search.trim();

  function clearAllFilters() {
    setSelectedUser(null);
    setSearch("");
    setRangeDays(null);
    setCustomStart("");
    setCustomEnd("");
  }

  function applyPreset(days: number) {
    setRangeDays(days);
    setCustomStart("");
    setCustomEnd("");
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Work history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Completed sessions people chose to share, newest first.
        </p>

        {/* LIVE NOW — anyone whose timer is running right now */}
        {activeQuery.data && activeQuery.data.length > 0 && (
          <section className="mt-6 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              <Radio className="size-3.5 animate-pulse" />
              Live now
              <span className="ml-1 font-mono text-emerald-700/70 dark:text-emerald-400/70">
                {activeQuery.data.length} working
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              {activeQuery.data.map((t) => {
                const elapsed = Math.max(
                  0,
                  Math.floor((now - new Date(t.started_at).getTime()) / 1000),
                );
                return (
                  <div key={t.user_id} className="flex flex-col items-center gap-1.5">
                    <div className="relative">
                      <span className="grid size-12 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                        {initials(t.name)}
                      </span>
                      {/* Solid green online dot at the bottom-right of the avatar */}
                      <span className="absolute bottom-0 right-0 grid size-4 place-items-center">
                        <span className="absolute inline-flex size-4 animate-ping rounded-full bg-emerald-500/40" />
                        <span className="relative inline-flex size-3.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                      </span>
                    </div>
                    <p className="max-w-24 truncate text-center text-xs font-medium">{t.name}</p>
                    <p className="font-mono text-[12px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatDuration(elapsed)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* PERSON FILTER */}
        <FilterBlock icon={<UsersIcon className="size-4" />} label="Person">
          <Chip active={selectedUser === null} onClick={() => setSelectedUser(null)}>
            All
          </Chip>
          {people.map((p) => {
            const startedAtMs = activeById.get(p.id);
            const isLive = startedAtMs !== undefined;
            const elapsed = isLive ? Math.max(0, Math.floor((now - startedAtMs) / 1000)) : 0;
            return (
              <div key={p.id} className="flex flex-col items-start gap-1">
                <Chip active={selectedUser === p.id} onClick={() => setSelectedUser(p.id)}>
                  <span className="relative">
                    <span className="grid size-5 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                      {initials(p.name)}
                    </span>
                    {/* Solid green online dot at the bottom-right of the avatar (matches reference image) */}
                    {isLive && (
                      <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center">
                        <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-emerald-500/50" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                      </span>
                    )}
                  </span>
                  {p.name}
                  <span className="font-mono text-[10px] opacity-70">{p.count}</span>
                </Chip>
                {isLive && (
                  <span className="ml-2 inline-flex items-center gap-1 font-mono text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    <span className="inline-flex size-1.5 rounded-full bg-emerald-500" />
                    Working · {formatDuration(elapsed)}
                  </span>
                )}
              </div>
            );
          })}
        </FilterBlock>

        {/* TIME PRESETS */}
        <FilterBlock icon={<Clock className="size-4" />} label="Quick range">
          <Chip
            active={rangeDays === null && !customStart && !customEnd}
            onClick={() => {
              setRangeDays(null);
              setCustomStart("");
              setCustomEnd("");
            }}
          >
            All time
          </Chip>
          {RANGE_PRESETS.map((preset) => (
            <Chip
              key={preset.days}
              active={rangeDays === preset.days && !customStart && !customEnd}
              onClick={() => applyPreset(preset.days)}
            >
              Last {preset.label}
            </Chip>
          ))}
        </FilterBlock>

        {/* CUSTOM DATE RANGE */}
        <FilterBlock icon={<Calendar className="size-4" />} label="Custom date range">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">From</Label>
              <Input
                type="date"
                value={customStart}
                max={customEnd || toDateInputValue(new Date())}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setRangeDays(null);
                }}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">To</Label>
              <Input
                type="date"
                value={customEnd}
                min={customStart}
                max={toDateInputValue(new Date())}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setRangeDays(null);
                }}
                className="h-10 rounded-xl"
              />
            </div>
            {(customStart || customEnd) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCustomStart("");
                  setCustomEnd("");
                }}
                className="h-10 rounded-xl"
              >
                Clear dates
              </Button>
            )}
          </div>
        </FilterBlock>

        {/* SEARCH */}
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles, notes or people"
            className="h-11 rounded-full pl-10"
          />
        </div>

        {/* ANALYTICS SUMMARY */}
        {(hasAnyFilter || filtered.length > 0) && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Analysis {activePerson ? `for ${activePerson.name}` : "of the filtered range"}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {describeRange({ rangeDays, customStart, customEnd })}
                </p>
              </div>
              {hasAnyFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="rounded-full text-xs"
                >
                  Reset all filters
                </Button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={<Clock className="size-4" />}
                label="Total time"
                value={formatDuration(analytics.totalSeconds)}
              />
              <StatTile
                icon={<ListChecks className="size-4" />}
                label="Sessions"
                value={String(analytics.total)}
              />
              <StatTile
                icon={<Clock className="size-4" />}
                label="Average"
                value={analytics.total > 0 ? formatDuration(analytics.avg) : "—"}
              />
              <StatTile
                icon={<UsersIcon className="size-4" />}
                label={activePerson ? "This person" : "Active people"}
                value={activePerson ? "1" : String(analytics.activeUsers)}
              />
            </div>
          </section>
        )}

        {/* RESULTS LIST */}
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
                {hasAnyFilter
                  ? "Try a different search, clear the filters, or widen the date range."
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

/* ---------- helpers ---------- */

function FilterBlock({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {icon} {label}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
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

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1.5 font-mono text-lg font-semibold tnum">{value}</p>
    </div>
  );
}

function describeRange({
  rangeDays,
  customStart,
  customEnd,
}: {
  rangeDays: number | null;
  customStart: string;
  customEnd: string;
}): string {
  if (customStart && customEnd) return `From ${customStart} to ${customEnd}`;
  if (rangeDays !== null) return `Last ${rangeDays} day${rangeDays === 1 ? "" : "s"}`;
  return "All time";
}
