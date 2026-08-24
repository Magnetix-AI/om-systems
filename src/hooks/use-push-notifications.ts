import { useCallback, useEffect, useState } from "react";
import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
  sendTestPush,
} from "@/lib/push.functions";

const SW_URL = "/push-sw.js";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function bufToBase64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return window.btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushState = "unsupported" | "denied" | "off" | "on";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported) {
        setState("unsupported");
        setReady(true);
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_URL);
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (cancelled) return;
        if (Notification.permission === "denied") setState("denied");
        else setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) return { ok: false, error: "הדפדפן לא תומך בהתראות" };
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return { ok: false, error: "לא ניתן אישור לקבלת התראות" };
      }

      const { publicKey } = await getVapidPublicKey();
      if (!publicKey) return { ok: false, error: "מפתחות ההתראות אינם מוגדרים" };

      const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      await savePushSubscription({
        data: {
          endpoint: sub.endpoint,
          p256dh: bufToBase64Url(sub.getKey("p256dh")),
          auth: bufToBase64Url(sub.getKey("auth")),
          userAgent: navigator.userAgent,
        },
      });

      setState("on");
      await sendTestPush({ data: undefined } as never).catch(() => undefined);
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, error: err instanceof Error ? err.message : "שגיאה בהפעלת התראות" };
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return { ok: false };
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await deletePushSubscription({ data: { endpoint: sub.endpoint } }).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
      setState("off");
      return { ok: true };
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { state, busy, ready, enable, disable, supported };
}

/** Removes this device's push registration — used on explicit sign-out. */
export async function unregisterPushOnLogout() {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return;
    await deletePushSubscription({ data: { endpoint: sub.endpoint } }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  } catch {
    /* ignore */
  }
}
