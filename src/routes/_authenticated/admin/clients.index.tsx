import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  ssr: false,
  component: ClientsList,
});

function ClientsList() {
  const [q, setQ] = useState("");
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone, contact_name, address")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = clients.filter((c: any) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      c.name?.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s) ||
      c.contact_name?.toLowerCase().includes(s) ||
      c.address?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">מאגר לקוחות</h1>
        <p className="text-sm text-muted-foreground">לחץ על לקוח כדי לצפות בהיסטוריית הקריאות</p>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש לפי שם, טלפון, כתובת..." className="pr-9" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> {filtered.length} לקוחות</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">טוען...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">לא נמצאו לקוחות</p>
          ) : (
            <div className="divide-y">
              {filtered.map((c: any) => (
                <Link
                  key={c.id}
                  to="/admin/clients/$clientId"
                  params={{ clientId: c.id }}
                  className="flex items-center justify-between gap-3 py-3 px-2 hover:bg-secondary/50 rounded-md transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[c.contact_name, c.phone, c.address].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
