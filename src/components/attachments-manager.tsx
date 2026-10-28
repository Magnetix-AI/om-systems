import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Trash2, ImagePlus, Pencil, Check, X, Eye } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Parent = { jobId?: string; projectId?: string };
type Attachment = Database["public"]["Tables"]["attachments"]["Row"] & { url?: string };

function useFilePreview(file: File | null) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file) { setUrl(undefined); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function AttachmentsManager({ jobId, projectId }: Parent) {
  const qc = useQueryClient();
  const key = jobId ? ["attachments", "job", jobId] : ["attachments", "project", projectId];
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [desc, setDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const preview = useFilePreview(file);
  const [selected, setSelected] = useState<Attachment | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["tech-attachments"] });
  };

  const openImage = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(a.storage_path, 3600);
    if (error) return toast.error("לא ניתן לפתוח את התמונה", { description: error.message });
    setSelected({ ...a, url: data.signedUrl });
  };

  const { data: items = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase.from("attachments").select("*").order("created_at", { ascending: false });
      if (!jobId && !projectId) return [];
      q = jobId ? q.eq("job_id", jobId) : q.eq("project_id", projectId ?? "");
      const { data, error } = await q;
      if (error) throw error;
      const withUrls = await Promise.all((data ?? []).map(async (a) => {
        const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(a.storage_path, 3600);
        return { ...a, url: signed?.signedUrl };
      }));
      return withUrls;
    },
    staleTime: 0,
    refetchInterval: 30 * 60 * 1000,
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop() || "bin";
      const parentDir = jobId ? `jobs/${jobId}` : `projects/${projectId}`;
      const path = `${parentDir}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("attachments").insert({
        job_id: jobId ?? null,
        project_id: projectId ?? null,
        storage_path: path,
        description: desc || null,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) {
        await supabase.storage.from("attachments").remove([path]);
        throw insErr;
      }
      toast.success("התמונה הועלתה");
      setFile(null); setDesc("");
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    } catch (e: any) {
      toast.error("שגיאה בהעלאה", { description: e.message });
    } finally { setUploading(false); }
  };

  const handleDelete = async (a: Attachment) => {
    if (!confirm("למחוק את התמונה?")) return;
    const { error: storageError } = await supabase.storage.from("attachments").remove([a.storage_path]);
    if (storageError) return toast.error("לא ניתן למחוק את התמונה", { description: storageError.message });
    const { error } = await supabase.from("attachments").delete().eq("id", a.id);
    if (error) return toast.error("שגיאה", { description: error.message });
    refresh();
    toast.success("התמונה נמחקה");
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><ImagePlus className="h-4 w-4" /> תמונות ותיאורים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 border rounded-md p-3 bg-secondary/30">
          <div className="space-y-1">
            <Label className="text-xs">תמונה</Label>
            <Input aria-label="בחירת תמונה להעלאה" ref={fileRef} type="file" accept="image/*" disabled={uploading} onChange={e => setFile(e.target.files?.[0] ?? null)} />
            {preview && <img src={preview} alt="תצוגה מקדימה לפני העלאה" className="h-40 w-full rounded-md object-contain bg-muted" />}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">תיאור (אופציונלי)</Label>
            <Textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="מה רואים בתמונה..." />
          </div>
          <Button size="sm" onClick={handleUpload} disabled={!file || uploading}>
            <Upload className="h-4 w-4 ml-1" /> {uploading ? "מעלה..." : "העלה תמונה"}
          </Button>
        </div>

        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">עדיין לא הועלו תמונות</p>}
        {items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((a) => (
              <AttachmentTile key={a.id} a={a} onOpen={() => openImage(a)} onDelete={() => handleDelete(a)} onChanged={refresh} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>תמונה מצורפת לקריאה</DialogTitle></DialogHeader>
        {selected?.url && <img src={selected.url} alt={selected.description || "תמונה מצורפת"} className="w-full max-h-[65vh] object-contain rounded-md bg-muted" />}
        {selected?.description && <p className="whitespace-pre-wrap break-words text-sm">{selected.description}</p>}
      </DialogContent>
    </Dialog>
    </>
  );
}

function AttachmentTile({ a, onOpen, onDelete, onChanged }: { a: Attachment; onOpen: () => void; onDelete: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(a.description ?? "");
  const [replacement, setReplacement] = useState<File | null>(null);
  const preview = useFilePreview(replacement);
  const [saving, setSaving] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [a.url]);
  const save = async () => {
    setSaving(true);
    let newPath: string | undefined;
    try {
      if (replacement) {
        const folder = a.storage_path.slice(0, a.storage_path.lastIndexOf("/"));
        newPath = `${folder}/${crypto.randomUUID()}.${replacement.name.split(".").pop() || "bin"}`;
        const { error } = await supabase.storage.from("attachments").upload(newPath, replacement, { contentType: replacement.type });
        if (error) throw error;
      }
      const { error } = await supabase.from("attachments").update({ description: val || null, ...(newPath ? { storage_path: newPath } : {}) }).eq("id", a.id);
      if (error) {
        if (newPath) await supabase.storage.from("attachments").remove([newPath]);
        throw error;
      }
      if (newPath) {
        const { error: cleanupError } = await supabase.storage.from("attachments").remove([a.storage_path]);
        if (cleanupError) toast.error("התמונה הוחלפה, אך לא ניתן היה להסיר את הקובץ הישן");
      }
      setEditing(false);
      setReplacement(null);
      onChanged();
      toast.success("התמונה עודכנה");
    } catch (e) {
      toast.error("לא ניתן לשמור את התמונה", { description: e instanceof Error ? e.message : String(e) });
    } finally { setSaving(false); }
  };
  return (
    <div className="border rounded-md overflow-hidden bg-background">
      <Button type="button" variant="ghost" aria-label="פתח תמונה" title="פתח תמונה" onClick={onOpen} className="w-full h-36 p-0 rounded-none overflow-hidden">
      {(preview || a.url) && !imageFailed ? (
        <img src={preview || a.url} onError={() => setImageFailed(true)} alt={a.description || "תמונה מצורפת"} className="w-full h-full object-cover" />
      ) : (
        <span className="w-full h-full bg-muted flex items-center justify-center gap-2 text-muted-foreground"><Eye className="h-4 w-4" />פתח תמונה</span>
      )}
      </Button>
      <div className="p-2 space-y-1">
        {editing ? (
          <div className="space-y-1">
            <Label className="text-xs">החלפת תמונה</Label>
            <Input type="file" accept="image/*" aria-label="החלפת תמונה" disabled={saving} onChange={e => { setReplacement(e.target.files?.[0] ?? null); setImageFailed(false); }} className="text-xs" />
            <Textarea aria-label="תיאור התמונה" rows={2} value={val} disabled={saving} onChange={e => setVal(e.target.value)} className="text-xs" />
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" aria-label="שמור תמונה" title="שמור תמונה" disabled={saving} className="h-9 w-9" onClick={save}><Check className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="בטל עריכה" title="בטל עריכה" disabled={saving} className="h-9 w-9" onClick={() => { setEditing(false); setVal(a.description ?? ""); setReplacement(null); }}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{a.description || <span className="italic">ללא תיאור</span>}</p>
        )}
        <div className="flex justify-between">
          <Button size="icon" variant="ghost" aria-label="פתח תמונה" title="פתח תמונה" className="h-9 w-9" onClick={onOpen}><Eye className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="ערוך תמונה" title="ערוך תמונה" disabled={saving} className="h-9 w-9" onClick={() => { setEditing(true); setVal(a.description ?? ""); }}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="מחק תמונה" title="מחק תמונה" disabled={saving} className="h-9 w-9 text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
