import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithPhoneNumber,
  onAuthStateChanged,
  RecaptchaVerifier,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";
import { getStorage, ref, getDownloadURL, type FirebaseStorage } from "firebase/storage";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD8LTjLjo89KpUzvHLpjwODOGj9UKb2H8c",
  authDomain: "team-nursing-classes-818e5.firebaseapp.com",
  projectId: "team-nursing-classes-818e5",
  storageBucket: "team-nursing-classes-818e5.appspot.com",
  messagingSenderId: "200533923371",
  appId: "1:200533923371:android:790df39361ee8e72a3fc6e",
};

const VIDEO_PATHS = ["videos", "chapters", "lectures", "sessions", "media", "stream"];

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

function initFirebase() {
  if (app) return;
  app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  storage = getStorage(app);
}

// ─── Anonymous auth (if enabled on project) ───────────────────────────────────
let anonAuthResult: Promise<boolean> | null = null;

export function tryAnonymousAuth(): Promise<boolean> {
  if (anonAuthResult) return anonAuthResult;
  initFirebase();

  anonAuthResult = new Promise<boolean>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth!, async (user) => {
      if (user) { unsubscribe(); resolve(true); return; }
      try {
        await signInAnonymously(auth!);
        resolve(true);
      } catch {
        resolve(false);
      }
    });
  });
  return anonAuthResult;
}

// ─── Phone number auth ────────────────────────────────────────────────────────
let confirmationResult: ConfirmationResult | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

/** Send OTP to phone number. containerEl is any mounted div for invisible reCAPTCHA. */
export async function sendOtp(phone: string, containerEl: HTMLElement): Promise<void> {
  initFirebase();
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch { /* ignore */ }
  }
  recaptchaVerifier = new RecaptchaVerifier(auth!, containerEl, { size: "invisible" });
  confirmationResult = await signInWithPhoneNumber(auth!, toE164(phone), recaptchaVerifier);
}

/** Confirm OTP code. Returns true on success. */
export async function confirmOtp(code: string): Promise<boolean> {
  if (!confirmationResult) return false;
  try {
    await confirmationResult.confirm(code);
    return true;
  } catch {
    return false;
  }
}

/** Check if user is currently signed in to Firebase */
export function isFirebaseSignedIn(): boolean {
  if (!auth) return false;
  return !!auth.currentUser;
}

// ─── Storage access ───────────────────────────────────────────────────────────
/**
 * Try to get a download URL for a Firebase-secured video.
 * Requires user to already be authenticated (phone auth or anonymous).
 */
export async function getFirebaseVideoUrl(fsId: string): Promise<string | null> {
  initFirebase();
  if (!auth?.currentUser) return null;

  const fbStorage = storage!;
  const candidates = [
    ...VIDEO_PATHS.map((p) => `${p}/${fsId}`),
    ...VIDEO_PATHS.map((p) => `${p}/${fsId}.mp4`),
    fsId,
    `${fsId}.mp4`,
  ];

  for (const path of candidates) {
    try {
      const url = await getDownloadURL(ref(fbStorage, path));
      return url;
    } catch {
      // not found or permission denied — try next
    }
  }
  return null;
}
