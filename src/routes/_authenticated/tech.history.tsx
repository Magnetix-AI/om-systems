import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, statusColor, statusLabel } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { History, Calendar, Search, ArrowRight, CheckCircle2, Clock, Briefcase } from "lucide-react";
import { format, isToday, isYesterday, parseISO, startOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tech/history")({
  ssr: false,
  component: TechHistory,
});

type Job = any;

const bucketLabels: Record<string, string> = {
  today: "היום",
  yesterday: "אתמול",
  thisWeek: "השבוע",
  thisMonth: "החודש",
  older: "קודמות",
};

function TechHistory() {
  const { data: user } = useCurrentUser();
  const userId = user?.id;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "other">("completed");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["tech-history-jobs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, title, description, status, scheduled_date, start_time, end_time, completed_at, created_at, client:clients(name, address)"
        )
        .eq("technician_id", userId!)
        .order("completed_at", { ascending: false })
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (jobs as Job[]).filter((j) => {
      if (statusFilter === "completed" && j.status !== "completed") return false;
      if (statusFilter === "other" && j.status === "completed") return false;
      if (!q) return true;
      return (
        j.title?.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q) ||
        j.client?.name?.toLowerCase().includes(q) ||
        j.client?.address?.toLowerCase().includes(q)
      );
    });
  }, [jobs, search, statusFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, Job[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: [],
    };
    const now = startOfDay(new Date());
    for (const j of filtered) {
      const d = j.completed_at
        ? parseISO(j.completed_at)
        : j.scheduled_date
          ? parseISO(j.scheduled_date)
          : parseISO(j.created_at);
      const day = startOfDay(d);
      if (isToday(day)) groups.today.push(j);
      else if (isYesterday(day)) groups.yesterday.push(j);
      else if (now.getTime() - day.getTime() <= 7 * 24 * 60 * 60 * 1000) groups.thisWeek.push(j);
      else if (now.getMonth() === day.getMonth() && now.getFullYear() === day.getFullYear()) groups.thisMonth.push(j);
      else groups.older.push(j);
    }
    return groups;
  }, [filtered]);

  const bucketOrder = ["today", "yesterday", "thisWeek", "thisMonth", "older"];

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              היסטוריית קריאות
            </h1>
            <p className="text-sm text-muted-foreground">קריאות שביצעת — מסודרות מהחדש לישן</p>
          </div>
          <Link to="/tech">
            <Button variant="outline" size="sm" className="gap-1">
              <Calendar className="h-4 w-4" />
              ליומן
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש לפי לקוח, כתובת או תיאור..."
                  className="pr-8"
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">סטטוס</div>
                <Select
                  value={statusFilter}
                  onValueChange={(v: "all" | "completed" | "other") => setStatusFilter(v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">הושלמו</SelectItem>
                    <SelectItem value="other">בטיפול / פתוחות</SelectItem>
                    <SelectItem value="all">הכל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading && <p className="text-center text-muted-foreground py-8">טוען...</p>}

        {!isLoading && filtered.length === 0 && (
          <div className="border border-dashed rounded-lg py-10 text-center text-sm text-muted-foreground">
            לא נמצאו קריאות בהסטוריה
          </div>
        )}

        {!isLoading && (
          <div className="space-y-4">
            {bucketOrder.map((bucket) => {
              const list = grouped[bucket];
              if (!list.length) return null;
              return (
                <div key={bucket}>
                  <div className="sticky top-14 z-10 bg-background/95 backdrop-blur border-b py-2 mb-2">
                    <h2 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                      {bucket === "today" && <Calendar className="h-4 w-4" />}
                      {bucketLabels[bucket]}
                      <Badge variant="outline" className="text-xs">{list.length}</Badge>
                    </h2>
                  </div>
                  <div className="grid gap-3">
                    {list.map((job) => (
                      <JobHistoryCard key={job.id} job={job} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function JobHistoryCard({ job }: { job: Job }) {
  const isCompleted = job.status === "completed";
  const completedAt = job.completed_at ? parseISO(job.completed_at) : null;
  const scheduledAt = job.scheduled_date ? parseISO(job.scheduled_date) : null;
  const dateLabel = completedAt
    ? `בוצעה ב-${format(completedAt, "EEEE, d MMMM yyyy", { locale: he })}`
    : scheduledAt
      ? `מתוכננת ל-${format(scheduledAt, "EEEE, d MMMM yyyy", { locale: he })}`
      : null;

  const timeRange =
    job.start_time && job.end_time
      ? `${format(parseISO(job.start_time), "HH:mm")} – ${format(parseISO(job.end_time), "HH:mm")}`
      : null;

  return (
    <Link
      to="/tech/$jobId"
      params={{ jobId: job.id }}
      className={cn(
        "block rounded-lg border p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/40",
        isCompleted ? "bg-success/5 border-success/20" : "bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{job.title}</h3>
            <Badge variant="outline" className={cn("text-xs", statusColor(job.status))}>
              {isCompleted && <CheckCircle2 className="h-3 w-3 ml-1" />}
              {statusLabel(job.status)}
            </Badge>
          </div>
          {job.client?.name && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{job.client.name}</span>
              {job.client.address && (
                <span className="truncate opacity-70">· {job.client.address}</span>
              )}
            </div>
          )}
          {job.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            {dateLabel && <span>{dateLabel}</span>}
            {timeRange && (
              <span className="inline-flex items-center gap-1" dir="ltr">
                <Clock className="h-3 w-3" />
                {timeRange}
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
      </div>
    </Link>
  );
}
