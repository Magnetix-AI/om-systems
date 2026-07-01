import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Link } from "@tanstack/react-router";
import { statusLabel, statusColor } from "@/components/app-shell";

export function AdminViewJobDialog({
  jobId,
  onClose,
}: {
  jobId: string | null;
  onClose: () => void;
}) {
  const { data: job, isLoading } = useQuery({
    enabled: !!jobId,
    queryKey: ["admin-view-job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, client:clients(name, address), items:job_items(id, quantity, unit_price, product:products(name, unit))")
        .eq("id", jobId!).maybeSingle();
      if (error) throw error;
      if (data?.technician_id) {
        const { data: prof } = await supabase.from("profiles")
          .select("full_name").eq("id", data.technician_id).maybeSingle();
        (data as any).technician_name = prof?.full_name;
      }
      return data;
    },
  });

  const fmt = (t?: string | null) => t ? new Date(t).toLocaleString("he-IL") : "—";

  return (
    <Dialog open={!!jobId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            פרטי קריאה
            {job && <Badge variant="outline" className={statusColor(job.status)}>{statusLabel(job.status)}</Badge>}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !job ? (
          <div className="py-8 text-center text-sm text-muted-foreground">טוען...</div>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-semibold text-base">{job.title}</div>
              {job.description && <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2 border rounded-md p-2 bg-secondary/20">
              <div><span className="text-muted-foreground">לקוח: </span>{job.client?.name ?? "—"}</div>
              <div><span className="text-muted-foreground">טכנאי: </span>{(job as any).technician_name ?? "לא משויך"}</div>
              <div><span className="text-muted-foreground">התחלה: </span>{fmt((job as any).start_time ?? job.scheduled_date)}</div>
              <div><span className="text-muted-foreground">סיום: </span>{fmt((job as any).end_time)}</div>
              <div><span className="text-muted-foreground">כניסה: </span>{fmt((job as any).arrival_time)}</div>
              <div><span className="text-muted-foreground">יציאה: </span>{fmt((job as any).departure_time)}</div>
              <div className="col-span-2"><span className="text-muted-foreground">זמן עדכון הקריאה: </span>{fmt((job as any).completed_at)}</div>
            </div>

            {((job as any).site_contact_name || (job as any).site_contact_phone || (job as any).site_contact_address) && (
              <div className="border rounded-md p-2 space-y-0.5">
                <div className="font-semibold">איש קשר בשטח</div>
                <div>{(job as any).site_contact_name || "—"}</div>
                {(job as any).site_contact_phone && (
                  <a href={`tel:${(job as any).site_contact_phone}`} dir="ltr" className="text-primary hover:underline block">
                    {(job as any).site_contact_phone}
                  </a>
                )}
                {(job as any).site_contact_address && <div>{(job as any).site_contact_address}</div>}
              </div>
            )}

            <div className="space-y-1">
              <div className="font-semibold">הערות טכנאי</div>
              <div className="border rounded-md p-2 bg-muted/30 whitespace-pre-wrap min-h-[60px]">
                {(job as any).technician_notes || <span className="text-muted-foreground">אין הערות</span>}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-semibold">פריטים שנוספו</div>
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
          </div>
        )}
        <DialogFooter className="gap-2">
          {job && (
            <Button variant="outline" asChild>
              <Link to="/admin/jobs/$jobId" params={{ jobId: job.id }} onClick={onClose}>פתח דף מלא</Link>
            </Button>
          )}
          <Button onClick={onClose}>סגור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
