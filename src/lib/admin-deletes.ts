import { supabase } from "@/integrations/supabase/client";

export async function deleteJobsCascade(ids: string[]) {
  if (!ids.length) return;
  const { error: e1 } = await supabase.from("job_items").delete().in("job_id", ids);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("jobs").delete().in("id", ids);
  if (e2) throw e2;
}

export async function deleteProjectsCascade(ids: string[]) {
  if (!ids.length) return;
  const { data: visits } = await supabase.from("project_visits").select("id").in("project_id", ids);
  const visitIds = (visits ?? []).map((v: any) => v.id);
  if (visitIds.length) {
    const { error: e1 } = await supabase.from("project_visit_items").delete().in("visit_id", visitIds);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("project_visits").delete().in("id", visitIds);
    if (e2) throw e2;
  }
  const { error: e3 } = await supabase.from("projects").delete().in("id", ids);
  if (e3) throw e3;
}
