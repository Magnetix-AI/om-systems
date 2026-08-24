function clean(v: string | undefined) {
  return (v ?? "").trim().replace(/^["']|["']$/g, "");
}

/** Cron/webhook callers authenticate with the project's anon/publishable key. */
export function isAuthorizedHookRequest(request: Request) {
  const provided = clean(
    request.headers.get("apikey") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      undefined,
  );
  if (!provided) return false;
  const allowed = [
    clean(process.env["SUPABASE_ANON_KEY"]),
    clean(process.env["SUPABASE_PUBLISHABLE_KEY"]),
    clean(process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]),
  ].filter(Boolean);
  return allowed.includes(provided);
}
