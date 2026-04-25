import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, updateDoc, query, orderBy, serverTimestamp, limit, addDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Helper error throwing as instructed
export const handleFirestoreError = (error: any, operationType: any, path: string | null) => {
  const authInfo = {
    userId: auth.currentUser?.uid || 'Unknown',
    email: auth.currentUser?.email || 'Unknown',
    emailVerified: auth.currentUser?.emailVerified || false,
    isAnonymous: auth.currentUser?.isAnonymous || false,
    providerInfo: auth.currentUser?.providerData || []
  };

  throw JSON.stringify({
    error: error.message,
    operationType,
    path,
    authInfo
  });
};
