import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Plus, Pencil, Trash2, Package, ChevronDown, ChevronLeft, Folder, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/products")({
  ssr: false,
  component: AdminProducts,
});

type ProductCategory = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

const ALL = "__all__";
const UNCAT = "__uncat__";

function AdminProducts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>(ALL);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });

  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name, parent_id, sort_order")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProductCategory[];
    },
  });

  const childrenOf = useMemo(() => {
    const m = new Map<string | null, ProductCategory[]>();
    for (const c of categories) {
      const k = c.parent_id;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [categories]);

  const descendants = (cid: string): string[] => {
    const out = [cid];
    for (const c of childrenOf.get(cid) ?? []) out.push(...descendants(c.id));
    return out;
  };

  const filtered = useMemo(() => {
    let list = products as any[];
    if (selectedCat === UNCAT) {
      list = list.filter(p => !p.category_id);
    } else if (selectedCat !== ALL) {
      const allowed = new Set(descendants(selectedCat));
      list = list.filter(p => p.category_id && allowed.has(p.category_id));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.includes(search),
      );
    }
    return list;
  }, [products, selectedCat, search, descendants]);

  const productCountByCat = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const p of products as any[]) {
      m.set(p.category_id ?? null, (m.get(p.category_id ?? null) ?? 0) + 1);
    }
    return m;
  }, [products]);

  const totalInCat = (cid: string): number =>
    descendants(cid).reduce((s, id) => s + (productCountByCat.get(id) ?? 0), 0);

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק את המוצר?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error("שגיאה במחיקה", { description: error.message });
    toast.success("המוצר נמחק");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  return (
    <div className="max-w-[1500px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">מלאי ומחירון</h1>
          <p className="text-sm text-muted-foreground">ניהול חומרים, ציוד ומחירים — גרור מוצר לקטגוריה כדי לשייך</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 ml-1" /> מוצר חדש</Button>
          </DialogTrigger>
          <ProductDialog
            product={editing}
            categories={categories}
            defaultCategoryId={selectedCat !== ALL && selectedCat !== UNCAT ? selectedCat : null}
            onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-products"] }); }}
          />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <CategoryTreePanel
          categories={categories}
          childrenOf={childrenOf}
          totalInCat={totalInCat}
          totalProducts={products.length}
          uncategorized={productCountByCat.get(null) ?? 0}
          selected={selectedCat}
          onSelect={setSelectedCat}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>
                {selectedCat === ALL ? "כל המוצרים" :
                 selectedCat === UNCAT ? "ללא קטגוריה" :
                 categories.find(c => c.id === selectedCat)?.name ?? "מוצרים"}
                {" "}({filtered.length})
              </CardTitle>
              <Input placeholder="חפש לפי שם / מק״ט / ברקוד" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-center py-8 text-muted-foreground">טוען...</p>
            : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                <Package className="h-8 w-8 opacity-40" /><p>אין מוצרים</p>
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
                  {filtered.map((p: any) => {
                    const cat = categories.find(c => c.id === p.category_id);
                    return (
                      <TableRow
                        key={p.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("application/x-product", p.id);
                        }}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{cat?.name ?? p.category ?? "—"}</TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CategoryTreePanel({
  categories, childrenOf, totalInCat, totalProducts, uncategorized, selected, onSelect,
}: {
  categories: ProductCategory[];
  childrenOf: Map<string | null, ProductCategory[]>;
  totalInCat: (cid: string) => number;
  totalProducts: number;
  uncategorized: number;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [renameTarget, setRenameTarget] = useState<ProductCategory | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addParent, setAddParent] = useState<ProductCategory | "root" | null>(null);
  const [addName, setAddName] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["product-categories"] });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const moveProduct = async (productId: string, categoryId: string | null) => {
    const { error } = await supabase.from("products").update({ category_id: categoryId }).eq("id", productId);
    if (error) return toast.error("שגיאה", { description: error.message });
    toast.success("המוצר הועבר");
    invalidate();
  };

  const descendants = (cid: string): string[] => {
    const out = [cid];
    for (const c of childrenOf.get(cid) ?? []) out.push(...descendants(c.id));
    return out;
  };
  const reparent = async (catId: string, newParent: string | null) => {
    if (catId === newParent) return;
    if (newParent && descendants(catId).includes(newParent)) return toast.error("לא ניתן להעביר לתת-קטגוריה של עצמה");
    const siblings = (childrenOf.get(newParent) ?? []).filter(c => c.id !== catId);
    const nextOrder = siblings.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1;
    const { error } = await supabase.from("product_categories").update({ parent_id: newParent, sort_order: nextOrder }).eq("id", catId);
    if (error) return toast.error("שגיאה", { description: error.message });
    invalidate();
  };
  const reorderSibling = async (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) => {
    const target = categories.find(c => c.id === targetId);
    const dragged = categories.find(c => c.id === draggedId);
    if (!target || !dragged) return;
    if (draggedId === targetId) return;
    if (descendants(draggedId).includes(targetId)) return toast.error("לא ניתן להעביר לתת-קטגוריה של עצמה");
    const newParent = target.parent_id;
    const siblings = (childrenOf.get(newParent) ?? [])
      .filter(c => c.id !== draggedId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const idx = siblings.findIndex(c => c.id === targetId);
    const insertAt = position === "before" ? idx : idx + 1;
    siblings.splice(insertAt, 0, { ...dragged, parent_id: newParent });
    const results = await Promise.all(
      siblings.map((c, i) =>
        supabase.from("product_categories")
          .update({ sort_order: i, parent_id: newParent })
          .eq("id", c.id),
      ),
    );
    const err = results.find(r => r.error)?.error;
    if (err) return toast.error("שגיאה בסידור", { description: err.message });
    invalidate();
  };
  const createCat = async (parent_id: string | null, name: string) => {
    const n = name.trim();
    if (!n) return;
    const siblings = childrenOf.get(parent_id) ?? [];
    const nextOrder = siblings.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1;
    const { error } = await supabase.from("product_categories").insert({ name: n, parent_id, sort_order: nextOrder });
    if (error) return toast.error("שגיאה", { description: error.message });
    invalidate();
  };
  const renameCat = async (id: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase.from("product_categories").update({ name: n }).eq("id", id);
    if (error) return toast.error("שגיאה", { description: error.message });
    invalidate();
  };
  const deleteCat = async (cat: ProductCategory) => {
    if (!confirm(`למחוק את הקטגוריה "${cat.name}"? המוצרים והתתים יועברו לקטגוריית האב.`)) return;
    const fallback = cat.parent_id;
    await supabase.from("products").update({ category_id: fallback }).eq("category_id", cat.id);
    await supabase.from("product_categories").update({ parent_id: fallback }).eq("parent_id", cat.id);
    const { error } = await supabase.from("product_categories").delete().eq("id", cat.id);
    if (error) return toast.error("שגיאה", { description: error.message });
    toast.success("הקטגוריה נמחקה");
    invalidate();
  };

  const [dropHint, setDropHint] = useState<{ id: string; pos: "before" | "after" | "inside" } | null>(null);

  const computePos = (e: React.DragEvent<HTMLDivElement>): "before" | "after" | "inside" => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (y < h * 0.3) return "before";
    if (y > h * 0.7) return "after";
    return "inside";
  };

  const handleCatDragOver = (e: React.DragEvent<HTMLDivElement>, catId: string) => {
    if (e.dataTransfer.types.includes("application/x-product")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropHint({ id: catId, pos: "inside" });
      return;
    }
    if (e.dataTransfer.types.includes("application/x-pcat")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropHint({ id: catId, pos: computePos(e) });
    }
  };

  const handleCatDrop = (e: React.DragEvent<HTMLDivElement>, targetCatId: string) => {
    const productId = e.dataTransfer.getData("application/x-product");
    if (productId) {
      e.preventDefault();
      setDropHint(null);
      moveProduct(productId, targetCatId);
      return;
    }
    const catId = e.dataTransfer.getData("application/x-pcat");
    if (catId) {
      e.preventDefault();
      const pos = computePos(e);
      setDropHint(null);
      if (pos === "inside") reparent(catId, targetCatId);
      else reorderSibling(catId, targetCatId, pos);
    }
  };

  const dragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-product") ||
        e.dataTransfer.types.includes("application/x-pcat")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };

  const renderNode = (cat: ProductCategory, depth = 0) => {
    const kids = childrenOf.get(cat.id) ?? [];
    const isOpen = expanded[cat.id] ?? depth < 1;
    const isSelected = selected === cat.id;
    return (
      <div key={cat.id}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                "relative flex items-center gap-1 px-1.5 py-1 rounded cursor-pointer transition-colors",
                isSelected ? "bg-primary/15 text-primary" : "hover:bg-secondary/60",
                dropHint?.id === cat.id && dropHint.pos === "inside" && "ring-2 ring-primary bg-primary/10",
              )}
              style={{ paddingInlineStart: 6 + depth * 14 }}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("application/x-pcat", cat.id);
              }}
              onDragOver={(e) => handleCatDragOver(e, cat.id)}
              onDragLeave={() => setDropHint(h => (h?.id === cat.id ? null : h))}
              onDrop={(e) => handleCatDrop(e, cat.id)}
              onClick={() => onSelect(cat.id)}
            >
              {dropHint?.id === cat.id && dropHint.pos === "before" && (
                <span className="absolute inset-x-1 -top-px h-0.5 bg-primary rounded pointer-events-none" />
              )}
              {dropHint?.id === cat.id && dropHint.pos === "after" && (
                <span className="absolute inset-x-1 -bottom-px h-0.5 bg-primary rounded pointer-events-none" />
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded(s => ({ ...s, [cat.id]: !isOpen })); }}
                className="shrink-0 h-4 w-4 flex items-center justify-center"
              >
                {kids.length ? (
                  isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />
                ) : <span className="inline-block w-3" />}
              </button>
              {isOpen && kids.length ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" /> : <Folder className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-sm font-medium flex-1 truncate">{cat.name}</span>
              <Badge variant="outline" className="h-5 text-[10px] px-1.5">{totalInCat(cat.id)}</Badge>
            </div>

          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => { setAddParent(cat); setAddName(""); }}>
              <Plus className="h-3.5 w-3.5 ml-2" /> תת-קטגוריה
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { setRenameTarget(cat); setRenameValue(cat.name); }}>
              <Pencil className="h-3.5 w-3.5 ml-2" /> שנה שם
            </ContextMenuItem>
            <ContextMenuItem className="text-destructive" onClick={() => deleteCat(cat)}>
              <Trash2 className="h-3.5 w-3.5 ml-2" /> מחק
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {isOpen && kids.length > 0 && (
          <div className="mt-0.5 space-y-0.5">{kids.map(k => renderNode(k, depth + 1))}</div>
        )}
      </div>
    );
  };

  const roots = childrenOf.get(null) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Folder className="h-4 w-4 text-primary" /> קטגוריות</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAddParent("root"); setAddName(""); }}>
            <Plus className="h-3 w-3 ml-1" /> חדש
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent
        className="space-y-0.5 max-h-[calc(100vh-260px)] overflow-y-auto"
        onDragOver={dragOver}
        onDrop={(e) => {
          const catId = e.dataTransfer.getData("application/x-pcat");
          if (catId) { e.preventDefault(); reparent(catId, null); }
        }}
      >
        <button
          type="button"
          onClick={() => onSelect(ALL)}
          onDragOver={dragOver}
          onDrop={(e) => { const pid = e.dataTransfer.getData("application/x-product"); if (pid) { e.preventDefault(); moveProduct(pid, null); } }}
          className={cn(
            "w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded text-sm",
            selected === ALL ? "bg-primary/15 text-primary" : "hover:bg-secondary/60",
          )}
        >
          <span className="font-medium">כל המוצרים</span>
          <Badge variant="outline" className="h-5 text-[10px] px-1.5">{totalProducts}</Badge>
        </button>
        <button
          type="button"
          onClick={() => onSelect(UNCAT)}
          onDragOver={dragOver}
          onDrop={(e) => handleDrop(e, null)}
          className={cn(
            "w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded text-sm",
            selected === UNCAT ? "bg-primary/15 text-primary" : "hover:bg-secondary/60",
          )}
        >
          <span>ללא קטגוריה</span>
          <Badge variant="outline" className="h-5 text-[10px] px-1.5">{uncategorized}</Badge>
        </button>
        <div className="border-t my-2" />
        {roots.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">אין קטגוריות עדיין</p>
        ) : roots.map(r => renderNode(r))}
        <p className="text-[10px] text-muted-foreground text-center pt-2">קליק ימני לעוד אפשרויות</p>
      </CardContent>

      <Dialog open={!!addParent} onOpenChange={(o) => !o && setAddParent(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {addParent && addParent !== "root"
                ? `תת-קטגוריה תחת "${(addParent as ProductCategory).name}"`
                : "קטגוריה חדשה"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="שם קטגוריה"
            autoFocus
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                await createCat(addParent === "root" ? null : (addParent as ProductCategory).id, addName);
                setAddParent(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddParent(null)}>ביטול</Button>
            <Button onClick={async () => {
              await createCat(addParent === "root" ? null : (addParent as ProductCategory).id, addName);
              setAddParent(null);
            }}>צור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>שינוי שם קטגוריה</DialogTitle></DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            onKeyDown={async (e) => {
              if (e.key === "Enter" && renameTarget) {
                await renameCat(renameTarget.id, renameValue);
                setRenameTarget(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>ביטול</Button>
            <Button onClick={async () => {
              if (renameTarget) await renameCat(renameTarget.id, renameValue);
              setRenameTarget(null);
            }}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ProductDialog({ product, categories, defaultCategoryId, onClose }: {
  product: any;
  categories: ProductCategory[];
  defaultCategoryId: string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(product?.category_id ?? defaultCategoryId ?? null);
  const [unit, setUnit] = useState(product?.unit ?? "יח׳");
  const [price, setPrice] = useState(String(product?.price ?? "0"));
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const catPath = (cid: string): string => {
    const cat = categories.find(c => c.id === cid);
    if (!cat) return "";
    return cat.parent_id ? `${catPath(cat.parent_id)} / ${cat.name}` : cat.name;
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name,
      sku: sku || null,
      barcode: barcode || null,
      category_id: categoryId,
      category: categoryId ? categories.find(c => c.id === categoryId)?.name ?? null : null,
      unit,
      price: Number(price),
      is_active: isActive,
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
        <div className="space-y-1.5">
          <Label>קטגוריה</Label>
          <select
            value={categoryId ?? ""}
            onChange={e => setCategoryId(e.target.value || null)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— ללא קטגוריה —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{catPath(c.id)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label>יחידה</Label>
            <Input value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
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
