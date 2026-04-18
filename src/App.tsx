import { MoreHorizontal, ArrowUp, X, Check, User as UserIcon, Copy, Settings, Shield, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError } from './firebase';

const provider = new GoogleAuthProvider();

const MODELS = [
  { id: 'nemotron-3-super-free', name: 'Cipher Prime' },
  { id: 'minimax-m2.5-free', name: 'Cipher Node' },
  { id: 'deepseek-r1-free', name: 'Cipher Oracle (Math/Logic)' },
];

const PreBlock = ({ children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  let codeString = '';
  
  if (children && children.props && children.props.children) {
    codeString = children.props.children;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(String(codeString).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-6 right-2 p-1.5 rounded-lg bg-[#2d2d2d]/80 backdrop-blur-sm text-gray-300 opacity-0 group-hover:opacity-100 transition-all flex items-center hover:bg-[#3d3d3d] hover:text-white z-10 border border-[#444]"
        title="Copy code"
      >
        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
      </button>
      <pre {...props}>
        {children}
      </pre>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isChatEnded, setIsChatEnded] = useState(false);
  const [pendingAction, setPendingAction] = useState<{type: 'new' | 'select', payload?: any} | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState(0);

  const CREDITS_LIMIT = 50;

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedModel, setSelectedModel] = useState('nemotron-3-super-free');
  const [skipSlop, setSkipSlop] = useState(true);
  const [settingsTab, setSettingsTab] = useState<'account' | 'cipher' | 'appearance'>('account');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute("content", theme === 'dark' ? '#080808' : '#ffffff');
    document.body.style.backgroundColor = theme === 'dark' ? '#080808' : '#ffffff';
  }, [theme]);

  useEffect(() => {
    if (user) {
      const fetchInitialData = async () => {
        try {
          const q = query(collection(db, 'users', user.uid, 'chats'), orderBy('updatedAt', 'desc'));
          const qSnap = await getDocs(q);
          setChatHistory(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          const today = new Date().toISOString().split('T')[0];
          if (userSnap.exists()) {
             const data = userSnap.data();
             if (data.lastMessageDate === today) {
                setDailyUsage(data.dailyUsage || 0);
             } else {
                setDailyUsage(0);
             }
          }
        } catch (err) {
          console.error('Error fetching init data:', err);
        }
      };
      fetchInitialData();
    } else {
      setChatHistory([]);
      setCurrentChatId(null);
      setMessages([]);
      setDailyUsage(0);
    }
  }, [user]);

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

  const checkAndIncrementUsage = async (uid: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Secondary check via localStorage footprint
      const localDataStr = localStorage.getItem('cipher_device_limits');
      if (localDataStr) {
         try {
            const localData = JSON.parse(localDataStr);
            if (localData.date === today && localData.usage >= CREDITS_LIMIT) {
                setLimitWarning(`Device blocked: Maximum daily credits (${CREDITS_LIMIT}) reached. Resets at midnight.`);
                setTimeout(() => setLimitWarning(null), 5000);
                return false;
            }
         } catch(e) {}
      }

      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      let currentUsage = 0;
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.lastMessageDate === today) {
           currentUsage = data.dailyUsage || 0;
        }
      }

      if (currentUsage >= CREDITS_LIMIT) {
          setLimitWarning(`Protocol access suspended: Maximum daily credits (${CREDITS_LIMIT}) reached. Resets at midnight.`);
          setTimeout(() => setLimitWarning(null), 5000);
          localStorage.setItem('cipher_device_limits', JSON.stringify({ date: today, usage: currentUsage }));
          return false;
      }
      
      const newUsage = currentUsage + 1;
      await setDoc(userRef, { dailyUsage: newUsage, lastMessageDate: today }, { merge: true });
      setDailyUsage(newUsage);
      localStorage.setItem('cipher_device_limits', JSON.stringify({ date: today, usage: newUsage }));

      const remaining = CREDITS_LIMIT - newUsage;
      if (remaining <= 5 && remaining > 0) {
          setLimitWarning(`Warning: Only ${remaining} credits remaining today.`);
          setTimeout(() => setLimitWarning(null), 4000);
      }

      return true;
    } catch (err) {
      console.error('Usage tracking error:', err);
      // Allow pass-through if firestore fails rather than breaking UX
      return true;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user || isChatEnded) return;
    
    if (!(await checkAndIncrementUsage(user.uid))) return;

    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          model: selectedModel,
          skipSlop: skipSlop,
          userName: user.displayName || 'Unknown User',
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();
      let assistantMsgContent = '';

      if (data.error) {
         const errMsg = typeof data.error === 'object' ? JSON.stringify(data.error) : data.error;
         assistantMsgContent = `Error: ${errMsg}`;
      } else {
         assistantMsgContent = data.choices[0].message.content;
      }

      let newlyEnded = false;
      const lowerContent = assistantMsgContent.toLowerCase().trim();
      
      if (
        assistantMsgContent.includes('[END_CONVERSATION]') || 
        assistantMsgContent.includes('[END]') ||
        lowerContent === 'end' || 
        lowerContent === 'end.' || 
        lowerContent === 'end of conversation.' ||
        lowerContent.includes('chat ended') ||
        lowerContent.includes('end this chat') ||
        lowerContent.includes('[no response]') ||
        lowerContent.includes('[no output]')
      ) {
         newlyEnded = true;
         // Strip out tags so they don't render as ugly text
         assistantMsgContent = assistantMsgContent.replace(/\[END_CONVERSATION\]/gi, '').replace(/\[END\]/gi, '').replace(/\[No response\]/gi, '').replace(/\[No output\]/gi, '').trim();
         
         // If it literally just output "end" and stripped to nothing
         if (assistantMsgContent.toLowerCase() === 'end' || assistantMsgContent.toLowerCase() === 'end.' || assistantMsgContent === '' || assistantMsgContent.toLowerCase().includes('chat ended')) {
             assistantMsgContent = "Session protocol successfully terminated.";
         }
         setIsChatEnded(true);
      }
      
      const finalMessages = [...newMessages, { role: 'assistant', content: assistantMsgContent }];
      setMessages(finalMessages);

      // Handle Firestore Chat Saving & Title Generation
      let finalChatId = currentChatId;
      let finalTitle = "New Chat";
      
      const isFirstMessage = newMessages.length === 1;

      // Only attempt title gen if this is the first substantial message
      if (isFirstMessage && userMsg.content.length > 10) {
         try {
           const titleResponse = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'nemotron-3-super-free', // Fast model for titles
                skipSlop: true,
                messages: [
                  { role: 'system', content: 'Generate a short, maximum 3-word title summarizing the user message. ONLY output the words.' },
                  { role: 'user', content: userMsg.content }
                ]
              })
           });
           const titleData = await titleResponse.json();
           if (!titleData.error && titleData.choices?.[0]?.message?.content) {
              const cleanedTitle = titleData.choices[0].message.content.replace(/["*]/g, '').trim();
              if (cleanedTitle.length < 50) finalTitle = cleanedTitle;
           }
         } catch (e) {
           console.error("Title generation failed", e);
         }
      }

      if (!finalChatId) {
        // Create new chat
        const chatDocRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
          title: finalTitle,
          messages: finalMessages,
          isEnded: isChatEnded || newlyEnded,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        finalChatId = chatDocRef.id;
        setCurrentChatId(finalChatId);
        setChatHistory(prev => [{ id: finalChatId, title: finalTitle, updatedAt: Date.now() }, ...prev]);
      } else {
        // Update existing chat
        const chatRef = doc(db, 'users', user.uid, 'chats', finalChatId);
        await updateDoc(chatRef, {
          messages: finalMessages,
          isEnded: isChatEnded || newlyEnded,
          updatedAt: serverTimestamp()
        });
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Fetch aborted");
        return;
      }
      setMessages([...newMessages, { role: 'assistant', content: 'Connection to Cipher severed!' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Theme styles
  const bgMain = theme === 'dark' ? 'bg-pitch-black text-[#ececec]' : 'bg-[#fff] text-[#111827]';
  const iconColor = theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-900';
  const userBubble = theme === 'dark' ? 'bg-[#1a1a1a] text-white border border-[#242424]' : 'bg-gray-100 text-gray-900';
  const aiText = theme === 'dark' ? 'text-[#ececec] markdown-body' : 'text-gray-900 markdown-body';
  const inputCont = theme === 'dark' ? 'bg-[#121212] border border-[#242424]' : 'bg-gray-200';
  const inputClass = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const btnActive = theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800';
  const btnInactive = theme === 'dark' ? 'bg-[#1a1a1a] text-[#444]' : 'bg-[#e4e4e7] text-[#a1a1aa]';

  if (authLoading) {
    return <div className={`h-screen flex items-center justify-center ${bgMain} font-mono tracking-widest text-xs opacity-50 uppercase`}>Initializing Protocol...</div>;
  }

  if (!user) {
    return (
      <div className={`h-screen flex flex-col items-center justify-center ${bgMain} px-6`}>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center w-full max-w-sm"
        >
          <div className="mb-12">
             <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                <Shield size={24} />
             </div>
          </div>

          <div className="text-center mb-12">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] mb-2">Cipher Intelligence</h1>
            <p className={`text-sm tracking-tight ${theme === 'dark' ? 'text-gray-500 font-light' : 'text-gray-500'}`}>
              Connect to the neural network to begin synthesis.
            </p>
          </div>

          <button 
            onClick={handleLogin}
            className={`group relative w-full h-12 rounded-full overflow-hidden transition-all duration-300 flex items-center justify-center gap-3 ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
          >
            <span className="font-medium text-sm">Continue with Google</span>
          </button>

          <div className="mt-12 flex items-center gap-4 opacity-20 pointer-events-none">
             <div className={`h-[1px] w-8 ${theme === 'dark' ? 'bg-white' : 'bg-black'}`}></div>
             <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Secure Node 04</span>
             <div className={`h-[1px] w-8 ${theme === 'dark' ? 'bg-white' : 'bg-black'}`}></div>
          </div>
        </motion.div>
      </div>
    );
  }

  const startNewChat = () => {
    if (messages.length === 0 && !currentChatId) {
      setIsHistoryOpen(false);
      return; 
    }
    if (isLoading) {
      setPendingAction({ type: 'new' });
      return;
    }
    setCurrentChatId(null);
    setMessages([]);
    setIsChatEnded(false);
    setIsHistoryOpen(false);
  };

  const confirmAbort = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    setIsLoading(false);
    if (pendingAction?.type === 'new') {
        setCurrentChatId(null);
        setMessages([]);
        setIsChatEnded(false);
    } else if (pendingAction?.type === 'select') {
        executeSelectChat(pendingAction.payload);
    }
    setPendingAction(null);
    setIsHistoryOpen(false);
  };

  const cancelAbort = () => {
    setPendingAction(null);
  };

  const executeSelectChat = async (chat: any) => {
    setCurrentChatId(chat.id);
    setIsHistoryOpen(false);
    setIsChatEnded(chat.isEnded || false);
    
    try {
      const docSnap = await getDoc(doc(db, 'users', user!.uid, 'chats', chat.id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const msgs = data.messages || [];
        setMessages(msgs);
        
        // Retroactively flag chats that ended before the boolean constraint was robust
        let essentiallyEnded = data.isEnded || false;
        if (!essentiallyEnded && msgs.length > 0) {
           const lastMsg = msgs[msgs.length - 1];
           if (lastMsg.role === 'assistant') {
              const content = lastMsg.content.toLowerCase();
              if (content.includes('[end_conversation]') || content.includes('session protocol successfully terminated') || content.includes('chat ended') || content.includes('[no response]') || content.includes('[no output]')) {
                 essentiallyEnded = true;
              }
           }
        }
        setIsChatEnded(essentiallyEnded);
      }
    } catch(err) {
      console.error(err);
      setMessages([]);
    }
  };

  const deleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // prevent triggering selectChat
    if (!user) return;
    
    // Opt UI instantly
    setChatHistory(prev => prev.filter(c => c.id !== chatId));
    if (currentChatId === chatId) {
       startNewChat();
    }
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'chats', chatId));
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  const selectChat = (chat: any) => {
    if (chat.id === currentChatId) {
       setIsHistoryOpen(false);
       return;
    }
    if (isLoading) {
       setPendingAction({ type: 'select', payload: chat });
       return;
    }
    executeSelectChat(chat);
  };

  const blurBg = theme === 'dark' ? 'bg-pitch-black/80' : 'bg-[#fff]/80';

  return (
    <div className={`font-sans h-screen flex flex-col relative overflow-hidden overscroll-none transition-colors ${bgMain}`}>
        
        {/* Top Left Menu Icons */}
        <div className="absolute top-4 left-4 z-20">
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className={`cursor-pointer p-2 rounded-full transition-colors ${iconColor}`}
          >
            <div className="size-6 flex items-center justify-center shrink-0">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" preserveAspectRatio="xMidYMid meet">
                 <g fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                   <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                   <path d="M3 3v5h5" />
                   <path d="M12 7v5l4 2" />
                 </g>
               </svg>
            </div>
          </button>
        </div>

        {/* Top Right Menu Icons */}
        <div className="absolute top-4 right-4 flex gap-2 z-20">
          <button 
            onClick={startNewChat}
            className={`cursor-pointer p-2 rounded-full transition-colors ${iconColor}`}
            title="New Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className={`cursor-pointer p-2 rounded-full transition-colors ${iconColor}`}
            title="Settings"
          >
              <MoreHorizontal size={24} />
          </button>
        </div>

        {/* Limit Warning Toast */}
        <AnimatePresence>
           {limitWarning && (
              <motion.div 
                 initial={{ opacity: 0, y: -20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -20 }}
                 className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium"
              >
                  {limitWarning}
              </motion.div>
           )}
        </AnimatePresence>

        {/* Chat Area - Added bottom padding so last message clears the input bar */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col items-center pt-24 px-4 pb-40 w-full relative z-0 overscroll-contain">
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
                                <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{ pre: PreBlock }}>{msg.content}</Markdown>
                            </div>
                        </div>
                    )
                ))}
                {isLoading && (
                   <div className="flex justify-start w-full">
                     <div className={`text-[15px] px-1 max-w-[80%] leading-[1.5] ${theme === 'dark' ? 'bg-gradient-to-r from-gray-500 via-gray-100 to-gray-500' : 'bg-gradient-to-r from-gray-400 via-gray-900 to-gray-400'} bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer`}>
                        synthesizing
                     </div>
                   </div>
                )}
            </div>
        </div>

        {/* Input Area Overlay */}
        <div className={`fixed bottom-0 left-0 w-full flex flex-col items-center pb-[max(1.5rem,env(safe-area-inset-bottom))] px-4 pt-4 backdrop-blur-[2px] z-10 transition-colors ${blurBg}`}>
            <AnimatePresence>
              {isChatEnded && (
                 <motion.div 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 10 }}
                   className="w-full max-w-3xl flex justify-center mb-4"
                 >
                   <button 
                     onClick={() => {
                       setCurrentChatId(null);
                       setMessages([]);
                       setIsChatEnded(false);
                     }}
                     className={`px-6 py-2.5 rounded-full flex items-center justify-center text-sm font-medium transition-colors shadow-sm ${theme === 'dark' ? 'bg-[#2a2a2a] text-gray-300 border border-transparent hover:bg-[#333]' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                   >
                     <span>Cipher ended this convo. Click here to start a new chat.</span>
                   </button>
                 </motion.div>
              )}
            </AnimatePresence>

            <div className={`w-full max-w-3xl flex items-end pl-6 pr-2 py-2 transition-all duration-300 ${inputCont} ${isChatEnded ? 'opacity-50 pointer-events-none' : ''} ${input.includes('\n') || (textareaRef.current && textareaRef.current.scrollHeight > 44) ? 'rounded-[24px]' : 'rounded-full'}`}>
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    disabled={isLoading || isChatEnded}
                    className={`bg-transparent border-none outline-none flex-1 text-[16px] py-1.5 resize-none no-scrollbar leading-[1.4] ${inputClass} disabled:cursor-not-allowed`}
                    placeholder={isChatEnded ? "Protocol Terminated..." : "Message Cipher..."}
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading || isChatEnded}
                    className={`rounded-full w-9 h-9 flex items-center justify-center ml-2 mb-0.5 flex-shrink-0 transition-colors ${
                        (input.trim() && !isLoading && !isChatEnded) ? `${btnActive} cursor-pointer` : `${btnInactive} cursor-not-allowed`
                    }`}
                >
                    <ArrowUp strokeWidth={2} size={18} />
                </button>
            </div>
        </div>

        {/* Pending Nav Overlay */}
        <AnimatePresence>
            {pendingAction && (
                <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
                >
                   <motion.div 
                     initial={{ scale: 0.95, y: 10 }}
                     animate={{ scale: 1, y: 0 }}
                     className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${theme === 'dark' ? 'bg-[#1a1a1a] border-transparent' : 'bg-white border-gray-200'}`}
                   >
                     <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Interrupt Cipher?</h3>
                     <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                         Cipher is currently still synthesizing the outcome. Leaving now will abort the generation process forever.
                     </p>
                     <div className="flex gap-3 justify-end">
                        <button 
                          onClick={cancelAbort}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-black/5 text-gray-600'}`}
                        >
                          Stay
                        </button>
                        <button 
                          onClick={confirmAbort}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                          Abort & Leave
                        </button>
                     </div>
                   </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {isHistoryOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={`flex flex-col w-full md:w-5/6 lg:w-3/5 max-w-3xl rounded-3xl overflow-hidden shadow-2xl relative ${theme === 'dark' ? 'bg-pitch-black text-white border border-transparent' : 'bg-white text-gray-900 border border-gray-200'}`}
              >
                {/* Search Bar */}
                <div className="flex items-center gap-3 px-5 h-14 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.3-4.3"></path>
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="flex-grow w-full bg-transparent outline-none text-[15px] placeholder:text-gray-500"
                  />
                  <button onClick={() => setIsHistoryOpen(false)} className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'text-gray-500 hover:bg-white/10 hover:text-gray-300' : 'text-gray-400 hover:bg-black/5 hover:text-gray-600'}`}>
                    <X size={18} />
                  </button>
                </div>

                {/* List Area */}
                <div className="w-full relative py-2" style={{ height: 'min(460px, calc(100dvh - 136px))' }}>
                  <div className="h-full overflow-y-auto no-scrollbar px-2 space-y-4 overscroll-contain">
                    
                    <div className="flex flex-col gap-0.5">
                      {chatHistory.length === 0 ? (
                         <div className={`px-4 py-8 text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>No chats found. Press the + icon to start a new chat.</div>
                      ) : (
                        chatHistory
                        .filter(c => c.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((chat) => (
                        <div key={chat.id} onClick={() => selectChat(chat)} className={`h-[38px] rounded-xl flex items-center justify-between px-3 cursor-pointer transition-colors group ${currentChatId === chat.id ? (theme === 'dark' ? 'bg-cipher-grey' : 'bg-gray-200') : (theme === 'dark' ? 'hover:bg-cipher-grey/50' : 'hover:bg-gray-100')}`}>
                           <span className="truncate text-[14px] flex-grow">{chat.title || 'New Chat'}</span>
                           <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                               <span className={`text-[11px] whitespace-nowrap ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                 {new Date(chat.updatedAt?.toMillis ? chat.updatedAt.toMillis() : chat.updatedAt).toLocaleDateString()}
                               </span>
                               <button 
                                 onClick={(e) => deleteChat(e, chat.id)}
                                 className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-500 hover:bg-red-500/10 hover:text-red-400' : 'text-gray-400 hover:bg-red-50 hover:text-red-500'}`}
                                 title="Delete Chat"
                               >
                                 <Trash2 size={14} />
                               </button>
                           </div>
                        </div>
                        ))
                      )}
                    </div>

                  </div>
                </div>

              </motion.div>
            </div>
          )}

          {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className={`flex flex-col w-full md:w-5/6 lg:w-3/5 max-w-3xl rounded-3xl overflow-hidden shadow-2xl relative ${theme === 'dark' ? 'bg-pitch-black text-white border border-transparent' : 'bg-white text-gray-900 border border-gray-200'}`}
              >
                <div className="flex justify-between items-center p-6 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Settings size={20} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
                    <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
                  </div>
                  <button onClick={() => setIsSettingsOpen(false)} className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/5 text-gray-500'}`}>
                    <X size={18} />
                  </button>
                </div>

                {/* Tabs */}
              <div className={`flex px-6 pt-4 space-x-6 border-b ${theme === 'dark' ? 'border-transparent' : 'border-gray-200'}`}>
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
              <div className="p-6 overflow-y-auto no-scrollbar overscroll-contain" style={{ height: 'min(460px, calc(100dvh - 136px))' }}>
                
                {settingsTab === 'account' && user && (
                  <div className="flex flex-col items-center py-6 md:py-2">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'User'} className="w-24 h-24 rounded-full mb-4 object-cover border-4 border-blue-500/20" />
                    ) : (
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 border-4 border-blue-500/20 ${theme === 'dark' ? 'bg-[#333]' : 'bg-gray-100'}`}>
                        <UserIcon size={32} />
                      </div>
                    )}
                    <h3 className="text-xl md:text-2xl font-semibold tracking-tight">{user.displayName || 'Authenticated User'}</h3>
                    <p className={`text-sm md:text-base mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{user.email}</p>
                    
                    {/* Credits Display */}
                    <div className={`mt-8 w-full max-w-sm rounded-2xl p-5 border ${theme === 'dark' ? 'bg-[#0f0f0f] border-transparent' : 'bg-white border-gray-200 shadow-sm'}`}>
                       <div className="flex justify-between items-end mb-2">
                         <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Daily Credits</span>
                         <span className="text-2xl font-bold text-blue-500">{CREDITS_LIMIT - dailyUsage} <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>/ {CREDITS_LIMIT}</span></span>
                       </div>
                       <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-[#333]' : 'bg-gray-200'}`}>
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(0, ((CREDITS_LIMIT - dailyUsage) / CREDITS_LIMIT) * 100)}%` }}></div>
                       </div>
                       <p className={`text-xs mt-3 text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Credits reset automatically at midnight.</p>
                    </div>
                    
                    <button 
                      onClick={handleLogout}
                      className="mt-8 px-6 py-2.5 bg-red-500/10 text-red-500 rounded-xl font-medium hover:bg-red-500/20 transition-colors"
                    >
                      Sign Out / Disconnect
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
                                : (theme === 'dark' ? 'border-cipher-border hover:bg-cipher-grey' : 'border-gray-200 hover:bg-gray-50')
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
            </motion.div>
          </div>
          )}
        </AnimatePresence>
    </div>
  );
}
