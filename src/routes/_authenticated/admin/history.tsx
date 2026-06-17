import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Search, History as HistoryIcon, Briefcase, FolderKanban, Pencil } from "lucide-react";
import { toast } from "sonner";
import { statusLabel, statusColor } from "@/components/app-shell";
import { deleteJobsCascade, deleteProjectsCascade } from "@/lib/admin-deletes";
import { AdminEditItemDialog } from "@/components/admin-edit-item-dialog";

export const Route = createFileRoute("/_authenticated/admin/history")({
  ssr: false,
  component: AdminHistory,
});

type Granularity = "all" | "day" | "week" | "month";
type RowKind = "job" | "project";
type Row = {
  id: string;
  kind: RowKind;
  title: string;
  client: string | null;
  technician: string | null;
  status: string;
  date: string; // ISO
};

function startOfWeek(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun
  x.setDate(x.getDate() - day);
  return x;
}
function fmtDate(d: Date) { return d.toLocaleDateString("he-IL"); }
function buildBuckets(g: Granularity) {
  if (g === "all" || g === "day") {
    const buckets: { value: string; label: string; start: Date; end: Date }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (g === "day") {
      for (let i = -180; i <= 180; i++) {
        const s = new Date(today); s.setDate(s.getDate() + i);
        const e = new Date(s); e.setDate(e.getDate() + 1);
        buckets.push({ value: s.toISOString(), label: fmtDate(s), start: s, end: e });
      }
    }
    return buckets;
  }
  if (g === "week") {
    const buckets = [];
    const base = startOfWeek(new Date());
    for (let i = -26; i <= 26; i++) {
      const s = new Date(base); s.setDate(s.getDate() + i * 7);
      const e = new Date(s); e.setDate(e.getDate() + 7);
      const eLabel = new Date(e); eLabel.setDate(eLabel.getDate() - 1);
      buckets.push({ value: s.toISOString(), label: `${fmtDate(s)} – ${fmtDate(eLabel)}`, start: s, end: e });
    }
    return buckets;
  }
  // month
  const buckets = [];
  const now = new Date();
  for (let i = -12; i <= 12; i++) {
    const s = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const e = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    buckets.push({
      value: s.toISOString(),
      label: s.toLocaleDateString("he-IL", { month: "long", year: "numeric" }),
      start: s, end: e,
    });
  }
  return buckets;
}

