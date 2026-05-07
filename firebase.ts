import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBMBrPn0ypVgYNUYbmK0X1kmkAdrKfod-A",
  authDomain: "gen-lang-client-0145327151.firebaseapp.com",
  projectId: "gen-lang-client-0145327151",
  storageBucket: "gen-lang-client-0145327151.firebasestorage.app",
  messagingSenderId: "831027802568",
  appId: "1:831027802568:web:c41326806cdee18a6550fd"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with the specific database ID and long polling to bypass websocket issues
// The 3rd argument is the database ID.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, "ai-studio-0db8495b-a177-4a01-9076-555c25ef4f60");

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Auth helpers
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Test connection
async function testConnection() {
  try {
    const healthRef = doc(db, '_internal_', 'healthcheck');
    const promise = getDocFromServer(healthRef);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 10000));
    
    await Promise.race([promise, timeout]);
    console.log("Firebase connection verified.");
  } catch (error: any) {
    console.warn("Firestore connection check info:", error.message);
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
       console.error("CRITICAL: Firebase is offline or unreachable. Check if the database 'ai-studio-0db8495b-a177-4a01-9076-555c25ef4f60' exists and is active.");
    }
  }
}
testConnection();

export { onAuthStateChanged };
export type { FirebaseUser };
