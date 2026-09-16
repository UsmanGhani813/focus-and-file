import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Timer, ShieldCheck, Paperclip } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tempo — Track work time with proof" },
      {
        name: "description",
        content:
          "Start a timer, log what you worked on, attach your evidence and share a public work history. Free time tracking for teams and freelancers.",
      },
      { property: "og:title", content: "Tempo — Track work time with proof" },
      {
        property: "og:description",
        content:
          "Start a timer, log what you worked on, attach your evidence and share a public work history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/dashboard", replace: true });
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="animate-rise mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Work timer &amp; evidence log
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Start the clock. Log the work. Prove it.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
            Tempo times your work down to the second, then asks what you did and lets you attach the
            files that back it up. Nothing is lost on a refresh.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full rounded-full px-8 sm:w-auto">
              <Link to="/auth" search={{ mode: "register" }}>
                Register yourself
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full rounded-full px-8 sm:w-auto"
            >
              <Link to="/auth" search={{ mode: "login" }}>
                Log in
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          <Feature
            icon={<Timer className="size-5" />}
            title="Timestamp-based timer"
            body="Elapsed time is calculated from the stored start time, so refreshing or reopening your browser never loses a running session."
          />
          <Feature
            icon={<Paperclip className="size-5" />}
            title="Evidence attached"
            body="Attach screenshots, PDFs, spreadsheets and archives to each completed session before you submit it."
          />
          <Feature
            icon={<ShieldCheck className="size-5" />}
            title="You choose what's public"
            body="Every session has a visibility switch. Public work shows up in the shared history; private work stays yours."
          />
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          Just browsing?{" "}
          <Link to="/history" className="font-medium text-primary underline-offset-4 hover:underline">
            Explore the public work history
          </Link>
        </p>
      </main>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">{icon}</span>
      <h2 className="mt-4 text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
