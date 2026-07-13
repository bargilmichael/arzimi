import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0145327151";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : undefined;

let app;
if (getApps().length === 0) {
  if (clientEmail && privateKey) {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      })
    });
  } else {
    app = initializeApp({
      projectId,
    });
  }
} else {
  app = getApps()[0];
}

const db = getFirestore(app, "ai-studio-0db8495b-a177-4a01-9076-555c25ef4f60");

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

  const projectIdParam = req.method === 'GET' ? req.query.projectId : req.body?.projectId;
  
  if (!projectIdParam) {
    return res.status(400).json({ error: "Missing projectId parameter." });
  }

  try {
    console.log(`[Vercel Serverless] Fetching map via modular admin SDK for project: ${projectIdParam}`);
    const projectRef = db.collection('projects').doc(projectIdParam);
    const projectSnap = await projectRef.get();
    
    if (projectSnap.exists) {
      const data = projectSnap.data();
      return res.status(200).json({ mapUrl: data?.mapUrl || null });
    } else {
      return res.status(200).json({ mapUrl: null });
    }
  } catch (error: any) {
    console.error("[Vercel Serverless] Failed to fetch project map via modular admin SDK:", error);
    return res.status(500).json({ 
      error: error.message || "Failed to fetch project map from Firestore" 
    });
  }
}
