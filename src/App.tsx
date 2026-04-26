import React, { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  increment,
  writeBatch,
  limit,
  Timestamp,
  FieldValue
} from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { useTweaks, TweaksPanel, TweakSection, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakColor } from './components/TweaksPanel';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// --- Firebase Init ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- Session ID ---
const SESSION_ID = (() => {
  let id = sessionStorage.getItem("c_sid");
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("c_sid", id); }
  return id;
})();

function parseDevice() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" :
    /Windows NT/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : "Unknown";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" :
    /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Browser";
  return { os, browser, label: `${browser} on ${os}` };
}

// --- Preference defaults ---
const PREF_DEFAULTS = {
  theme: "dark", accent: "graphite", font: "sans", textSize: 15,
  density: "cozy", bubbleShape: "pill", reducedMotion: false, sendOnEnter: true,
  skipSlop: true,
};

function applyPrefs(p: any) {
  const root = document.documentElement;
  const theme = p.theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : (p.theme || "dark");
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-accent", p.accent || "graphite");
  root.setAttribute("data-font", p.font || "sans");
  root.setAttribute("data-density", p.density || "cozy");
  root.setAttribute("data-bubble", p.bubbleShape || "pill");
  root.style.setProperty("--text-size", (p.textSize || 15) + "px");
  root.setAttribute("data-rm", p.reducedMotion ? "1" : "0");
}

// --- Firestore helpers ---
const FS = {
  userRef: (uid: string) => doc(db, 'users', uid),
  chatsRef: (uid: string) => collection(db, 'users', uid, 'chats'),
  chatRef: (uid: string, cid: string) => doc(db, 'users', uid, 'chats', cid),
  msgsRef: (uid: string, cid: string) => collection(db, 'users', uid, 'chats', cid, 'messages'),
  sessRef: (uid: string) => doc(db, 'users', uid, 'sessions', SESSION_ID),
  allSessRef: (uid: string) => collection(db, 'users', uid, 'sessions'),
  mcpRef: (uid: string) => collection(db, 'users', uid, 'mcpServers'),

  async ensureUser(fbUser: User) {
    const ref = this.userRef(fbUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        displayName: fbUser.displayName || "User",
        firstName: (fbUser.displayName || "User").split(" ")[0],
        email: fbUser.email,
        photoURL: fbUser.photoURL || null,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        plan: "free",
        credits: { total: 10000000, used: 0 },
        notifications: { daily: true, mentions: true, billing: true, product: false },
        dataControls: { trainModels: false, chatHistory: true },
        preferences: PREF_DEFAULTS,
      });
    } else {
      await updateDoc(ref, { lastSeen: serverTimestamp() });
    }
  },

  async trackSession(uid: string) {
    const dev = parseDevice();
    await setDoc(this.sessRef(uid), {
      ...dev, sessionId: SESSION_ID,
      userAgent: navigator.userAgent.slice(0, 300),
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    }, { merge: true });
  },

  async deleteSess(uid: string, sid: string) {
    await deleteDoc(doc(db, 'users', uid, 'sessions', sid));
  },

  async createChat(uid: string, title: string) {
    const ref = await addDoc(this.chatsRef(uid), {
      title: title.slice(0, 60),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      messageCount: 0,
    });
    return ref.id;
  },

  async saveMsg(uid: string, chatId: string, role: string, content: string) {
    const ts = serverTimestamp();
    await addDoc(this.msgsRef(uid, chatId), {
      role: role === "ai" ? "assistant" : role,
      content,
      createdAt: ts
    });
    await updateDoc(this.chatRef(uid, chatId), {
      updatedAt: ts,
      messageCount: increment(1),
    });
  },

  async loadMsgs(uid: string, chatId: string) {
    const snap = await getDocs(query(this.msgsRef(uid, chatId), orderBy("createdAt")));
    return snap.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        role: data.role === "assistant" ? "ai" : data.role,
        content: data.content,
      };
    });
  },

  async deleteChat(uid: string, chatId: string) {
    const msgs = await getDocs(this.msgsRef(uid, chatId));
    const batch = writeBatch(db);
    msgs.docs.forEach(d => batch.delete(d.ref));
    batch.delete(this.chatRef(uid, chatId));
    await batch.commit();
  },

  async deleteAllChats(uid: string) {
    const chats = await getDocs(this.chatsRef(uid));
    for (const c of chats.docs) await this.deleteChat(uid, c.id);
  },

  async exportData(uid: string) {
    const uSnap = await getDoc(this.userRef(uid));
    const cSnap = await getDocs(this.chatsRef(uid));
    const sSnap = await getDocs(this.allSessRef(uid));
    const mSnap = await getDocs(this.mcpRef(uid));
    
    const chats = [];
    for (const c of cSnap.docs) {
      const data = c.data() as any;
      const ms = await getDocs(query(this.msgsRef(uid, c.id), orderBy("createdAt")));
      chats.push({ 
        id: c.id, 
        ...data, 
        messages: ms.docs.map(m => {
          const mData = m.data() as any;
          return { 
            ...mData, 
            createdAt: mData.createdAt instanceof Timestamp ? mData.createdAt.toDate().toISOString() : mData.createdAt 
          };
        }) 
      });
    }
    return {
      profile: uSnap.data(),
      chats,
      sessions: sSnap.docs.map(d => d.data()),
      mcpServers: mSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
      exportedAt: new Date().toISOString(),
    };
  },

  async deductCredit(uid: string, tokens: number) {
    if (tokens <= 0) return;
    await updateDoc(this.userRef(uid), { "credits.used": increment(tokens) }).catch(() => {});
  },

  async resetGlobalChats() {
    // This is a safety method to clear conversations for the user
    // In a real app, this would be a server-side batch delete
    alert("This function would trigger a collection group wipe in production.");
    console.warn("Global reset requested.");
  },

  async addMcp(uid: string, url: string, type: "sse" | "webhook" = "sse") {
    await addDoc(this.mcpRef(uid), { url, type, createdAt: serverTimestamp(), status: "active" });
  },

  async delMcp(uid: string, sid: string) {
    await deleteDoc(doc(db, 'users', uid, 'mcpServers', sid));
  }
};

