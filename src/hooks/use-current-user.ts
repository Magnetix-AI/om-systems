import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "technician";

export interface CurrentUser {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
}

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const [{ data: profile }, { data: roleRow }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);
      return {
        id: user.id,
        email: user.email ?? null,
        fullName: profile?.full_name || user.email || "",
        role: (roleRow?.role as AppRole) || "technician",
      };
    },
    staleTime: 60_000,
  });
}
