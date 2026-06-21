import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Plus, Search, Trash2, Clock, MapPin, Lock } from "lucide-react";
import { toast } from "sonner";
import { AttachmentsGallery } from "@/components/attachments-gallery";

export const Route = createFileRoute("/_authenticated/tech/projects/$projectId")({
  ssr: false,
  component: TechProjectDetail,
});

function fmtTime(ts: string | null) { return ts ? new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—"; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("he-IL") : "—"; }

function TechProjectDetail() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();

  const { data: project } = useQuery({
    queryKey: ["tech-project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, client:clients(name, address)")
        .eq("id", projectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["tech-project-visits", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_visits")
        .select("id, visit_date, arrival_time, departure_time, notes, technician_id, items:project_visit_items(id, quantity, product:products(name, unit))")
        .eq("project_id", projectId)
        .order("visit_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("id, name, sku, unit, category, price").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const [visitDate, setVisitDate] = useState(today);
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p: any) =>
      p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    );
  }, [products, search]);

  if (!project) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;
  const isOpen = project.status === "open";

  const buildTs = (date: string, time: string) => time ? new Date(`${date}T${time}:00`).toISOString() : null;

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { data: visit, error } = await supabase.from("project_visits").insert({
        project_id: projectId,
        technician_id: user.id,
        visit_date: visitDate,
        arrival_time: buildTs(visitDate, arrival),
        departure_time: buildTs(visitDate, departure),
        notes: notes || null,
      }).select("id").single();
      if (error) throw error;

      const items = Object.entries(quantities)
        .filter(([, q]) => q > 0)
        .map(([product_id, quantity]) => {
          const p = products.find((pr: any) => pr.id === product_id);
          return { visit_id: visit.id, product_id, quantity, unit_price: p?.price ?? 0 };
        });
      if (items.length) {
        const { error: itErr } = await supabase.from("project_visit_items").insert(items);
        if (itErr) throw itErr;
      }
      toast.success("יום העבודה נשמר");
      setArrival(""); setDeparture(""); setNotes(""); setQuantities({}); setSearch("");
      qc.invalidateQueries({ queryKey: ["tech-project-visits", projectId] });
    } catch (e: any) {
      toast.error("שגיאה בשמירה", { description: e.message });
    } finally { setSaving(false); }
  };

  const deleteVisit = async (id: string) => {
    if (!confirm("למחוק יום עבודה זה?")) return;
    const { error } = await supabase.from("project_visits").delete().eq("id", id);
    if (error) return toast.error("שגיאה", { description: error.message });
    toast.success("נמחק");
    qc.invalidateQueries({ queryKey: ["tech-project-visits", projectId] });
  };

  const setQty = (id: string, q: number) => setQuantities(prev => {
    const n = { ...prev };
    if (q <= 0) delete n[id]; else n[id] = q;
    return n;
  });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <button onClick={() => navigate({ to: "/tech" })} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> חזרה
        </button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-lg">{project.title}</CardTitle>
              <Badge variant="outline" className={isOpen ? "bg-primary/10 text-primary border-primary/30" : "bg-success/10 text-success border-success/30"}>
                {isOpen ? "פעיל" : "סגור"}
              </Badge>
            </div>
            {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
            {project.client && (
              <div className="text-sm space-y-0.5 mt-2">
                <div className="font-medium">{project.client.name}</div>
                {project.client.address && <div className="text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{project.client.address}</div>}
              </div>
            )}
          </CardHeader>
        </Card>

        <AttachmentsGallery projectId={projectId} />

        {isOpen ? (
          <Card>
            <CardHeader><CardTitle className="text-base">יום עבודה חדש</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-xs">תאריך</Label><Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">כניסה</Label><Input type="time" step={300} value={arrival} onChange={e => setArrival(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">יציאה</Label><Input type="time" step={300} value={departure} onChange={e => setDeparture(e.target.value)} /></div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">ציוד שסופק היום</Label>
                <div className="relative">
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pr-8" placeholder="חיפוש ציוד..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
                  {filtered.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">אין תוצאות</p>}
                  {filtered.map((p: any) => {
                    const qty = quantities[p.id] ?? 0;
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(p.id, Math.max(0, qty - 1))}>-</Button>
                          <Input className="h-7 w-12 text-center" value={qty} onChange={e => setQty(p.id, parseInt(e.target.value) || 0)} />
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(p.id, qty + 1)}><Plus className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">הערות</Label>
                <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="מה בוצע היום..." />
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving || !arrival}>
                {saving ? "שומר..." : "שמור יום עבודה"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-muted/30"><CardContent className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Lock className="h-4 w-4" /> הפרוייקט סגור — לא ניתן להוסיף ימי עבודה
          </CardContent></Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">ימי עבודה ({visits.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {visits.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">עדיין לא נרשמו ימי עבודה</p>}
            {visits.map((v: any) => (
              <div key={v.id} className="border rounded-md p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-semibold text-sm">{fmtDate(v.visit_date)}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime(v.arrival_time)} - {fmtTime(v.departure_time)}</span>
                    {isOpen && v.technician_id === user?.id && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteVisit(v.id)}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </div>
                </div>
                {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                {v.items?.length > 0 && (
                  <ul className="text-xs space-y-0.5 border-t pt-1.5">
                    {v.items.map((it: any) => (
                      <li key={it.id}>• {it.product?.name} × {it.quantity} {it.product?.unit}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
