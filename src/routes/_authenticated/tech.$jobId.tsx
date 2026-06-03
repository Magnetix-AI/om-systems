import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, statusLabel, statusColor } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Trash2, Plus, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tech/$jobId")({
  ssr: false,
  component: JobDetail,
});

type DraftItem = { id: string; product_id: string; quantity: number };

function JobDetail() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, client:clients(*), items:job_items(id, product_id, quantity, unit_price, product:products(name, price, unit))")
        .eq("id", jobId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("id, name, sku, price, unit, category")
        .eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (job?.technician_notes) setNotes(job.technician_notes); }, [job?.id]);

  const completed = job?.status === "completed";
  const existing = (job?.items ?? []) as any[];
  const existingTotal = existing.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const newTotal = products.reduce((s: number, p: any) => s + (quantities[p.id] || 0) * Number(p.price), 0);
  const total = existingTotal + newTotal;

  const setQty = (id: string, v: number) => setQuantities(q => ({ ...q, [id]: Math.max(0, v) }));

  const handleSubmit = async () => {
    if (!job) return;
    setSaving(true);
    try {
      const rows = products
        .filter((p: any) => (quantities[p.id] || 0) > 0)
        .map((p: any) => ({ job_id: job.id, product_id: p.id, quantity: quantities[p.id], unit_price: Number(p.price) }));
      if (rows.length) {
        const { error: itemsErr } = await supabase.from("job_items").insert(rows);
        if (itemsErr) throw itemsErr;
      }
      const { error } = await supabase.from("jobs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        technician_notes: notes,
      }).eq("id", job.id);
      if (error) throw error;
      toast.success("הקריאה סומנה כסופקה");
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["tech-jobs"] });
      navigate({ to: "/tech" });
    } catch (e: any) {
      toast.error("שגיאה בסגירת הקריאה", { description: e.message });
    } finally { setSaving(false); }
  };

  const startWork = async () => {
    if (!job || job.status !== "open") return;
    await supabase.from("jobs").update({ status: "in_progress" }).eq("id", job.id);
    qc.invalidateQueries({ queryKey: ["job", jobId] });
  };

  if (isLoading) return <AppShell><div className="p-8 text-center text-muted-foreground">טוען...</div></AppShell>;
  if (!job) return <AppShell><div className="p-8 text-center text-muted-foreground">קריאה לא נמצאה</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Link to="/tech" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> חזרה לקריאות
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xl">{job.title}</CardTitle>
              <Badge variant="outline" className={statusColor(job.status)}>{statusLabel(job.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {job.description && <p className="text-muted-foreground">{job.description}</p>}
            {job.client && (
              <div className="bg-secondary/40 rounded-lg p-3 space-y-1">
                <div className="font-semibold">פרטי לקוח</div>
                <div>{job.client.name}</div>
                {job.client.contact_name && <div className="text-muted-foreground">איש קשר: {job.client.contact_name}</div>}
                {job.client.phone && <div className="text-muted-foreground" dir="ltr">{job.client.phone}</div>}
                {job.client.address && <div className="text-muted-foreground">{job.client.address}</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">חומרים וציוד</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">לא נוספו פריטים עדיין</p>}
            {allItems.map((it, idx) => (
              <div key={it.key} className="flex items-center gap-2">
                {it.existing || completed ? (
                  <div className="flex-1 text-sm">{it.name}</div>
                ) : (
                  <Select
                    value={it.product_id}
                    onValueChange={(v) => setDraft(d => d.map(x => x.id === it.key ? { ...x, product_id: v } : x))}
                  >
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — ₪{Number(p.price).toFixed(2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input
                  type="number" min={0} step="0.5"
                  value={it.quantity}
                  disabled={it.existing || completed}
                  onChange={e => setDraft(d => d.map(x => x.id === it.key ? { ...x, quantity: Number(e.target.value) } : x))}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground w-10">{it.unit}</span>
                <span className="text-sm w-20 text-left">₪{(it.quantity * it.unit_price).toFixed(2)}</span>
                {!it.existing && !completed && (
                  <Button variant="ghost" size="icon" onClick={() => setDraft(d => d.filter(x => x.id !== it.key))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {!completed && (
              <Button variant="outline" onClick={addRow} className="w-full" disabled={products.length === 0}>
                <Plus className="h-4 w-4 ml-1" /> הוסף פריט
              </Button>
            )}
            <div className="border-t pt-3 flex justify-between font-semibold">
              <span>סה״כ</span>
              <span>₪{total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">הערות טכנאי</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              disabled={completed}
              onChange={e => setNotes(e.target.value)}
              placeholder="פרט את העבודה שבוצעה..."
              rows={4}
            />
          </CardContent>
        </Card>

        {!completed && (
          <div className="flex gap-2 sticky bottom-4">
            {job.status === "open" && (
              <Button variant="outline" onClick={startWork} className="flex-1">סמן בטיפול</Button>
            )}
            <Button onClick={handleSubmit} disabled={saving} className="flex-1 bg-success hover:bg-success/90 text-success-foreground">
              <CheckCircle2 className="h-4 w-4 ml-1" />
              {saving ? "שומר..." : "שלח וסגור קריאה"}
            </Button>
          </div>
        )}
        {completed && (
          <Card className="bg-success/10 border-success/30">
            <CardContent className="p-4 text-center text-sm font-medium text-success flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              הקריאה הושלמה {job.completed_at && `ב-${new Date(job.completed_at).toLocaleDateString("he-IL")}`}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
