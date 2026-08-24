import { Link, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Cable, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { PushNotificationsToggle } from "@/components/push-notifications-toggle";
import { unregisterPushOnLogout } from "@/hooks/use-push-notifications";

export function AppShell({ children, nav }: { children?: ReactNode; nav?: ReactNode }) {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const router = useRouter();

  const handleLogout = async () => {
    try { localStorage.removeItem("admin_session_started_at"); } catch {}
    await unregisterPushOnLogout();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <header className="border-b bg-card sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="h-8 w-8 rounded-lg bg-[var(--gradient-primary)] grid place-items-center text-primary-foreground">
              <Cable className="h-4 w-4" />
            </div>
            <span>O.M Systems LTD</span>
          </Link>
          <div className="flex-1">{nav}</div>
          <div className="flex items-center gap-3">
            <div className="text-sm hidden sm:block">
              <div className="font-medium">{user?.fullName}</div>
              <div className="text-xs text-muted-foreground">
                {user?.role === "admin" ? "מנהל" : "טכנאי"}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="התנתק">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children ?? <Outlet />}</main>
    </div>
  );
}

export const statusLabel = (s: string) =>
  s === "open" ? "פתוחה" : s === "in_progress" ? "בטיפול" : s === "completed" ? "הושלמה" : s;

export const statusColor = (s: string) =>
  s === "open" ? "bg-warning/15 text-warning-foreground border-warning/40"
  : s === "in_progress" ? "bg-primary/10 text-primary border-primary/30"
  : "bg-success/15 text-success border-success/30";
