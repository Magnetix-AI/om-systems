import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { statusLabel, statusColor } from "@/components/app-shell";
import { AttachmentsManager } from "@/components/attachments-manager";

export const Route = createFileRoute("/_authenticated/admin/jobs/$jobId")({
  ssr: false,
  component: AdminJobDetail,
});

export default function AdminJobDetail() {
  const { jobId } = Route.useParams();
  const { data: job } = useQuery({
    queryKey: ["admin-job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, client:clients(name, phone, address)")
        .eq("id", jobId).maybeSingle();
      if (error) throw error;
      if (data?.technician_id) {
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", data.technician_id).maybeSingle();
        (data as any).technician_name = prof?.full_name;
      }
      return data;
    },
  });

  if (!job) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <Link to="/admin" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> חזרה לקריאות
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle>{job.title}</CardTitle>
            <Badge variant="outline" className={statusColor(job.status)}>{statusLabel(job.status)}</Badge>
          </div>
          {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}
          <div className="text-sm text-muted-foreground mt-2 space-y-0.5">
            <div>לקוח: {job.client?.name ?? "—"} {job.client?.phone && <span dir="ltr">({job.client.phone})</span>}</div>
            <div>טכנאי: {(job as any).technician_name ?? "לא משויך"}</div>
            {job.scheduled_date && <div>תאריך מתוכנן: {new Date(job.scheduled_date).toLocaleString("he-IL")}</div>}
          </div>
        </CardHeader>
      </Card>

      <AttachmentsManager jobId={jobId} />
    </div>
  );
}
