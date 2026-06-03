import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products")({
  ssr: false,
  component: AdminProducts,
});

function AdminProducts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });

  const filtered = products.filter((p: any) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  );

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק את המוצר?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error("שגיאה במחיקה", { description: error.message });
    toast.success("המוצר נמחק");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">מלאי ומחירון</h1>
          <p className="text-sm text-muted-foreground">ניהול חומרים, ציוד ומחירים</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 ml-1" /> מוצר חדש</Button>
          </DialogTrigger>
          <ProductDialog product={editing} onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-products"] }); }} />
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>קטלוג מוצרים ({products.length})</CardTitle>
            <Input placeholder="חפש לפי שם / מק״ט / ברקוד" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">טוען...</p>
          : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
              <Package className="h-8 w-8 opacity-40" /><p>אין מוצרים במלאי</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם המוצר</TableHead>
                  <TableHead className="text-right">קטגוריה</TableHead>
                  <TableHead className="text-right">מק״ט</TableHead>
                  <TableHead className="text-right">ברקוד</TableHead>
                  <TableHead className="text-right">יחידה</TableHead>
                  <TableHead className="text-right">מחיר</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                    <TableCell dir="ltr" className="text-sm">{p.sku ?? "—"}</TableCell>
                    <TableCell dir="ltr" className="text-sm">{p.barcode ?? "—"}</TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell className="font-semibold">₪{Number(p.price).toFixed(2)}</TableCell>
                    <TableCell>
                      {p.is_active
                        ? <Badge variant="outline" className="bg-success/10 text-success border-success/30">פעיל</Badge>
                        : <Badge variant="outline">מושבת</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductDialog({ product, onClose }: { product: any; onClose: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "יח׳");
  const [price, setPrice] = useState(String(product?.price ?? "0"));
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name, sku: sku || null, barcode: barcode || null, category: category || null,
      unit, price: Number(price), is_active: isActive,
    };
    const op = product
      ? supabase.from("products").update(payload).eq("id", product.id)
      : supabase.from("products").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error("שגיאה בשמירה", { description: error.message });
    toast.success(product ? "המוצר עודכן" : "המוצר נוסף");
    onClose();
  };

  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>{product ? "עריכת מוצר" : "מוצר חדש"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>שם המוצר</Label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>מק״ט (SKU)</Label>
            <Input value={sku} onChange={e => setSku(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>ברקוד</Label>
            <Input value={barcode} onChange={e => setBarcode(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label>קטגוריה</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="כבלים / מצלמות..." />
          </div>
          <div className="space-y-1.5">
            <Label>יחידה</Label>
            <Input value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>מחיר ליחידה (₪)</Label>
            <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="active" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          <Label htmlFor="active" className="cursor-pointer">מוצר פעיל (זמין לטכנאים)</Label>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleSave} disabled={!name || saving}>{saving ? "שומר..." : "שמור"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
