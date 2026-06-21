import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

import {
  ChevronRight, ChevronLeft, Calendar as CalendarIcon, MapPin,
  User, Clock, Briefcase, FolderKanban, AlertTriangle, Pencil, Trash2, Plus, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
import { AdminEditItemDialog } from "@/components/admin-edit-item-dialog";

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
  end: Date | null;
  technician_id: string | null;
  technician_name: string | null;
  technician_color: string | null;
  client_name: string | null;
  client_address: string | null;
  status: string;
};

function AdminMain() {
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [editItem, setEditItem] = useState<CalendarItem | null>(null);
  const [toDelete, setToDelete] = useState<CalendarItem | null>(null);
  const [newJobDate, setNewJobDate] = useState<Date | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<{ item: CalendarItem; date: Date } | null>(null);
  const qc = useQueryClient();

  const range = useMemo(() => getRange(cursor, view), [cursor, view]);

  const { data: jobs = [] } = useQuery({
    queryKey: ["main-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, description, status, scheduled_date, start_time, end_time, technician_id, client:clients(name, address)")
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
      return (await supabase.from("profiles").select("id, full_name, color").in("id", ids)).data ?? [];
    },
  });

  const techMap = useMemo(
    () => Object.fromEntries((techs as any[]).map(t => [t.id, t])),
    [techs],
  );

  const items: CalendarItem[] = useMemo(() => {
    const jobItems = (jobs as any[])
      .filter(j => j.scheduled_date || j.start_time)
      .map<CalendarItem>(j => {
        const start = new Date(j.start_time ?? j.scheduled_date);
        const tech = j.technician_id ? techMap[j.technician_id] : null;
        return {
          kind: "job",
          id: j.id,
          title: j.title,
          description: j.description,
          date: start,
          end: j.end_time ? new Date(j.end_time) : null,
          technician_id: j.technician_id,
          technician_name: tech?.full_name ?? null,
          technician_color: tech?.color ?? null,
          client_name: j.client?.name ?? null,
          client_address: j.client?.address ?? null,
          status: j.status,
        };
      });
    const projItems = (projects as any[])
      .filter(p => p.start_date)
      .map<CalendarItem>(p => {
        const tech = p.technician_id ? techMap[p.technician_id] : null;
        return {
          kind: "project",
          id: p.id,
          title: p.title,
          description: p.description,
          date: new Date(p.start_date),
          end: null,
          technician_id: p.technician_id,
          technician_name: tech?.full_name ?? null,
          technician_color: tech?.color ?? null,
          client_name: p.client?.name ?? null,
          client_address: p.client?.address ?? null,
          status: p.status,
        };
      });
    return [...jobItems, ...projItems];
  }, [jobs, projects, techMap]);

  const unscheduled: CalendarItem[] = useMemo(() => {
    return (jobs as any[])
      .filter(j => (!j.scheduled_date && !j.start_time) || !j.technician_id)
      .map<CalendarItem>(j => {
        const tech = j.technician_id ? techMap[j.technician_id] : null;
        return {
          kind: "job",
          id: j.id,
          title: j.title,
          description: j.description,
          date: j.start_time ? new Date(j.start_time) : (j.scheduled_date ? new Date(j.scheduled_date) : new Date()),
          end: j.end_time ? new Date(j.end_time) : null,
          technician_id: j.technician_id,
          technician_name: tech?.full_name ?? null,
          technician_color: tech?.color ?? null,
          client_name: j.client?.name ?? null,
          client_address: j.client?.address ?? null,
          status: j.status,
        };
      });
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
              <WeekGrid
                cursor={cursor} selected={selected} items={items}
                onSelect={setSelected} onItemClick={setEditItem} onItemDelete={setToDelete}
                onAddOnDay={setNewJobDate}
                onDropOnDay={(kind, id, date) => {
                  const found = items.find(i => i.kind === kind && i.id === id);
                  if (found) setRescheduleTarget({ item: found, date });
                }}
              />
            )}
            {view === "day" && (
              <DayGrid cursor={cursor} items={items.filter(i => isSameDay(i.date, cursor))} onItemClick={setEditItem} />
            )}
          </CardContent>
        </Card>

        {/* Day details — RIGHT side */}
        <DayDetailsPanel date={selected} items={dayItems} onEdit={setEditItem} onDelete={setToDelete} />
      </div>

      <AdminEditItemDialog item={editItem} onClose={() => setEditItem(null)} invalidateKeys={[["main-jobs"], ["main-projects"]]} />

      <NewJobOnDateDialog
        date={newJobDate}
        onClose={() => setNewJobDate(null)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["main-jobs"] });
          setNewJobDate(null);
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק {toDelete?.kind === "project" ? "פרוייקט" : "קריאה"}?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" — הפעולה בלתי הפיכה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!toDelete) return;
                try {
                  if (toDelete.kind === "job") await deleteJobsCascade([toDelete.id]);
                  else await deleteProjectsCascade([toDelete.id]);
                  toast.success("נמחק");
                  qc.invalidateQueries({ queryKey: ["main-jobs"] });
                  qc.invalidateQueries({ queryKey: ["main-projects"] });
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

function WeekGrid({ cursor, selected, items, onSelect, onItemClick, onItemDelete, onAddOnDay, onDropOnDay }: {
  cursor: Date; selected: Date; items: CalendarItem[]; onSelect: (d: Date) => void;
  onItemClick: (i: CalendarItem) => void;
  onItemDelete: (i: CalendarItem) => void;
  onAddOnDay: (d: Date) => void;
  onDropOnDay: (kind: "job" | "project", id: string, date: Date) => void;
}) {
  const days = getRange(cursor, "week");
  const HOUR_PX = 36;
  const START_HOUR = 6;
  const END_HOUR = 22;
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="overflow-x-auto">
      <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, minmax(110px, 1fr))" }}>
        {/* Header row */}
        <div />
        {days.map(d => {
          const sel = isSameDay(d, selected);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "relative p-2 text-center border-b text-xs font-semibold transition-colors hover:bg-secondary/50 cursor-pointer group/header",
                sel && "bg-primary/10 text-primary",
                isToday(d) && !sel && "text-primary",
              )}
              onClick={() => onSelect(d)}
            >
              <div className="text-muted-foreground">{WEEKDAY_LABELS[d.getDay()]}</div>
              <div className="text-lg">{format(d, "d/M")}</div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAddOnDay(d); }}
                title="הוסף קריאה ליום זה"
                className="absolute top-1 left-1 h-6 w-6 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center opacity-0 group-hover/header:opacity-100 transition"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {/* Hours + day columns */}
        <div className="relative border-l">
          {hours.map(h => (
            <div key={h} style={{ height: HOUR_PX }} className="text-[10px] text-muted-foreground text-left pl-1 border-b">
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map(d => {
          const dayItems = items.filter(i => isSameDay(i.date, d));
          // Compute overlap columns
          const sorted = [...dayItems].sort((a, b) => a.date.getTime() - b.date.getTime());
          const layout = new Map<string, { col: number; cols: number }>();
          let cluster: typeof sorted = [];
          let clusterEnd = 0;
          const flush = () => {
            if (!cluster.length) return;
            const cols: Array<{ end: number }> = [];
            const assign = new Map<string, number>();
            for (const it of cluster) {
              const s = it.date.getTime();
              const e = (it.end ?? new Date(s + 60 * 60000)).getTime();
              let placed = -1;
              for (let i = 0; i < cols.length; i++) {
                if (cols[i].end <= s) { placed = i; cols[i].end = e; break; }
              }
              if (placed === -1) { cols.push({ end: e }); placed = cols.length - 1; }
              assign.set(it.kind + it.id, placed);
            }
            const total = cols.length;
            for (const it of cluster) {
              layout.set(it.kind + it.id, { col: assign.get(it.kind + it.id)!, cols: total });
            }
            cluster = [];
            clusterEnd = 0;
          };
          for (const it of sorted) {
            const s = it.date.getTime();
            const e = (it.end ?? new Date(s + 60 * 60000)).getTime();
            if (cluster.length && s >= clusterEnd) flush();
            cluster.push(it);
            clusterEnd = Math.max(clusterEnd, e);
          }
          flush();
          return (
            <div
              key={d.toISOString()}
              className="relative border-l border-b"
              style={{ height: HOUR_PX * hours.length }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData("application/x-cal-item");
                if (!raw) return;
                try {
                  const parsed = JSON.parse(raw) as { kind: "job" | "project"; id: string };
                  onDropOnDay(parsed.kind, parsed.id, d);
                } catch { /* ignore */ }
              }}
            >
              {hours.map(h => (
                <div key={h} style={{ height: HOUR_PX }} className="border-b border-dashed border-border/40" />
              ))}
              {dayItems.map(it => {
                const startMin = it.date.getHours() * 60 + it.date.getMinutes() - START_HOUR * 60;
                const durMin = it.end ? Math.max(30, (it.end.getTime() - it.date.getTime()) / 60000) : 60;
                const top = (startMin / 60) * HOUR_PX;
                const height = (durMin / 60) * HOUR_PX;
                const color = it.technician_color || (it.kind === "project" ? "#a78bfa" : "#3b82f6");
                const lay = layout.get(it.kind + it.id) ?? { col: 0, cols: 1 };
                const widthPct = 100 / lay.cols;
                return (
                  <div
                    key={it.kind + it.id}
                    className="absolute group/item"
                    style={{ top, height, left: `calc(${lay.col * widthPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                    draggable={it.kind === "job"}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("application/x-cal-item", JSON.stringify({ kind: it.kind, id: it.id }));
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); onItemClick(it); }}
                      className="w-full h-full rounded text-right text-[11px] text-white px-1.5 py-1 shadow-sm overflow-hidden hover:opacity-90 hover:shadow-md transition"
                      style={{ background: color }}
                      title={`${it.title} · ${it.technician_name ?? "ללא טכנאי"}`}
                    >
                      <div className="font-semibold truncate">{it.title}</div>
                      <div className="opacity-90 truncate">
                        {format(it.date, "HH:mm")}{it.end ? `–${format(it.end, "HH:mm")}` : ""}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onItemDelete(it); }}
                      title="הסר"
                      className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}

      </div>
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

function DayDetailsPanel({ date, items, onEdit, onDelete }: {
  date: Date; items: CalendarItem[];
  onEdit: (i: CalendarItem) => void;
  onDelete: (i: CalendarItem) => void;
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
          <div key={it.kind + it.id} className="p-3 rounded-lg border bg-card space-y-2"
            style={it.technician_color ? { borderRightWidth: 4, borderRightColor: it.technician_color } : undefined}>
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
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {format(it.date, "HH:mm")}{it.end ? ` – ${format(it.end, "HH:mm")}` : ""}
              </div>
              {it.client_name && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {it.client_name}{it.client_address ? ` — ${it.client_address}` : ""}</div>}
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                {it.technician_color && <span className="h-2 w-2 rounded-full inline-block" style={{ background: it.technician_color }} />}
                {it.technician_name ?? "לא משויך"}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => onEdit(it)}>
                <Pencil className="h-3 w-3 ml-1" /> ערוך
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => onDelete(it)}>
                <Trash2 className="h-3 w-3 ml-1" /> מחק
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}


function NewJobOnDateDialog({ date, onClose, onCreated }: {
  date: Date | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("__none");
  const [techId, setTechId] = useState<string>("__none");
  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
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

  // reset when date changes
  useEffect(() => {
    if (date) {
      setTitle(""); setDescription(""); setClientId("__none"); setTechId("__none"); setTime("09:00"); setEndTime("10:00");
    }
  }, [date]);

  const handleCreate = async () => {
    if (!date || !title.trim()) {
      toast.error("יש להזין כותרת");
      return;
    }
    setSaving(true);
    try {
      const [shh, smm] = time.split(":").map(Number);
      const start = new Date(date);
      start.setHours(shh || 9, smm || 0, 0, 0);
      const [ehh, emm] = endTime.split(":").map(Number);
      const end = new Date(date);
      end.setHours(ehh || 10, emm || 0, 0, 0);
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const { error } = await supabase.from("jobs").insert({
        title,
        description: description || null,
        client_id: clientId === "__none" ? null : clientId,
        technician_id: techId === "__none" ? null : techId,
        scheduled_date: startIso,
        start_time: startIso,
        end_time: endIso,
      });
      if (error) throw error;
      toast.success("נוצרה קריאה");
      onCreated();
    } catch (e: any) {
      toast.error("שגיאה ביצירה", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!date} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            קריאה חדשה {date ? `· ${format(date, "EEEE, d בMMMM", { locale: he })}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>כותרת</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="כותרת הקריאה" />
          </div>
          <div className="space-y-1.5">
            <Label>תיאור</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>לקוח</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— ללא —</SelectItem>
                  {(clients as any[]).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>טכנאי</Label>
              <Select value={techId} onValueChange={setTechId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">לא משויך</SelectItem>
                  {(techs as any[]).map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>שעת התחלה</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>שעת סיום</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? "יוצר..." : "צור קריאה"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
