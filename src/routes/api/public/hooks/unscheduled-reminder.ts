import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/unscheduled-reminder")({
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

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToUsers, getAdminUserIds } = await import("@/lib/push.server");

        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        // Unscheduled = no technician assigned and no start time set.
        const { data: jobs, error } = await supabaseAdmin
          .from("jobs")
          .select("id, title, created_at, client:clients(name)")
          .is("technician_id", null)
          .is("start_time", null)
          .is("unscheduled_reminder_sent_at", null)
          .neq("status", "completed")
          .lt("created_at", cutoff)
          .limit(50);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const pending = jobs ?? [];
        if (pending.length === 0) return Response.json({ notified: 0 });

        const admins = await getAdminUserIds();
        if (admins.length > 0) {
          for (const job of pending) {
            const clientName =
              (job as { client?: { name?: string } | null }).client?.name ?? "ללא לקוח";
            await sendPushToUsers(admins, {
              title: "קריאה לא מתואמת מעל 48 שעות",
              body: `${job.title} · ${clientName} — נא לטפל בקריאה`,
              url: "/admin",
              tag: `job-stale-${job.id}`,
            });
          }
        }

        await supabaseAdmin
          .from("jobs")
          .update({ unscheduled_reminder_sent_at: new Date().toISOString() })
          .in(
            "id",
            pending.map((j) => j.id),
          );

        return Response.json({ notified: pending.length });
      },
    },
  },
});
