// Biometric (Face ID / fingerprint) login via WebAuthn platform authenticator.
//
// SECURITY: We DO NOT store the user's password. After a successful sign-in
// we capture the Supabase refresh token and store it in localStorage,
// gated behind a WebAuthn assertion. To sign back in we call
// `supabase.auth.refreshSession({ refresh_token })`. Refresh tokens are
// rotated and can be revoked from the auth dashboard, unlike a password.

import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "fieldops.faceCred.v2";
const LEGACY_KEY = "fieldops.faceCred.v1"; // old key that stored a plaintext password

type StoredCred = {
  credentialId: string; // base64url
  email: string;
  refreshToken: string;
  rpId: string;
};

export class FaceAuthError extends Error {
  code: "missing" | "unsupported" | "setup_session_missing" | "expired" | "failed";

  constructor(code: FaceAuthError["code"], message: string) {
    super(message);
    this.name = "FaceAuthError";
    this.code = code;
  }
}

const b64uEncode = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64uDecode = (s: string): ArrayBuffer => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

export const isFaceAuthSupported = () =>
  typeof window !== "undefined" &&
  !!window.PublicKeyCredential &&
  !!navigator.credentials;

export const getStoredFaceCred = (): StoredCred | null => {
  try {
    // Purge any legacy credential that contained a plaintext password.
    if (typeof localStorage !== "undefined" && localStorage.getItem(LEGACY_KEY)) {
      localStorage.removeItem(LEGACY_KEY);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredCred) : null;
  } catch { return null; }
};

export const clearFaceCred = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore */ }
};

export async function registerFaceCred(email: string, refreshTokenFromLogin?: string) {
  if (!isFaceAuthSupported()) throw new FaceAuthError("unsupported", "המכשיר אינו תומך בזיהוי ביומטרי");

  // Prefer the refresh token returned by the password login itself. This avoids
  // races where localStorage/session propagation has not completed yet.
  let refreshToken = refreshTokenFromLogin;
  if (!refreshToken) {
    const { data: sessionData } = await supabase.auth.getSession();
    refreshToken = sessionData.session?.refresh_token;
  }
  if (!refreshToken) {
    throw new FaceAuthError(
      "setup_session_missing",
      "החיבור למערכת עדיין נטען. לחץ שוב על הפעלת זיהוי פנים בעוד רגע",
    );
  }

  const rpId = window.location.hostname;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "O.M Systems LTD", id: rpId },
      user: { id: userId, name: email, displayName: email },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new FaceAuthError("failed", "הרישום נכשל");

  const stored: StoredCred = {
    credentialId: b64uEncode(cred.rawId),
    email,
    refreshToken,
    rpId,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  // Make sure the old plaintext-password credential is gone.
  localStorage.removeItem(LEGACY_KEY);
}

async function requestFaceAssertion(stored: StoredCred) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: stored.rpId,
      timeout: 60_000,
      userVerification: "required",
      allowCredentials: [{ id: b64uDecode(stored.credentialId), type: "public-key" }],
    },
  });
  if (!assertion) throw new FaceAuthError("failed", "האימות נכשל");
}

export async function verifyFaceCred(refreshTokenFromCurrentLogin?: string): Promise<{ email: string }> {
  const stored = getStoredFaceCred();
  if (!stored) throw new FaceAuthError("missing", "לא הוגדר זיהוי פנים במכשיר זה");
  if (!isFaceAuthSupported()) throw new FaceAuthError("unsupported", "המכשיר אינו תומך בזיהוי ביומטרי");

  await requestFaceAssertion(stored);

  if (refreshTokenFromCurrentLogin) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, refreshToken: refreshTokenFromCurrentLogin }));
    return { email: stored.email };
  }

  // Exchange the stored refresh token for a fresh Supabase session.
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: stored.refreshToken });
  if (error || !data.session) {
    // Refresh token is invalid/expired — clear and require password login again.
    clearFaceCred();
    throw new FaceAuthError("expired", "פג תוקף ההרשאה הביומטרית, נדרשת התחברות מחדש");
  }

  // Rotate: persist the new refresh token for next time.
  const updated: StoredCred = { ...stored, refreshToken: data.session.refresh_token };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  return { email: stored.email };
}
