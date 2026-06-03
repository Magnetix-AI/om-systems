import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const INACTIVITY_MS = 60 * 60 * 1000; // 1 hour
const KEY = "fieldops.lastActivity";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Inactivity check on navigation/load
    try {
      const last = Number(localStorage.getItem(KEY) || 0);
      if (last && Date.now() - last > INACTIVITY_MS) {
        await supabase.auth.signOut();
        localStorage.removeItem(KEY);
        throw redirect({ to: "/auth" });
      }
    } catch (e) {
      if ((e as any)?.isRedirect) throw e;
    }
    localStorage.setItem(KEY, String(Date.now()));
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const bump = () => {
      localStorage.setItem(KEY, String(Date.now()));
      schedule();
    };
    const schedule = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(logout, INACTIVITY_MS);
    };
    const logout = async () => {
      await supabase.auth.signOut();
      localStorage.removeItem(KEY);
      toast.info("נותקת עקב חוסר פעילות");
      navigate({ to: "/auth" });
    };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll", "visibilitychange"];
    const onEvt = () => {
      if (document.visibilityState === "visible") {
        const last = Number(localStorage.getItem(KEY) || 0);
        if (last && Date.now() - last > INACTIVITY_MS) return logout();
      }
      bump();
    };
    events.forEach(e => window.addEventListener(e, onEvt, { passive: true }));
    schedule();
    return () => {
      events.forEach(e => window.removeEventListener(e, onEvt));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [navigate]);

  return <Outlet />;
}
