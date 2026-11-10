/// <reference types="bun" />
import { afterEach, expect, mock, test } from "bun:test";

let user: { id: string } | null = { id: "session-test" };
let role = "admin";
const signOut = mock(async () => ({}));
const values = new Map<string, string>();

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user }, error: null }), signOut },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role } }) }) }) }),
  },
}));
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: (options: unknown) => options,
  Outlet: () => null,
  Link: () => null,
  useRouterState: () => "/admin",
}));
mock.module("@/components/app-shell", () => ({ AppShell: () => null }));

const { Route: authenticated } = await import("../routes/_authenticated/route");
const { Route: admin } = await import("../routes/_authenticated/admin/route");
type Guard = { beforeLoad: () => Promise<unknown> };
const authenticatedGuard = authenticated as unknown as Guard;
const adminGuard = admin as unknown as Guard;

Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
} });
Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });

afterEach(() => { user = { id: "session-test" }; role = "admin"; signOut.mockClear(); values.clear(); });

test("technician stays signed in after 48 hours without activity", async () => {
  role = "technician";
  values.set("fieldops.lastActivity", String(Date.now() - 48 * 60 * 60 * 1000));
  expect(await authenticatedGuard.beforeLoad()).toEqual({ user: { id: "session-test" } });
  expect(signOut).not.toHaveBeenCalled();
});

test("administrator stays signed in beyond the previous four-hour limit", async () => {
  values.set("admin_session_started_at", String(Date.now() - 48 * 60 * 60 * 1000));
  await authenticatedGuard.beforeLoad();
  await adminGuard.beforeLoad();
  expect(signOut).not.toHaveBeenCalled();
});

test("signed-out visitors still cannot enter protected pages", async () => {
  user = null;
  expect(authenticatedGuard.beforeLoad()).rejects.toEqual({ to: "/auth" });
  expect(adminGuard.beforeLoad()).rejects.toEqual({ to: "/auth" });
});

test("technicians still cannot enter administrator pages", async () => {
  role = "technician";
  expect(adminGuard.beforeLoad()).rejects.toEqual({ to: "/tech" });
});