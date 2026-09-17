import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Approval gate: pending users can't reach the dashboard, declined users can't either.
    const { data: profile } = await supabase
      .from("profiles")
      .select("approval_status")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.approval_status === "pending") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { status: "pending" } });
    }
    if (profile?.approval_status === "declined") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { status: "declined" } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