function AdminHistory() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("all");
  const [bucket, setBucket] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Row[] | null>(null);
  const [editItem, setEditItem] = useState<{ kind: "job" | "project"; id: string } | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-history"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: jobs }, { data: projects }] = await Promise.all([
        supabase.from("jobs").select("id, title, status, created_at, technician_id, client:clients(name)").order("created_at", { ascending: false }),
        supabase.from("projects").select("id, title, status, created_at, technician_id, client:clients(name)").order("created_at", { ascending: false }),
      ]);
      const techIds = Array.from(new Set([
        ...(jobs ?? []).map((j: any) => j.technician_id),
        ...(projects ?? []).map((p: any) => p.technician_id),
      ].filter(Boolean)));
      let techMap: Record<string, string> = {};
      if (techIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", techIds);
        techMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      const jobRows: Row[] = (jobs ?? []).map((j: any) => ({
        id: j.id, kind: "job", title: j.title, client: j.client?.name ?? null,
        technician: j.technician_id ? techMap[j.technician_id] ?? null : null,
        status: j.status, date: j.created_at,
      }));
      const projRows: Row[] = (projects ?? []).map((p: any) => ({
        id: p.id, kind: "project", title: p.title, client: p.client?.name ?? null,
        technician: p.technician_id ? techMap[p.technician_id] ?? null : null,
        status: p.status, date: p.created_at,
      }));
      return [...jobRows, ...projRows].sort((a, b) => b.date.localeCompare(a.date));
    },
  });

  const buckets = useMemo(() => buildBuckets(granularity), [granularity]);
  const selectedBucket = buckets.find(b => b.value === bucket);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !(
        r.title.toLowerCase().includes(q) ||
        (r.client?.toLowerCase().includes(q)) ||
        (r.technician?.toLowerCase().includes(q))
      )) return false;
      if (selectedBucket) {
        const d = new Date(r.date).getTime();
        if (d < selectedBucket.start.getTime() || d >= selectedBucket.end.getTime()) return false;
      }
      return true;
    });
  }, [rows, search, selectedBucket]);

  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(`${r.kind}:${r.id}`));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) filtered.forEach(r => next.delete(`${r.kind}:${r.id}`));
    else filtered.forEach(r => next.add(`${r.kind}:${r.id}`));
    setSelected(next);
  };
  const toggleOne = (r: Row) => {
    const k = `${r.kind}:${r.id}`;
    const next = new Set(selected);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelected(next);
  };

  const askDelete = (items: Row[]) => {
    setPendingDelete(items);
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!pendingDelete) return;
    try {
      const jobIds = pendingDelete.filter(r => r.kind === "job").map(r => r.id);
      const projIds = pendingDelete.filter(r => r.kind === "project").map(r => r.id);
      await deleteJobsCascade(jobIds);
      await deleteProjectsCascade(projIds);
      toast.success(`נמחקו ${pendingDelete.length} פריטים`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-history"] });
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
    } catch (e: any) {
      toast.error("שגיאה במחיקה", { description: e.message });
    } finally {
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><HistoryIcon className="h-6 w-6" /> היסטוריית קריאות ופרוייקטים</h1>
        <p className="text-sm text-muted-foreground">מהחדש לישן. ניתן לחפש, לסנן ולמחוק.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="חיפוש לפי כותרת, לקוח או טכנאי..." value={search} onChange={e => setSearch(e.target.value)} className="pr-8" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">סינון לפי</div>
              <Select value={granularity} onValueChange={(v: Granularity) => { setGranularity(v); setBucket(""); }}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  <SelectItem value="day">ימים</SelectItem>
                  <SelectItem value="week">שבועות</SelectItem>
                  <SelectItem value="month">חודשים</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {granularity !== "all" && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">בחר תקופה</div>
                <Select value={bucket} onValueChange={setBucket}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="בחר תקופה" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {buckets.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selected.size > 0 && (
              <Button variant="destructive" onClick={() => {
                const items = filtered.filter(r => selected.has(`${r.kind}:${r.id}`));
                askDelete(items);
              }}>
                <Trash2 className="h-4 w-4 ml-1" /> מחק נבחרים ({selected.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">אין תוצאות.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="text-right">סוג</TableHead>
                  <TableHead className="text-right">כותרת</TableHead>
                  <TableHead className="text-right">לקוח</TableHead>
                  <TableHead className="text-right">טכנאי</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const k = `${r.kind}:${r.id}`;
                  return (
                    <TableRow key={k}>
                      <TableCell><Checkbox checked={selected.has(k)} onCheckedChange={() => toggleOne(r)} /></TableCell>
                      <TableCell>
                        {r.kind === "job"
                          ? <Badge variant="outline" className="gap-1"><Briefcase className="h-3 w-3" /> קריאה</Badge>
                          : <Badge variant="outline" className="gap-1"><FolderKanban className="h-3 w-3" /> פרוייקט</Badge>}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          to={r.kind === "job" ? "/admin" : "/admin/projects/$projectId"}
                          params={r.kind === "project" ? { projectId: r.id } : undefined as any}
                          className="hover:underline"
                        >{r.title}</Link>
                      </TableCell>
                      <TableCell>{r.client ?? "—"}</TableCell>
                      <TableCell>{r.technician ?? <span className="text-muted-foreground">לא משויך</span>}</TableCell>
                      <TableCell>
                        {r.kind === "job"
                          ? <Badge variant="outline" className={statusColor(r.status)}>{statusLabel(r.status)}</Badge>
                          : <Badge variant="outline" className={r.status === "open" ? "bg-primary/10 text-primary border-primary/30" : "bg-success/10 text-success border-success/30"}>{r.status === "open" ? "פעיל" : "סגור"}</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(r.date).toLocaleDateString("he-IL")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => setEditItem({ kind: r.kind, id: r.id })} title="ערוך">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => askDelete([r])}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק {pendingDelete?.length ?? 0} פריטים?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את הקריאות / פרוייקטים שנבחרו כולל כל הפריטים והביקורים המשויכים. לא ניתן לבטל.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
