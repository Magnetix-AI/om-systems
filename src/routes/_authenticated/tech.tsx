import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, statusLabel, statusColor } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, ChevronLeft, Briefcase } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/tech")({
  ssr: false,
  component: TechDashboard,
});

function TechDashboard() {
  const { data: user } = useCurrentUser();
  const userId = user?.id;

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["tech-jobs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, description, status, scheduled_date, completed_at, client:clients(name, address, phone)")
        .eq("technician_id", userId!)
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const active = jobs.filter((j: any) => j.status !== "completed");
  const completed = jobs.filter((j: any) => j.status === "completed");

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">שלום, {user?.fullName}</h1>
          <p className="text-sm text-muted-foreground">להלן הקריאות המשויכות אליך</p>
        </div>
        <Tabs defaultValue="active">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="active">פעילות ({active.length})</TabsTrigger>
            <TabsTrigger value="history">היסטוריה ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="space-y-3 mt-4">
            {isLoading && <p className="text-center text-muted-foreground py-8">טוען...</p>}
            {!isLoading && active.length === 0 && <EmptyState text="אין כרגע קריאות פעילות" />}
            {active.map((j: any) => <JobCard key={j.id} job={j} />)}
          </TabsContent>
          <TabsContent value="history" className="space-y-3 mt-4">
            {!isLoading && completed.length === 0 && <EmptyState text="אין קריאות שהושלמו עדיין" />}
            {completed.map((j: any) => <JobCard key={j.id} job={j} />)}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
        <Briefcase className="h-8 w-8 opacity-40" />
        <p>{text}</p>
      </CardContent>
    </Card>
  );
}

function JobCard({ job }: { job: any }) {
  return (
    <Link to="/tech/$jobId" params={{ jobId: job.id }}>
      <Card className="hover:shadow-[var(--shadow-card)] transition-all hover:border-primary/40 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold leading-tight">{job.title}</h3>
            <Badge variant="outline" className={statusColor(job.status)}>{statusLabel(job.status)}</Badge>
          </div>
          {job.client && (
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="font-medium text-foreground">{job.client.name}</div>
              {job.client.address && (
                <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.client.address}</div>
              )}
            </div>
          )}
          {job.scheduled_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              <Calendar className="h-3 w-3" />
              {format(new Date(job.scheduled_date), "dd/MM/yyyy HH:mm")}
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
