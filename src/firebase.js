import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyD-JfpdUzhmkFav0RW2HoncLz9VHi0El9Y",
  authDomain: "ciphertheai.firebaseapp.com",
  projectId: "ciphertheai",
  storageBucket: "ciphertheai.firebasestorage.app",
  messagingSenderId: "996902957218",
  appId: "1:996902957218:web:6143180978d6477c1767fb",
  measurementId: "G-D4LRJ8GDTW",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export default firebase;
export const db = firebase.firestore();
export const auth = firebase.auth();
try { firebase.analytics(); } catch (_) {}
