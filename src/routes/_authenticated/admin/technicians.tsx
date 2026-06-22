import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  createTechnician, updateTechnician, deleteTechnician, getTechnicianUsername,
} from "@/lib/admin-technicians.functions";

export const Route = createFileRoute("/_authenticated/admin/technicians")({
  ssr: false,
  component: TechniciansAdmin,
});

const DEFAULT_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function TechniciansAdmin() {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const createFn = useServerFn(createTechnician);
  const updateFn = useServerFn(updateTechnician);
  const deleteFn = useServerFn(deleteTechnician);
  const getUsernameFn = useServerFn(getTechnicianUsername);
  const [editingUsername, setEditingUsername] = useState<string>("");

  // Load username when opening edit dialog.
  const openEdit = async (t: any) => {
    setEditing(t);
    setEditingUsername("");
    try {
      const res = await getUsernameFn({ data: { userId: t.id } });
      setEditingUsername(res.username);
    } catch { /* ignore */ }
  };

  const { data: techs = [], isLoading } = useQuery({
    queryKey: ["admin-technicians-list"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "technician");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, color, phone")
        .in("id", ids);
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-technicians-list"] });
    qc.invalidateQueries({ queryKey: ["technicians"] });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" /> ניהול טכנאים
          </h1>
          <p className="text-sm text-muted-foreground">
            הוספה ועריכה של טכנאים. שם המשתמש משמש להתחברות.
          </p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 ml-1" /> טכנאי חדש</Button>
          </DialogTrigger>
          <TechnicianFormDialog
            mode="create"
            onSubmit={async (vals) => {
              await createFn({ data: vals });
              toast.success("טכנאי נוצר בהצלחה");
              invalidate();
              setNewOpen(false);
            }}
          />
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>טכנאים במערכת ({techs.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">טוען...</p>
          ) : techs.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">אין טכנאים. הוסף את הטכנאי הראשון.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">צבע</TableHead>
                  <TableHead className="text-right">שם מלא</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {techs.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="h-6 w-6 rounded-full border" style={{ background: t.color ?? "#94a3b8" }} />
                    </TableCell>
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => setToDelete(t)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <TechnicianFormDialog
            mode="edit"
            initial={{ ...editing, username: editingUsername }}
            onSubmit={async (vals) => {
              await updateFn({
                data: {
                  userId: editing.id,
                  fullName: vals.firstName + " " + vals.lastName,
                  color: vals.color,
                  password: vals.password || undefined,
                  username: vals.username && vals.username !== editingUsername ? vals.username : undefined,
                },
              });
              toast.success("עודכן בהצלחה");
              invalidate();
              setEditing(null);
            }}
          />
        )}
      </Dialog>


      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק טכנאי?</AlertDialogTitle>
            <AlertDialogDescription>
              הטכנאי "{toDelete?.full_name}" יוסר מהמערכת. קריאות שמשויכות אליו יישארו ללא טכנאי.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await deleteFn({ data: { userId: toDelete.id } });
                  toast.success("נמחק");
                  invalidate();
                } catch (e: any) {
                  toast.error("שגיאה במחיקה", { description: e.message });
                } finally { setToDelete(null); }
              }}
            >מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TechnicianFormDialog({
  mode, initial, onSubmit,
}: {
  mode: "create" | "edit";
  initial?: { full_name?: string; color?: string; username?: string };
  onSubmit: (vals: {
    firstName: string; lastName: string; username: string; password: string; color: string;
  }) => Promise<void>;
}) {
  const initFirst = initial?.full_name?.split(" ")[0] ?? "";
  const initLast = initial?.full_name?.split(" ").slice(1).join(" ") ?? "";
  const [firstName, setFirstName] = useState(initFirst);
  const [lastName, setLastName] = useState(initLast);
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  // Sync username when async-loaded for edit mode.
  React.useEffect(() => {
    if (mode === "edit" && initial?.username !== undefined) {
      setUsername(initial.username);
    }
  }, [initial?.username, mode]);

  const submit = async () => {
    if (mode === "create" && (!username || !password || !firstName)) {
      toast.error("מלא שם, שם משתמש וסיסמה");
      return;
    }
    if (mode === "edit" && !username) {
      toast.error("שם משתמש לא יכול להיות ריק");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ firstName, lastName, username, password, color });
    } catch (e: any) {
      toast.error("שגיאה", { description: e.message });
    } finally { setSaving(false); }
  };

  return (
    <DialogContent dir="rtl" className="max-w-md">
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "טכנאי חדש" : "עריכת טכנאי"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>שם פרטי</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>שם משפחה</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>שם משתמש (לכניסה למערכת)</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" placeholder="e.g. yossi" />
          <p className="text-[11px] text-muted-foreground">אותיות באנגלית, ספרות, נקודה/מקף בלבד</p>
        </div>

        <div className="space-y-1.5">
          <Label>{mode === "create" ? "סיסמה" : "סיסמה חדשה (אופציונלי)"}</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label>צבע ביומן</Label>
          <div className="flex gap-2 flex-wrap items-center">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${color === c ? "ring-2 ring-foreground scale-110" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 p-1" />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? "שומר..." : "שמור"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
