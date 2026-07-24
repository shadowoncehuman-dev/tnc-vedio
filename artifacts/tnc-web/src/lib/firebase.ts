import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth } from "firebase/auth";
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
let authReady: Promise<boolean> | null = null;

function initFirebase() {
  if (app) return;
  app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  storage = getStorage(app);
}

/**
 * Sign in anonymously to Firebase so storage rules that require
 * `request.auth != null` are satisfied. Returns true if auth succeeded.
 */
export function ensureFirebaseAuth(): Promise<boolean> {
  if (authReady) return authReady;

  initFirebase();

  authReady = new Promise<boolean>((resolve) => {
    const fbAuth = auth!;

    // If already signed in, we're done
    const unsubscribe = onAuthStateChanged(fbAuth, async (user) => {
      if (user) {
        unsubscribe();
        resolve(true);
        return;
      }
      // Try anonymous sign-in — only works if Anonymous auth is enabled in Firebase Console
      try {
        await signInAnonymously(fbAuth);
        resolve(true);
      } catch {
        // Anonymous auth not enabled — resolve false silently (no console noise)
        resolve(false);
      }
    });
  });

  return authReady;
}

/**
 * Try to get a download URL for a Firebase-secured video by its _fs_id UUID.
 * Tries multiple common storage path patterns.
 * Returns null if not found or auth fails.
 */
export async function getFirebaseVideoUrl(fsId: string): Promise<string | null> {
  initFirebase();
  const authed = await ensureFirebaseAuth();
  if (!authed) return null;

  const fbStorage = storage!;
  const pathsToTry = [
    ...VIDEO_PATHS.map((p) => `${p}/${fsId}`),
    ...VIDEO_PATHS.map((p) => `${p}/${fsId}.mp4`),
    fsId,
    `${fsId}.mp4`,
  ];

  for (const path of pathsToTry) {
    try {
      const fileRef = ref(fbStorage, path);
      const url = await getDownloadURL(fileRef);
      return url;
    } catch {
      // object/not-found or unauthorized — try next
    }
  }
  return null;
}
