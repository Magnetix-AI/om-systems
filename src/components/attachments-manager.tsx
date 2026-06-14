import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, ImagePlus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

type Parent = { jobId?: string; projectId?: string };

export function AttachmentsManager({ jobId, projectId }: Parent) {
  const qc = useQueryClient();
  const key = jobId ? ["attachments", "job", jobId] : ["attachments", "project", projectId];
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [desc, setDesc] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase.from("attachments").select("*").order("created_at", { ascending: false });
      q = jobId ? q.eq("job_id", jobId) : q.eq("project_id", projectId!);
      const { data, error } = await q;
      if (error) throw error;
      const withUrls = await Promise.all((data ?? []).map(async (a: any) => {
        const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(a.storage_path, 3600);
        return { ...a, url: signed?.signedUrl };
      }));
      return withUrls;
    },
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
      if (insErr) throw insErr;
      toast.success("התמונה הועלתה");
      setFile(null); setDesc("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: key });
    } catch (e: any) {
      toast.error("שגיאה בהעלאה", { description: e.message });
    } finally { setUploading(false); }
  };

  const handleDelete = async (a: any) => {
    if (!confirm("למחוק את התמונה?")) return;
    await supabase.storage.from("attachments").remove([a.storage_path]);
    const { error } = await supabase.from("attachments").delete().eq("id", a.id);
    if (error) return toast.error("שגיאה", { description: error.message });
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><ImagePlus className="h-4 w-4" /> תמונות ותיאורים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 border rounded-md p-3 bg-secondary/30">
          <div className="space-y-1">
            <Label className="text-xs">תמונה</Label>
            <Input ref={fileRef} type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
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
            {items.map((a: any) => (
              <AttachmentTile key={a.id} a={a} onDelete={() => handleDelete(a)} onChanged={() => qc.invalidateQueries({ queryKey: key })} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentTile({ a, onDelete, onChanged }: { a: any; onDelete: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(a.description ?? "");
  const save = async () => {
    const { error } = await supabase.from("attachments").update({ description: val || null }).eq("id", a.id);
    if (error) return toast.error("שגיאה", { description: error.message });
    setEditing(false);
    onChanged();
  };
  return (
    <div className="border rounded-md overflow-hidden bg-background">
      {a.url ? (
        <img src={a.url} alt={a.description ?? ""} className="w-full h-32 object-cover" />
      ) : (
        <div className="w-full h-32 bg-muted" />
      )}
      <div className="p-2 space-y-1">
        {editing ? (
          <div className="space-y-1">
            <Textarea rows={2} value={val} onChange={e => setVal(e.target.value)} className="text-xs" />
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={save}><Check className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditing(false); setVal(a.description ?? ""); }}><X className="h-3 w-3" /></Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{a.description || <span className="italic">ללא תיאור</span>}</p>
        )}
        <div className="flex justify-between">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(e => !e)}><Pencil className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
    </div>
  );
}