// --- Browser notification helpers ---
const Notif = {
  supported: () => "Notification" in window,
  granted: () => Notif.supported() && Notification.permission === "granted",
  async request() {
    if (!Notif.supported()) return false;
    if (Notification.permission === "granted") return true;
    return (await Notification.requestPermission()) === "granted";
  },
  send(title: string, body: string) {
    if (!Notif.granted()) return;
    try { new Notification(title, { body }); } catch {}
  },
};

// --- Icons ---
const Icon = ({ name, size = 18, stroke = 1.6 }: { name: string; size?: number; stroke?: number }) => {
  const P: Record<string, React.ReactNode> = {
    history: <><circle cx="12" cy="12" r="9"/><path d="M3.5 12a8.5 8.5 0 0 1 14-6.5L20 8"/><path d="M20 3v5h-5"/><path d="M12 7v5l3 2"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    arrowUp: <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    x: <><path d="M18 6 6 18M6 6l12 12"/></>,
    trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
    check: <><path d="M20 6 9 17l-5-5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    palette: <><circle cx="12" cy="12" r="9"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15" r="1" fill="currentColor" stroke="none"/><path d="M12 21c-2 0-3-1-3-2.5s1-2 2-2.5"/></>,
    plug: <><path d="M9 2v6M15 2v6M7 8h10v4a5 5 0 0 1-10 0V8zM12 17v5"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    shield: <><path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"/></>,
    logout: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></>,
    back: <><path d="m15 18-6-6 6-6"/></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 2.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z"/></>,
    link: <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
    server: <><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {P[name] || null}
    </svg>
  );
};

const Shimmer = ({ text }: { text: string }) => <span className="shimmer">{text}</span>;

const Logo = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 340 340" aria-hidden="true" className="logo">
    <title>Cipher logo — star</title>
    <g transform="translate(170 170)">
      <polygon points="0,-64 7,-22 0,0 -7,-22" fill="currentColor" opacity="0.82" transform="rotate(0)"/>
      <polygon points="0,-64 7,-22 0,0 -7,-22" fill="currentColor" opacity="0.72" transform="rotate(60)"/>
      <polygon points="0,-64 7,-22 0,0 -7,-22" fill="currentColor" opacity="0.62" transform="rotate(120)"/>
      <polygon points="0,-64 7,-22 0,0 -7,-22" fill="currentColor" opacity="0.82" transform="rotate(180)"/>
      <polygon points="0,-64 7,-22 0,0 -7,-22" fill="currentColor" opacity="0.72" transform="rotate(240)"/>
      <polygon points="0,-64 7,-22 0,0 -7,-22" fill="currentColor" opacity="0.62" transform="rotate(300)"/>
      <rect x="-9" y="-9" width="18" height="18" rx="1.5" transform="rotate(45)" fill="currentColor"/>
      <circle cx="0" cy="0" r="3.2" fill="var(--bg)"/>
    </g>
  </svg>
);

// --- Toast Context ---
const ToastCtx = createContext<(msg: string, type?: string) => void>(() => {});
const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<any[]>([]);
  const show = useCallback((msg: string, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3400);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{ position:"fixed", top:20, left:20, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none" }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type==="danger"?"#c94040": t.type==="success"?"#2d7a4f":"var(--bg-elev-2)",
            color: t.type==="info"?"var(--fg)":"#fff",
            border: t.type==="info"?"1px solid var(--border-strong)":"none",
            padding:"10px 16px", borderRadius:10, fontSize:13.5, maxWidth:340,
            boxShadow:"none",
            animation:"riseIn 260ms ease", pointerEvents:"auto",
          }}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
const useToast = () => useContext(ToastCtx);

// --- Confirm Dialog ---
const ConfirmDialog = ({ open, title, body, confirmLabel="Confirm", danger=false, onConfirm, onCancel }: any) => {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onCancel} style={{ zIndex:10000 }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"var(--bg-elev)", border:"1px solid var(--border)", borderRadius:16,
        padding:"24px 28px", width:"min(400px,100%)", boxShadow:"var(--shadow-lg)", animation:"pop 220ms ease",
      }}>
        <div style={{ fontWeight:500, fontSize:15, marginBottom:8 }}>{title}</div>
        <div style={{ color:"var(--fg-muted)", fontSize:13.5, lineHeight:1.6, marginBottom:22 }}>{body}</div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={danger?"btn-danger":"btn-primary"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

// --- Screen Components ---
const LoadingScreen = () => (
  <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}>
    <div style={{ textAlign:"center" }}>
      <Logo size={160}/>
      <div style={{ marginTop:18 }}><Shimmer text="Loading…"/></div>
    </div>
  </div>
);

const LoginScreen = ({ onSignIn, loading, error }: any) => (
  <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:20 }}>
    <div style={{
      textAlign:"center", maxWidth:360, width:"100%",
      background:"var(--bg-elev)", border:"1px solid var(--border)",
      borderRadius:22, padding:"44px 32px", boxShadow:"var(--shadow-lg)", animation:"riseIn 400ms ease",
    }}>
      <Logo size={200}/>
      <h1 style={{ fontWeight:500, fontSize:26, letterSpacing:"-0.015em", margin:"18px 0 8px", color:"var(--fg)" }}>Cipher</h1>
      <p style={{ color:"var(--fg-muted)", fontSize:14, marginBottom:32, lineHeight:1.5 }}>
        Your AI workspace.<br/>Sign in to continue.
      </p>
      <button
        onClick={onSignIn}
        disabled={loading}
        style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:10,
          width:"100%", padding:"12px 20px", borderRadius:12,
          background:"#fff", color:"#1a1a1a", border:"none",
          fontWeight:500, fontSize:14, cursor: loading?"wait":"pointer",
          transition:"transform 140ms, opacity 140ms",
          opacity: loading ? 0.7 : 1,
        }}
      >
        Authorize with Google
      </button>
      {error && <div style={{ marginTop:14, color:"#e06060", fontSize:13 }}>{error}</div>}
    </div>
  </div>
);

