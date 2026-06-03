import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, statusLabel, statusColor } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, ArrowRight, CheckCircle2, Search, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tech/$jobId")({
  ssr: false,
  component: JobDetail,
});


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
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState(false);
  const recRef = React.useRef<any>(null);

  useEffect(() => { if (job?.technician_notes) setNotes(job.technician_notes); }, [job?.id]);

  const filteredProducts = products.filter((p: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (p.name?.toLowerCase().includes(q)) || (p.sku?.toLowerCase().includes(q)) || (p.category?.toLowerCase().includes(q));
  });

  const toggleRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("הדפדפן לא תומך בהקלטה קולית");
      return;
    }
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "he-IL";
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = notes ? notes + " " : "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setNotes((finalText + interim).trim());
    };
    rec.onerror = (e: any) => { toast.error("שגיאת הקלטה", { description: e.error }); setRecording(false); };
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    rec.start();
    setRecording(true);
  };

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

        {existing.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">פריטים שכבר דווחו</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {existing.map((it: any) => (
                <div key={it.id} className="flex items-center justify-between text-sm border-b pb-1">
                  <span>{it.product?.name}</span>
                  <span className="text-muted-foreground">{Number(it.quantity)} {it.product?.unit}</span>
                  <span className="font-medium">₪{(Number(it.quantity) * Number(it.unit_price)).toFixed(2)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!completed && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">מאגר ציוד — סמן כמויות שסופקו</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="חיפוש במאגר ציוד..."
                  className="pr-8"
                />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {products.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">אין פריטים במלאי</p>}
                {products.length > 0 && filteredProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">לא נמצאו תוצאות</p>}
                {filteredProducts.map((p: any) => {
                  const qty = quantities[p.id] || 0;
                  const active = qty > 0;
                  return (
                    <div key={p.id} className={`flex items-center gap-2 rounded-lg p-2 border transition-colors ${active ? "bg-success/10 border-success/40" : "bg-secondary/30"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">₪{Number(p.price).toFixed(2)} / {p.unit}{p.category ? ` · ${p.category}` : ""}</div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(p.id, qty - 1)} disabled={qty <= 0}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number" min={0} step="1" value={qty}
                        onChange={e => setQty(p.id, Number(e.target.value))}
                        className="w-16 h-8 text-center"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(p.id, qty + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 flex justify-between font-semibold">
            <span>סה״כ לחיוב</span>
            <span>₪{total.toFixed(2)}</span>
          </CardContent>
        </Card>


        <Card>
          <CardHeader><CardTitle className="text-lg">הערות טכנאי</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Textarea
                value={notes}
                disabled={completed}
                onChange={e => setNotes(e.target.value)}
                placeholder="פרט את העבודה שבוצעה... או לחץ על המיקרופון להקלטה"
                rows={4}
                className="pl-12"
              />
              {!completed && (
                <Button
                  type="button"
                  variant={recording ? "destructive" : "secondary"}
                  size="icon"
                  onClick={toggleRecording}
                  className={`absolute bottom-2 left-2 h-9 w-9 rounded-full ${recording ? "animate-pulse" : ""}`}
                  title={recording ? "עצור הקלטה" : "הקלט תמלול"}
                >
                  {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
            </div>
            {recording && <p className="text-xs text-muted-foreground text-center">🎙️ מקליט... דבר בעברית</p>}
          </CardContent>
        </Card>

        {!completed && (
          <div className="flex gap-2 sticky bottom-4">
            {job.status === "open" && (
              <Button variant="outline" onClick={startWork} className="flex-1">סמן בטיפול</Button>
            )}
            <Button onClick={handleSubmit} disabled={saving} className="flex-1 bg-success hover:bg-success/90 text-success-foreground">
              <CheckCircle2 className="h-4 w-4 ml-1" />
              {saving ? "שומר..." : "סופק — סגור קריאה"}
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
