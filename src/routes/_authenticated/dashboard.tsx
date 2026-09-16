import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Paperclip, Play, Square, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { WorkDetailDialog } from "@/components/WorkDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BUCKET,
  fileExtension,
  formatBytes,
  formatDateTime,
  formatDuration,
  friendlyError,
  validateFile,
  type WorkSession,
} from "@/lib/work";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Work timer — Tempo" },
      {
        name: "description",
        content: "Start and stop your work timer, then log the session with a title, notes and files.",
      },
      { property: "og:title", content: "Work timer — Tempo" },
      {
        property: "og:description",
        content: "Start and stop your work timer, then log the session with a title, notes and files.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const detailsSchema = z.object({
  title: z.string().trim().min(3, "Give the work a title (at least 3 characters)").max(120),
  description: z.string().trim().max(2000, "Description must be under 2000 characters"),
});

type Stopped = { startedAt: string; stoppedAt: string; durationSeconds: number };

function Dashboard() {
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();
  const [now, setNow] = useState(() => Date.now());
  const [stopped, setStopped] = useState<Stopped | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
  const [detail, setDetail] = useState<WorkSession | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const timerQuery = useQuery({
    queryKey: ["active-timer", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_timers")
        .select("started_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const sessionsQuery = useQuery({
    queryKey: ["my-sessions", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_sessions")
        .select(
          "id, user_id, title, description, started_at, stopped_at, duration_seconds, is_public, created_at, profiles(id, full_name, email, phone, avatar_url), attachments(id, file_name, file_path, file_type, file_size)",
        )
        .eq("user_id", user.id)
        .order("stopped_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as WorkSession[];
    },
  });

  const runningSince = timerQuery.data?.started_at ?? null;

  useEffect(() => {
    if (!runningSince) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningSince]);

  const elapsed = useMemo(() => {
    if (!runningSince) return 0;
    return Math.max(0, Math.floor((now - new Date(runningSince).getTime()) / 1000));
  }, [runningSince, now]);

  const startTimer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("active_timers")
        .upsert({ user_id: user.id, started_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      setStopped(null);
      queryClient.invalidateQueries({ queryKey: ["active-timer", user.id] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't start the timer.")),
  });

  function stopTimer() {
    if (!runningSince) return;
    const stoppedAt = new Date().toISOString();
    const duration = Math.max(
      1,
      Math.round((new Date(stoppedAt).getTime() - new Date(runningSince).getTime()) / 1000),
    );
    setStopped({ startedAt: runningSince, stoppedAt, durationSeconds: duration });
  }

  const submitWork = useMutation({
    mutationFn: async (payload: Stopped & { title: string; description: string; isPublic: boolean }) => {
      const { data: session, error } = await supabase
        .from("work_sessions")
        .insert({
          user_id: user.id,
          title: payload.title,
          description: payload.description || null,
          started_at: payload.startedAt,
          stopped_at: payload.stoppedAt,
          duration_seconds: payload.durationSeconds,
          is_public: payload.isPublic,
        })
        .select("id")
        .single();
      if (error) throw error;

      const failed: string[] = [];
      for (const file of files) {
        const path = `${user.id}/${session.id}/${crypto.randomUUID()}.${fileExtension(file.name)}`;
        const upload = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
        });
        if (upload.error) {
          failed.push(file.name);
          continue;
        }
        const { error: rowError } = await supabase.from("attachments").insert({
          work_session_id: session.id,
          user_id: user.id,
          file_name: file.name,
          file_path: path,
          file_type: file.type || null,
          file_size: file.size,
        });
        if (rowError) failed.push(file.name);
      }

      const { error: clearError } = await supabase.from("active_timers").delete().eq("user_id", user.id);
      if (clearError) throw clearError;
      return { failed };
    },
    onSuccess: ({ failed }) => {
      if (failed.length > 0) {
        toast.warning(`Work saved, but these files failed to upload: ${failed.join(", ")}`);
      } else {
        toast.success("Work submitted");
      }
      setStopped(null);
      setTitle("");
      setDescription("");
      setIsPublic(true);
      setFiles([]);
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ["active-timer", user.id] });
      queryClient.invalidateQueries({ queryKey: ["my-sessions", user.id] });
      queryClient.invalidateQueries({ queryKey: ["public-sessions"] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save this work session.")),
  });

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    const next: File[] = [];
    for (const file of Array.from(selected)) {
      const problem = validateFile(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      next.push(file);
    }
    setFiles((prev) => [...prev, ...next].slice(0, 10));
    if (fileInput.current) fileInput.current.value = "";
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stopped) return;
    const parsed = detailsSchema.safeParse({ title, description });
    if (!parsed.success) {
      const next: { title?: string; description?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "title") next.title = issue.message;
        if (issue.path[0] === "description") next.description = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    submitWork.mutate({ ...stopped, ...parsed.data, isPublic });
  }

  const showForm = !!stopped;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        {/* TIMER */}
        <section className="animate-rise">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            {showForm ? "Session stopped" : runningSince ? "Session running" : "Ready when you are"}
          </p>

          <div className="relative mx-auto mt-6 grid size-[min(78vw,330px)] place-items-center">
            <div
              className={`absolute inset-0 rounded-full border-[6px] ${
                runningSince && !showForm ? "border-accent animate-blink" : "border-border"
              }`}
            />
            {timerQuery.isLoading ? (
              <Skeleton className="size-[78%] rounded-full" />
            ) : showForm ? (
              <div className="grid size-[78%] place-items-center rounded-full bg-card text-center shadow-sm">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Duration
                  </p>
                  <p className="mt-1 font-mono text-4xl font-semibold tracking-tight tnum sm:text-5xl">
                    {formatDuration(stopped.durationSeconds)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Add the details below</p>
                </div>
              </div>
            ) : runningSince ? (
              <button
                onClick={stopTimer}
                className="grid size-[78%] place-items-center rounded-full bg-destructive text-center text-destructive-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
              >
                <div>
                  <p className="font-mono text-4xl font-semibold tracking-tight tnum sm:text-5xl">
                    {formatDuration(elapsed)}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
                    <Square className="size-4" /> Stop
                  </span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => startTimer.mutate()}
                disabled={startTimer.isPending}
                className="grid size-[78%] place-items-center rounded-full bg-primary text-center text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70"
              >
                <div>
                  {startTimer.isPending ? (
                    <Loader2 className="mx-auto size-9 animate-spin" />
                  ) : (
                    <Play className="mx-auto size-9" />
                  )}
                  <span className="mt-3 block text-2xl font-semibold uppercase tracking-[0.2em]">
                    Start
                  </span>
                </div>
              </button>
            )}
          </div>

          <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
            {runningSince
              ? `Started ${formatDateTime(runningSince)}`
              : "Press start when you begin working. A refresh won't lose your session."}
          </p>
        </section>

        {/* COMPLETION FORM */}
        {showForm && (
          <section className="animate-rise mt-12">
            <h2 className="text-lg font-semibold tracking-tight">Complete this session</h2>
            <form
              onSubmit={onSubmit}
              className="mt-4 rounded-2xl border border-border bg-card p-5 sm:p-6"
            >
              <div className="space-y-1.5">
                <Label>
                  Work title <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q1 design system audit"
                  maxLength={120}
                />
                {errors.title && <p className="text-xs font-medium text-destructive">{errors.title}</p>}
              </div>

              <div className="mt-4 space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What did you get done?"
                  maxLength={2000}
                />
                {errors.description && (
                  <p className="text-xs font-medium text-destructive">{errors.description}</p>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <Label>Attachments</Label>
                <div className="flex flex-wrap gap-2">
                  {files.map((file, i) => (
                    <span
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-2 rounded-full border border-border bg-background py-1.5 pl-3 pr-1.5 text-xs"
                    >
                      <span className="max-w-40 truncate font-medium">{file.name}</span>
                      <span className="font-mono text-muted-foreground">{formatBytes(file.size)}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    <Paperclip className="size-3.5" /> Add file
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Images, PDFs, Word, Excel, text and ZIP files · up to 20 MB each
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-secondary p-3">
                <div>
                  <p className="text-sm font-medium">Show in public history</p>
                  <p className="text-xs text-muted-foreground">
                    Off keeps this session visible only to you.
                  </p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStopped(null)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Keep timing instead
                </button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitWork.isPending}
                  className="rounded-full px-8"
                >
                  {submitWork.isPending && <Loader2 className="size-4 animate-spin" />}
                  Submit work
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* RECENT */}
        <section className="mt-14">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Your recent work</h2>
            <Link to="/history" className="text-sm font-medium text-primary hover:underline">
              All history
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {sessionsQuery.isLoading ? (
              <>
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </>
            ) : sessionsQuery.isError ? (
              <ErrorBox onRetry={() => sessionsQuery.refetch()} />
            ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
              sessionsQuery.data.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setDetail(s)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold tracking-tight">{s.title}</h3>
                      {!s.is_public && (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Private
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-1 truncate text-sm text-muted-foreground">{s.description}</p>
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
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <p className="font-medium">No work logged yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Press start above, do your thing, then stop to log it.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <WorkDetailDialog session={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="font-medium">We couldn't load this list</p>
      <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
      <Button variant="outline" onClick={onRetry} className="mt-4 rounded-full">
        Try again
      </Button>
    </div>
  );
}
