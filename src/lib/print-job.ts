import { supabase } from "@/integrations/supabase/client";
import { statusLabel } from "@/components/app-shell";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("he-IL") : "");
const fmtTime = (d?: string | null) =>
  d ? new Date(d).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "";
const fmtDateTime = (d?: string | null) => (d ? `${fmtDate(d)} ${fmtTime(d)}` : "");

/** Opens a print-ready page for a job; the user can print or "Save as PDF". */
export async function printJob(jobId: string) {
  const w = window.open("", "_blank");
  if (!w) throw new Error("החלון נחסם על ידי הדפדפן");
  w.document.write("<p dir='rtl' style='font-family:sans-serif'>טוען...</p>");

  const { data: job, error } = await supabase
    .from("jobs")
    .select("*, client:clients(name), items:job_items(id, quantity, product:products(name, unit))")
    .eq("id", jobId)
    .single();
  if (error || !job) { w.close(); throw error ?? new Error("לא נמצאה קריאה"); }
  const j = job as any;

  let techName = "";
  if (j.technician_id) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", j.technician_id).maybeSingle();
    techName = data?.full_name ?? "";
  }

  // Media: signed URLs for each attachment
  type Att = { id: string; storage_path: string; description: string | null; url: string };
  const media: Att[] = [];
  const { data: atts } = await supabase
    .from("attachments")
    .select("id, storage_path, description, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (atts?.length) {
    await Promise.all(
      (atts as any[]).map(async (a) => {
        const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(a.storage_path, 3600);
        if (signed) media.push({ id: a.id, storage_path: a.storage_path, description: a.description, url: signed.signedUrl });
      })
    );
  }

  const date = fmtDate(j.scheduled_date ?? j.start_time);
  const hours = j.start_time ? `${fmtTime(j.start_time)}${j.end_time ? " – " + fmtTime(j.end_time) : ""}` : "";
  const row = (label: string, val: string) =>
    val ? `<tr><th>${esc(label)}</th><td>${esc(val)}</td></tr>` : "";

  const itemsHtml = (j.items?.length
    ? j.items
        .map((it: any) => `<tr><td>${esc(it.product?.name ?? "פריט")}</td><td>${esc(it.quantity)}${it.product?.unit ? " " + esc(it.product.unit) : ""}</td></tr>`)
        .join("")
    : "");

  const notesHtml = j.technician_notes
    ? `<div class="desc">${esc(j.technician_notes)}</div>`
    : `<div class="desc muted">אין הערות טכנאי</div>`;

  const mediaHtml = media.length
    ? `<div class="media-grid">${media
        .map(
          (m) => `<figure>
            <img src="${m.url}" alt="">
            ${m.description ? `<figcaption>${esc(m.description)}</figcaption>` : ""}
          </figure>`
        )
        .join("")}</div>`
    : `<div class="muted">אין קבצים מצורפים</div>`;

  const logo = `${window.location.origin}/print/logo.png`;
  w.document.open();
  w.document.write(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>${esc(j.title)}</title>
<style>
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
body { font-family: Arial, "Segoe UI", sans-serif; color:#111; margin:0; padding:24px; background:#fff; }
.logo { text-align:center; margin-bottom:18px; } .logo img { max-width:300px; height:auto; }
h1 { font-size:42px; margin:0 0 6px; text-align:center; border-top:2px solid #1f5fa8; padding-top:14px; padding-bottom:12px; }
.tech { text-align:center; font-size:34px; color:#333; margin:10px 0 20px; }
table { width:100%; border-collapse:collapse; margin-bottom:20px; font-size:15px; }
th, td { border:1px solid #ccc; padding:8px 10px; text-align:right; vertical-align:top; }
th { background:#f1f4f8; width:28%; font-weight:600; }
h2 { font-size:18px; margin:18px 0 8px; color:#1f5fa8; }
.desc { border:1px solid #ccc; padding:12px; white-space:pre-wrap; font-size:15px; line-height:1.6; min-height:60px; }
.muted { color:#888; font-size:14px; }
.items { width:auto; min-width:50%; }
.items td:first-child { width:auto; }
.media-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:14px; }
figure { margin:0; border:1px solid #ccc; padding:8px; text-align:center; page-break-inside:avoid; }
figure img { max-width:100%; max-height:260px; object-fit:contain; }
figcaption { font-size:13px; color:#555; margin-top:6px; }
.foot { margin-top:30px; font-size:12px; color:#777; text-align:center; }
@media print { body { padding:0; } }
</style></head><body>
<div class="logo"><img src="${logo}" alt="א.מ. מערכות"></div>
<h1>${esc(j.title)}</h1>
<div class="tech">טכנאי משויך: <strong>${esc(techName || "לא שויך")}</strong></div>
<table>
${row("תאריך", date)}
${row("שעות", hours)}
${row("סטטוס", statusLabel(j.status))}
${row("לקוח", j.client?.name ?? "")}
${row("איש קשר באתר", j.site_contact_name ?? "")}
${row("טלפון", j.site_contact_phone ?? "")}
${row("כתובת", j.site_contact_address ?? "")}
</table>
<h2>תיאור</h2>
<div class="desc">${esc(j.description || "—")}</div>

<h2>ביצוע בפועל – עדכוני טכנאי</h2>
<table>
${row("שעת כניסה", fmtDateTime(j.arrival_time))}
${row("שעת יציאה", fmtDateTime(j.departure_time))}
${row("הושלמה", fmtDateTime(j.completed_at))}
</table>
<h2>הערות טכנאי</h2>
${notesHtml}
${itemsHtml ? `<h2>פריטים שנוספו</h2><table class="items"><tr><th>פריט</th><th>כמות</th></tr>${itemsHtml}</table>` : ""}
<h2>מדיה</h2>
${mediaHtml}
<div class="foot">הופק בתאריך ${new Date().toLocaleString("he-IL")}</div>
<script>
const imgs=[...document.querySelectorAll('.logo img, .media-grid img')];
const go=()=>setTimeout(()=>window.print(),300);
Promise.all(imgs.map(i=>i.complete?1:new Promise(r=>{i.onload=r;i.onerror=r;}))).then(go);
</script>
</body></html>`);
  w.document.close();
}
