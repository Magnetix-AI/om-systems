import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Briefcase, User, FolderKanban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/components/app-shell";
import { format, parseISO } from "date-fns";

type Result =
  | { kind: "job"; id: string; title: string; subtitle: string; meta?: string }
  | { kind: "client"; id: string; title: string; subtitle: string }
  | { kind: "project"; id: string; title: string; subtitle: string; meta?: string };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const term = debounced;
      const like = `%${term}%`;

      const [jobsRes, clientsRes, projectsRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, title, description, status, scheduled_date, site_contact_name, site_contact_phone, site_contact_address, client:clients(name, contact_name, address)")
          .or(
            `title.ilike.${like},description.ilike.${like},site_contact_name.ilike.${like},site_contact_phone.ilike.${like},site_contact_address.ilike.${like}`
          )
          .limit(20),
        supabase
          .from("clients")
          .select("id, name, contact_name, address, notes")
          .or(`name.ilike.${like},contact_name.ilike.${like},address.ilike.${like},notes.ilike.${like}`)
          .limit(20),
        supabase
          .from("projects")
          .select("id, title, description, status, client:clients(name)")
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(20),
      ]);

      // Also find jobs by client fields (name/contact/address)
      const clientIds = (clientsRes.data ?? []).map((c: any) => c.id);
      let jobsByClient: any[] = [];
      if (clientIds.length) {
        const r = await supabase
          .from("jobs")
          .select("id, title, description, status, scheduled_date, site_contact_name, site_contact_phone, site_contact_address, client:clients(name, contact_name, address)")
          .in("client_id", clientIds)
          .limit(20);
        jobsByClient = r.data ?? [];
      }

      const jobsMap = new Map<string, any>();
      for (const j of [...(jobsRes.data ?? []), ...jobsByClient]) jobsMap.set(j.id, j);

      const results: Result[] = [];
      for (const j of jobsMap.values()) {
        const bits = [
          j.client?.name,
          j.site_contact_name ?? j.client?.contact_name,
          j.site_contact_phone,
          j.site_contact_address ?? j.client?.address,
        ].filter(Boolean);
        results.push({
          kind: "job",
          id: j.id,
          title: j.title,
          subtitle: bits.join(" · "),
          meta: [
            statusLabel(j.status),
            j.scheduled_date ? format(parseISO(j.scheduled_date), "d/M/yyyy") : null,
          ].filter(Boolean).join(" · "),
        });
      }
      for (const c of clientsRes.data ?? []) {
        results.push({
          kind: "client",
          id: c.id,
          title: c.name,
          subtitle: [c.contact_name, c.address].filter(Boolean).join(" · "),
        });
      }
      for (const p of projectsRes.data ?? []) {
        results.push({
          kind: "project",
          id: p.id,
          title: p.title,
          subtitle: [(p as any).client?.name, p.description].filter(Boolean).join(" · "),
          meta: statusLabel(p.status),
        });
      }
      return results;
    },
  });

  const results = data ?? [];
  const showPanel = open && debounced.length >= 2;

  const grouped = useMemo(() => {
    return {
      jobs: results.filter(r => r.kind === "job"),
      clients: results.filter(r => r.kind === "client"),
      projects: results.filter(r => r.kind === "project"),
    };
  }, [results]);

  const flat = useMemo(() => [...grouped.jobs, ...grouped.clients, ...grouped.projects], [grouped]);

  useEffect(() => { setActiveIdx(0); }, [debounced]);

  const go = (r: Result) => {
    setOpen(false);
    setQ("");
    if (r.kind === "job") navigate({ to: "/admin/jobs/$jobId", params: { jobId: r.id } });
    else if (r.kind === "client") navigate({ to: "/admin/clients/$clientId", params: { clientId: r.id } });
    else navigate({ to: "/admin/projects/$projectId", params: { projectId: r.id } });
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
            else if (e.key === "Enter" && flat[activeIdx]) { e.preventDefault(); go(flat[activeIdx]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="חיפוש חופשי — קריאה, לקוח, פרוייקט, טלפון, כתובת..."
          className="pr-8 pl-8"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(""); setOpen(false); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute z-50 mt-1 w-[min(560px,90vw)] right-0 rounded-md border bg-popover text-popover-foreground shadow-lg max-h-[70vh] overflow-y-auto">
          {isFetching && flat.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">מחפש...</div>
          )}
          {!isFetching && flat.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">לא נמצאו תוצאות</div>
          )}

          {grouped.jobs.length > 0 && (
            <Group icon={<Briefcase className="h-3.5 w-3.5" />} label={`קריאות (${grouped.jobs.length})`}>
              {grouped.jobs.map((r) => (
                <Row key={`j-${r.id}`} r={r} active={flat[activeIdx]?.kind === r.kind && flat[activeIdx]?.id === r.id} onClick={() => go(r)} />
              ))}
            </Group>
          )}
          {grouped.clients.length > 0 && (
            <Group icon={<User className="h-3.5 w-3.5" />} label={`לקוחות (${grouped.clients.length})`}>
              {grouped.clients.map((r) => (
                <Row key={`c-${r.id}`} r={r} active={flat[activeIdx]?.kind === r.kind && flat[activeIdx]?.id === r.id} onClick={() => go(r)} />
              ))}
            </Group>
          )}
          {grouped.projects.length > 0 && (
            <Group icon={<FolderKanban className="h-3.5 w-3.5" />} label={`פרוייקטים (${grouped.projects.length})`}>
              {grouped.projects.map((r) => (
                <Row key={`p-${r.id}`} r={r} active={flat[activeIdx]?.kind === r.kind && flat[activeIdx]?.id === r.id} onClick={() => go(r)} />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 border-b bg-muted/30">
        {icon}
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ r, active, onClick }: { r: Result; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-right px-3 py-2 hover:bg-accent hover:text-accent-foreground border-b last:border-b-0 transition-colors",
        active && "bg-accent text-accent-foreground"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm truncate">{r.title}</div>
        {("meta" in r && r.meta) && <div className="text-[10px] text-muted-foreground shrink-0">{r.meta}</div>}
      </div>
      {r.subtitle && <div className="text-xs text-muted-foreground truncate mt-0.5">{r.subtitle}</div>}
    </button>
  );
}
