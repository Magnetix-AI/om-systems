import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FolderKanban, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/projects/")({
  ssr: false,
  component: AdminProjects,
});

function AdminProjects() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, status, start_date, created_at, technician_id, client:clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const techIds = Array.from(new Set((data ?? []).map((p: any) => p.technician_id).filter(Boolean)));
      let techMap: Record<string, string> = {};
      if (techIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", techIds);
        techMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return (data ?? []).map((p: any) => ({ ...p, technician_name: p.technician_id ? techMap[p.technician_id] : null }));
    },
  });

  const openCount = projects.filter((p: any) => p.status === "open").length;
  const closedCount = projects.filter((p: any) => p.status === "closed").length;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">פרוייקטים</h1>
          <p className="text-sm text-muted-foreground">פרוייקטים ארוכי טווח. רק אדמין סוגר פרוייקט.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-1" /> פרוייקט חדש</Button></DialogTrigger>
          <NewProjectDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-projects"] }); }} />
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-5"><div className="text-sm opacity-80">פרוייקטים פעילים</div><div className="text-3xl font-bold mt-1">{openCount}</div></CardContent>
        </Card>
        <Card className="bg-success/10 border-success/30">
          <CardContent className="p-5"><div className="text-sm opacity-80">פרוייקטים שנסגרו</div><div className="text-3xl font-bold mt-1">{closedCount}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>כל הפרוייקטים</CardTitle></CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
              <FolderKanban className="h-8 w-8 opacity-40" />
              <p>אין פרוייקטים עדיין.</p>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-right">שם פרוייקט</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">טכנאי</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">תאריך התחלה</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {projects.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>{p.client?.name ?? "—"}</TableCell>
                    <TableCell>{p.technician_name ?? <span className="text-muted-foreground">לא משויך</span>}</TableCell>
                    <TableCell><Badge variant="outline" className={p.status === "open" ? "bg-primary/10 text-primary border-primary/30" : "bg-success/10 text-success border-success/30"}>{p.status === "open" ? "פעיל" : "סגור"}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.start_date ? new Date(p.start_date).toLocaleDateString("he-IL") : "—"}</TableCell>
                    <TableCell>
                      <Link to="/admin/projects/$projectId" params={{ projectId: p.id }}>
                        <Button variant="ghost" size="sm">פתח <ChevronLeft className="h-4 w-4 mr-1" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);

  // New client toggle
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientContact, setNewClientContact] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });

  const handleCreate = async () => {
    setSaving(true);
    try {
      let finalClientId = clientId || null;

      if (isNewClient && newClientName.trim()) {
        const { data: nc, error: ce } = await supabase
          .from("clients")
          .insert({
            name: newClientName.trim(),
            address: newClientAddress.trim() || null,
            contact_name: newClientContact.trim() || null,
          })
          .select("id")
          .single();
        if (ce) throw ce;
        finalClientId = nc.id;
        qc.invalidateQueries({ queryKey: ["clients"] });
      }

      const { data: created, error } = await supabase.from("projects").insert({
        title,
        description,
        client_id: finalClientId,
      }).select("id").single();
      if (error) throw error;
      toast.success("הפרוייקט נוצר");
      onClose();
      if (created?.id) navigate({ to: "/admin/projects/$projectId", params: { projectId: created.id } });
    } catch (e: any) {
      toast.error("שגיאה ביצירה", { description: e.message });
    } finally { setSaving(false); }
  };

  return (
    <DialogContent dir="rtl" className="max-w-lg">
      <DialogHeader><DialogTitle>פרוייקט חדש</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>שם הפרוייקט <span className="text-destructive">*</span></Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="לדוגמה: התקנת תשתית בבניין חדש" />
        </div>
        <div className="space-y-1.5">
          <Label>תיאור</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label>לקוח</Label>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {
                setIsNewClient(!isNewClient);
                setClientId("");
                setNewClientName("");
                setNewClientAddress("");
                setNewClientContact("");
              }}
            >
              {isNewClient ? "בחר מלקוחות קיימים" : "+ לקוח חדש"}
            </Button>
          </div>

          {isNewClient ? (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="שם לקוח *" />
              <Input value={newClientContact} onChange={e => setNewClientContact(e.target.value)} placeholder="איש קשר (אופציונלי)" />
              <Input value={newClientAddress} onChange={e => setNewClientAddress(e.target.value)} placeholder="כתובת" />
            </div>
          ) : (
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
              <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          לאחר היצירה תוכל לשייך לפרוייקט קריאות קיימות, או ליצור קריאות חדשות עם שייוך אליו.
        </p>
      </div>
      <DialogFooter>
        <Button
          onClick={handleCreate}
          disabled={!title || saving || (isNewClient && !newClientName.trim())}
        >
          {saving ? "שומר..." : "צור פרוייקט"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
