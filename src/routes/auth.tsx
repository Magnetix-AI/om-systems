import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Cable, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { adminLogin } from "@/lib/admin-auth.functions";

const ADMIN_SESSION_KEY = "admin_session_started_at";
const LAST_ACTIVITY_KEY = "fieldops.lastActivity";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      throw redirect({ to: roleRow?.role === "admin" ? "/admin" : "/tech" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const adminLoginFn = useServerFn(adminLogin);

  const getPostLoginPath = async (userId: string) => {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    return roleRow?.role === "admin" ? "/admin" : "/tech";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const id = email.trim();
    const loginEmail = id.includes("@") ? id : `${id.toLowerCase()}@om-tech.local`;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) throw error;
      const user = data.user ?? (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("לא נמצאה התחברות פעילה");
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      toast.success("התחברת בהצלחה");
      window.location.replace(await getPostLoginPath(user.id));
    } catch (err: any) {
      setLoading(false);
      toast.error("שגיאה בהתחברות", { description: err?.message });
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    try {
      const result = await adminLoginFn({
        data: { username: adminUser, password: adminPass },
      });
      if (!result.ok) {
        toast.error("שגיאה בהתחברות מנהל", { description: result.error });
        return;
      }
      const { data: sessionData, error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (error) throw new Error(error.message);
      const user = sessionData.user ?? (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("לא נמצאה התחברות פעילה");
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      localStorage.setItem(ADMIN_SESSION_KEY, String(Date.now()));
      toast.success("התחברת כמנהל");
      setAdminOpen(false);
      window.location.replace(await getPostLoginPath(user.id));
    } catch (err: any) {
      toast.error("שגיאה בהתחברות מנהל", { description: err?.message });
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-secondary p-4" dir="rtl">
      <Card className="w-full max-w-md shadow-[var(--shadow-elevated)]">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-[var(--gradient-primary)] grid place-items-center text-primary-foreground">
            <Cable className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">O.M Systems LTD</CardTitle>
          <CardDescription>מערכת לניהול קריאות שירות — מתח נמוך ותקשורת</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email">דוא״ל / שם משתמש</Label>
              <Input
                id="email"
                type="text"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                dir="ltr"
                placeholder="username או email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "מתחבר..." : "התחבר כטכנאי"}
            </Button>
          </form>
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">או</span></div>
          </div>
          <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setAdminOpen(true)}>
            <ShieldCheck className="h-4 w-4" />
            כניסה למערכת כאדמין
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            אין אפשרות להרשמה עצמית. טכנאים מתווספים על ידי מנהל המערכת בלבד.
          </p>
        </CardContent>
      </Card>

      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-right">כניסת מנהל</DialogTitle>
            <DialogDescription className="text-right">הזן שם משתמש וסיסמה לכניסה לממשק הניהול</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminUser">שם משתמש</Label>
              <Input id="adminUser" required value={adminUser} onChange={e => setAdminUser(e.target.value)} dir="ltr" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPass">סיסמה</Label>
              <Input id="adminPass" type="password" required value={adminPass} onChange={e => setAdminPass(e.target.value)} dir="ltr" />
            </div>
            <Button type="submit" className="w-full" disabled={adminLoading}>
              {adminLoading ? "מתחבר..." : "כניסה כמנהל"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
