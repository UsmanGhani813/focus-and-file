import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  Trash2,
  Users,
  Clock,
  Paperclip,
  Search,
  UserCheck,
  Check,
  X,
  Phone,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTime, formatDuration, friendlyError, initials } from "@/lib/work";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw redirect({ to: "/dashboard" });
    return { user: userData.user };
  },
  head: () => ({
    meta: [
      { title: "Admin panel — Tempo" },
      { name: "description", content: "Manage users, sessions and content." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type AdminUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  session_count: number;
  total_seconds: number;
  is_admin: boolean;
  approval_status: "pending" | "approved" | "declined";
};

type PendingUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

type AdminSession = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  started_at: string;
  stopped_at: string;
  duration_seconds: number;
  is_public: boolean;
  created_at: string;
  profiles: { full_name: string; email: string | null } | null;
  attachments: { id: string; file_name: string; file_path: string }[] | null;
};

function AdminPage() {
  const [tab, setTab] = useState<"pending" | "users" | "sessions">("pending");
  const [search, setSearch] = useState("");

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, sessions, attachments, publicSessions, pending] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("work_sessions").select("id, duration_seconds"),
        supabase.from("attachments").select("id", { count: "exact", head: true }),
        supabase
          .from("work_sessions")
          .select("id", { count: "exact", head: true })
          .eq("is_public", true),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("approval_status", "pending"),
      ]);
      const totalSeconds =
        sessions.data?.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) ?? 0;
      return {
        users: users.count ?? 0,
        sessions: sessions.data?.length ?? 0,
        attachments: attachments.count ?? 0,
        publicSessions: publicSessions.count ?? 0,
        totalSeconds,
        pending: pending.count ?? 0,
      };
    },
  });

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin panel</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview and moderation controls for all Tempo users and sessions.
        </p>

        {/* STATS */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={<UserCheck className="size-4" />}
            label="Pending approvals"
            value={statsQuery.data?.pending ?? "—"}
            loading={statsQuery.isLoading}
            highlight={!!statsQuery.data && statsQuery.data.pending > 0}
          />
          <StatCard
            icon={<Users className="size-4" />}
            label="Users"
            value={statsQuery.data?.users ?? "—"}
            loading={statsQuery.isLoading}
          />
          <StatCard
            icon={<Clock className="size-4" />}
            label="Sessions"
            value={statsQuery.data?.sessions ?? "—"}
            hint={
              statsQuery.data
                ? `${statsQuery.data.publicSessions} public`
                : undefined
            }
            loading={statsQuery.isLoading}
          />
          <StatCard
            icon={<Paperclip className="size-4" />}
            label="Attachments"
            value={statsQuery.data?.attachments ?? "—"}
            loading={statsQuery.isLoading}
          />
          <StatCard
            icon={<Clock className="size-4" />}
            label="Total time"
            value={
              statsQuery.data
                ? formatDuration(statsQuery.data.totalSeconds)
                : "—"
            }
            loading={statsQuery.isLoading}
          />
        </div>

        {/* TABS */}
        <div className="mt-8 flex gap-2 border-b border-border">
          <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
            <span className="inline-flex items-center gap-1.5">
              Pending approvals
              {statsQuery.data && statsQuery.data.pending > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {statsQuery.data.pending}
                </span>
              )}
            </span>
          </TabButton>
          <TabButton active={tab === "users"} onClick={() => setTab("users")}>
            All users
          </TabButton>
          <TabButton active={tab === "sessions"} onClick={() => setTab("sessions")}>
            All sessions
          </TabButton>
        </div>

        {tab !== "pending" && (
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "users" ? "Search users by name or email" : "Search sessions"}
              className="h-11 rounded-full pl-10"
            />
          </div>
        )}

        {tab === "pending" ? (
          <PendingPanel />
        ) : tab === "users" ? (
          <UsersPanel search={search} />
        ) : (
          <SessionsPanel search={search} />
        )}
      </main>
    </div>
  );
}

