import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusLabel, statusColor } from "@/components/app-shell";
import { ArrowRight, Phone, MapPin, User, Briefcase, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/clients/$clientId")({
  ssr: false,
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["client-jobs", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, status, scheduled_date, created_at, completed_at, technician_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const techIds = Array.from(new Set((data ?? []).map((j: any) => j.technician_id).filter(Boolean)));
      let techMap: Record<string, string> = {};
      if (techIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", techIds);
        techMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return (data ?? []).map((j: any) => ({ ...j, technician_name: j.technician_id ? techMap[j.technician_id] : null }));
    },
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["client-projects", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, status, start_date, created_at, closed_at, technician_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const techIds = Array.from(new Set((data ?? []).map((p: any) => p.technician_id).filter(Boolean)));
      let techMap: Record<string, string> = {};
      if (techIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", techIds);
        techMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return (data ?? []).map((p: any) => ({ ...p, technician_name: p.technician_id ? techMap[p.technician_id] : null }));
    },
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <Link to="/admin/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> חזרה למאגר לקוחות
      </Link>

      <Card>
        <CardHeader><CardTitle className="text-xl">{client?.name ?? "—"}</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1 text-muted-foreground">
          {client?.contact_name && <div className="flex items-center gap-2"><User className="h-4 w-4" /> {client.contact_name}</div>}
          {client?.phone && <div className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4" /> {client.phone}</div>}
          {client?.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {client.address}</div>}
          {client?.notes && <div className="mt-2 p-2 bg-secondary/40 rounded text-foreground">{client.notes}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wrench className="h-5 w-5" /> היסטוריית קריאות ({jobs.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">טוען...</p>
          ) : jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">אין קריאות ללקוח זה</p>
          ) : (
            <div className="divide-y">
              {jobs.map((j: any) => (
                <div key={j.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{j.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      נוצרה: {new Date(j.created_at).toLocaleString("he-IL")}
                      {j.completed_at && ` · הושלמה: ${new Date(j.completed_at).toLocaleString("he-IL")}`}
                      {j.technician_name && ` · טכנאי: ${j.technician_name}`}
                    </div>
                  </div>
                  <Badge variant="outline" className={statusColor(j.status)}>{statusLabel(j.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Briefcase className="h-5 w-5" /> פרוייקטים ({projects.length})</CardTitle></CardHeader>
        <CardContent>
          {projectsLoading ? (
            <p className="text-center text-muted-foreground py-8">טוען...</p>
          ) : projects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">אין פרוייקטים ללקוח זה</p>
          ) : (
            <div className="divide-y">
              {projects.map((p: any) => (
                <Link
                  key={p.id}
                  to="/admin/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="py-3 flex items-start justify-between gap-3 hover:bg-secondary/40 rounded px-2 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      נוצר: {new Date(p.created_at).toLocaleString("he-IL")}
                      {p.closed_at && ` · נסגר: ${new Date(p.closed_at).toLocaleString("he-IL")}`}
                      {p.technician_name && ` · טכנאי: ${p.technician_name}`}
                    </div>
                  </div>
                  <Badge variant="outline" className={p.status === "open" ? "border-emerald-500 text-emerald-600" : "border-muted text-muted-foreground"}>
                    {p.status === "open" ? "פתוח" : "סגור"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
