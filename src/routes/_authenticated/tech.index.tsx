import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, statusLabel, statusColor } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
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

  const jobsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const j of jobs as any[]) {
      if (!j.scheduled_date) continue;
      const d = new Date(j.scheduled_date);
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    }
    return map;
  }, [jobs]);

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
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const list = jobsByDay.get(key) ?? [];
              return (
                <div key={key}>
                  <div className={cn(
                    "flex items-center justify-between mb-2 px-1",
                    isToday(d) && "text-primary",
                  )}>
                    <div className="font-semibold">
                      {format(d, "EEEE", { locale: he })}
                      <span className="text-muted-foreground font-normal mr-2">
                        {format(d, "d/M", { locale: he })}
                      </span>
                    </div>
                    {isToday(d) && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">היום</Badge>}
                  </div>
                  {list.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-6 text-center text-sm text-muted-foreground">
                        אין קריאות ביום זה
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {list.map((j: any) => <JobCard key={j.id} job={j} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function JobCard({ job }: { job: any }) {
  const time = job.start_time
    ? job.end_time
      ? `${job.start_time.slice(0, 5)} – ${job.end_time.slice(0, 5)}`
      : job.start_time.slice(0, 5)
    : null;
  return (
    <Link to="/tech/$jobId" params={{ jobId: job.id }}>
      <Card className="hover:shadow-[var(--shadow-card)] transition-all hover:border-primary/40 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold leading-tight">{job.title}</h3>
            <Badge variant="outline" className={statusColor(job.status)}>{statusLabel(job.status)}</Badge>
          </div>
          {time && (
            <div className="flex items-center gap-1 text-sm font-medium text-primary mb-1">
              <Clock className="h-3.5 w-3.5" />{time}
            </div>
          )}
          {job.client && (
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="font-medium text-foreground">{job.client.name}</div>
              {job.client.address && (
                <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.client.address}</div>
              )}
            </div>
          )}
          <div className="flex justify-end mt-2 text-primary text-sm font-medium">
            פתח קריאה <ChevronLeft className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
