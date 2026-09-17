import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, UserRound, ChevronDown, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { initials } from "@/lib/work";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function AppNav() {
  const { user, isAuthenticated } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const name = profile?.full_name || user?.email || "";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src="/logo-mark.png"
            alt="Quorlex Soft"
            className="size-9 rounded-xl object-contain"
            width={36}
            height={36}
          />
          <span className="text-lg font-semibold tracking-tight">Tempo</span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Link
            to={isAuthenticated ? "/dashboard" : "/"}
            className="rounded-full px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-foreground [&.active]:text-background sm:px-3.5"
            activeOptions={{ exact: true }}
          >
            Home
          </Link>
          <Link
            to="/history"
            className="rounded-full px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-foreground [&.active]:text-background sm:px-3.5"
          >
            History
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              aria-label="Admin"
              title="Admin"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-foreground [&.active]:text-background sm:px-3.5"
            >
              <ShieldCheck className="size-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account menu"
                  className="ml-0.5 flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-1 pr-2 transition-colors hover:bg-secondary sm:ml-1 sm:gap-2 sm:pr-2.5"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                    {initials(name)}
                  </span>
                  <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{name}</span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <UserRound className="size-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <ShieldCheck className="size-4" /> Admin panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="ml-1 rounded-full">
              <Link to="/auth">Log in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
