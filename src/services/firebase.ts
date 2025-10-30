import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, Timestamp, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : undefined;
export const auth = getAuth(app);
export const db = getFirestore(app);
// Store a conversation in Firestore
export async function storeConversation(query: string, response: string, userId: string) {
  try {
    await addDoc(collection(db, "conversations"), {
      query,
      response,
      userId,
      timestamp: Timestamp.now(),
    });
  } catch (e) {
    console.error("Error storing conversation:", e);
  }
}

export async function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signup(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

export async function updateApcLimits(variableName: string, values: { pv: string; ll: string; hl: string }) {
  try {
    const docRef = doc(collection(db, "apclimits"), variableName);
    await setDoc(docRef, values);
  } catch (error) {
    console.error("Error updating APC limits:", error);
  }
}

export { app, analytics };
