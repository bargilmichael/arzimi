import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBMBrPn0ypVgYNUYbmK0X1kmkAdrKfod-A",
  authDomain: "gen-lang-client-0145327151.firebaseapp.com",
  projectId: "gen-lang-client-0145327151",
  storageBucket: "gen-lang-client-0145327151.firebasestorage.app",
  messagingSenderId: "831027802568",
  appId: "1:831027802568:web:c41326806cdee18a6550fd"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
}, "ai-studio-0db8495b-a177-4a01-9076-555c25ef4f60");

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, mapUrl } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: "Missing projectId parameter." });
    }

    console.log(`[Vercel Serverless] Saving map for project: ${projectId}, mapUrl: ${mapUrl ? "exists" : "null"}`);
    const projectRef = doc(db, 'projects', projectId);
    await setDoc(projectRef, {
      id: projectId,
      mapUrl: mapUrl || null,
      mapUploadedAt: mapUrl ? Date.now() : null
    }, { merge: true });

    return res.status(200).json({ success: true, mapUrl: mapUrl || null });
  } catch (error: any) {
    console.error("[Vercel Serverless] Failed to save project map:", error);
    return res.status(500).json({ 
      error: error.message || "Failed to save project map to Firestore" 
    });
  }
}
