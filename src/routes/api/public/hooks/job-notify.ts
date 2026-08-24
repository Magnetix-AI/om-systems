import { createFileRoute } from "@tanstack/react-router";

type Body = {
  jobId?: string;
  kind?: "created" | "assigned";
  technicianId?: string | null;
};

function fmtWhen(scheduled: string | null, start: string | null) {
  const iso = start || scheduled;
  if (!iso) return "ללא תאריך";
  const d = new Date(iso);
  const date = d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
  if (!start) return date;
  const time = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

export const Route = createFileRoute("/api/public/hooks/job-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env["SUPABASE_ANON_KEY"]) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        let body: Body = {};
        try {
          body = (await request.json()) as Body;
        } catch {
          /* ignore */
        }
        if (!body.jobId || !body.kind) {
          return new Response(JSON.stringify({ error: "missing jobId/kind" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToUsers, getAdminUserIds } = await import("@/lib/push.server");

        const { data: job } = await supabaseAdmin
          .from("jobs")
          .select("id, title, technician_id, scheduled_date, start_time, client:clients(name)")
          .eq("id", body.jobId)
          .maybeSingle();

        if (!job) {
          return new Response(JSON.stringify({ error: "job not found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }

        const clientName =
          (job as { client?: { name?: string } | null }).client?.name ?? "ללא לקוח";
        const when = fmtWhen(job.scheduled_date, job.start_time);

        if (body.kind === "created") {
          const admins = await getAdminUserIds();
          const result = await sendPushToUsers(admins, {
            title: "נפתחה קריאה חדשה",
            body: `${job.title} · ${clientName}`,
            url: `/admin/jobs/${job.id}`,
            tag: `job-created-${job.id}`,
          });
          return Response.json(result);
        }

        const techId = body.technicianId || job.technician_id;
        if (!techId) return Response.json({ sent: 0, failed: 0 });

        const result = await sendPushToUsers([techId], {
          title: "שויכה אליך קריאה חדשה",
          body: `${job.title} · ${clientName} · ${when}`,
          url: `/tech/${job.id}`,
          tag: `job-assigned-${job.id}`,
        });
        return Response.json(result);
      },
    },
  },
});
