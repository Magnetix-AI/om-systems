import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Cable, ScanFace, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getStoredFaceCred,
  isFaceAuthSupported,
  registerFaceCred,
  verifyFaceCred,
} from "@/lib/face-auth";


export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

// Admin credentials are NOT stored client-side. Admins sign in with their
// own email/password; the `admin` role is granted server-side via the
// `user_roles` table and enforced by RLS / `has_role()`.

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  const [faceLoading, setFaceLoading] = useState(false);
  const [faceSetupOpen, setFaceSetupOpen] = useState(false);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);
  const faceSupported = typeof window !== "undefined" && isFaceAuthSupported();
  const hasFaceCred = typeof window !== "undefined" && !!getStoredFaceCred();

  const finishLogin = () => {
    toast.success("התחברת בהצלחה");
    navigate({ to: "/" });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error("שגיאה בהתחברות", { description: error.message });
    // First successful login on this device → offer Face ID setup
    if (faceSupported && !hasFaceCred) {
      setPendingCreds({ email, password });
      setFaceSetupOpen(true);
      return;
    }
    finishLogin();
  };

  const handleFaceLogin = async () => {
    setFaceLoading(true);
    try {
      const { email: e2, password: p2 } = await verifyFaceCred();
      const { error } = await supabase.auth.signInWithPassword({ email: e2, password: p2 });
      if (error) throw new Error(error.message);
      finishLogin();
    } catch (err: any) {
      toast.error("כניסה עם זיהוי פנים נכשלה", { description: err.message });
    } finally {
      setFaceLoading(false);
    }
  };

  const handleEnableFace = async () => {
    if (!pendingCreds) return;
    setFaceLoading(true);
    try {
      await registerFaceCred(pendingCreds.email, pendingCreds.password);
      toast.success("זיהוי פנים הופעל בהצלחה");
      setFaceSetupOpen(false);
      finishLogin();
    } catch (err: any) {
      toast.error("הגדרת זיהוי פנים נכשלה", { description: err.message });
    } finally {
      setFaceLoading(false);
    }
  };

  const skipFaceSetup = () => {
    setFaceSetupOpen(false);
    finishLogin();
  };


  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role: "technician" }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) return toast.error("שגיאה בהרשמה", { description: error.message });
    toast.success("נרשמת בהצלחה כטכנאי");
    navigate({ to: "/" });
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: adminUser,
      password: adminPass,
    });
    if (error || !signInData.user) {
      setAdminLoading(false);
      return toast.error("שגיאה בהתחברות מנהל", { description: error?.message });
    }
    // Verify admin role server-side via user_roles (RLS enforced).
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", signInData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    setAdminLoading(false);
    if (!roleRow) {
      await supabase.auth.signOut();
      return toast.error("חשבון זה אינו חשבון מנהל");
    }
    toast.success("התחברת כמנהל");
    setAdminOpen(false);
    navigate({ to: "/" });
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
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">התחברות</TabsTrigger>
              <TabsTrigger value="signup">הרשמה</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">דוא״ל</Label>
                  <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">סיסמה</Label>
                  <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "מתחבר..." : "התחבר כטכנאי"}
                </Button>
                {faceSupported && hasFaceCred && (
                  <button
                    type="button"
                    onClick={handleFaceLogin}
                    disabled={faceLoading}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <ScanFace className="h-3.5 w-3.5" />
                    {faceLoading ? "מאמת..." : "כניסה עם זיהוי פנים"}
                  </button>
                )}
              </form>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">או</span></div>
              </div>
              <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setAdminOpen(true)}>
                <ShieldCheck className="h-4 w-4" />
                כניסה למערכת כאדמין
              </Button>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground text-center">
                  הרשמה מיועדת לטכנאים בלבד
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">שם מלא</Label>
                  <Input id="name" required value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">דוא״ל</Label>
                  <Input id="email2" type="email" required value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">סיסמה</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "נרשם..." : "צור חשבון טכנאי"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-right">כניסת מנהל</DialogTitle>
            <DialogDescription className="text-right">הזן דוא״ל וסיסמה של חשבון מנהל</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminUser">דוא״ל</Label>
              <Input id="adminUser" type="email" required value={adminUser} onChange={e => setAdminUser(e.target.value)} dir="ltr" autoFocus />
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

      <Dialog open={faceSetupOpen} onOpenChange={(o) => { if (!o) skipFaceSetup(); }}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <ScanFace className="h-5 w-5" /> הפעלת זיהוי פנים
            </DialogTitle>
            <DialogDescription className="text-right">
              להפעלת כניסה מהירה במכשיר זה באמצעות זיהוי פנים / טביעת אצבע. בכניסות הבאות לא תידרש להזין סיסמה.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleEnableFace} disabled={faceLoading}>
              {faceLoading ? "מגדיר..." : "הפעל זיהוי פנים"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={skipFaceSetup} disabled={faceLoading}>
              דלג
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

