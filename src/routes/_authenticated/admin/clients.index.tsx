import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, ChevronLeft, Users, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  ssr: false,
  component: ClientsList,
});

type Client = {
  id: string;
  name: string;
  contact_name: string | null;
  address: string | null;
  notes: string | null;
};

function ClientsList() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, contact_name, address, notes")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const filtered = clients.filter((c) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      c.name?.toLowerCase().includes(s) ||
      c.contact_name?.toLowerCase().includes(s) ||
      c.address?.toLowerCase().includes(s)
    );
  });

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      const { error } = await supabase.from("clients").delete().eq("id", toDelete.id);
      if (error) throw error;
      toast.success("לקוח נמחק");
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (e: any) {
      toast.error("שגיאה במחיקה", { description: e.message });
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">מאגר לקוחות</h1>
          <p className="text-sm text-muted-foreground">לחץ על לקוח כדי לצפות בהיסטוריית הקריאות</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 ml-1" /> לקוח חדש</Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש לפי שם, איש קשר, כתובת..." className="pr-9" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> {filtered.length} לקוחות</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">טוען...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">לא נמצאו לקוחות</p>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-3 px-2 hover:bg-secondary/50 rounded-md transition-colors">
                  <Link
                    to="/admin/clients/$clientId"
                    params={{ clientId: c.id }}
                    className="flex items-center justify-between gap-3 flex-1 min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[c.contact_name, c.address].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(c)} title="ערוך">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setToDelete(c)} title="מחק">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ClientEditDialog
        client={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-clients"] });
          qc.invalidateQueries({ queryKey: ["clients"] });
          setEditing(null);
        }}
      />
      <ClientEditDialog
        client={null}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-clients"] });
          qc.invalidateQueries({ queryKey: ["clients"] });
          setCreating(false);
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק לקוח?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.name}" יוסר מהמאגר. קריאות ופרוייקטים מקושרים יישארו אך ללא לקוח.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientEditDialog({
  client, open, onClose, onSaved,
}: {
  client: Client | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(client?.name ?? "");
      setContact(client?.contact_name ?? "");
      setAddress(client?.address ?? "");
      setNotes(client?.notes ?? "");
    }
  }, [open, client?.id]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("יש להזין שם לקוח");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        contact_name: contact.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      };
      if (client) {
        const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
        if (error) throw error;
        toast.success("עודכן");
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
        toast.success("נוצר לקוח");
      }
      onSaved();
    } catch (e: any) {
      toast.error("שגיאה בשמירה", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{client ? "עריכת לקוח" : "לקוח חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>שם <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>איש קשר</Label>
            <Input value={contact} onChange={e => setContact(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>כתובת</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "שומר..." : "שמור"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