const TopBar = ({ onHistory, onNewChat, onSettings, onHome, inChat }: any) => (
  <div className="topbar">
    <div className="topbar-left">
      <button className="icon-btn" onClick={onHistory} aria-label="History"><Icon name="history"/></button>
    </div>
    <div className="topbar-center">
      {inChat && (
        <button className="brand" onClick={onHome} aria-label="Home">
          Cipher
        </button>
      )}
    </div>
    <div className="topbar-right">
      <button className="icon-btn" onClick={onNewChat} aria-label="New chat"><Icon name="plus" size={20}/></button>
      <button className="icon-btn" onClick={onSettings} aria-label="Settings"><Icon name="settings"/></button>
    </div>
  </div>
);

// --- Composer ---
const Composer = ({ onSend, onStop, disabled, variant="bottom", sendOnEnter=true, outOfCredits=false }: any) => {
  const [val, setVal] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{ const el=taRef.current; if(!el)return; el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,208)+"px"; },[val]);
  
  const send = () => { 
    const t = val.trim(); 
    if(!t||disabled||outOfCredits) return; 
    
    // Check for "large" text (e.g. > 10 lines)
    const lines = t.split('\n').length;
    let displayContent = t;
    if (lines > 10) {
      displayContent = `Pasted ${lines} lines of text`;
    }
    
    onSend(t, displayContent); 
    setVal(""); 
  };
  
  const timeUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className={`composer-wrap variant-${variant}`}>
      {outOfCredits && (
        <div className="out-of-credits-banner">
          You have run out of daily messages. Your credits will refresh in {timeUntilMidnight()}.
        </div>
      )}
      <div className={`composer ${val.trim()?"filled":""}`} style={{ transition: "all 200ms ease" }}>
        <textarea
          ref={taRef} placeholder={outOfCredits ? "Daily limit reached" : "Message Cipher…"} value={val} rows={1}
          style={{ transition: "all 200ms ease" }}
          disabled={disabled || outOfCredits}
          onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>{
            if(e.key==="Enter"){
              if(sendOnEnter&&!e.shiftKey){e.preventDefault();send();}
              else if(!sendOnEnter&&(e.metaKey||e.ctrlKey)){e.preventDefault();send();}
            }
          }}
        />
        <button className="send" onClick={disabled ? onStop : send} aria-label={disabled ? "Stop" : "Send"} disabled={outOfCredits||(!val.trim()&&!disabled)}
          style={{ transition: "all 200ms ease" }}>
          {disabled ? <Icon name="stop" size={16} stroke={2}/> : <Icon name="arrowUp" size={16} stroke={2.2}/>}
        </button>
      </div>
      <div className="composer-hint">
        {sendOnEnter ? "Enter to send · Shift+Enter for new line" : "⌘↩ to send · Enter for new line"}
      </div>
    </div>
  );
};

