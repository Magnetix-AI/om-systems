import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProjectPicker } from "@/components/project-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { statusLabel, statusColor } from "@/components/app-shell";
import { Plus, Briefcase, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { deleteJobsCascade } from "@/lib/admin-deletes";
import { AdminEditItemDialog, EditItem } from "@/components/admin-edit-item-dialog";


export const Route = createFileRoute("/_authenticated/admin/jobs/")({
  ssr: false,
  component: AdminJobs,
});

function AdminJobs() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);
  const [editItem, setEditItem] = useState<EditItem | null>(null);

  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [technicianFilter, setTechnicianFilter] = useState<string>("__all");
  const [clientFilter, setClientFilter] = useState<string>("__all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, status, scheduled_date, created_at, technician_id, client_id, client:clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const techIds = Array.from(new Set((data ?? []).map((j: any) => j.technician_id).filter(Boolean)));
      let techMap: Record<string, string> = {};
      if (techIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", techIds);
        techMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return (data ?? []).map((j: any) => ({ ...j, technician_name: j.technician_id ? techMap[j.technician_id] : null }));
    },
  });

  const technicianOptions = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((j: any) => { if (j.technician_id && j.technician_name) map.set(j.technician_id, j.technician_name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [jobs]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((j: any) => { if (j.client_id && j.client?.name) map.set(j.client_id, j.client.name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [jobs]);

  const isUnscheduledJob = (j: any) => !j.scheduled_date || !j.technician_id;

  const filteredJobs = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : null;
    const rows = jobs.filter((j: any) => {
      if (showUnscheduled && !isUnscheduledJob(j)) return false;
      if (technicianFilter !== "__all") {
        if (technicianFilter === "__none" ? j.technician_id : j.technician_id !== technicianFilter) return false;
      }
      if (clientFilter !== "__all" && j.client_id !== clientFilter) return false;
      const d = j.scheduled_date ?? j.created_at;
      if (!d) return !fromMs && !toMs;
      const t = new Date(d).getTime();
      if (fromMs && t < fromMs) return false;
      if (toMs && t >= toMs) return false;
      return true;
    });
    return rows.sort((a: any, b: any) => {
      const ta = a.scheduled_date ? new Date(a.scheduled_date).getTime() : null;
      const tb = b.scheduled_date ? new Date(b.scheduled_date).getTime() : null;
      if (ta === null && tb === null) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (ta === null) return 1;
      if (tb === null) return -1;
      return sortDir === "desc" ? tb - ta : ta - tb;
    });
  }, [jobs, technicianFilter, clientFilter, dateFrom, dateTo, sortDir, showUnscheduled]);


  const counts = {
    open: filteredJobs.filter((j: any) => j.status === "open").length,
    in_progress: filteredJobs.filter((j: any) => j.status === "in_progress").length,
    completed: filteredJobs.filter((j: any) => j.status === "completed").length,
  };

  const resetFilters = () => {
    setSortDir("desc"); setTechnicianFilter("__all"); setClientFilter("__all"); setDateFrom(""); setDateTo("");
  };


  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">ניהול קריאות</h1>
          <p className="text-sm text-muted-foreground">צפייה ושיוך של כל הקריאות במערכת</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 ml-1" /> קריאה חדשה</Button>
          </DialogTrigger>
          <NewJobDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-jobs"] }); }} />
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="פתוחות" value={counts.open} tone="warning" />
        <StatCard label="בטיפול" value={counts.in_progress} tone="primary" />
        <StatCard label="הושלמו" value={counts.completed} tone="success" />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>כל הקריאות</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">מיון תאריך</Label>
              <Select value={sortDir} onValueChange={(v: "desc" | "asc") => setSortDir(v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">מהחדש לישן</SelectItem>
                  <SelectItem value="asc">מהישן לחדש</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">טכנאי</Label>
              <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">כל הטכנאים</SelectItem>
                  <SelectItem value="__none">לא משויך</SelectItem>
                  {technicianOptions.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">לקוח</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">כל הלקוחות</SelectItem>
                  {clientOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מתאריך</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">עד תאריך</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
            </div>
            {(technicianFilter !== "__all" || clientFilter !== "__all" || dateFrom || dateTo || sortDir !== "desc") && (
              <Button variant="outline" size="sm" onClick={resetFilters}>איפוס</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
              <Briefcase className="h-8 w-8 opacity-40" />
              <p>אין קריאות התואמות לסינון.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">כותרת</TableHead>
                  <TableHead className="text-right">לקוח</TableHead>
                  <TableHead className="text-right">טכנאי</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead></TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((j: any) => (

                  <TableRow key={j.id}>
                    <TableCell className="font-medium">
                      <Link to="/admin/jobs/$jobId" params={{ jobId: j.id }} className="hover:underline text-primary">
                        {j.title}
                      </Link>
                    </TableCell>
                    <TableCell>{j.client?.name ?? "—"}</TableCell>
                    <TableCell>{j.technician_name ?? <span className="text-muted-foreground">לא משויך</span>}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor(j.status)}>{statusLabel(j.status)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {j.scheduled_date ? new Date(j.scheduled_date).toLocaleDateString("he-IL") : "—"}
                    </TableCell>
                    <TableCell>
                      <AssignTechnician job={j} onChange={() => qc.invalidateQueries({ queryKey: ["admin-jobs"] })} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary"
                        onClick={() => setEditItem({ kind: "job", id: j.id })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                        onClick={() => setToDelete({ id: j.id, title: j.title })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק קריאה?</AlertDialogTitle>
            <AlertDialogDescription>
              הקריאה "{toDelete?.title}" וכל הפריטים המשויכים אליה יימחקו לצמיתות. לא ניתן לבטל.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await deleteJobsCascade([toDelete.id]);
                  toast.success("נמחק");
                  qc.invalidateQueries({ queryKey: ["admin-jobs"] });
                } catch (e: any) {
                  toast.error("שגיאה במחיקה", { description: e.message });
                } finally {
                  setToDelete(null);
                }
              }}
            >מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminEditItemDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        invalidateKeys={[["admin-jobs"]]}
      />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "warning" | "primary" | "success" }) {
  const colors = {
    warning: "bg-warning/10 text-warning-foreground border-warning/30",
    primary: "bg-primary/10 text-primary border-primary/30",
    success: "bg-success/10 text-success border-success/30",
  };
  return (
    <Card className={colors[tone]}>
      <CardContent className="p-5">
        <div className="text-sm font-medium opacity-80">{label}</div>
        <div className="text-3xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function AssignTechnician({ job, onChange }: { job: any; onChange: () => void }) {
  const { data: techs = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "technician");
      const ids = (roles ?? []).map(r => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, color").in("id", ids);
      return data ?? [];
    },
  });

  const handleAssign = async (val: string) => {
    const technician_id = val === "__none" ? null : val;
    const { error } = await supabase.from("jobs").update({ technician_id }).eq("id", job.id);
    if (error) return toast.error("שגיאה בשיוך", { description: error.message });
    toast.success("שויך בהצלחה");
    onChange();
  };

  return (
    <Select value={job.technician_id ?? "__none"} onValueChange={handleAssign}>
      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">— לא משויך —</SelectItem>
        {techs.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function NewJobDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [techId, setTechId] = useState<string>("__none");
  const [scheduled, setScheduled] = useState("");
  const [endAt, setEndAt] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientContact, setNewClientContact] = useState("");
  const [useNewClient, setUseNewClient] = useState(false);
  const [siteContactName, setSiteContactName] = useState("");
  const [siteContactPhone, setSiteContactPhone] = useState("");
  const [siteContactAddress, setSiteContactAddress] = useState("");
  const [linkProject, setLinkProject] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const { data: techs = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "technician");
      const ids = (roles ?? []).map(r => r.user_id);
      if (!ids.length) return [];
      return (await supabase.from("profiles").select("id, full_name, color").in("id", ids)).data ?? [];
    },
  });

  const handleCreate = async () => {
    setSaving(true);
    try {
      let cid: string | null = clientId || null;
      if (useNewClient && newClientName) {
        const { data, error } = await supabase.from("clients")
          .insert({ name: newClientName })
          .select("id").single();
        if (error) throw error;
        cid = data.id;
      }
      const startIso = scheduled ? new Date(scheduled).toISOString() : null;
      const endIso = endAt ? new Date(endAt).toISOString() : null;
      const { data: created, error } = await supabase.from("jobs").insert({
        title, description,
        client_id: cid,
        technician_id: techId === "__none" ? null : techId,
        scheduled_date: startIso,
        start_time: startIso,
        end_time: endIso,
        site_contact_name: siteContactName.trim() || null,
        site_contact_phone: siteContactPhone.trim() || null,
        site_contact_address: siteContactAddress.trim() || null,
        project_id: linkProject ? projectId : null,
      }).select("id").single();
      if (error) throw error;
      toast.success("נוצרה קריאה — כעת ניתן להעלות תמונות");
      onClose();
      if (created?.id) navigate({ to: "/admin/jobs/$jobId", params: { jobId: created.id } });
    } catch (e: any) {
      toast.error("שגיאה ביצירה", { description: e.message });
    } finally { setSaving(false); }
  };

  return (
    <DialogContent dir="rtl" className="max-w-lg">
      <DialogHeader><DialogTitle>קריאה חדשה</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>כותרת</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="לדוגמה: התקנת מצלמות אבטחה" />
        </div>
        <div className="space-y-1.5">
          <Label>תיאור</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="newClient" checked={useNewClient} onChange={e => setUseNewClient(e.target.checked)} />
          <Label htmlFor="newClient" className="cursor-pointer">לקוח חדש</Label>
        </div>
        {useNewClient ? (
          <div className="space-y-2 border rounded-md p-3 bg-muted/30">
            <Input placeholder="שם לקוח" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>לקוח קיים</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
              <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2 border rounded-md p-3 bg-secondary/20">
          <Label className="font-semibold">איש קשר בשטח</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="שם" value={siteContactName} onChange={e => setSiteContactName(e.target.value)} />
            <Input placeholder="טלפון (לחיוג מהיר)" value={siteContactPhone} onChange={e => setSiteContactPhone(e.target.value)} dir="ltr" />
          </div>
          <Input placeholder="כתובת" value={siteContactAddress} onChange={e => setSiteContactAddress(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Checkbox id="linkProject" checked={linkProject} onCheckedChange={(c) => { setLinkProject(!!c); if (!c) setProjectId(null); }} />
            <Label htmlFor="linkProject" className="cursor-pointer">שייך לפרוייקט</Label>
          </div>
          {linkProject && <ProjectPicker value={projectId} onChange={setProjectId} />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>טכנאי משויך</Label>
            <Select value={techId} onValueChange={setTechId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">לא משויך</SelectItem>
                {techs.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>תחילת קריאה</Label>
            <Input type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>סיום קריאה</Label>
            <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleCreate} disabled={!title || saving}>{saving ? "שומר..." : "צור קריאה"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
