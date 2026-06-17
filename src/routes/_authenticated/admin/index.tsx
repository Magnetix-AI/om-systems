import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronRight, ChevronLeft, Calendar as CalendarIcon, MapPin,
  User, Clock, Briefcase, FolderKanban, AlertTriangle, Pencil, Trash2,
} from "lucide-react";
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, startOfMonth, startOfWeek, isToday,
} from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { statusLabel, statusColor } from "@/components/app-shell";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteJobsCascade, deleteProjectsCascade } from "@/lib/admin-deletes";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  component: AdminMain,
});

type ViewMode = "month" | "week" | "day";

type CalendarItem = {
  kind: "job" | "project";
  id: string;
  title: string;
  description: string | null;
  date: Date;
  technician_id: string | null;
  technician_name: string | null;
  client_name: string | null;
  client_address: string | null;
  status: string;
};

function AdminMain() {
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [editItem, setEditItem] = useState<CalendarItem | null>(null);

  const range = useMemo(() => getRange(cursor, view), [cursor, view]);

  const { data: jobs = [] } = useQuery({
    queryKey: ["main-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, description, status, scheduled_date, technician_id, client:clients(name, address)")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["main-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, status, start_date, technician_id, client:clients(name, address)")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: techs = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "technician");
      const ids = (roles ?? []).map(r => r.user_id);
      if (!ids.length) return [];
      return (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? [];
    },
  });

  const techMap = useMemo(
    () => Object.fromEntries((techs as any[]).map(t => [t.id, t.full_name])),
    [techs],
  );

  const items: CalendarItem[] = useMemo(() => {
    const jobItems = (jobs as any[])
      .filter(j => j.scheduled_date)
      .map<CalendarItem>(j => ({
        kind: "job",
        id: j.id,
        title: j.title,
        description: j.description,
        date: new Date(j.scheduled_date),
        technician_id: j.technician_id,
        technician_name: j.technician_id ? techMap[j.technician_id] ?? null : null,
        client_name: j.client?.name ?? null,
        client_address: j.client?.address ?? null,
        status: j.status,
      }));
    const projItems = (projects as any[])
      .filter(p => p.start_date)
      .map<CalendarItem>(p => ({
        kind: "project",
        id: p.id,
        title: p.title,
        description: p.description,
        date: new Date(p.start_date),
        technician_id: p.technician_id,
        technician_name: p.technician_id ? techMap[p.technician_id] ?? null : null,
        client_name: p.client?.name ?? null,
        client_address: p.client?.address ?? null,
        status: p.status,
      }));
    return [...jobItems, ...projItems];
  }, [jobs, projects, techMap]);

  const unscheduled: CalendarItem[] = useMemo(() => {
    return (jobs as any[])
      .filter(j => !j.scheduled_date || !j.technician_id)
      .map<CalendarItem>(j => ({
        kind: "job",
        id: j.id,
        title: j.title,
        description: j.description,
        date: j.scheduled_date ? new Date(j.scheduled_date) : new Date(),
        technician_id: j.technician_id,
        technician_name: j.technician_id ? techMap[j.technician_id] ?? null : null,
        client_name: j.client?.name ?? null,
        client_address: j.client?.address ?? null,
        status: j.status,
      }));
  }, [jobs, techMap]);

  const dayItems = useMemo(
    () => items.filter(i => isSameDay(i.date, selected)).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [items, selected],
  );

  const navPrev = () => setCursor(c => view === "month" ? addMonths(c, -1) : view === "week" ? addWeeks(c, -1) : addDays(c, -1));
  const navNext = () => setCursor(c => view === "month" ? addMonths(c, 1) : view === "week" ? addWeeks(c, 1) : addDays(c, 1));

  return (
    <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary" /> ראשי
          </h1>
          <p className="text-sm text-muted-foreground">לוח שנה מרכזי לקריאות ופרוייקטים</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setCursor(new Date()); setSelected(new Date()); }}>היום</Button>
          <Button variant="outline" size="icon" onClick={navPrev}><ChevronRight className="h-4 w-4" /></Button>
          <div className="px-3 text-sm font-semibold min-w-[140px] text-center">
            {format(cursor, view === "day" ? "PPP" : "MMMM yyyy", { locale: he })}
          </div>
          <Button variant="outline" size="icon" onClick={navNext}><ChevronLeft className="h-4 w-4" /></Button>
          <Select value={view} onValueChange={v => setView(v as ViewMode)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">חודש</SelectItem>
              <SelectItem value="week">שבוע</SelectItem>
              <SelectItem value="day">יום</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px] gap-4">
        {/* Unscheduled — LEFT side. In RTL with grid this column appears on the visual left. */}
        <UnscheduledPanel items={unscheduled} onEdit={setEditItem} />

        {/* Calendar — center */}
        <Card>
          <CardContent className="p-3">
            {view === "month" && (
              <MonthGrid cursor={cursor} selected={selected} items={items} onSelect={setSelected} />
            )}
            {view === "week" && (
              <WeekGrid cursor={cursor} selected={selected} items={items} onSelect={setSelected} />
            )}
            {view === "day" && (
              <DayGrid cursor={cursor} items={items.filter(i => isSameDay(i.date, cursor))} onItemClick={setEditItem} />
            )}
          </CardContent>
        </Card>

        {/* Day details — RIGHT side */}
        <DayDetailsPanel date={selected} items={dayItems} onEdit={setEditItem} />
      </div>

      <EditDialog item={editItem} techs={techs as any[]} onClose={() => setEditItem(null)} />
    </div>
  );
}