// --- History Modal ---
const HistoryModal = ({ open, onClose, onPick, uid }: any) => {
  const [q, setQ] = useState("");
  const [chats, setChats] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(()=>{
    if(!open||!uid)return;
    setTimeout(()=>inputRef.current?.focus(),10);
    const unsub = onSnapshot(query(FS.chatsRef(uid), orderBy("updatedAt","desc")), snap=>{
      setChats(snap.docs.map(d=>({ id:d.id, ...d.data() })));
    });
    return ()=>unsub();
  },[open,uid]);

  const filtered = chats.filter(c=>c.title?.toLowerCase().includes(q.toLowerCase()));
  const fmt = (ts: any) => { 
    if(!ts) return ""; 
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts); 
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"}); 
    } catch { return ""; }
  };

  if(!open) return null;
  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 99999 }}>
      <div className="history" onClick={e=>e.stopPropagation()}>
        <div className="history-search">
          <Icon name="search" size={16}/>
          <input ref={inputRef} placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/>
          <button className="history-close" onClick={onClose} aria-label="Close"><Icon name="x" size={16}/></button>
        </div>
        <div className="history-list">
          {filtered.length===0 && <div className="history-empty">{q?"No matches":"No chats yet"}</div>}
          {filtered.map((c,i)=>(
            <div key={c.id} className={`history-row ${i===0&&!q?"active":""}`} onClick={()=>{onPick(c.id);onClose();}}>
              <span className="h-title">{c.title||"Untitled"}</span>
              <span className="h-date">{fmt(c.updatedAt)}</span>
              <button className="h-del" onClick={async e=>{ e.stopPropagation(); await FS.deleteChat(uid,c.id); toast("Chat deleted","info"); }} aria-label="Delete">
                <Icon name="trash" size={15}/>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Settings Components ---
const Toggle = ({ on, onChange }: any) => (
  <button className={`toggle ${on?"on":""}`} onClick={()=>onChange(!on)} aria-pressed={on}>
    <span className="knob"/>
  </button>
);

const Sec = ({ title, children }: any) => (
  <div className="sec"><div className="sec-title">{title}</div><div className="sec-body">{children}</div></div>
);
const Row = ({ label, sub, children }: any) => (
  <div className="row">
    <div className="row-label"><div>{label}</div>{sub&&<div className="row-sub">{sub}</div>}</div>
    <div className="row-ctrl">{children}</div>
  </div>
);

// --- Settings Tabs ---
const AccountTab = ({ uid, user, onLogout, userData }: any) => {
  const toast = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ firstName: "" });
  const [showSess, setShowSess] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const unsub2 = onSnapshot(FS.allSessRef(uid), s => { setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))); });
    return () => { unsub2(); };
  }, [uid]);

  const firstName = userData?.firstName || user?.displayName?.split(" ")[0] || "User";
  const email = userData?.email || user?.email || "";
  const plan = userData?.plan || "free";
  const credits = userData?.credits || {};
  const used = credits.used ?? 0;
  const total = credits.total ?? 5000;
  const credLeft = Math.max(0, total - used);
  const credPct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  const saveProfile = async () => {
    await updateDoc(FS.userRef(uid), { firstName: draft.firstName }).catch(() => {});
    setEditing(false);
    toast("Profile updated", "success");
  };

  const signOut = async (sessId: string) => {
    await deleteDoc(doc(db, `users/${uid}/sessions/${sessId}`)).catch(() => {});
    toast("Session signed out", "success");
  };

  if (!userData) return <div style={{ padding: 20, color: "var(--fg-muted)", fontSize: 13 }}>Loading…</div>;

  const getIcon = (s: any) => s.os === "iOS" || s.os === "Android" ? "phone" : "monitor";

  return (
    <div className="settings-tab">
      <Sec title="Profile">
        <div className="profile-card">
          <div className="avatar">{firstName[0]?.toUpperCase()}</div>
          {editing ? (
            <div className="profile-info" style={{ flex: 1 }}>
              <input value={draft.firstName} onChange={e => setDraft(d => ({ ...d, firstName: e.target.value }))}
                placeholder="First name"
                style={{ display: "block", width: "100%", background: "var(--bg-elev-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", marginBottom: 6, color: "var(--fg)", fontSize: 14 }} />
              <input value={email} disabled
                placeholder="Email"
                style={{ display: "block", width: "100%", background: "var(--bg-elev-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", color: "var(--fg-muted)", fontSize: 13, cursor: "not-allowed", opacity: 0.7 }} />
            </div>
          ) : (
            <div className="profile-info">
              <div className="profile-name">{firstName}</div>
              <div className="profile-email">{email}</div>
            </div>
          )}
          {editing
            ? <div style={{ display: "flex", gap: 6 }}>
              <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveProfile}>Save</button>
            </div>
            : <button className="btn-ghost" onClick={() => { setDraft({ firstName }); setEditing(true); }}>Edit</button>
          }
        </div>
      </Sec>

      <Sec title="Plan & Credits">
        <div className="plan-card">
          <div className="plan-head">
            <div>
              <div className="plan-name">Cipher Pro</div>
              <div className="plan-sub">Active plan</div>
            </div>
            </div>


          <div className="credit-meter">
            <div className="credit-head">
              <span>Daily 100 messages for all devices sync</span>
              <span className="credit-num">{used.toLocaleString()} / {total.toLocaleString()}</span>
            </div>
            <div className="bar"><div className="bar-fill" style={{ width: credPct + "%" }} /></div>
            <div className="credit-foot">
              <span>{credLeft.toLocaleString()} remaining</span>
            </div>
          </div>
          <div className="credit-grid">
            <div className="credit-chip"><span className="chip-n">{credLeft.toLocaleString()}</span><span className="chip-l">Left</span></div>
            <div className="credit-chip"><span className="chip-n">{used.toLocaleString()}</span><span className="chip-l">Used</span></div>
            <div className="credit-chip"><span className="chip-n">{total.toLocaleString()}</span><span className="chip-l">Total</span></div>
            <div className="credit-chip"><span className="chip-n">{sessions.length}</span><span className="chip-l">Devices</span></div>
          </div>
        </div>
      </Sec>

      <Sec title="Active Sessions">
        <Row label={`${sessions.length} device${sessions.length !== 1 ? "s" : ""} signed in`} sub="This session is highlighted">
          <button className="btn-ghost" onClick={() => setShowSess(s => !s)}>{showSess ? "Hide" : "Review"}</button>
        </Row>
        {showSess && sessions.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-elev-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-muted)", flexShrink: 0 }}>
              <Icon name={getIcon(s)} size={15} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--fg)", fontSize: 13 }}>
                {s.label || s.browser + " on " + s.os}
                {s.id === SESSION_ID && <span style={{ fontSize: 10, background: "var(--accent)", color: "var(--accent-fg)", borderRadius: 4, padding: "1px 6px", marginLeft: 8 }}>This device</span>}
              </div>
              <div style={{ color: "var(--fg-muted)", fontSize: 12 }}>{s.userAgent?.slice(0, 60)}…</div>
            </div>
            {s.id !== SESSION_ID && (
              <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => signOut(s.id)}>Sign out</button>
            )}
          </div>
        ))}
      </Sec>

      <Sec title="Security">
        <Row label="Two-factor authentication" sub="Managed by Google">
          <button className="btn-ghost" onClick={() => toast("2FA is managed through your Google account", "info")}>Info</button>
        </Row>
        <Row label="Sign out of Cipher">
          <button className="btn-danger" onClick={onLogout}>Sign out</button>
        </Row>
      </Sec>
    </div>
  );
};

const AppearanceTab = ({ prefs, setPrefs }: any) => {
  const themes = [{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }, { id: "dim", label: "Dim" }, { id: "system", label: "System" }];
  const accents = [
    { id: "graphite", color: "#1f1f1f" }, { id: "iris", color: "#6c6bff" }, { id: "moss", color: "#5b8c5a" },
    { id: "ember", color: "#c96a3e" }, { id: "rose", color: "#c75b86" }, { id: "azure", color: "#3a7ad1" },
  ];
  return (
    <>
      <Sec title="Theme">
        <div className="theme-grid">
          {themes.map(t => (
            <button key={t.id} className={`theme-card ${prefs.theme === t.id ? "active" : ""}`} onClick={() => setPrefs({ theme: t.id })}>
              <div className={`theme-preview theme-${t.id}`} />
              <div className="theme-label">{t.label}</div>
            </button>
          ))}
        </div>
      </Sec>
      <Sec title="Accent">
        <div className="accent-row">
          {accents.map(a => (
            <button key={a.id} className={`accent-dot ${prefs.accent === a.id ? "active" : ""}`} style={{ background: a.color }} onClick={() => setPrefs({ accent: a.id })} />
          ))}
        </div>
      </Sec>
      <Sec title="Chat Display">
        <Row label="Font family">
          <div className="seg">
            {['sans', 'serif', 'mono'].map(f => (
              <button key={f} className={`seg-btn ${prefs.font === f ? "active" : ""}`} onClick={() => setPrefs({ font: f })}>{f}</button>
            ))}
          </div>
        </Row>
        <Row label="Text size" sub={`${prefs.textSize}px`}>
          <input type="range" className="slider" min={12} max={20} step={1} value={prefs.textSize} onChange={e => setPrefs({ textSize: Number(e.target.value) })} />
        </Row>
        <Row label="Density">
          <div className="seg">
            {['compact', 'cozy', 'roomy'].map(d => (
              <button key={d} className={`seg-btn ${prefs.density === d ? "active" : ""}`} onClick={() => setPrefs({ density: d })}>{d}</button>
            ))}
          </div>
        </Row>
        <Row label="Bubble shape">
          <div className="seg">
            {['pill', 'rounded', 'square'].map(s => (
              <button key={s} className={`seg-btn ${prefs.bubbleShape === s ? "active" : ""}`} onClick={() => setPrefs({ bubbleShape: s })}>{s}</button>
            ))}
          </div>
        </Row>
      </Sec>
      <Sec title="Advanced">
        <Row label="Skip AI Slop" sub="Enforce direct, filler-free responses"><Toggle on={prefs.skipSlop} onChange={(v: boolean) => setPrefs({ skipSlop: v })} /></Row>
        <Row label="Reduced motion"><Toggle on={prefs.reducedMotion} onChange={(v: boolean) => setPrefs({ reducedMotion: v })} /></Row>
        <Row label="Send on Enter"><Toggle on={prefs.sendOnEnter} onChange={(v: boolean) => setPrefs({ sendOnEnter: v })} /></Row>
      </Sec>
    </>
  );
};

