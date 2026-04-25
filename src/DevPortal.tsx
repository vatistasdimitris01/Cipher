import { useState, useEffect } from 'react';
import { ArrowLeft, Key, Server, Copy, Check, Terminal, FileJson, Plus, Trash2, Wallet, DollarSign, Settings, Fingerprint } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { auth } from './firebase';

const provider = new GoogleAuthProvider();

export default function DevPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [keys, setKeys] = useState<{key: string, name: string, createdAt: string, usage: number, balance?: number}[]>([]);
  
  const [activeTab, setActiveTab] = useState<'keys' | 'billing' | 'settings'>('keys');

  // Forms
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchKeys = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/v1/keys?userId=${user.uid}`);
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
    } catch(e) {}
  };

  useEffect(() => {
    fetchKeys();
  }, [user]);

  const generateKey = async () => {
    if (!newKeyName.trim() || !user) return;
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, userId: user.uid })
      });
      if (res.ok) {
         setNewKeyName('');
         fetchKeys();
      }
    } catch (e) {}
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (authLoading) {
     return <div className="h-screen w-full bg-white flex items-center justify-center"><div className="w-4 h-4 border-2 border-black rounded-full animate-spin border-t-transparent"></div></div>;
  }

  if (!user) {
     return (
       <div className="h-screen w-full bg-white text-gray-900 font-sans flex flex-col items-center justify-center p-6 text-center overflow-y-auto relative">
          <div className="absolute top-0 left-0 w-full h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/50 via-white/0 to-transparent pointer-events-none"></div>
          <Fingerprint size={48} className="text-gray-300 mb-6 relative z-10" />
          <h1 className="text-4xl font-bold tracking-tighter text-black mb-3 relative z-10">Cipher Platform</h1>
          <p className="text-gray-500 max-w-sm mb-8 relative z-10">Authenticate your neural link to access API provisions, context pools, and webhook configurations.</p>
          <button 
            onClick={() => signInWithPopup(auth, provider)}
            className="px-6 py-3 bg-black text-white font-semibold rounded-full hover:bg-gray-800 transition-colors relative z-10"
          >
            Authenticate Link
          </button>
          
          <button 
             onClick={() => navigate('/')} 
             className="mt-12 flex items-center gap-2 text-xs text-gray-400 hover:text-black transition-colors uppercase tracking-wider font-semibold relative z-10"
           >
             <ArrowLeft size={14} /> Return to Hub
           </button>
       </div>
     );
  }

  const totalSpent = keys.length * 5.0 - keys.reduce((acc, k) => acc + (k.balance ?? 5.0), 0);
  const totalBalance = keys.reduce((acc, k) => acc + (k.balance ?? 5.0), 0);

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 overflow-hidden">
      {/* Enterprise Sidebar */}
      <div className="w-[260px] border-r border-gray-100 flex flex-col bg-gray-50/50 shrink-0">
        <div className="p-6 pb-4 border-b border-gray-100">
           <button 
             onClick={() => navigate('/')} 
             className="flex items-center gap-2 text-xs text-gray-400 hover:text-black transition-colors mb-6 uppercase tracking-wider font-semibold"
           >
             <ArrowLeft size={14} /> Back to Hub
           </button>
           <h2 className="text-base font-bold tracking-tight text-black flex items-center gap-2">
             <Fingerprint size={16} className="text-blue-600" /> Platform Portal
           </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
            <button onClick={() => setActiveTab('keys')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${activeTab === 'keys' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
               <Key size={16} /> API Keys
            </button>
            <button onClick={() => setActiveTab('billing')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${activeTab === 'billing' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
               <Wallet size={16} /> Usage & Billing
            </button>
            <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${activeTab === 'settings' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
               <Settings size={16} /> Global Settings
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative bg-white">
        <div className="max-w-4xl mx-auto p-10 lg:p-16">
          
          {activeTab === 'keys' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
               <h1 className="text-3xl font-bold tracking-tight text-black mb-2">API Keys</h1>
               <p className="text-gray-500 text-sm mb-12 font-light">Mint connection keys to interface with Cipher nodes programmatically. By default, keys are scoped globally with an initial balance pool of $5 ($1 = 1,000,000 context tokens).</p>

               <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-6 mb-8 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 to-transparent"></div>
                 <h3 className="text-sm tracking-widest uppercase text-gray-400 font-semibold mb-4 relative z-10">Mint Neural Key</h3>
                 <div className="flex gap-3 max-w-lg relative z-10">
                     <input 
                       value={newKeyName} 
                       onChange={(e) => setNewKeyName(e.target.value)} 
                       placeholder="Identifier (e.g. Production Cluster A)" 
                       className="flex-1 bg-transparent border-b border-gray-200 text-sm outline-none focus:border-black transition-colors text-black px-2 placeholder:text-gray-300"
                     />
                     <button onClick={generateKey} disabled={!newKeyName.trim()} className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50">Generate</button>
                 </div>
               </div>

               <div>
                 <h3 className="text-sm tracking-widest uppercase text-gray-400 font-semibold mb-4">Active Bindings</h3>
                 {keys.length === 0 ? (
                   <div className="border border-dashed border-gray-100 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                       <Key size={32} className="text-gray-200 mb-4" />
                       <p className="text-sm text-gray-400 font-light">No active keys assigned to this neural link.</p>
                   </div>
                 ) : (
                   <div className="space-y-3">
                     {keys.map(k => (
                       <div key={k.key} className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-center group hover:border-gray-200 transition-colors shadow-sm">
                         <div>
                           <p className="font-semibold text-sm text-black flex items-center gap-2">{k.name} <span className="bg-green-50 text-green-600 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">Active</span></p>
                           <p className="font-mono text-xs text-gray-400 mt-2 flex items-center gap-3">
                             <span>{k.key.substring(0, 15)}...</span>
                             <span className="w-1 h-1 rounded-full bg-gray-100"></span>
                             <span>Created {new Date(k.createdAt).toLocaleDateString()}</span>
                           </p>
                         </div>
                         <button 
                           onClick={() => copyToClipboard(k.key, k.key)}
                           className="p-2 transition-colors text-gray-400 hover:text-black bg-gray-50 border border-gray-100 rounded hover:border-gray-300"
                           title="Copy Key"
                         >
                           {copiedKey === k.key ? <Check size={16} className="text-green-500"/> : <Copy size={16} />}
                         </button>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
               <h1 className="text-3xl font-bold tracking-tight text-black mb-2">Usage & Billing</h1>
               <p className="text-gray-500 text-sm mb-12 font-light">Monitor your real-time token exhaustion. Costs map out linearly at $1.00 USD per 1M Context Tokens executed.</p>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-5 text-gray-900"><Wallet size={120} /></div>
                     <div className="flex items-center gap-2 mb-8 relative z-10">
                       <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                       <span className="text-sm text-gray-400 font-semibold tracking-wide uppercase">Remaining Pool</span>
                     </div>
                     <span className="text-5xl font-bold text-black tracking-tighter relative z-10">${totalBalance % 1 === 0 ? totalBalance.toFixed(0) : totalBalance.toFixed(2)}</span>
                  </div>
                  
                  <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-5 text-gray-900"><DollarSign size={120} /></div>
                     <div className="flex items-center gap-2 mb-8 relative z-10">
                       <div className="w-2 h-2 rounded-full bg-red-400"></div>
                       <span className="text-sm text-gray-400 font-semibold tracking-wide uppercase">Total Exhausted</span>
                     </div>
                     <span className="text-5xl font-bold text-black tracking-tighter relative z-10">${totalSpent % 1 === 0 ? totalSpent.toFixed(0) : totalSpent.toFixed(2)}</span>
                  </div>
               </div>

               <div className="mt-12 bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                  <h3 className="text-black font-semibold mb-4">Payment Methods</h3>
                  <div className="border border-dashed border-gray-100 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                       <p className="text-sm text-gray-400 mb-4 font-light">Billing engine is currently operating in beta. All newly generated keys inherit a complimentary test balance pool.</p>
                       <button className="px-4 py-2 bg-gray-50 border border-gray-100 text-sm text-gray-500 rounded hover:bg-gray-100 hover:text-black transition-colors cursor-not-allowed">Add Payment Method via Stripe</button>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
               <h1 className="text-3xl font-bold tracking-tight text-black mb-2">Global Settings</h1>
               <p className="text-gray-500 text-sm mb-12 font-light">Manage root-level API limits attached to this identity.</p>

               <div className="space-y-6">
                  <div className="bg-white border border-gray-100 rounded-xl p-6 flex items-center justify-between shadow-sm">
                     <div>
                        <h4 className="text-black font-semibold flex items-center gap-2 mb-1">Hard Overages <span className="bg-red-50 text-red-500 text-[10px] px-2 py-0.5 rounded">Disabled</span></h4>
                        <p className="text-sm text-gray-500 font-light">If enabled, the API auto-bills when context limits are reached.</p>
                     </div>
                     <button className="w-12 h-6 bg-gray-100 rounded-full relative cursor-not-allowed">
                        <div className="w-4 h-4 bg-gray-300 rounded-full absolute left-1 top-1"></div>
                     </button>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-xl p-6 flex items-center justify-between shadow-sm">
                     <div>
                        <h4 className="text-black font-semibold flex items-center gap-2 mb-1">Telemetry Opt-In</h4>
                        <p className="text-sm text-gray-500 font-light">Allow Cipher metrics processing to improve underlying model pipelines.</p>
                     </div>
                     <button className="w-12 h-6 bg-blue-500 rounded-full relative cursor-not-allowed">
                        <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                     </button>
                  </div>

                  <div className="mt-12 pt-8 border-t border-gray-100">
                     <h4 className="text-red-500 font-semibold mb-2">Danger Zone</h4>
                     <p className="text-sm text-gray-500 mb-4 font-light">Permanently destroy this developer account and revoke all bound keys natively.</p>
                     <button className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded hover:bg-red-600 hover:text-white transition-colors text-sm font-bold">Delete Account</button>
                  </div>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
