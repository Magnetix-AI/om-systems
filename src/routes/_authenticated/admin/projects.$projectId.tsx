import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Lock, Unlock, Clock, Briefcase, Plus, X, ChevronLeft } from "lucide-react";
import { AttachmentsManager } from "@/components/attachments-manager";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { statusLabel, statusColor } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/admin/projects/$projectId")({
  ssr: false,
  component: AdminProjectDetail,
});

function fmtTime(ts: string | null) { return ts ? new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—"; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("he-IL") : "—"; }

function AdminProjectDetail() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["admin-project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, client:clients(name, address)")
        .eq("id", projectId).maybeSingle();
      if (error) throw error;
      if (data?.technician_id) {
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", data.technician_id).maybeSingle();
        (data as any).technician_name = prof?.full_name;
      }
      return data;
    },
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["project-visits", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_visits")
        .select("id, visit_date, arrival_time, departure_time, notes, items:project_visit_items(id, quantity, unit_price, product:products(name, unit, price))")
        .eq("project_id", projectId)
        .order("visit_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleStatus = async () => {
    if (!project) return;
    const newStatus = project.status === "open" ? "closed" : "open";
    const { error } = await supabase.from("projects")
      .update({ status: newStatus, closed_at: newStatus === "closed" ? new Date().toISOString() : null })
      .eq("id", project.id);
    if (error) return toast.error("שגיאה", { description: error.message });
    toast.success(newStatus === "closed" ? "הפרוייקט נסגר" : "הפרוייקט נפתח מחדש");
    qc.invalidateQueries({ queryKey: ["admin-project", projectId] });
    qc.invalidateQueries({ queryKey: ["admin-projects"] });
  };

  if (!project) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;

  const totalAmount = visits.reduce((s: number, v: any) =>
    s + (v.items ?? []).reduce((ss: number, it: any) => ss + Number(it.quantity) * Number(it.unit_price || it.product?.price || 0), 0), 0);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <Link to="/admin/projects" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> חזרה לפרוייקטים
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CardTitle>{project.title}</CardTitle>
              <Badge variant="outline" className={project.status === "open" ? "bg-primary/10 text-primary border-primary/30" : "bg-success/10 text-success border-success/30"}>
                {project.status === "open" ? "פעיל" : "סגור"}
              </Badge>
            </div>
            {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
            <div className="text-sm text-muted-foreground mt-2 space-y-0.5">
              <div>לקוח: {project.client?.name ?? "—"}</div>
              <div>טכנאי: {(project as any).technician_name ?? "לא משויך"}</div>
              <div>תאריך התחלה: {fmtDate(project.start_date)}</div>
              {project.closed_at && <div>נסגר: {new Date(project.closed_at).toLocaleString("he-IL")}</div>}
            </div>
          </div>
          <Button onClick={toggleStatus} variant={project.status === "open" ? "destructive" : "default"}>
            {project.status === "open" ? <><Lock className="h-4 w-4 ml-1" /> סגור פרוייקט</> : <><Unlock className="h-4 w-4 ml-1" /> פתח מחדש</>}
          </Button>
        </CardHeader>
      </Card>

      <AttachmentsManager projectId={projectId} />

      <LinkedJobsCard projectId={projectId} />


      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ימי עבודה ({visits.length})</CardTitle>
          <div className="text-sm">סה"כ ציוד: <span className="font-bold">₪{totalAmount.toFixed(2)}</span></div>
        </CardHeader>
        <CardContent className="space-y-3">
          {visits.length === 0 && <p className="text-center text-muted-foreground py-6">עדיין לא נרשמו ימי עבודה</p>}
          {visits.map((v: any) => {
            const dayTotal = (v.items ?? []).reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.unit_price || it.product?.price || 0), 0);
            return (
              <Card key={v.id} className="border-border/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-semibold">{fmtDate(v.visit_date)}</div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> כניסה {fmtTime(v.arrival_time)}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> יציאה {fmtTime(v.departure_time)}</span>
                    </div>
                  </div>
                  {v.notes && <p className="text-sm text-muted-foreground">{v.notes}</p>}
                  {v.items?.length > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <div className="text-xs font-medium mb-1">ציוד שסופק:</div>
                      <ul className="text-sm space-y-0.5">
                        {v.items.map((it: any) => (
                          <li key={it.id} className="flex justify-between">
                            <span>{it.product?.name} × {it.quantity} {it.product?.unit}</span>
                            <span className="text-muted-foreground">₪{(Number(it.quantity) * Number(it.unit_price || it.product?.price || 0)).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="text-sm font-medium text-left mt-1">סה"כ ליום: ₪{dayTotal.toFixed(2)}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function LinkedJobsCard({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ["project-jobs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, status, scheduled_date, start_time, client:clients(name)")
        .eq("project_id", projectId)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: availableJobs = [] } = useQuery({
    queryKey: ["project-jobs-available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, scheduled_date, client:clients(name)")
        .is("project_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: pickerOpen,
  });

  const linkJob = async (jobId: string) => {
    const { error } = await supabase.from("jobs").update({ project_id: projectId }).eq("id", jobId);
    if (error) return toast.error("שגיאה", { description: error.message });
    toast.success("הקריאה שויכה לפרוייקט");
    qc.invalidateQueries({ queryKey: ["project-jobs", projectId] });
    qc.invalidateQueries({ queryKey: ["project-jobs-available"] });
    qc.invalidateQueries({ queryKey: ["main-jobs"] });
    setPickerOpen(false);
  };
  const unlinkJob = async (jobId: string) => {
    if (!confirm("להסיר את הקריאה מהפרוייקט?")) return;
    const { error } = await supabase.from("jobs").update({ project_id: null }).eq("id", jobId);
    if (error) return toast.error("שגיאה", { description: error.message });
    toast.success("הקריאה הוסרה מהפרוייקט");
    qc.invalidateQueries({ queryKey: ["project-jobs", projectId] });
    qc.invalidateQueries({ queryKey: ["main-jobs"] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          קריאות בפרוייקט ({jobs.length})
        </CardTitle>
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 ml-1" /> שייך קריאה</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-md p-0">
            <DialogHeader className="p-4 pb-2"><DialogTitle>שייך קריאה לפרוייקט</DialogTitle></DialogHeader>
            <Command className="rounded-none">
              <CommandInput placeholder="חפש קריאה לפי כותרת / לקוח…" />
              <CommandList className="max-h-[400px]">
                <CommandEmpty>אין קריאות פנויות לשיוך</CommandEmpty>
                <CommandGroup>
                  {(availableJobs as any[]).map(j => (
                    <CommandItem
                      key={j.id}
                      value={`${j.title} ${j.client?.name ?? ""}`}
                      onSelect={() => linkJob(j.id)}
                    >
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium truncate">{j.title}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {j.client?.name ?? "ללא לקוח"}{j.scheduled_date ? ` · ${new Date(j.scheduled_date).toLocaleDateString("he-IL")}` : ""}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">אין קריאות משויכות לפרוייקט. לחץ "שייך קריאה" כדי להתחיל.</p>
        ) : (
          <div className="divide-y">
            {(jobs as any[]).map(j => (
              <div key={j.id} className="flex items-center justify-between gap-2 py-2">
                <Link
                  to="/admin/jobs/$jobId"
                  params={{ jobId: j.id }}
                  className="flex-1 min-w-0 hover:text-primary"
                >
                  <div className="font-medium truncate">{j.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {j.client?.name ?? "ללא לקוח"}
                    {(j.start_time || j.scheduled_date) && ` · ${new Date(j.start_time ?? j.scheduled_date).toLocaleString("he-IL")}`}
                  </div>
                </Link>
                <Badge variant="outline" className={statusColor(j.status)}>{statusLabel(j.status)}</Badge>
                <Link to="/admin/jobs/$jobId" params={{ jobId: j.id }}>
                  <Button variant="ghost" size="sm" className="h-7"><ChevronLeft className="h-4 w-4" /></Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => unlinkJob(j.id)} title="הסר מהפרוייקט">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
