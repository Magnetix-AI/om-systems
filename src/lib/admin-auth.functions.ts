import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-side admin login. The fixed username/password live ONLY in server
// secrets (ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL) — never in the
// client bundle. If the credentials match, we sign in as the admin user
// via Supabase Auth and return the session tokens for the client to install
// with `supabase.auth.setSession(...)`.

const InputSchema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(256),
});

// Constant-time string compare to avoid timing leaks on the username/password.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const expectedUser = process.env.ADMIN_USERNAME;
    const expectedPass = process.env.ADMIN_PASSWORD;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!expectedUser || !expectedPass || !adminEmail) {
      throw new Error("Admin credentials are not configured on the server");
    }

    const userOk = safeEqual(data.username, expectedUser);
    const passOk = safeEqual(data.password, expectedPass);
    if (!userOk || !passOk) {
      // Expected failure — return a result instead of throwing so it doesn't
      // surface as an uncaught runtime error in the client.
      return { ok: false as const, error: "פרטי כניסה שגויים" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try to sign in as the admin user. If the account doesn't exist yet
    // (first-time bootstrap), create it then sign in.
    let signIn = await supabaseAdmin.auth.signInWithPassword({
      email: adminEmail,
      password: expectedPass,
    });

    // Helper: find an existing auth user by email via the admin API.
    const findUserByEmail = async (email: string) => {
      // listUsers is paginated; the admin email is unique so first page is enough.
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
      // Either the user doesn't exist yet, or its password drifted from the
      // configured secret. Resolve both cases.
      const existing = await findUserByEmail(adminEmail);

      if (!existing) {
        // First-time bootstrap: create the admin user.
        const created = await supabaseAdmin.auth.admin.createUser({
          email: adminEmail,
          password: expectedPass,
          email_confirm: true,
          user_metadata: { full_name: "מנהל מערכת" },
        });
        if (created.error || !created.data.user) {
          throw new Error(created.error?.message || "Failed to bootstrap admin user");
        }
        adminUserId = created.data.user.id;
      } else {
        // Account exists but the stored password no longer matches the
        // configured secret — re-sync it so the fixed credentials work again.
        const updated = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: expectedPass,
          email_confirm: true,
        });
        if (updated.error) {
          throw new Error(updated.error.message);
        }
        adminUserId = existing.id;
      }

      signIn = await supabaseAdmin.auth.signInWithPassword({
        email: adminEmail,
        password: expectedPass,
      });
      if (signIn.error || !signIn.data.session) {
        throw new Error(signIn.error?.message || "Failed to sign in as admin");
      }
    } else {
      adminUserId = signIn.data.user!.id;
    }

    // Ensure the admin role is granted (handle_new_user only assigns 'technician').
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

    return {
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
    };
  });
