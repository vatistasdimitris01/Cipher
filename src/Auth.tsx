import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { Fingerprint, ArrowLeft, ShieldCheck, Globe, Zap } from 'lucide-react';
import { motion } from 'motion/react';

const provider = new GoogleAuthProvider();

export default function Auth() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        // Automatically redirect to chat or portal if already logged in
        setTimeout(() => navigate('/chat'), 1500);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Authentication failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-white flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-6 h-6 border-2 border-black rounded-full border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white text-black font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/40 via-white/0 to-transparent pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10 text-center"
      >
        <div className="mb-12 flex justify-center">
          <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm">
            <Fingerprint size={48} className="text-black" />
          </div>
        </div>

        <h1 className="text-4xl font-bold tracking-tighter mb-4">Identity Protocol</h1>
        <p className="text-gray-500 mb-12 font-medium">Link your account to synchronize neural fragments and access the Cipher API across all interfaces.</p>

        {user ? (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6 mb-8 flex items-center justify-center gap-3">
            <ShieldCheck size={20} className="text-green-600" />
            <span className="text-green-700 font-bold tracking-tight">Identity Verified. Redirecting...</span>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-black text-white font-bold rounded-2xl text-lg hover:bg-gray-800 transition-all shadow-xl shadow-black/5 flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <Globe size={20} /> Continue with Google
          </button>
        )}

        <div className="mt-12 grid grid-cols-2 gap-4 text-left">
           <div className="p-4 rounded-xl border border-gray-50 bg-gray-50/30">
              <Zap size={16} className="text-blue-500 mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Compute Pool</p>
              <p className="text-xs font-semibold text-black">Unrestricted Reasoning</p>
           </div>
           <div className="p-4 rounded-xl border border-gray-50 bg-gray-50/30">
              <Globe size={16} className="text-purple-500 mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Neural Sync</p>
              <p className="text-xs font-semibold text-black">Cross-Platform Memory</p>
           </div>
        </div>

        <button 
          onClick={() => navigate('/')} 
          className="mt-16 flex items-center gap-2 text-xs text-gray-400 hover:text-black transition-colors uppercase tracking-widest font-bold mx-auto group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Return to Hub
        </button>
      </motion.div>

      <div className="absolute bottom-12 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">
        Cipher Intelligence Agency • 2026
      </div>
    </div>
  );
}
