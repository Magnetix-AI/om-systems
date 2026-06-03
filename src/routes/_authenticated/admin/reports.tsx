import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Send, Download, ChevronDown, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  ssr: false,
  component: AdminReports,
});

function AdminReports() {
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          id, title, completed_at, sent_to_invoicing, sent_to_invoicing_at, technician_notes,
          client:clients(name, address, phone),
          technician:profiles!jobs_technician_id_fkey(full_name),
          items:job_items(quantity, unit_price, product:products(name, unit))
        `)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const computeTotal = (items: any[]) =>
    (items ?? []).reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);

  const sendToInvoicing = async (id: string) => {
    const { error } = await supabase.from("jobs").update({
      sent_to_invoicing: true,
      sent_to_invoicing_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error("שגיאה", { description: error.message });
    toast.success("נשלח לחיוב (סימולציה — חיבור Webhook ייעשה בהמשך)");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const exportCSV = () => {
    const rows = [
      ["תאריך השלמה", "כותרת", "לקוח", "טכנאי", "פריטים", "סה״כ ₪", "נשלח לחיוב"],
      ...reports.map((r: any) => [
        r.completed_at ? new Date(r.completed_at).toLocaleString("he-IL") : "",
        r.title,
        r.client?.name ?? "",
        r.technician?.full_name ?? "",
        (r.items ?? []).map((it: any) => `${it.product?.name} x${it.quantity}`).join("; "),
        computeTotal(r.items).toFixed(2),
        r.sent_to_invoicing ? "כן" : "לא",
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const totalRevenue = reports.reduce((s: number, r: any) => s + computeTotal(r.items), 0);
  const pendingInvoice = reports.filter((r: any) => !r.sent_to_invoicing).length;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">דוחות וחיוב</h1>
          <p className="text-sm text-muted-foreground">קריאות שהושלמו מהשטח, מוכנות לחשבונית</p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={reports.length === 0}>
          <Download className="h-4 w-4 ml-1" /> ייצוא לקובץ CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">קריאות שהושלמו</div><div className="text-3xl font-bold mt-1">{reports.length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">ממתינות לחיוב</div><div className="text-3xl font-bold mt-1 text-accent">{pendingInvoice}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">סך הכנסות פוטנציאליות</div><div className="text-3xl font-bold mt-1 text-success">₪{totalRevenue.toFixed(2)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>קריאות שהושלמו</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">טוען...</p>
          : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 opacity-40" /><p>אין עדיין קריאות שהושלמו</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r: any) => <ReportRow key={r.id} report={r} total={computeTotal(r.items)} onSend={() => sendToInvoicing(r.id)} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportRow({ report, total, onSend }: { report: any; total: number; onSend: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg bg-card">
      <div className="flex items-center justify-between gap-2 p-4">
        <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-right">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          <div className="flex-1">
            <div className="font-semibold">{report.title}</div>
            <div className="text-xs text-muted-foreground">
              {report.client?.name} • טכנאי: {report.technician?.full_name ?? "—"} • {report.completed_at && new Date(report.completed_at).toLocaleDateString("he-IL")}
            </div>
          </div>
          <div className="text-lg font-bold text-success">₪{total.toFixed(2)}</div>
        </CollapsibleTrigger>
        {report.sent_to_invoicing ? (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            <CheckCircle2 className="h-3 w-3 ml-1" /> נשלח לחיוב
          </Badge>
        ) : (
          <Button size="sm" onClick={onSend}>
            <Send className="h-4 w-4 ml-1" /> שלח לחשבונית
          </Button>
        )}
      </div>
      <CollapsibleContent>
        <div className="border-t p-4 bg-secondary/30 space-y-3">
          {report.client && (
            <div className="text-sm">
              <span className="font-medium">פרטי לקוח: </span>
              {report.client.name} {report.client.address && `• ${report.client.address}`} {report.client.phone && `• ${report.client.phone}`}
            </div>
          )}
          {report.technician_notes && (
            <div className="text-sm"><span className="font-medium">הערות טכנאי: </span>{report.technician_notes}</div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">פריט</TableHead>
                <TableHead className="text-right">כמות</TableHead>
                <TableHead className="text-right">מחיר ליחידה</TableHead>
                <TableHead className="text-right">סה״כ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report.items ?? []).map((it: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell>{it.product?.name}</TableCell>
                  <TableCell>{it.quantity} {it.product?.unit}</TableCell>
                  <TableCell>₪{Number(it.unit_price).toFixed(2)}</TableCell>
                  <TableCell className="font-medium">₪{(Number(it.quantity) * Number(it.unit_price)).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
