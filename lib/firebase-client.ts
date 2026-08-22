import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signInWithCustomToken, onAuthStateChanged, type User, type Auth } from "firebase/auth";

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyBuildKey",
  authDomain: "chants-506202.firebaseapp.com",
  projectId: "chants-506202",
  storageBucket: "chants-506202.firebasestorage.app",
  messagingSenderId: "1011879711045",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1011879711045:web:dummybuild",
};

function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApps()[0]!;
  return initializeApp(cfg as any);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function signInWithDiscordCustomToken(customToken: string): Promise<User> {
  return signInWithCustomToken(getFirebaseAuth(), customToken).then(r=>r.user);
}

export function onAuthChanged(cb: (u: User|null)=>void): ()=>void {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}

export async function getIdToken(): Promise<string|null> {
  const u=getFirebaseAuth().currentUser; if(!u) return null; return await u.getIdToken();
}

export async function signOutFirebase(): Promise<void> {
  const { signOut } = await import("firebase/auth"); await signOut(getFirebaseAuth());
}
