import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Cable, ScanFace, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getStoredFaceCred,
  isFaceAuthSupported,
  registerFaceCred,
  verifyFaceCred,
} from "@/lib/face-auth";
import { adminLogin } from "@/lib/admin-auth.functions";


const PENDING_FACE_KEY = "fieldops.pendingFaceFlow";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    // While the face setup/verify dialog is pending we must NOT redirect away
    // even though a session exists — otherwise the dialog disappears instantly.
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(PENDING_FACE_KEY)) return;
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
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const adminLoginFn = useServerFn(adminLogin);

  const [faceLoading, setFaceLoading] = useState(false);
  const [faceSetupOpen, setFaceSetupOpen] = useState(false);
  const [faceVerifyOpen, setFaceVerifyOpen] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);
  const faceSupported = typeof window !== "undefined" && isFaceAuthSupported();
  const hasFaceCred = typeof window !== "undefined" && !!getStoredFaceCred();

  const finishLogin = () => {
    try { sessionStorage.removeItem(PENDING_FACE_KEY); } catch { /* ignore */ }
    toast.success("התחברת בהצלחה");
    navigate({ to: "/" });
  };

  const runFaceVerify = async () => {
    setFaceLoading(true);
    setFaceError(null);
    try {
      await verifyFaceCred();
      setFaceVerifyOpen(false);
      finishLogin();
    } catch (err: any) {
      setFaceError(err?.message || "האימות נכשל");
    } finally {
      setFaceLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const id = email.trim();
    // Allow login via plain username — auto-map to internal email domain.
    const loginEmail = id.includes("@") ? id : `${id.toLowerCase()}@om-tech.local`;
    const stored = getStoredFaceCred();
    // Mark the face flow as pending BEFORE creating the session, so the
    // auth-route beforeLoad doesn't redirect us away when onAuthStateChange
    // invalidates the router.
    const willNeedFaceFlow = faceSupported && (!stored || stored.email === loginEmail);
    if (willNeedFaceFlow) {
      try { sessionStorage.setItem(PENDING_FACE_KEY, "1"); } catch { /* ignore */ }
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setLoading(false);
    if (error) {
      try { sessionStorage.removeItem(PENDING_FACE_KEY); } catch { /* ignore */ }
      return toast.error("שגיאה בהתחברות", { description: error.message });
    }
    if (faceSupported && stored && stored.email === loginEmail) {
      // Mandatory second factor: verify face for this device's enrolled user.
      setFaceVerifyOpen(true);
      setTimeout(() => { runFaceVerify(); }, 200);
      return;
    }
    if (faceSupported && !stored) {
      setPendingCreds({ email: loginEmail, password });
      setFaceSetupOpen(true);
      return;
    }
    finishLogin();
  };


  const handleFaceLogin = async () => {
    setFaceLoading(true);
    try {
      // verifyFaceCred() internally refreshes the Supabase session via a
      // stored refresh token — no password is involved.
      await verifyFaceCred();
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


  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    try {
      // Server validates username+password against env secrets and returns
      // a real Supabase session for the admin account. Nothing sensitive
      // lives in the client bundle.
      const result = await adminLoginFn({
        data: { username: adminUser, password: adminPass },
      });
      if (!result.ok) {
        toast.error("שגיאה בהתחברות מנהל", { description: result.error });
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (error) throw new Error(error.message);
      toast.success("התחברת כמנהל");
      setAdminOpen(false);
      navigate({ to: "/" });
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

      <Dialog open={faceSetupOpen} onOpenChange={() => { /* mandatory — cannot dismiss */ }}>
        <DialogContent dir="rtl" className="sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <ScanFace className="h-5 w-5" /> הגדרת זיהוי פנים
            </DialogTitle>
            <DialogDescription className="text-right">
              בכניסה הראשונית למערכת חובה להגדיר זיהוי פנים / טביעת אצבע במכשיר זה. בכניסות הבאות יידרש אימות ביומטרי נוסף לאחר הסיסמה.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleEnableFace} disabled={faceLoading}>
              {faceLoading ? "מגדיר..." : "הפעל זיהוי פנים"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={faceLoading}
              onClick={async () => {
                try { sessionStorage.removeItem(PENDING_FACE_KEY); } catch { /* ignore */ }
                await supabase.auth.signOut();
                setFaceSetupOpen(false);
                setPendingCreds(null);
                toast.info("ההגדרה בוטלה");
              }}
            >
              ביטול
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={faceVerifyOpen} onOpenChange={() => { /* mandatory — cannot dismiss */ }}>
        <DialogContent dir="rtl" className="sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <ScanFace className="h-5 w-5" /> אימות זיהוי פנים
            </DialogTitle>
            <DialogDescription className="text-right">
              שלב אבטחה נוסף: יש לאמת את זהותך באמצעות זיהוי פנים / טביעת אצבע במכשיר זה.
            </DialogDescription>
          </DialogHeader>
          {faceError && (
            <p className="text-sm text-destructive text-right">{faceError}</p>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={runFaceVerify} disabled={faceLoading}>
              {faceLoading ? "מאמת..." : faceError ? "נסה שוב" : "אמת זיהוי פנים"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={faceLoading}
              onClick={async () => {
                try { sessionStorage.removeItem(PENDING_FACE_KEY); } catch { /* ignore */ }
                await supabase.auth.signOut();
                setFaceVerifyOpen(false);
                setFaceError(null);
                toast.info("האימות בוטל");
              }}
            >
              ביטול
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

  );
}

