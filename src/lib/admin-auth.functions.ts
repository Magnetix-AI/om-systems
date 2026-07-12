import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-side admin login. Admin credentials live ONLY in server secrets
// (ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL and the ADMIN2_* set) —
// never in the client bundle. Multiple admin accounts can be defined; each
// resolves to its own Supabase auth user, so different admins can be signed
// in concurrently in different browsers/sessions.

const InputSchema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(256),
});

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

type AdminAccount = { username: string; password: string; email: string; fullName: string };

function loadAccounts(): AdminAccount[] {
  const list: AdminAccount[] = [];
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_EMAIL) {
    list.push({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
      email: process.env.ADMIN_EMAIL,
      fullName: "מנהל מערכת",
    });
  }
  if (process.env.ADMIN2_USERNAME && process.env.ADMIN2_PASSWORD && process.env.ADMIN2_EMAIL) {
    list.push({
      username: process.env.ADMIN2_USERNAME,
      password: process.env.ADMIN2_PASSWORD,
      email: process.env.ADMIN2_EMAIL,
      fullName: process.env.ADMIN2_USERNAME,
    });
  }
  return list;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const accounts = loadAccounts();
    if (accounts.length === 0) {
      throw new Error("Admin credentials are not configured on the server");
    }

    // Match against all configured admin accounts in constant time-ish fashion.
    let matched: AdminAccount | null = null;
    for (const acc of accounts) {
      const userOk = safeEqual(data.username, acc.username);
      const passOk = safeEqual(data.password, acc.password);
      if (userOk && passOk) matched = acc;
    }
    if (!matched) {
      return { ok: false as const, error: "פרטי כניסה שגויים" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let signIn = await supabaseAdmin.auth.signInWithPassword({
      email: matched.email,
      password: matched.password,
    });

    const findUserByEmail = async (email: string) => {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const normalized = email.toLowerCase();
      return data.users.find((u) => (u.email ?? "").toLowerCase() === normalized) ?? null;
    };

    let adminUserId: string | null = null;

    if (signIn.error || !signIn.data.session) {
      const existing = await findUserByEmail(matched.email);

      if (!existing) {
        const created = await supabaseAdmin.auth.admin.createUser({
          email: matched.email,
          password: matched.password,
          email_confirm: true,
          user_metadata: { full_name: matched.fullName },
        });
        if (created.error || !created.data.user) {
          throw new Error(created.error?.message || "Failed to bootstrap admin user");
        }
        adminUserId = created.data.user.id;
      } else {
        const updated = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: matched.password,
          email_confirm: true,
        });
        if (updated.error) throw new Error(updated.error.message);
        adminUserId = existing.id;
      }

      signIn = await supabaseAdmin.auth.signInWithPassword({
        email: matched.email,
        password: matched.password,
      });
      if (signIn.error || !signIn.data.session) {
        throw new Error(signIn.error?.message || "Failed to sign in as admin");
      }
    } else {
      adminUserId = signIn.data.user!.id;
    }

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUserId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: adminUserId, role: "admin" },
          { onConflict: "user_id,role" },
        );
    }

    // Make sure the profile name reflects the account label.
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: matched.fullName })
      .eq("id", adminUserId);

    return {
      ok: true as const,
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
    };
  });
