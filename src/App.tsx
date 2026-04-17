import { MoreHorizontal, ArrowUp, X, Check, User as UserIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const MODELS = [
  { id: 'nemotron-3-super-free', name: 'Cipher Prime' },
  { id: 'minimax-m2.5-free', name: 'Cipher Node' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedModel, setSelectedModel] = useState('nemotron-3-super-free');
  const [skipSlop, setSkipSlop] = useState(true);
  const [settingsTab, setSettingsTab] = useState<'account' | 'cipher' | 'appearance'>('account');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    // ... rest of the send logic
    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          skipSlop: skipSlop,
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();
      if (data.error) {
         setMessages([...newMessages, { role: 'assistant', content: `Error: ${data.error}` }]);
      } else {
         setMessages([...newMessages, { role: 'assistant', content: data.choices[0].message.content }]);
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Connection to Cipher severed!' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Theme styles
  const bgMain = theme === 'dark' ? 'bg-[#212121] text-[#ececec]' : 'bg-[#fff] text-[#111827]';
  const iconColor = theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-900';
  const userBubble = theme === 'dark' ? 'bg-[#2f2f2f] text-white' : 'bg-gray-100 text-gray-900';
  const aiText = theme === 'dark' ? 'text-[#ececec] markdown-body' : 'text-gray-900 markdown-body';
  const inputCont = theme === 'dark' ? 'bg-[#2f2f2f]' : 'bg-[#f4f4f5]';
  const inputClass = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const btnActive = theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800';
  const btnInactive = theme === 'dark' ? 'bg-[#424242] text-[#676767]' : 'bg-[#e4e4e7] text-[#a1a1aa]';

  if (authLoading) {
    return <div className={`h-screen flex items-center justify-center ${bgMain}`}>Loading...</div>;
  }

  if (!user) {
    return (
      <div className={`h-screen flex items-center justify-center ${bgMain}`}>
        <div className={`p-8 rounded-2xl max-w-md w-full text-center ${theme === 'dark' ? 'bg-[#1f1f1f] border border-[#333]' : 'bg-white border border-gray-200 shadow-xl'}`}>
          <h1 className="text-2xl font-bold mb-2">Welcome to ShadowNet</h1>
          <p className={`mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Authenticate protocol to access the Oracle.</p>
          <button 
            onClick={handleLogin}
            className={`w-full py-3 px-4 rounded-full font-medium transition-colors ${btnActive}`}
          >
            Authenticate via Google
          </button>
        </div>
      </div>
    );
  }

  const blurBg = theme === 'dark' ? 'bg-[#212121]/80' : 'bg-[#fff]/80';

  return (
    <div className={`font-sans h-screen flex flex-col relative overflow-hidden transition-colors ${bgMain}`}>
        
        {/* Top Right Menu Icon */}
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className={`absolute top-4 right-4 cursor-pointer p-2 rounded-full transition-colors z-20 ${iconColor}`}
        >
            <MoreHorizontal size={20} />
        </button>

        {/* Chat Area - Added bottom padding so last message clears the input bar */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center pt-24 px-4 pb-32 w-full">
            <div className="w-full max-w-3xl flex flex-col gap-8">
                {messages.map((msg, idx) => (
                    msg.role === 'user' ? (
                        <div key={idx} className="flex justify-end w-full">
                            <div className={`px-5 py-2.5 rounded-[20px] text-[15px] max-w-[80%] break-words ${userBubble}`}>
                                {msg.content}
                            </div>
                        </div>
                    ) : (
                        <div key={idx} className="flex justify-start w-full">
                            <div className={`text-[15px] px-1 max-w-[80%] leading-[1.5] break-words overflow-hidden ${aiText}`}>
                                <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</Markdown>
                            </div>
                        </div>
                    )
                ))}
                {isLoading && (
                   <div className="flex justify-start w-full">
                     <div className={`text-[15px] px-1 max-w-[80%] leading-[1.5] animate-pulse ${aiText}`}>
                        synthesizing...
                     </div>
                   </div>
                )}
            </div>
        </div>

        {/* Input Area Overlay */}
        <div className={`absolute bottom-0 left-0 w-full flex justify-center pb-8 px-4 pt-8 backdrop-blur-md z-10 transition-colors ${blurBg}`}>
            <div className={`w-full max-w-3xl rounded-full flex items-center pl-6 pr-2 py-2 transition-colors ${inputCont}`}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={isLoading}
                    className={`bg-transparent border-none outline-none flex-1 text-[16px] ${inputClass} disabled:opacity-50`}
                    placeholder="Message Cipher..."
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className={`rounded-full w-9 h-9 flex items-center justify-center ml-2 flex-shrink-0 transition-colors ${
                        input.trim() && !isLoading ? `${btnActive} cursor-pointer` : `${btnInactive} cursor-not-allowed`
                    }`}
                >
                    <ArrowUp strokeWidth={2} size={18} />
                </button>
            </div>
        </div>

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
            <div className={`w-full max-w-md rounded-2xl flex flex-col shadow-xl overflow-hidden ${theme === 'dark' ? 'bg-[#1f1f1f] text-white border border-[#333]' : 'bg-white text-gray-900 border border-gray-200'}`}>
              <div className="flex justify-between items-center p-6 pb-2">
                <h2 className="text-xl font-medium">Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)} className={`p-1 rounded-full ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className={`flex px-6 pt-4 space-x-6 border-b ${theme === 'dark' ? 'border-[#333]' : 'border-gray-200'}`}>
                <button 
                  onClick={() => setSettingsTab('account')}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 ${settingsTab === 'account' ? (theme === 'dark' ? 'border-blue-500 text-blue-400' : 'border-blue-500 text-blue-600') : 'border-transparent text-gray-500 hover:text-gray-400'}`}
                >
                  Account
                </button>
                <button 
                  onClick={() => setSettingsTab('cipher')}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 ${settingsTab === 'cipher' ? (theme === 'dark' ? 'border-blue-500 text-blue-400' : 'border-blue-500 text-blue-600') : 'border-transparent text-gray-500 hover:text-gray-400'}`}
                >
                  Cipher
                </button>
                <button 
                  onClick={() => setSettingsTab('appearance')}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 ${settingsTab === 'appearance' ? (theme === 'dark' ? 'border-blue-500 text-blue-400' : 'border-blue-500 text-blue-600') : 'border-transparent text-gray-500 hover:text-gray-400'}`}
                >
                  Appearance
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6 space-y-6">
                
                {settingsTab === 'account' && user && (
                  <div className="flex flex-col items-center py-6">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'User'} className="w-20 h-20 rounded-full mb-4 object-cover" />
                    ) : (
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-[#333]' : 'bg-gray-100'}`}>
                        <UserIcon size={32} />
                      </div>
                    )}
                    <h3 className="text-xl font-medium">{user.displayName || 'Authenticated User'}</h3>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{user.email}</p>
                    
                    <button 
                      onClick={handleLogout}
                      className="mt-8 px-6 py-2.5 bg-red-500/10 text-red-500 rounded-full font-medium hover:bg-red-500/20 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}

                {settingsTab === 'cipher' && (
                  <>
                    <div className="space-y-3">
                      <span className="text-[15px] font-medium block">Cipher Model</span>
                      <div className="grid gap-2">
                        {MODELS.map(m => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedModel(m.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-colors ${
                              selectedModel === m.id 
                                ? (theme === 'dark' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-blue-500 bg-blue-50 text-blue-700')
                                : (theme === 'dark' ? 'border-gray-700 hover:bg-[#2f2f2f]' : 'border-gray-200 hover:bg-gray-50')
                            }`}
                          >
                            {m.name}
                            {selectedModel === m.id && <Check size={16} className="text-blue-500" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <div>
                        <span className="text-[15px] font-medium block">Bypass Filler</span>
                        <span className={`text-xs block mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Forces Cipher to output concise blocks directly.</span>
                      </div>
                      <button 
                        onClick={() => setSkipSlop(!skipSlop)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${skipSlop ? 'bg-blue-600' : 'bg-gray-600'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${skipSlop ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </>
                )}

                {settingsTab === 'appearance' && (
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-[15px] font-medium block">Light Mode</span>
                      <span className={`text-xs block mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Switch to a bright interface.</span>
                    </div>
                    <button 
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${theme === 'light' ? 'bg-blue-600' : 'bg-gray-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'light' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
