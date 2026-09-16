import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError, initials } from "@/lib/work";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Tempo" },
      { name: "description", content: "View and update your name, email address and phone number." },
      { property: "og:title", content: "Your profile — Tempo" },
      {
        property: "og:description",
        content: "View and update your name, email address and phone number.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email address").max(255),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number is too long")
    .regex(/^[+0-9()\-\s]*$/, "Phone number can only contain digits, spaces, + ( ) and -"),
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const profileQuery = useQuery({
    queryKey: ["my-profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profileQuery.data) {
      setForm({
        full_name: profileQuery.data.full_name ?? "",
        email: profileQuery.data.email ?? user.email ?? "",
        phone: profileQuery.data.phone ?? "",
      });
    }
  }, [profileQuery.data, user.email]);

  const save = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const emailChanged = values.email.toLowerCase() !== (user.email ?? "").toLowerCase();
      if (emailChanged) {
        const { error } = await supabase.auth.updateUser({ email: values.email });
        if (error) throw error;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: values.full_name, email: values.email, phone: values.phone || null })
        .eq("id", user.id);
      if (error) throw error;
      return { emailChanged };
    },
    onSuccess: ({ emailChanged }) => {
      toast.success(
        emailChanged
          ? "Profile saved. Check your new email address to confirm the change."
          : "Profile saved",
      );
      queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["public-sessions"] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save your profile.")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your name appears next to your public work history.
        </p>

        {profileQuery.isLoading ? (
          <Skeleton className="mt-6 h-80 rounded-2xl" />
        ) : (
          <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
                {initials(form.full_name || user.email || "?")}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{form.full_name || "Unnamed"}</p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  maxLength={100}
                />
                {errors["full_name"] && (
                  <p className="text-xs font-medium text-destructive">{errors["full_name"]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  maxLength={255}
                />
                <p className="text-xs text-muted-foreground">
                  Changing this sends a confirmation link to the new address.
                </p>
                {errors["email"] && (
                  <p className="text-xs font-medium text-destructive">{errors["email"]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  maxLength={20}
                />
                {errors["phone"] && (
                  <p className="text-xs font-medium text-destructive">{errors["phone"]}</p>
                )}
              </div>
            </div>

            <Button type="submit" size="lg" disabled={save.isPending} className="mt-6 w-full rounded-full">
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
