import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateSchema = z.object({
  firstName: z.string().min(1).max(64),
  lastName: z.string().min(1).max(64),
  username: z.string().min(2).max(64).regex(/^[a-zA-Z0-9._-]+$/, "username invalid"),
  password: z.string().min(6).max(128),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const UpdateSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1).max(128).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  password: z.string().min(6).max(128).optional(),
  username: z.string().min(2).max(64).regex(/^[a-zA-Z0-9._-]+$/, "username invalid").optional(),
});

const DeleteSchema = z.object({ userId: z.string().uuid() });
const GetSchema = z.object({ userId: z.string().uuid() });

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const createTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = `${data.username.toLowerCase()}@om-tech.local`;
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: fullName, username: data.username },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message || "Failed to create user");
    }
    const userId = created.data.user.id;
    // Ensure profile row exists with full_name + color (handle_new_user already creates it).
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: fullName, color: data.color ?? null }, { onConflict: "id" });
    // Ensure technician role.
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "technician" }, { onConflict: "user_id,role" });
    return { id: userId, email };
  });

export const updateTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { full_name?: string; color?: string | null } = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.color !== undefined) patch.color = data.color;
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.password,
      });
      if (error) throw new Error(error.message);
    }
    if (data.username) {
      const newEmail = `${data.username.toLowerCase()}@om-tech.local`;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email: newEmail,
        email_confirm: true,
        user_metadata: { username: data.username },
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const getTechnicianUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GetSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (error) throw new Error(error.message);
    const email = res.user?.email ?? "";
    const username = email.includes("@om-tech.local")
      ? email.replace("@om-tech.local", "")
      : email;
    return { username, email };
  });

export const deleteTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
