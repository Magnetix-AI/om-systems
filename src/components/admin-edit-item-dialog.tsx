import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ProjectPicker } from "@/components/project-picker";

export type EditItem = {
  kind: "job" | "project";
  id: string;
};

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(local: string) {
  if (!local) return null;
  // datetime-local is interpreted in the browser's local timezone — toISOString
  // converts to true UTC, preventing the +3 offset bug when stored as timestamptz.
  return new Date(local).toISOString();
}

export function AdminEditItemDialog({
  item,
  onClose,
  invalidateKeys = [],
}: {
  item: EditItem | null;
  onClose: () => void;
  invalidateKeys?: string[][];
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("__none");
  const [techId, setTechId] = useState<string>("__none");
  const [scheduled, setScheduled] = useState("");
  const [endAt, setEndAt] = useState("");
  const [siteContactName, setSiteContactName] = useState("");
  const [siteContactPhone, setSiteContactPhone] = useState("");
  const [siteContactAddress, setSiteContactAddress] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("open");
  const [useNewClient, setUseNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const { data: techs = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "technician");
      const ids = (roles ?? []).map(r => r.user_id);
      if (!ids.length) return [];
      return (await supabase.from("profiles").select("id, full_name, color").in("id", ids)).data ?? [];
    },
  });

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setUseNewClient(false);
    setNewClientName("");
    (async () => {
      setLoading(true);
      try {
        if (item.kind === "job") {
          const { data, error } = await supabase
            .from("jobs")
            .select("title, description, client_id, technician_id, start_time, end_time, scheduled_date, site_contact_name, site_contact_phone, site_contact_address, project_id, status")
            .eq("id", item.id).single();
          if (error) throw error;
          if (cancelled || !data) return;
          setTitle(data.title ?? "");
          setDescription(data.description ?? "");
          setClientId(data.client_id ?? "__none");
          setTechId(data.technician_id ?? "__none");
          setScheduled(toLocalInput(data.start_time ?? data.scheduled_date));
          setEndAt(toLocalInput(data.end_time));
          setSiteContactName((data as any).site_contact_name ?? "");
          setSiteContactPhone((data as any).site_contact_phone ?? "");
          setSiteContactAddress((data as any).site_contact_address ?? "");
          setProjectId((data as any).project_id ?? null);
          setStatus((data as any).status ?? "open");
        } else {
          const { data, error } = await supabase
            .from("projects")
            .select("title, description, client_id, technician_id, start_date")
            .eq("id", item.id).single();
          if (error) throw error;
          if (cancelled || !data) return;
          setTitle(data.title ?? "");
          setDescription(data.description ?? "");
          setClientId(data.client_id ?? "__none");
          setTechId(data.technician_id ?? "__none");
          setScheduled(data.start_date ? `${data.start_date}T00:00` : "");
          setEndAt("");
          setSiteContactName("");
          setSiteContactPhone("");
          setSiteContactAddress("");
        }
      } catch (e: any) {
        toast.error("שגיאה בטעינה", { description: e.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [item?.id, item?.kind]);

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const startIso = localToIso(scheduled);
      const endIso = localToIso(endAt);
      let cid: string | null = clientId === "__none" ? null : clientId;
      if (useNewClient && newClientName.trim()) {
        const { data, error } = await supabase.from("clients")
          .insert({ name: newClientName.trim() })
          .select("id").single();
        if (error) throw error;
        cid = data.id;
      }
      if (item.kind === "job") {
        const patch: any = {
          title,
          description,
          client_id: cid,
          technician_id: techId === "__none" ? null : techId,
          scheduled_date: startIso,
          start_time: startIso,
          end_time: endIso,
          site_contact_name: siteContactName.trim() || null,
          site_contact_phone: siteContactPhone.trim() || null,
          site_contact_address: siteContactAddress.trim() || null,
          project_id: projectId,
          status,
        };
        if (status === "completed") patch.completed_at = new Date().toISOString();
        else patch.completed_at = null;
        const { error } = await supabase.from("jobs").update(patch).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").update({
          title,
          description,
          client_id: cid,
          technician_id: techId === "__none" ? null : techId,
          start_date: startIso ? startIso.slice(0, 10) : null,
        }).eq("id", item.id);
        if (error) throw error;
      }
      toast.success("עודכן");
      for (const k of invalidateKeys) qc.invalidateQueries({ queryKey: k });
      qc.invalidateQueries({ queryKey: ["main-jobs"] });
      qc.invalidateQueries({ queryKey: ["main-projects"] });
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      qc.invalidateQueries({ queryKey: ["admin-history"] });
      onClose();
    } catch (e: any) {
      toast.error("שגיאה בעדכון", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>עריכת {item.kind === "project" ? "פרוייקט" : "קריאה"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">טוען...</div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>כותרת</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>תיאור</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>לקוח</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="editNewClient"
                  checked={useNewClient}
                  onCheckedChange={(c) => { setUseNewClient(!!c); if (!c) setNewClientName(""); }}
                />
                <Label htmlFor="editNewClient" className="cursor-pointer text-xs font-normal">לקוח חדש</Label>
              </div>
              {useNewClient ? (
                <Input placeholder="שם לקוח חדש" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
              ) : (
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— ללא לקוח —</SelectItem>
                    {(clients as any[]).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>טכנאי</Label>
              <Select value={techId} onValueChange={setTechId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">לא משויך</SelectItem>
                  {(techs as any[]).map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>תחילת קריאה</Label>
                <Input type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} />
              </div>
              {item.kind === "job" && (
                <div className="space-y-1.5">
                  <Label>סיום קריאה</Label>
                  <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
                </div>
              )}
            </div>
            {item.kind === "job" && (
              <div className="space-y-1.5 border rounded-md p-2 bg-secondary/20">
                <Label className="font-semibold text-sm">איש קשר בשטח</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="שם" value={siteContactName} onChange={e => setSiteContactName(e.target.value)} />
                  <Input placeholder="טלפון" value={siteContactPhone} onChange={e => setSiteContactPhone(e.target.value)} dir="ltr" />
                </div>
                <Input placeholder="כתובת" value={siteContactAddress} onChange={e => setSiteContactAddress(e.target.value)} />
              </div>
            )}
            {item.kind === "job" && (
              <div className="space-y-1.5">
                <Label>שייוך לפרוייקט</Label>
                <ProjectPicker value={projectId} onChange={setProjectId} />
              </div>
            )}
            {item.kind === "job" && (
              <div className="space-y-1.5">
                <Label>סטטוס</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">פתוחה</SelectItem>
                    <SelectItem value="in_progress">בטיפול</SelectItem>
                    <SelectItem value="completed">הושלמה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 border rounded-md p-2">
              <Label className="font-semibold text-sm">תמונות וקבצים</Label>
              {item.kind === "job"
                ? <AttachmentsManager jobId={item.id} />
                : <AttachmentsManager projectId={item.id} />}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving || loading}>{saving ? "שומר..." : "שמור"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
