import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from './firebase';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Fingerprint, ArrowLeft, ShieldCheck, Globe, Zap, Smartphone } from 'lucide-react';
import { motion } from 'motion/react';

const provider = new GoogleAuthProvider();

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('pending');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auto-verify if user is already logged in and code exists
  useEffect(() => {
    if (user && code && status === 'pending') {
      verifyDevice(code);
    }
  }, [user, code]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const verifyDevice = async (deviceCode: string) => {
    if (!user) return;
    setStatus('verifying');
    
    try {
      // Direct call to Firestore from client as in snippet
      await setDoc(doc(db, 'auth_requests', deviceCode), {
        status: 'verified',
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0],
        verifiedAt: serverTimestamp()
      }, { merge: true });
      
      setStatus('verified');
      
      // Auto-close or redirect
      setTimeout(() => {
        if (window.opener) {
          window.close();
        } else {
          navigate('/chat');
        }
      }, 2000);
      
    } catch (e: any) {
      setError(e.message);
      setStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center">
        <motion.div 
           animate={{ rotate: 360 }}
           transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
           className="w-6 h-6 border-2 border-black rounded-full border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/40 via-white/0 to-transparent pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="mb-12 flex justify-center">
          <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm">
            <Fingerprint size={48} className="text-black" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center tracking-tighter mb-8">
          <span className="text-black/30">›_</span> Device Linking
        </h1>

        {code && status !== 'verified' && (
          <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 mb-6 shadow-sm">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-4">Verification Code</p>
            <p className="text-4xl font-mono text-center text-black mb-8 tracking-tighter">{code}</p>
            
            {!user ? (
              <div className="text-center">
                <p className="text-gray-500 text-sm mb-6">Link your Cipher Identity to authorize this terminal session.</p>
                <button
                  onClick={handleGoogleLogin}
                  className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Globe size={18} /> Sign in with Google
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-500 text-sm mb-6">Welcome, <b>{user.displayName || user.email}</b></p>
                <button
                  onClick={() => verifyDevice(code)}
                  disabled={status === 'verifying'}
                  className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition disabled:opacity-50 active:scale-[0.98]"
                >
                  {status === 'verifying' ? 'Establishing Neural Link...' : 'Confirm Device Link'}
                </button>
              </div>
            )}
          </div>
        )}

        {status === 'verified' && (
          <div className="bg-green-50 border border-green-100 rounded-3xl p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={24} className="text-white" />
            </div>
            <p className="text-green-800 font-bold">Neural link verified.</p>
            <p className="text-green-600/70 text-xs mt-2">The CLI session is now synchronized.</p>
          </div>
        )}

        {!code && (
          <div className="text-center text-gray-400">
             <p className="text-sm font-medium">No device code detected.</p>
             <p className="text-xs mt-2">Run <code className="bg-gray-50 px-2 py-0.5 rounded text-black font-mono">cipher login</code> to initiate a link.</p>
             <button onClick={() => navigate('/')} className="mt-8 text-[10px] font-bold uppercase tracking-widest hover:text-black">Return to Hub</button>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-center text-xs mt-6 font-medium tracking-tight bg-red-50 py-2 rounded-lg">{error}</p>
        )}
      </motion.div>
    </div>
  );
}

