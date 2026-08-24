import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type Row = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function vapid() {
  return {
    subject: process.env["VAPID_SUBJECT"] || "mailto:admin@om-systems.lovable.app",
    publicKey: process.env["VAPID_PUBLIC_KEY"],
    privateKey: process.env["VAPID_PRIVATE_KEY"],
  };
}

/**
 * Sends a push notification to every registered device of the given users.
 * Stale/expired subscriptions are pruned automatically.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return { sent: 0, failed: 0 };

  const keys = vapid();
  if (!keys.publicKey || !keys.privateKey) {
    console.error("[push] VAPID keys are not configured");
    return { sent: 0, failed: 0 };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", unique);

  if (error) {
    console.error("[push] failed loading subscriptions", error.message);
    return { sent: 0, failed: 0 };
  }

  const rows = (data ?? []) as Row[];
  let sent = 0;
  let failed = 0;
  const dead: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        const init = await buildPushPayload(
          { data: payload, options: { ttl: 60 * 60 * 24, urgency: "high" } },
          subscription,
          keys,
        );
        const res = await fetch(row.endpoint, init as RequestInit);
        if (res.ok) {
          sent += 1;
        } else {
          failed += 1;
          if (res.status === 404 || res.status === 410) dead.push(row.id);
        }
      } catch (err) {
        failed += 1;
        console.error("[push] send failed", err);
      }
    }),
  );

  if (dead.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", dead);
  }

  return { sent, failed };
}

/** Returns the user ids of every admin in the system. */
export async function getAdminUserIds() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (error) {
    console.error("[push] failed loading admins", error.message);
    return [];
  }
  return (data ?? []).map((r: { user_id: string }) => r.user_id);
}
