import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageIcon } from "lucide-react";

type Parent = { jobId?: string; projectId?: string };

export function AttachmentsGallery({ jobId, projectId }: Parent) {
  const key = jobId ? ["tech-attachments", "job", jobId] : ["tech-attachments", "project", projectId];
  const [selected, setSelected] = useState<any | null>(null);

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

  if (items.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> תמונות מהמשרד ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {items.map((a: any) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected(a)}
                className="border rounded-md overflow-hidden hover:opacity-90 transition-opacity"
              >
                {a.url && <img src={a.url} alt="" className="w-full h-24 object-cover" />}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">לחץ על תמונה כדי לראות תיאור</p>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>תמונה מהמשרד</DialogTitle></DialogHeader>
          {selected?.url && <img src={selected.url} alt="" className="w-full max-h-[60vh] object-contain rounded-md" />}
          <div className="border rounded-md p-3 bg-secondary/40">
            <div className="text-xs font-medium mb-1 text-muted-foreground">תיאור:</div>
            <p className="text-sm whitespace-pre-wrap">
              {selected?.description || <span className="italic text-muted-foreground">לא הוסף תיאור</span>}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
