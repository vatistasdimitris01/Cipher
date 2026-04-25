import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, updateDoc, query, orderBy, serverTimestamp, limit, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD-JfpdUzhmkFav0RW2HoncLz9VHi0El9Y",
  authDomain: "ciphertheai.firebaseapp.com",
  projectId: "ciphertheai",
  storageBucket: "ciphertheai.firebasestorage.app",
  messagingSenderId: "996902957218",
  appId: "1:996902957218:web:6143180978d6477c1767fb",
  measurementId: "G-D4LRJ8GDTW",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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
