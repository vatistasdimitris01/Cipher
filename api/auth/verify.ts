import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const OPENCODE_API_KEY = "sk-jLHTSQp8VGF9nN7oRAFlqyrfCxB8moyPIDtS0S1V1MCaFrV9LVR3KBtQVmxqk6PY";

if (serviceAccountKey && getApps().length === 0) {
  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (e) {
    console.error("Firebase Admin Init Error:", e);
  }
}

// Target the specific database
const db = getFirestore(firebaseConfig.firestoreDatabaseId);

export default async function handler(req, res) {
  // Add CORS headers
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

  const { code } = req.query;

  if (req.method === 'GET') {
    if (!code) return res.status(400).json({ error: 'Code required' });

    try {
      const docRef = db.collection('auth_requests').doc(code as string);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return res.json({ verified: false, error: 'Authorization code not found or expired.' });
      }

      const data = docSnap.data();

      if (data?.status === 'verified') {
        // Fetch user memory/context
        const memorySnap = await db.collection('users').doc(data.uid).collection('memory').orderBy('timestamp', 'desc').limit(1).get();
        let memory = "";
        if (!memorySnap.empty) {
          memory = memorySnap.docs[0].data().content;
        }

        // Return sync payload including the requested API key
        const response = {
          verified: true,
          uid: data.uid,
          email: data.email,
          name: data.name,
          memory,
          apiKey: OPENCODE_API_KEY
        };

        // Delete the doc after verification to prevent reuse
        await docRef.delete();

        return res.json(response);
      }

      return res.json({ verified: false, status: data?.status || 'pending' });
    } catch (error: any) {
      console.error("GET Verify Error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const providedCode = req.body.code;
      const generateCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return 'CIPH-' + Array(4).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
      };

      const finalCode = providedCode || generateCode();
      await db.collection('auth_requests').doc(finalCode).set({
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        // TTL for cleanliness
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) 
      });

      return res.json({ code: finalCode, status: 'pending' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
