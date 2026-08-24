import { createFileRoute, Outlet, Link, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Briefcase, Package, FileText, Users, FolderKanban, History, LayoutDashboard, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ADMIN_SESSION_KEY = "admin_session_started_at";
const ADMIN_MAX_MS = 4 * 60 * 60 * 1000; // 4 hours

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleRow?.role !== "admin") throw redirect({ to: "/tech" });

    if (typeof window !== "undefined" && !isMobileDevice()) {
      const raw = localStorage.getItem(ADMIN_SESSION_KEY);
      const started = raw ? parseInt(raw, 10) : NaN;
      if (!raw || Number.isNaN(started)) {
        localStorage.setItem(ADMIN_SESSION_KEY, String(Date.now()));
      } else if (Date.now() - started >= ADMIN_MAX_MS) {
        localStorage.removeItem(ADMIN_SESSION_KEY);
        await supabase.auth.signOut();
        throw redirect({ to: "/auth" });
      }
    } else if (typeof window !== "undefined") {
      // Mobile: never auto-expire
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  },
  component: AdminLayout,
});


function AdminLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    const started = raw ? parseInt(raw, 10) : Date.now();
    if (!raw) localStorage.setItem(ADMIN_SESSION_KEY, String(started));
    const remaining = Math.max(0, started + ADMIN_MAX_MS - Date.now());
    const logout = async () => {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      toast.warning("חלפו 4 שעות — מבוצע ניתוק אוטומטי");
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    };
    if (remaining === 0) { logout(); return; }
    const t = setTimeout(logout, remaining);
    return () => clearTimeout(t);
  }, [navigate]);


  const tabs = [
    { to: "/admin", label: "ראשי", icon: LayoutDashboard },
    { to: "/admin/jobs", label: "קריאות", icon: Briefcase },
    { to: "/admin/projects", label: "פרוייקטים", icon: FolderKanban },
    { to: "/admin/history", label: "היסטוריה", icon: History },
    { to: "/admin/clients", label: "מאגר לקוחות", icon: Users },
    { to: "/admin/technicians", label: "טכנאים", icon: UserCog },
    { to: "/admin/products", label: "מלאי ומחירון", icon: Package },
    { to: "/admin/reports", label: "דוחות וחיוב", icon: FileText },
  ];
  return (
    <AppShell
      nav={
        <nav className="hidden md:flex gap-1">
          {tabs.map(t => {
            const active = pathname === t.to;
            return (
              <Link
                key={t.to} to={t.to}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                )}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </nav>
      }
    >
      <div className="md:hidden border-b bg-card">
        <div className="flex overflow-x-auto px-2">
          {tabs.map(t => {
            const active = pathname === t.to;
            return (
              <Link key={t.to} to={t.to}
                className={cn("px-3 py-3 text-sm whitespace-nowrap border-b-2",
                  active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground")}>
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      <Outlet />
    </AppShell>
  );
}