function getRange(cursor: Date, view: ViewMode) {
  if (view === "month") {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }
  if (view === "week") {
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }
  return [cursor];
}

const WEEKDAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function MonthGrid({ cursor, selected, items, onSelect }: {
  cursor: Date; selected: Date; items: CalendarItem[]; onSelect: (d: Date) => void;
}) {
  const days = getRange(cursor, "month");
  return (
    <div>
      <div className="grid grid-cols-7 mb-2 text-center text-xs font-semibold text-muted-foreground">
        {WEEKDAY_LABELS.map(d => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const dayItems = items.filter(i => isSameDay(i.date, d));
          const inMonth = isSameMonth(d, cursor);
          const sel = isSameDay(d, selected);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              className={cn(
                "min-h-[88px] rounded-lg border p-1.5 text-right transition-all hover:border-primary/50 hover:shadow-sm flex flex-col gap-1",
                inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
                sel && "ring-2 ring-primary border-primary",
                isToday(d) && !sel && "border-primary/60",
              )}
            >
              <div className={cn("text-sm font-semibold flex items-center justify-between", isToday(d) && "text-primary")}>
                <span>{format(d, "d")}</span>
                {dayItems.length > 0 && (
                  <span className="text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5">{dayItems.length}</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayItems.slice(0, 2).map(it => (
                  <div key={it.kind + it.id} className={cn(
                    "text-[10px] rounded px-1 py-0.5 truncate",
                    it.kind === "project" ? "bg-accent/40 text-accent-foreground" : "bg-primary/15 text-primary"
                  )}>
                    {format(it.date, "HH:mm")} {it.title}
                  </div>
                ))}
                {dayItems.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">+{dayItems.length - 2} נוספים</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ cursor, selected, items, onSelect }: {
  cursor: Date; selected: Date; items: CalendarItem[]; onSelect: (d: Date) => void;
}) {
  const days = getRange(cursor, "week");
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(d => {
        const dayItems = items.filter(i => isSameDay(i.date, d)).sort((a, b) => a.date.getTime() - b.date.getTime());
        const sel = isSameDay(d, selected);
        return (
          <button
            key={d.toISOString()}
            onClick={() => onSelect(d)}
            className={cn(
              "min-h-[280px] rounded-lg border p-2 text-right flex flex-col gap-1 hover:border-primary/50 transition-all",
              sel && "ring-2 ring-primary border-primary",
              isToday(d) && "bg-primary/5",
            )}
          >
            <div className="text-xs text-muted-foreground">{WEEKDAY_LABELS[d.getDay()]}</div>
            <div className={cn("text-lg font-bold", isToday(d) && "text-primary")}>{format(d, "d/M")}</div>
            <div className="flex flex-col gap-1 overflow-hidden mt-1">
              {dayItems.map(it => (
                <div key={it.kind + it.id} className={cn(
                  "text-[11px] rounded px-1.5 py-1 truncate text-right",
                  it.kind === "project" ? "bg-accent/40" : "bg-primary/15 text-primary"
                )}>
                  <div className="font-medium truncate">{it.title}</div>
                  <div className="opacity-70">{format(it.date, "HH:mm")}</div>
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DayGrid({ cursor, items, onItemClick }: {
  cursor: Date; items: CalendarItem[]; onItemClick: (i: CalendarItem) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div>
      <div className="text-center font-bold text-lg mb-3">{format(cursor, "EEEE, d בMMMM", { locale: he })}</div>
      <div className="border rounded-lg divide-y max-h-[600px] overflow-y-auto">
        {hours.map(h => {
          const hourItems = items.filter(i => i.date.getHours() === h);
          return (
            <div key={h} className="flex min-h-[48px]">
              <div className="w-16 shrink-0 text-xs text-muted-foreground p-2 text-left border-l">
                {String(h).padStart(2, "0")}:00
              </div>
              <div className="flex-1 p-1 flex flex-col gap-1">
                {hourItems.map(it => (
                  <button
                    key={it.kind + it.id}
                    onClick={() => onItemClick(it)}
                    className={cn(
                      "text-right text-xs rounded px-2 py-1 hover:opacity-80",
                      it.kind === "project" ? "bg-accent/40" : "bg-primary/15 text-primary"
                    )}
                  >
                    <span className="font-semibold">{format(it.date, "HH:mm")}</span> · {it.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UnscheduledPanel({ items, onEdit }: { items: CalendarItem[]; onEdit: (i: CalendarItem) => void }) {
  return (
    <Card className="bg-warning/5 border-warning/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          קריאות לא מתואמות
          <Badge variant="outline" className="mr-auto bg-warning/20 border-warning/40">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">כל הקריאות מתואמות 🎉</p>
        ) : items.map(it => (
          <button
            key={it.id}
            onClick={() => onEdit(it)}
            className="w-full text-right p-3 rounded-lg border bg-card hover:border-primary/50 hover:shadow-sm transition-all space-y-1"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm truncate">{it.title}</div>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
            {it.client_name && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {it.client_name}
              </div>
            )}
            <div className="flex gap-1 text-[10px]">
              {!it.technician_id && <Badge variant="outline" className="bg-warning/15 border-warning/40">ללא טכנאי</Badge>}
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function DayDetailsPanel({ date, items, onEdit }: {
  date: Date; items: CalendarItem[]; onEdit: (i: CalendarItem) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          {format(date, "EEEE, d בMMMM", { locale: he })}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{items.length} פריטים</p>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">אין פריטים ביום זה</p>
        ) : items.map(it => (
          <div key={it.kind + it.id} className="p-3 rounded-lg border bg-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Link
                to={it.kind === "job" ? "/admin/jobs/$jobId" : "/admin/projects/$projectId"}
                params={it.kind === "job" ? { jobId: it.id } : { projectId: it.id }}
                className="font-semibold text-sm hover:text-primary flex items-center gap-1"
              >
                {it.kind === "project" ? <FolderKanban className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
                {it.title}
              </Link>
              <Badge variant="outline" className={statusColor(it.status)}>{statusLabel(it.status)}</Badge>
            </div>
            {it.description && <p className="text-xs text-muted-foreground line-clamp-2">{it.description}</p>}
            <div className="text-xs space-y-1 text-muted-foreground">
              <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {format(it.date, "HH:mm")}</div>
              {it.client_name && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {it.client_name}{it.client_address ? ` — ${it.client_address}` : ""}</div>}
              <div className="flex items-center gap-1.5"><User className="h-3 w-3" /> {it.technician_name ?? "לא משויך"}</div>
            </div>
            {it.kind === "job" && (
              <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => onEdit(it)}>
                <Pencil className="h-3 w-3 ml-1" /> ערוך שיוך
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EditDialog({ item, techs, onClose }: {
  item: CalendarItem | null; techs: { id: string; full_name: string }[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [scheduled, setScheduled] = useState("");
  const [techId, setTechId] = useState("__none");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (item) {
      // initialise once when item changes
      setScheduled(item.date && (item.kind === "job" || item.status !== "open")
        ? toLocalInput(item.date) : "");
      setTechId(item.technician_id ?? "__none");
    }
  }, [item?.id]);

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const value = scheduled ? new Date(scheduled).toISOString() : null;
      const payload = item.kind === "job"
        ? { scheduled_date: value, technician_id: techId === "__none" ? null : techId }
        : { start_date: value ? value.slice(0, 10) : null, technician_id: techId === "__none" ? null : techId };
      const query = item.kind === "job"
        ? supabase.from("jobs").update(payload as any).eq("id", item.id)
        : supabase.from("projects").update(payload as any).eq("id", item.id);
      const { error } = await query;
      if (error) throw error;
      toast.success("עודכן");
      qc.invalidateQueries({ queryKey: ["main-jobs"] });
      qc.invalidateQueries({ queryKey: ["main-projects"] });
      onClose();
    } catch (e: any) {
      toast.error("שגיאה בעדכון", { description: e.message });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>שיוך — {item.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">תאריך ושעה</label>
            <Input type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">טכנאי</label>
            <Select value={techId} onValueChange={setTechId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">לא משויך</SelectItem>
                {techs.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
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

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
