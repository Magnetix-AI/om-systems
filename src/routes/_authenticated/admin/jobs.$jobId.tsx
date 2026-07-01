import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { statusLabel, statusColor } from "@/components/app-shell";
import { AttachmentsManager } from "@/components/attachments-manager";

const toLocalInput = (t?: string | null) => {
  if (!t) return "";
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const APP_TIME_ZONE = "Asia/Jerusalem";

const getDatePartsInAppTimeZone = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const v = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return { year: Number(v.year), month: Number(v.month), day: Number(v.day) };
};
const getTimeInAppTimeZone = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const v = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  const zonedAsUtc = Date.UTC(Number(v.year), Number(v.month) - 1, Number(v.day), Number(v.hour), Number(v.minute), Number(v.second));
  return zonedAsUtc - date.getTime();
};
const buildAttendanceTimestamp = (baseDate: string | Date, hhmm: string) => {
  const [hour, minute] = hhmm.split(":").map(Number);
  const { year, month, day } = getDatePartsInAppTimeZone(baseDate);
  const wallTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstPass = wallTimeAsUtc - getTimeZoneOffsetMs(new Date(wallTimeAsUtc), APP_TIME_ZONE);
  const finalPass = wallTimeAsUtc - getTimeZoneOffsetMs(new Date(firstPass), APP_TIME_ZONE);
  return new Date(finalPass).toISOString();
};


export const Route = createFileRoute("/_authenticated/admin/jobs/$jobId")({
  ssr: false,
  component: AdminJobDetail,
});

export default function AdminJobDetail() {
  const { jobId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: job } = useQuery({
    queryKey: ["admin-job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, client:clients(name, address), items:job_items(id, quantity, unit_price, product:products(name, unit))")
        .eq("id", jobId).maybeSingle();
      if (error) throw error;
      if (data?.technician_id) {
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", data.technician_id).maybeSingle();
        (data as any).technician_name = prof?.full_name;
      }
      return data;
    },
  });

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [times, setTimes] = useState({ start_time: "", end_time: "", arrival_time: "", departure_time: "", completed_at: "" });
  const [savingTimes, setSavingTimes] = useState(false);
  useEffect(() => {
    if (job) setNotes(job.technician_notes ?? "");
  }, [job?.id, job?.technician_notes]);
  useEffect(() => {
    if (!job) return;
    const j = job as any;
    setTimes({
      start_time: toLocalInput(j.start_time),
      end_time: toLocalInput(j.end_time),
      arrival_time: toLocalInput(j.arrival_time),
      departure_time: toLocalInput(j.departure_time),
      completed_at: toLocalInput(j.completed_at),
    });
  }, [job?.id, (job as any)?.start_time, (job as any)?.end_time, (job as any)?.arrival_time, (job as any)?.departure_time, (job as any)?.completed_at]);

  const saveNotes = async () => {
    setSaving(true);
    const { error } = await supabase.from("jobs").update({ technician_notes: notes }).eq("id", jobId);
    setSaving(false);
    if (error) { toast.error("שגיאה בשמירה"); return; }
    toast.success("הערות נשמרו");
    qc.invalidateQueries({ queryKey: ["admin-job", jobId] });
  };

  const saveTimes = async () => {
    setSavingTimes(true);
    const payload: any = {
      start_time: fromLocalInput(times.start_time),
      end_time: fromLocalInput(times.end_time),
      arrival_time: fromLocalInput(times.arrival_time),
      departure_time: fromLocalInput(times.departure_time),
      completed_at: fromLocalInput(times.completed_at),
    };
    const { error } = await supabase.from("jobs").update(payload).eq("id", jobId);
    setSavingTimes(false);
    if (error) { toast.error("שגיאה בשמירת שעות"); return; }
    toast.success("שעות עודכנו");
    qc.invalidateQueries({ queryKey: ["admin-job", jobId] });
  };

  if (!job) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;


  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) router.history.back();
          else router.navigate({ to: "/admin/jobs" });
        }}
        className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" /> חזרה
      </button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle>{job.title}</CardTitle>
            <Badge variant="outline" className={statusColor(job.status)}>{statusLabel(job.status)}</Badge>
          </div>
          {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}
          <div className="text-sm text-muted-foreground mt-2 space-y-0.5">
            <div>לקוח: {job.client?.name ?? "—"}</div>
            {(job as any).site_contact_name || (job as any).site_contact_phone ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span>איש קשר בשטח: {(job as any).site_contact_name || "—"}</span>
                {(job as any).site_contact_phone && (
                  <a href={`tel:${(job as any).site_contact_phone}`} dir="ltr" className="text-primary hover:underline inline-flex items-center gap-1">
                    {(job as any).site_contact_phone}
                  </a>
                )}
              </div>
            ) : null}
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
          <div className="space-y-2">
            <div className="font-medium">שעות פעילות</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                ["start_time", "התחלה"],
                ["end_time", "סיום"],
                ["arrival_time", "כניסה"],
                ["departure_time", "יציאה"],
                ["completed_at", "הושלמה"],
              ] as const).map(([k, label]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="datetime-local"
                    value={times[k]}
                    onChange={(e) => setTimes((t) => ({ ...t, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={saveTimes} disabled={savingTimes}>
                {savingTimes ? "שומר..." : "שמור שעות"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-medium">הערות טכנאי</div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="אין הערות" />
            <div className="flex justify-end">
              <Button size="sm" onClick={saveNotes} disabled={saving || notes === (job.technician_notes ?? "")}>
                {saving ? "שומר..." : "שמור הערות"}
              </Button>
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

