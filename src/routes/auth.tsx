import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { friendlyError } from "@/lib/work";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const searchSchema = z.object({
  mode: z.enum(["login", "register"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Log in or register — Tempo" },
      {
        name: "description",
        content: "Create your Tempo account or log in to start tracking work sessions with evidence.",
      },
      { property: "og:title", content: "Log in or register — Tempo" },
      {
        property: "og:description",
        content: "Create your Tempo account or log in to start tracking work sessions with evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email address").max(255),
  phone: z
    .string()
    .trim()
    .min(6, "Please enter a valid phone number")
    .max(20, "Phone number is too long")
    .regex(/^[+0-9()\-\s]+$/, "Phone number can only contain digits, spaces, + ( ) and -"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Please enter your password"),
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(search.mode ?? "login");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/dashboard", replace: true });
  }, [loading, isAuthenticated, navigate]);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (mode === "register") {
      const parsed = registerSchema.safeParse(form);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
        setErrors(fieldErrors);
        return;
      }
      setBusy(true);
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
        },
      });
      setBusy(false);
      if (error) {
        toast.error(friendlyError(error));
        return;
      }
      if (!data.session) {
        toast.success("Account created. Check your email to confirm your address, then log in.");
        setMode("login");
        return;
      }
      toast.success(`Welcome, ${parsed.data.fullName.split(" ")[0]}!`);
      navigate({ to: "/dashboard", replace: true });
      return;
    }

    const parsed = loginSchema.safeParse({ email: form.email, password: form.password });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Timer className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">Tempo</span>
      </Link>

      <div className="animate-rise w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
          <TabsList className="grid w-full grid-cols-2 rounded-full">
            <TabsTrigger value="login" className="rounded-full">
              Login
            </TabsTrigger>
            <TabsTrigger value="register" className="rounded-full">
              Register yourself
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Log in to Tempo" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Pick up where you left off — a running timer will be restored."
            : "A few details and you're timing your first session."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {mode === "register" && (
            <Field label="Full name" error={errors.fullName}>
              <Input
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Maya Reyes"
                autoComplete="name"
                maxLength={100}
              />
            </Field>
          )}

          <Field label="Email" error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              maxLength={255}
            />
          </Field>

          {mode === "register" && (
            <Field label="Phone number" error={errors.phone}>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+1 555 010 2030"
                autoComplete="tel"
                maxLength={20}
              />
            </Field>
          )}

          <Field
            label="Password"
            error={errors.password}
            hint={mode === "register" ? "At least 8 characters." : undefined}
          >
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              maxLength={72}
            />
          </Field>

          <Button type="submit" size="lg" disabled={busy} className="w-full rounded-full">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "login" ? "Log in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setErrors({});
              setMode(mode === "login" ? "register" : "login");
            }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {mode === "login" ? "Register yourself" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
