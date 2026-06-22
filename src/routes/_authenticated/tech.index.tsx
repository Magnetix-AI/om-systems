import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, statusColor } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Briefcase } from "lucide-react";
import {
  addDays, addWeeks, eachDayOfInterval, endOfWeek, format,
  isSameDay, startOfWeek, isToday,
} from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tech/")({
  ssr: false,
  component: TechDashboard,
});

type ViewMode = "day" | "week";

const HOUR_PX = 44;
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DAY_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;

type Job = any;

type PositionedJob = Job & {
  start: Date;
  end: Date;
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
};

function TechDashboard() {
  const { data: user } = useCurrentUser();
  const userId = user?.id;
  const [view, setView] = useState<ViewMode>("day");
  const [cursor, setCursor] = useState(new Date());

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["tech-jobs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, description, status, scheduled_date, start_time, end_time, completed_at, client:clients(name, address)")
        .eq("technician_id", userId!)
        .not("scheduled_date", "is", null)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const days = useMemo(() => {
    if (view === "day") return [cursor];
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    const end = endOfWeek(cursor, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [view, cursor]);

  const move = (dir: 1 | -1) => {
    setCursor(view === "day" ? addDays(cursor, dir) : addWeeks(cursor, dir));
  };

  const title = view === "day"
    ? format(cursor, "EEEE, d בMMMM yyyy", { locale: he })
    : `${format(startOfWeek(cursor, { weekStartsOn: 0 }), "d MMM", { locale: he })} – ${format(endOfWeek(cursor, { weekStartsOn: 0 }), "d MMM yyyy", { locale: he })}`;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">שלום, {user?.fullName}</h1>
          <p className="text-sm text-muted-foreground">היומן שלך – הקריאות המשויכות אליך</p>
        </div>

        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => move(-1)} aria-label="הקודם">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>היום</Button>
                <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="הבא">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1 rounded-md border p-0.5">
                <Button
                  size="sm"
                  variant={view === "day" ? "default" : "ghost"}
                  onClick={() => setView("day")}
                >יומי</Button>
                <Button
                  size="sm"
                  variant={view === "week" ? "default" : "ghost"}
                  onClick={() => setView("week")}
                >שבועי</Button>
              </div>
            </div>
            <div className="text-center text-sm font-medium flex items-center justify-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {title}
            </div>
          </CardContent>
        </Card>

        {isLoading && <p className="text-center text-muted-foreground py-8">טוען...</p>}

        {!isLoading && (
          <div className="space-y-4">
            {days.map((d) => (
              <DayTimeGrid key={d.toISOString()} date={d} jobs={jobs} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DayTimeGrid({ date, jobs }: { date: Date; jobs: Job[] }) {
  const positioned = useMemo<PositionedJob[]>(() => {
    const dayJobs = (jobs as Job[]).filter(j =>
      j.scheduled_date && isSameDay(new Date(j.scheduled_date), date)
    );
    const events = dayJobs.map((j) => {
      const start = j.start_time ? new Date(j.start_time) : (j.scheduled_date ? new Date(j.scheduled_date) : new Date(date));
      const end = j.end_time ? new Date(j.end_time) : new Date(start.getTime() + 60 * 60000);
      const startMin = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
      const endMin = end.getHours() * 60 + end.getMinutes() - START_HOUR * 60;
      return { ...j, start, end, startMin, endMin };
    }).filter(e => e.endMin > e.startMin);
    return layoutEvents(events);
  }, [jobs, date]);

  const hasJobs = positioned.length > 0;

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className={cn("flex items-center justify-between", isToday(date) && "text-primary")}>
          <div className="font-semibold">
            {format(date, "EEEE", { locale: he })}
            <span className="text-muted-foreground font-normal mr-2">
              {format(date, "d/M", { locale: he })}
            </span>
          </div>
          {isToday(date) && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">היום</Badge>}
        </div>

        {!hasJobs ? (
          <div className="border border-dashed rounded-lg py-6 text-center text-sm text-muted-foreground">
            אין קריאות ביום זה
          </div>
        ) : (
          <div className="relative border rounded-lg overflow-hidden" style={{ height: DAY_HEIGHT }}>
            <div className="absolute inset-0 flex">
              {/* Hour labels — first child in RTL flow appears on the right side */}
              <div className="w-12 relative shrink-0 border-l">
                {HOURS.map((h) => {
                  const top = ((h - START_HOUR) + 0.5) * HOUR_PX;
                  return (
                    <div
                      key={h}
                      className="absolute right-0 left-0 text-center text-[10px] text-muted-foreground leading-none"
                      style={{ top }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  );
                })}
              </div>

              {/* Grid lines and job blocks */}
              <div className="flex-1 relative">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-b border-dashed border-border/50"
                    style={{ top: (h - START_HOUR) * HOUR_PX }}
                  />
                ))}
                {positioned.map((j) => {
                  const top = Math.max(0, (j.startMin / 60) * HOUR_PX);
                  const height = Math.max(28, ((j.endMin - j.startMin) / 60) * HOUR_PX);
                  const widthPct = 100 / j.cols;
                  const rightPct = j.col * widthPct;
                  const timeText = `${format(j.start, "HH:mm")} – ${format(j.end, "HH:mm")}`;

                  return (
                    <Link
                      key={j.id}
                      to="/tech/$jobId"
                      params={{ jobId: j.id }}
                      className={cn(
                        "absolute block rounded-md border px-2 py-1 shadow-sm overflow-hidden hover:shadow-md transition-all",
                        statusColor(j.status)
                      )}
                      style={{
                        top,
                        height,
                        right: `calc(${rightPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        minHeight: 28,
                      }}
                      title={j.title}
                    >
                      <div className="font-semibold leading-tight truncate">{j.title}</div>
                      <div className="flex items-center gap-1 opacity-90 truncate">
                        <Clock className="h-3 w-3 shrink-0" />
                        {timeText}
                      </div>
                      {j.client?.name && (
                        <div className="flex items-center gap-1 opacity-90 truncate">
                          <Briefcase className="h-3 w-3 shrink-0" />
                          {j.client.name}
                        </div>
                      )}
                      {j.description && height > 48 && (
                        <div className="mt-1 opacity-80 line-clamp-2 leading-tight">
                          {j.description}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function layoutEvents<T extends { startMin: number; endMin: number }>(
  events: T[]
): (T & { col: number; cols: number })[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: (T & { col: number; cols: number })[] = [];
  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const cols: { end: number }[] = [];
    const assign = new Map<T, number>();
    for (const it of cluster) {
      let idx = cols.findIndex((c) => c.end <= it.startMin);
      if (idx === -1) {
        idx = cols.length;
        cols.push({ end: it.endMin });
      } else {
        cols[idx].end = it.endMin;
      }
      assign.set(it, idx);
    }
    const total = cols.length;
    for (const it of cluster) {
      out.push({ ...it, col: assign.get(it)!, cols: total });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const ev of sorted) {
    if (cluster.length && ev.startMin >= clusterEnd) {
      flush();
    }
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  flush();
  return out;
}