const ConnectionsTab = ({ uid }: any) => {
  const [servers, setServers] = useState<any[]>([]);
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"sse" | "webhook">("sse");
  const [busy, setBusy] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(FS.mcpRef(uid), s => { setServers(s.docs.map(d => ({ id: d.id, ...d.data() }))); });
    return () => unsub();
  }, [uid]);

  const onAdd = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await FS.addMcp(uid, url, type);
      setUrl("");
      toast(`${type === "sse" ? "MCP Node" : "Webhook"} connected`, "success");
    } catch {
      toast("Failed to connect node", "danger");
    } finally {
      setBusy(false);
    }
  };

  const mcpExample = `{
  "mcpServers": {
    "local-filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/docs"]
    },
    "postgres-db": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": { "DATABASE_URL": "postgresql://..." }
    }
  }
}`;

  return (
    <div className="mcp-tab">
      <div className="tab-hero">
        <div className="hero-icon"><Icon name="server" size={32} /></div>
        <div className="hero-text">
          <div className="hero-title">Model Context Protocol</div>
          <div className="hero-desc">Bridges the gap between Cipher and your local infrastructure. Securely query tools, files, and data sources.</div>
        </div>
      </div>

      <Sec title="Connect a Node">
        <div className="mcp-input-group">
          <div className="twk-row" style={{ marginBottom: 12 }}>
            <div className="twk-lbl">Connection Type</div>
            <div className="seg">
              <button className={`seg-btn ${type === "sse" ? "active" : ""}`} onClick={() => setType("sse")}>SSE Protocol</button>
              <button className={`seg-btn ${type === "webhook" ? "active" : ""}`} onClick={() => setType("webhook")}>Webhook/Discord</button>
            </div>
          </div>
          <div className="field-label">{type === "sse" ? "SSE Endpoint URL" : "Webhook URL"}</div>
          <div className="input-with-button">
            <input 
              className="twk-field" 
              placeholder={type === "sse" ? "https://mcp-node.internal/sse" : "https://discord.com/api/webhooks/..."} 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
            />
            <button className="btn-primary" disabled={busy || !url.trim()} onClick={onAdd}>
              {busy ? "Connecting..." : "Connect"}
            </button>
          </div>
          <div className="field-hint">
            {type === "sse" 
              ? "Supports standard SSE discovery endpoints for MCP servers." 
              : "Direct integration for Discord webhooks and custom REST endpoints."}
          </div>
        </div>
      </Sec>

      <Sec title="Active Connections">
        {servers.length === 0 ? (
          <div className="mcp-empty">
            <Icon name="plug" size={24} />
            <p>No active connections found.</p>
          </div>
        ) : (
          <div className="mcp-list">
            {servers.map(s => (
              <div key={s.id} className="mcp-card">
                <div className="mcp-card-left">
                  <div className={`status-indicator active ${s.type === "webhook" ? "webhook" : ""}`} />
                  <div className="mcp-card-info">
                    <div className="mcp-url">{s.url}</div>
                    <div className="mcp-meta">
                      {s.type === "webhook" ? "Webhook Node • Live" : "MCP SSE Server • Adaptive Tools"}
                    </div>
                  </div>
                </div>
                <button className="icon-btn danger" onClick={() => FS.delMcp(uid, s.id)} aria-label="Disconnect">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Sec>

      <Sec title="Manual Blueprint">
        <div className="collapsible-blueprint">
          <button className="blueprint-toggle" onClick={() => setShowExample(!showExample)}>
            <div className="toggle-left">
              <Icon name={showExample ? "back" : "settings"} size={14} />
              <span>{showExample ? "Hide Implementation Details" : "Show Configuration Blueprint"}</span>
            </div>
            <Icon name="copy" size={14} />
          </button>
          {showExample && (
            <div className="blueprint-content">
              <p className="blueprint-desc">Use this JSON structure in your local MCP config file to allow Cipher to communicate with your tools.</p>
              <pre className="mcp-code">
                <code>{mcpExample}</code>
              </pre>
            </div>
          )}
        </div>
      </Sec>
    </div>
  );
};

const NotificationsTab = ({ uid }: any) => {
  const toast = useToast();
  const [sets, setSets] = useState<any>(null);
  
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(FS.userRef(uid), s => { 
      if (s.exists()) {
        const data = s.data();
        setSets(data.notifications || { daily: true, mentions: true, billing: true, product: false });
      }
    });
    return () => unsub();
  }, [uid]);

  const update = async (k: string, v: boolean) => {
    if (!sets) return;
    const next = { ...sets, [k]: v };
    setSets(next); // Optimistic update
    await updateDoc(FS.userRef(uid), { notifications: next });
  };

  const reqBrowser = async () => {
    const ok = await Notif.request();
    if (ok) toast("Notifications enabled", "success");
    else toast("Permission denied", "danger");
  };

  const settings = [
    { id: "daily", label: "Daily Summary", desc: "A recap of your AI activities and credits." },
    { id: "mentions", label: "System Mentions", desc: "Alerts when the system needs your attention." },
    { id: "billing", label: "Billing & Usage", desc: "Notifications about your plan and balance." },
    { id: "product", label: "Product Updates", desc: "News about new features and improvements." },
  ];

  const currentSets = sets || { daily: true, mentions: true, billing: true, product: false };

  return (
    <div className="settings-tab">
      <Sec title="Browser Permissions">
        <div className="notif-box">
          <div className="notif-box-info">
            <div className="notif-box-title">System Push Notifications</div>
            <div className="notif-box-desc">{Notif.granted() ? "CIPHER is permitted to send native alerts." : "Allow browser notifications for real-time updates."}</div>
          </div>
          <button className={`btn-${Notif.granted() ? "ghost" : "primary"} sm`} onClick={reqBrowser}>
            {Notif.granted() ? "Enabled" : "Enable"}
          </button>
        </div>
      </Sec>
      <Sec title="Email Preferences">
        {settings.map(s => (
          <Row key={s.id} label={s.label} sub={s.desc}>
            <Toggle on={currentSets[s.id]} onChange={(v: boolean) => update(s.id, v)} />
          </Row>
        ))}
      </Sec>
    </div>
  );
};

const DataTab = ({ uid, onDeleteAll }: any) => {
  const toast = useToast();
  const [sets, setSets] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(FS.userRef(uid), s => { 
      if (s.exists()) {
        const data = s.data();
        setSets(data.dataControls || { trainModels: false, chatHistory: true });
      }
    });
    return () => unsub();
  }, [uid]);

  const update = async (k: string, v: boolean) => {
    if (!sets) return;
    const next = { ...sets, [k]: v };
    setSets(next); // Optimistic
    await updateDoc(FS.userRef(uid), { dataControls: next });
  };

  const onExport = async () => {
    setBusy(true);
    try {
      const data = await FS.exportData(uid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `cipher-export-${Date.now()}.json`;
      a.click();
      toast("Data export started", "success");
    } catch { toast("failed to export data", "danger"); }
    finally { setBusy(false); }
  };

  const currentSets = sets || { trainModels: false, chatHistory: true };

  return (
    <div className="settings-tab">
      <Sec title="Privacy Controls">
        <Row label="Model Improvement" sub="Contribute your conversations to help train the next generation of Cipher nodes.">
          <Toggle on={currentSets.trainModels} onChange={(v: boolean) => update("trainModels", v)} />
        </Row>
        <Row label="Search History" sub="Keep a historical record of your interactions for future reference.">
          <Toggle on={currentSets.chatHistory} onChange={(v: boolean) => update("chatHistory", v)} />
        </Row>
      </Sec>
      <Sec title="Account Management">
        <div className="action-card">
          <div className="action-info">
            <div className="action-title">Download My Data</div>
            <div className="action-desc">Request a machine-readable archive of all your chats, settings, and profile data in JSON format.</div>
          </div>
          <button className="btn-ghost sm" disabled={busy} onClick={onExport}>
            {busy ? "Preparing Archive..." : "Request Export"}
          </button>
        </div>
        <div className="action-card danger-zone">
          <div className="action-info">
            <div className="action-title">Purge Conversations</div>
            <div className="action-desc">Permanently delete all conversation history associated with this account. This cannot be reversed.</div>
          </div>
          <button className="btn-danger sm" onClick={() => setConfirmDel(true)}>Purge All</button>
        </div>
      </Sec>
      <ConfirmDialog
        open={confirmDel} title="Purge all conversation data?" body="Every chat and message in your history will be permanently erased. We cannot recover this data once deleted."
        confirmLabel="Confirm Purge" danger onConfirm={async () => { setConfirmDel(false); await onDeleteAll(); toast("History purged", "info"); }} onCancel={() => setConfirmDel(false)}
      />
    </div>
  );
};

const SettingsModal = ({ open, onClose, prefs, setPrefs, uid, user, userData, onLogout, onDeleteAll }: any) => {
  const [tab, setTab] = useState("account");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 720);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 720);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (open) setMobileView("list");
  }, [open]);

  if (!open) return null;
  const tabs = [
    { id: "account", label: "Account", icon: "user" },
    { id: "appearance", label: "Appearance", icon: "palette" },
    { id: "connections", label: "Connections", icon: "plug" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "data", label: "Data & Privacy", icon: "shield" },
  ];

  const renderContent = () => (
    <>
      {tab === "account" && <AccountTab uid={uid} user={user} onLogout={onLogout} userData={userData} />}
      {tab === "appearance" && <AppearanceTab prefs={prefs} setPrefs={setPrefs} />}
      {tab === "connections" && <ConnectionsTab uid={uid} />}
      {tab === "notifications" && <NotificationsTab uid={uid} />}
      {tab === "data" && <DataTab uid={uid} onDeleteAll={onDeleteAll} />}
    </>
  );

  if (isMobile) {
    const act = tabs.find(t => t.id === tab);
    return (
      <div className="overlay overlay-settings" onClick={onClose} style={{ zIndex: 99999 }}>
        <div className="settings-mobile" onClick={e => e.stopPropagation()}>
          {mobileView === "list" ? (
            <>
              <div className="settings-head mobile-head">
                <span className="settings-title">Settings</span>
                <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
              </div>
              <div className="settings-mobile-list">
                {tabs.map(t => (
                  <button key={t.id} className="mobile-list-item" onClick={() => { setTab(t.id); setMobileView("detail"); }}>
                    <div className="mobile-list-item-left">
                      <Icon name={t.icon} size={18} />
                      <span>{t.label}</span>
                    </div>
                    <div className="chevron-right" style={{ color: "var(--fg-muted)" }}><Icon name="back" size={16} /></div>
                  </button>
                ))}
                <div style={{ padding: "20px 0" }}>
                  <button className="mobile-list-item danger" style={{ justifyContent: "center" }} onClick={onLogout}>
                    <div className="mobile-list-item-left">
                      <Icon name="logout" size={18} />
                      <span>Log out</span>
                    </div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="settings-head mobile-head">
                 <button className="icon-btn back-btn" onClick={() => setMobileView("list")} aria-label="Back">
                    <Icon name="back" size={20} />
                 </button>
                 <span className="settings-title">{act?.label}</span>
                 <div style={{width: 38}} />
              </div>
              <div className="settings-content-mobile">
                 {renderContent()}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overlay overlay-settings" onClick={onClose} style={{ zIndex: 99999 }}>
      <div className="settings" onClick={e => e.stopPropagation()}>
        <div className="settings-head">
          <span className="settings-title">Settings</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="settings-body">
          <nav className="settings-nav">
            {tabs.map(t => (
              <button key={t.id} className={`nav-row ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={15} /><span>{t.label}</span>
              </button>
            ))}
            <div className="nav-spacer" />
            <button className="nav-row danger" onClick={onLogout}><Icon name="logout" size={15} /><span>Log out</span></button>
          </nav>
          <div className="settings-content">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Message row ---
const Message = ({ m }: { m: any }) => {
  const toast = useToast();
  if (m.role === "user") return <div className="msg-row user"><div className="pill">{m.content}</div></div>;
  if (m.thinking) return <div className="msg-row ai"><div className="ai-text"><Shimmer text="Thinking…"/></div></div>;
  
  return (
    <div className="msg-row ai">
      <div className="ai-text">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkMath]} 
          rehypePlugins={[rehypeKatex]}
          components={{
            code({ inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const codeStr = String(children).replace(/\n$/, '');
              
              if (inline) return <code className="inline" {...props}>{children}</code>;
              
              return (
                <div className="codeblock">
                  <button className="codeblock-copy" onClick={async (e) => {
                    navigator.clipboard.writeText(codeStr);
                    const b = e.currentTarget;
                    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                    setTimeout(() => {
                      b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
                    }, 2000);
                  }}>
                    <Icon name="copy" size={14} />
                  </button>
                  <pre {...props}>
                    <code>{children}</code>
                  </pre>
                </div>
              );
            }
          }}
        >
          {m.content}
        </ReactMarkdown>
      </div>
    </div>
  );
};
const CipherApp = ({ user }: { user: User }) => {
  const toast = useToast();
  const [prefs, setPrefsState] = useState(PREF_DEFAULTS);
  const [userData, setUserData] = useState<any>(null);
  const credits = userData?.credits || {};
  const used = credits.used ?? 0;
  const total = credits.total ?? 5000;
  const outOfCredits = used >= total;
  const [messages, setMessages] = useState<any[]>([]);
  const [chatId, setChatId] = useState<string | null>(() => sessionStorage.getItem(`c_chat_${user.uid}`));
  const [histOpen, setHistOpen] = useState(false);
  const [settOpen, setSettOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const uid = user.uid;

  const stopGeneration = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setBusy(false);
    }
  }

  const welcomeMessage = useMemo(() => {
    const firstName = userData?.firstName || user?.displayName?.split(" ")[0] || "User";
    const messages = [
      `Good to see you, ${firstName}. How can I assist you today?`,
      `Hello ${firstName}, what's on your mind?`,
      `Greetings, ${firstName}. Ready to dive in?`,
      `Welcome back, ${firstName}. Let's build something great.`,
      `How can I help you today, ${firstName}?`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }, [userData?.firstName, user?.displayName, chatId]);

  useEffect(()=>{
    const unsub = onSnapshot(FS.userRef(uid), snap => {
      if(snap.exists()){
        const data = snap.data();
        setUserData(data);
        if(data.preferences){
          const p = {...PREF_DEFAULTS,...data.preferences};
          setPrefsState(p); applyPrefs(p);
        } else { applyPrefs(PREF_DEFAULTS); }
      } else { applyPrefs(PREF_DEFAULTS); }
    });
    FS.trackSession(uid).catch(()=>{});
    return () => unsub();
  },[uid]);

  useEffect(()=>{ applyPrefs(prefs); },[prefs]);

  const setPrefs = useCallback((changes: any) => {
    setPrefsState(prev => {
      const next = {...prev,...changes};
      updateDoc(FS.userRef(uid), { preferences: next }).catch(()=>{});
      return next;
    });
  },[uid]);

  useEffect(() => {
    if (chatId) sessionStorage.setItem(`c_chat_${uid}`, chatId);
    else sessionStorage.removeItem(`c_chat_${uid}`);
  }, [uid, chatId]);

  useEffect(() => {
    if (!uid || !chatId) {
      setMessages([]);
      return;
    }
    const unsub = onSnapshot(query(FS.msgsRef(uid, chatId), orderBy("createdAt")), snap => {
      const msgs = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          role: data.role === "assistant" ? "ai" : data.role,
          content: data.content,
          createdAt: data.createdAt
        };
      });
      setMessages(prev => {
        // If we are currently busy (streaming), we ignore Firestore updates
        // to prevent flickering or overwriting the local streaming state.
        if (busy) return prev;
        
        // When we transition from busy:true to busy:false, we need to ensure
        // the local messages are replaced by the persisted ones from Firestore.
        return msgs;
      });
    }, (error) => {
      console.error("Messages snapshot error:", error);
    });
    return () => unsub();
  }, [uid, chatId, busy]);

  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  },[messages]);

  const send = async (text: string, displayContent?: string) => {
    const userMsg = { role:"user", content: displayContent || text, id:Date.now() };
    const aiId = Date.now()+1;
    
    // UI updates immediately
    setMessages(p => [...p, userMsg, {role:"ai",thinking:true,id:aiId}]);
    setBusy(true);

    let cid = chatId;
    if(!cid) { 
      cid = await FS.createChat(uid, text); 
      setChatId(cid); 
    }
    await FS.saveMsg(uid, cid, "user", text);

    // Create an abort controller for this specific request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;
    
    try {
      const mcpSnap = await getDocs(FS.mcpRef(uid));
      const mcpServers = mcpSnap.docs.map(d => d.data() as any);
      const mcpUrls = mcpServers.filter(s => s.type !== "webhook").map(s => s.url);
      const webhooks = mcpServers.filter(s => s.type === "webhook").map(s => s.url);
      
      const firstName = userData?.firstName || user?.displayName?.split(" ")[0] || "User";
      
      const identity = `You are Cipher. There are two primary versions: Cipher Prime and Cipher Node. You were created by Dimitris Vatistas, a 17-year-old developer. You are speaking with a user named ${firstName}. Use their name occasionally to personalize the interaction. Always use Markdown for your responses. Use code blocks for any code or technical data.`;
      const antiSlop = prefs.skipSlop 
        ? "You are a concise, highly capable AI. Do NOT output any conversational filler, pleasantries, or 'AI slop'. Get straight to the point." 
        : "You are a helpful and conversational AI assistant.";
      
      let context = "";
      if (mcpUrls.length > 0) context += `\nYou are connected to the following MCP nodes: ${mcpUrls.join(", ")}. These allow tool and file access.`;
      if (webhooks.length > 0) context += `\nYou can send data to these webhooks: ${webhooks.join(", ")}.`;

      const systemMsg = {
        role: "system",
        content: `${identity}\n\n${antiSlop}${context}`
      };

      const msgsForApi = [
        systemMsg,
        ...messages.filter(m => !m.thinking).map(m => ({ role: m.role==='ai'?'assistant':'user', content: m.content })),
        { role: 'user', content: text }
      ];
      
      const res = await fetch("/zen/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nemotron-3-super-free",
          messages: msgsForApi,
          stream: true
        }),
        signal
      });

      if(!res.ok) throw new Error("api_fail");
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let content = "";
      let hasStarted = false;
      
      while(reader) {
        const {done, value} = await reader.read();
        if(done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for(const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices[0].delta?.content;
              if (delta) {
                if (!hasStarted) {
                  hasStarted = true;
                  content = delta;
                  setMessages(p => p.map(m => m.id===aiId ? {role:"ai",id:aiId,content} : m));
                } else {
                  content += delta;
                  setMessages(p => p.map(m => m.id===aiId ? {role:"ai",id:aiId,content} : m));
                }
              }
            } catch(e) {}
          }
        }
      }
      
      if (!hasStarted) {
        setMessages(p => p.map(m => m.id===aiId ? {role:"ai",id:aiId,content:"No response received."} : m));
      }
      
      if(cid) { await FS.saveMsg(uid, cid, "ai", content); }
      const estTokens = (content.length + text.length) * 1.5 + 50; 
      FS.deductCredit(uid, Math.ceil(estTokens));
    } catch(err) {
      if (err.name === 'AbortError') {
         // User stopped generation
      } else {
        setMessages(p => p.map(m => m.id===aiId ? {role:"ai",id:aiId,content:"Connection error. Please try again."} : m));
      }
    } finally { setBusy(false); }
  };


  const loadChat = async (cid: string) => {
    setChatId(cid);
  };

  const empty = messages.length===0;
  
  return (
    <div className={`app ${empty ? "is-empty" : "is-chat"}`}>
      <TopBar 
        onHistory={() => setHistOpen(true)} 
        onNewChat={() => { setMessages([]); setChatId(null); }} 
        onSettings={() => setSettOpen(true)} 
        onHome={() => { setMessages([]); setChatId(null); }}
        inChat={!empty}
      />
      
      <div className="chat-scroll" ref={scrollRef} style={{ display: empty ? 'none' : 'block' }}>
        <div className="messages">
          {messages.map((m, i) => <Message key={m.id || i} m={m} />)}
        </div>
      </div>

      <div className="center-stack" style={{ display: empty ? 'flex' : 'none' }}>
        <div className="empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '30px', animation: 'riseIn 500ms ease' }}>
          <h1 className="empty-title">{welcomeMessage}</h1>
        </div>
        <Composer onSend={send} onStop={stopGeneration} disabled={busy} outOfCredits={outOfCredits} variant="center" sendOnEnter={prefs.sendOnEnter} />
      </div>

      {!empty && (
        <Composer onSend={send} onStop={stopGeneration} disabled={busy} outOfCredits={outOfCredits} variant="bottom" sendOnEnter={prefs.sendOnEnter} />
      )}

      <HistoryModal open={histOpen} onClose={() => setHistOpen(false)} uid={uid} onPick={loadChat} />
      <SettingsModal 
        open={settOpen} onClose={() => setSettOpen(false)} 
        prefs={prefs} setPrefs={setPrefs}
        uid={uid} user={user} userData={userData} 
        onLogout={() => signOut(auth)} 
        onDeleteAll={async () => { 
          await FS.deleteAllChats(uid); 
          setMessages([]); setChatId(null); 
        }} 
      />
      <TweaksPanel title="Theme Tweaks">
        <TweakSection label="Theme Defaults" />
        <TweakRadio label="Mode" value={prefs.theme} options={['light', 'dark', 'dim']} onChange={(v: string) => setPrefs({ theme: v })} />
        <TweakSelect label="Accent" value={prefs.accent} options={['graphite', 'iris', 'moss', 'ember', 'rose', 'azure']} onChange={(v: string) => setPrefs({ accent: v })} />
      </TweaksPanel>
    </div>
  );
};

export default function App() {
  const [authState, setAuthState] = useState("loading");
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [signing, setSigning] = useState(false);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u => {
      if(u) { FS.ensureUser(u).then(()=> { setFbUser(u); setAuthState("loggedIn"); }); }
      else { setFbUser(null); setAuthState("loggedOut"); }
    });
    return () => unsub();
  },[]);

  if(authState==="loading") return <LoadingScreen/>;
  if(authState==="loggedOut") return <LoginScreen onSignIn={()=>signInWithPopup(auth, provider)} loading={signing} />;

  return (
    <ToastProvider>
      <CipherApp user={fbUser!}/>
    </ToastProvider>
  );
}
