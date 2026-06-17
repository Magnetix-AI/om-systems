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
        .select("*, client:clients(name, phone, address), items:job_items(id, quantity, unit_price, product:products(name, unit))")
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

  const fmtTime = (t?: string | null) =>
    t ? new Date(t).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : null;
  const fmtDateTime = (t?: string | null) =>
    t ? new Date(t).toLocaleString("he-IL") : null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <Link to="/admin/jobs" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">עדכוני טכנאי</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1">
            <div className="font-medium">שעות פעילות</div>
            <div className="text-muted-foreground space-y-0.5">
              {(job as any).start_time && <div>התחלה: {fmtTime((job as any).start_time)}</div>}
              {(job as any).end_time && <div>סיום: {fmtTime((job as any).end_time)}</div>}
              {(job as any).arrival_time && <div>כניסה: {fmtTime((job as any).arrival_time)}</div>}
              {(job as any).departure_time && <div>יציאה: {fmtTime((job as any).departure_time)}</div>}
              {job.completed_at && <div>הושלמה: {fmtDateTime(job.completed_at)}</div>}
              {!(job as any).start_time && !(job as any).end_time && !(job as any).arrival_time && !(job as any).departure_time && !job.completed_at && (
                <div>אין רישום שעות</div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-medium">הערות טכנאי</div>
            <div className="text-muted-foreground whitespace-pre-wrap">
              {job.technician_notes?.trim() ? job.technician_notes : "אין הערות"}
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-medium">פריטים שנוספו</div>
            {(job as any).items?.length ? (
              <ul className="text-muted-foreground space-y-0.5 list-disc pr-5">
                {(job as any).items.map((it: any) => (
                  <li key={it.id}>
                    {it.product?.name ?? "פריט"} — {it.quantity} {it.product?.unit ?? ""} × ₪{it.unit_price}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">אין פריטים</div>
            )}
          </div>
        </CardContent>
      </Card>

      <AttachmentsManager jobId={jobId} />
    </div>
  );
}

