// Lightweight Face ID / biometric login using WebAuthn platform authenticator.
// We register a credential bound to this device, then gate access to stored
// email+password (kept in localStorage) on a successful biometric assertion.
// This is a client-side convenience flow — the actual sign-in still goes
// through Supabase email/password.

const STORAGE_KEY = "fieldops.faceCred.v1";

type StoredCred = {
  credentialId: string; // base64url
  email: string;
  password: string; // obfuscated (base64) — convenience only
  rpId: string;
};

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
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredCred) : null;
  } catch { return null; }
};

export const clearFaceCred = () => localStorage.removeItem(STORAGE_KEY);

export async function registerFaceCred(email: string, password: string) {
  if (!isFaceAuthSupported()) throw new Error("המכשיר אינו תומך בזיהוי ביומטרי");
  const rpId = window.location.hostname;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "FieldOps", id: rpId },
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
  if (!cred) throw new Error("הרישום נכשל");

  const stored: StoredCred = {
    credentialId: b64uEncode(cred.rawId),
    email,
    password: btoa(unescape(encodeURIComponent(password))),
    rpId,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export async function verifyFaceCred(): Promise<{ email: string; password: string }> {
  const stored = getStoredFaceCred();
  if (!stored) throw new Error("לא הוגדר זיהוי פנים במכשיר זה");
  if (!isFaceAuthSupported()) throw new Error("המכשיר אינו תומך בזיהוי ביומטרי");

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
  if (!assertion) throw new Error("האימות נכשל");

  return {
    email: stored.email,
    password: decodeURIComponent(escape(atob(stored.password))),
  };
}
