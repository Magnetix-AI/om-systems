import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Minus, Plus, Search, X } from "lucide-react";

export type TechProduct = {
  id: string; name: string; sku: string | null; unit: string;
  category_id: string | null; manufacturer: string | null; model: string | null;
};
type Cat = { id: string; name: string; parent_id: string | null; sort_order: number };

export function useTechProducts() {
  return useQuery({
    queryKey: ["tech-products-all"],
    queryFn: async () => {
      const all: TechProduct[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("products")
          .select("id, name, sku, unit, category_id, manufacturer, model")
          .eq("is_active", true).order("name").range(from, from + 999);
        if (error) throw error;
        all.push(...(data as TechProduct[]));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
    staleTime: 5 * 60_000,
  });
}

export function TechEquipmentPicker({ products, quantities, setQty }: {
  products: TechProduct[]; quantities: Record<string, number>; setQty: (id: string, v: number) => void;
}) {
  const { data: cats = [] } = useQuery({
    queryKey: ["product-categories-tech"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories")
        .select("id, name, parent_id, sort_order").order("sort_order");
      if (error) throw error;
      return data as Cat[];
    },
  });
  const [search, setSearch] = useState("");
  const [path, setPath] = useState<string[]>([]);
  const [mfr, setMfr] = useState<string | null>(null);

  const children = useMemo(() => {
    const m = new Map<string | null, Cat[]>();
    for (const c of cats) { const a = m.get(c.parent_id) ?? []; a.push(c); m.set(c.parent_id, a); }
    return m;
  }, [cats]);
  const descendants = (id: string): Set<string> => {
    const s = new Set([id]); const st = [id];
    while (st.length) for (const c of children.get(st.pop()!) ?? []) { s.add(c.id); st.push(c.id); }
    return s;
  };
  const countIn = (id: string) => { const d = descendants(id); return products.filter(p => p.category_id && d.has(p.category_id)).length; };

  const current = path[path.length - 1] ?? null;
  const subCats = (children.get(current) ?? []).filter(c => countIn(c.id) > 0);
  const isLeaf = current !== null && subCats.length === 0;
  const q = search.trim().toLowerCase();

  const leafProducts = useMemo(() => isLeaf ? products.filter(p => p.category_id === current) : [], [isLeaf, current, products]);
  const manufacturers = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of leafProducts) { const k = p.manufacturer || "כללי"; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "he"));
  }, [leafProducts]);

  let list: TechProduct[] = [];
  if (q) list = products.filter(p => [p.name, p.sku, p.model, p.manufacturer].some(v => v?.toLowerCase().includes(q))).slice(0, 200);
  else if (isLeaf && (mfr || manufacturers.length <= 1)) list = leafProducts.filter(p => !mfr || (p.manufacturer || "כללי") === mfr);

  const selected = products.filter(p => (quantities[p.id] || 0) > 0);
  const catName = (id: string) => cats.find(c => c.id === id)?.name ?? "";
  const tile = "w-full flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-4 text-right text-base font-medium active:bg-secondary";

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם, דגם, מק״ט או יצרן..." className="h-12 pr-10 pl-10 text-base" />
        {search && <button type="button" onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-5 w-5" /></button>}
      </div>

      {selected.length > 0 && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-3 space-y-2">
          <div className="text-sm font-semibold">נבחרו {selected.length} פריטים</div>
          {selected.map(p => <ProductRow key={p.id} p={p} qty={quantities[p.id]} setQty={setQty} compact />)}
        </div>
      )}

      {!q && (
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <button type="button" className="text-primary font-medium" onClick={() => { setPath([]); setMfr(null); }}>כל הקטגוריות</button>
          {path.map((id, i) => (
            <span key={id} className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              <button type="button" className="text-primary" onClick={() => { setPath(path.slice(0, i + 1)); setMfr(null); }}>{catName(id)}</button>
            </span>
          ))}
          {mfr && <span className="flex items-center gap-1"><ChevronLeft className="h-4 w-4 text-muted-foreground" />{mfr}</span>}
        </div>
      )}

      <div className="space-y-2 min-h-[50vh] max-h-[70vh] overflow-y-auto">
        {!q && !isLeaf && subCats.map(c => (
          <button key={c.id} type="button" className={tile} onClick={() => setPath([...path, c.id])}>
            <span>{c.name}</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">{countIn(c.id)}<ChevronLeft className="h-5 w-5" /></span>
          </button>
        ))}
        {!q && isLeaf && !mfr && manufacturers.length > 1 && manufacturers.map(([m, n]) => (
          <button key={m} type="button" className={tile} onClick={() => setMfr(m)}>
            <span>{m}</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">{n}<ChevronLeft className="h-5 w-5" /></span>
          </button>
        ))}
        {list.map(p => <ProductRow key={p.id} p={p} qty={quantities[p.id] || 0} setQty={setQty} />)}
        {q && list.length === 0 && <p className="text-center text-muted-foreground py-6">לא נמצאו תוצאות</p>}
      </div>
    </div>
  );
}

function ProductRow({ p, qty, setQty, compact }: { p: TechProduct; qty: number; setQty: (id: string, v: number) => void; compact?: boolean }) {
  const active = qty > 0;
  return (
    <div className={`flex items-center gap-2 rounded-xl border p-3 ${active && !compact ? "bg-success/10 border-success/40" : "bg-card"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-snug">{p.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5 space-x-reverse space-x-2">
          {p.manufacturer && <span>{p.manufacturer}</span>}
          {p.model && <span>· דגם: <span dir="ltr">{p.model}</span></span>}
          {p.sku && <span>· מק״ט: <span dir="ltr">{p.sku}</span></span>}
        </div>
      </div>
      <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setQty(p.id, qty - 1)} disabled={qty <= 0}><Minus className="h-4 w-4" /></Button>
      <Input type="number" inputMode="numeric" min={0} value={qty} onChange={e => setQty(p.id, Number(e.target.value))} className="w-14 h-10 text-center shrink-0" />
      <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setQty(p.id, qty + 1)}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}