/* ---------- USERS ---------- */

function UsersPanel({ search }: { search: string }) {
  const queryClient = useQueryClient();
  const [toRemove, setToRemove] = useState<{ id: string; name: string } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profiles, sessions, roles] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, created_at, approval_status")
          .order("created_at", { ascending: false }),
        supabase.from("work_sessions").select("user_id, duration_seconds"),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      ]);
      if (profiles.error) throw profiles.error;

      const sessionMap = new Map<string, { count: number; seconds: number }>();
      for (const s of sessions.data ?? []) {
        const entry = sessionMap.get(s.user_id) ?? { count: 0, seconds: 0 };
        entry.count += 1;
        entry.seconds += s.duration_seconds ?? 0;
        sessionMap.set(s.user_id, entry);
      }
      const adminSet = new Set((roles.data ?? []).map((r) => r.user_id));

      return (profiles.data ?? []).map<AdminUser>((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        created_at: p.created_at,
        session_count: sessionMap.get(p.id)?.count ?? 0,
        total_seconds: sessionMap.get(p.id)?.seconds ?? 0,
        is_admin: adminSet.has(p.id),
        approval_status: p.approval_status,
      }));
    },
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      // Calls a SECURITY DEFINER function on the DB that deletes the auth.users row.
      // The cascade wipes the profile, sessions, attachments, timers and roles.
      const { error } = await supabase.rpc("admin_delete_user", { target_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User fully deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pending"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
      setToRemove(null);
    },
    onError: (e) => toast.error(friendlyError(e, "Couldn't remove user")),
  });

  const filtered = (usersQuery.data ?? []).filter((u) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      u.full_name.toLowerCase().includes(term) ||
      (u.email ?? "").toLowerCase().includes(term)
    );
  });

  if (usersQuery.isLoading) {
    return (
      <div className="mt-4 space-y-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No users match your search.
          </div>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {initials(u.full_name || u.email || "?")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{u.full_name || "Unnamed"}</p>
                  {u.is_admin && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Admin
                    </span>
                  )}
                  {u.approval_status === "pending" && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                      Pending
                    </span>
                  )}
                  {u.approval_status === "declined" && (
                    <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                      Declined
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  Joined {formatDateTime(u.created_at)} · {u.session_count} session
                  {u.session_count === 1 ? "" : "s"} · {formatDuration(u.total_seconds)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setToRemove({ id: u.id, name: u.full_name || u.email || "user" })}
                  disabled={u.is_admin}
                  title={u.is_admin ? "Admins cannot be removed from the panel" : "Remove user"}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={!!toRemove} onOpenChange={(open) => !open && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toRemove?.name} completely?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes their account, profile, work sessions and attachments.
              They will no longer be able to log in. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toRemove && removeUser.mutate(toRemove.id)}
              disabled={removeUser.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeUser.isPending && <Loader2 className="size-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------- SESSIONS ---------- */

function SessionsPanel({ search }: { search: string }) {
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<AdminSession | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_sessions")
        .select(
          "id, user_id, title, description, started_at, stopped_at, duration_seconds, is_public, created_at, profiles(full_name, email), attachments(id, file_name, file_path)",
        )
        .order("stopped_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as AdminSession[];
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      const { error } = await supabase
        .from("work_sessions")
        .update({ is_public: isPublic })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visibility updated");
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["public-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Couldn't update visibility")),
  });

  const deleteSession = useMutation({
    mutationFn: async (session: AdminSession) => {
      // Delete storage files first
      const paths = (session.attachments ?? []).map((a) => a.file_path);
      if (paths.length > 0) {
        await supabase.storage.from("work-evidence").remove(paths);
      }
      // Cascade deletes attachments rows via FK
      const { error } = await supabase.from("work_sessions").delete().eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["public-sessions"] });
      setToDelete(null);
    },
    onError: (e) => toast.error(friendlyError(e, "Couldn't delete session")),
  });

  const filtered = (sessionsQuery.data ?? []).filter((s) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      s.title.toLowerCase().includes(term) ||
      (s.description ?? "").toLowerCase().includes(term) ||
      (s.profiles?.full_name ?? "").toLowerCase().includes(term) ||
      (s.profiles?.email ?? "").toLowerCase().includes(term)
    );
  });

  if (sessionsQuery.isLoading) {
    return (
      <div className="mt-4 space-y-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No sessions match your search.
          </div>
        ) : (
          filtered.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {initials(s.profiles?.full_name ?? "?")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{s.title}</h3>
                  {!s.is_public && (
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Private
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.profiles?.full_name ?? "Unnamed"} · {s.profiles?.email}
                </p>
                {s.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {s.description}
                  </p>
                )}
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {formatDateTime(s.stopped_at)} · {formatDuration(s.duration_seconds)}
                  {s.attachments && s.attachments.length > 0
                    ? ` · ${s.attachments.length} file${s.attachments.length > 1 ? "s" : ""}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-muted-foreground">Public</span>
                  <Switch
                    checked={s.is_public}
                    disabled={toggleVisibility.isPending}
                    onCheckedChange={(isPublic) =>
                      toggleVisibility.mutate({ id: s.id, isPublic })
                    }
                  />
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setToDelete(s)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{toDelete?.title}" and{" "}
              {toDelete?.attachments?.length ?? 0} attached file
              {(toDelete?.attachments?.length ?? 0) === 1 ? "" : "s"}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteSession.mutate(toDelete)}
              disabled={deleteSession.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSession.isPending && <Loader2 className="size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------- PENDING APPROVALS ---------- */

function PendingPanel() {
  const queryClient = useQueryClient();

  const pendingQuery = useQuery({
    queryKey: ["admin-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at")
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingUser[];
    },
  });

  const approve = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ approval_status: "approved", approved_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User approved. They can now log in.");
      queryClient.invalidateQueries({ queryKey: ["admin-pending"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Couldn't approve user")),
  });

  const decline = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ approval_status: "declined" })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User declined. They can no longer log in.");
      queryClient.invalidateQueries({ queryKey: ["admin-pending"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Couldn't decline user")),
  });

  if (pendingQuery.isLoading) {
    return (
      <div className="mt-4 space-y-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const pending = pendingQuery.data ?? [];

  if (pending.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center">
        <UserCheck className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">No pending approvals</p>
        <p className="mt-1 text-sm text-muted-foreground">
          New user registrations that need your review will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {pending.map((u) => {
        const busyThis =
          (approve.isPending && approve.variables === u.id) ||
          (decline.isPending && decline.variables === u.id);
        return (
          <div
            key={u.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-4"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-700">
              {initials(u.full_name || u.email || "?")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{u.full_name || "Unnamed"}</p>
                <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  Awaiting approval
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5" /> {u.email}
                </span>
                {u.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5" /> {u.phone}
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Registered {formatDateTime(u.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={busyThis}
                onClick={() => decline.mutate(u.id)}
              >
                {decline.isPending && decline.variables === u.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4" />
                )}
                Decline
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={busyThis}
                onClick={() => approve.mutate(u.id)}
              >
                {approve.isPending && approve.variables === u.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Approve
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- helpers ---------- */

function StatCard({
  icon,
  label,
  value,
  hint,
  loading,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string | undefined;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-card p-4 ${
        highlight ? "border-destructive/40 bg-destructive/5" : "border-border"
      }`}
    >
      <div
        className={`flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide ${
          highlight ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {icon} {label}
      </div>
      <p
        className={`mt-2 font-mono text-2xl font-semibold tnum ${
          highlight ? "text-destructive" : ""
        }`}
      >
        {loading ? <Skeleton className="h-7 w-16" /> : value}
      </p>
      {hint && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TabButton({
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
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
