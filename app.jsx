/* global React, ReactDOM, firebase */
const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;

// ─── Firebase init ────────────────────────────────────────────────────────────
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyD-JfpdUzhmkFav0RW2HoncLz9VHi0El9Y",
    authDomain: "ciphertheai.firebaseapp.com",
    projectId: "ciphertheai",
    storageBucket: "ciphertheai.firebasestorage.app",
    messagingSenderId: "996902957218",
    appId: "1:996902957218:web:6143180978d6477c1767fb",
    measurementId: "G-D4LRJ8GDTW",
  });
}
const db   = firebase.firestore();
const auth = firebase.auth();
try { firebase.analytics(); } catch {}

// ─── Session ID (stable per browser tab) ─────────────────────────────────────
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

// ─── Preference defaults ──────────────────────────────────────────────────────
const PREF_DEFAULTS = {
  theme: "dark", accent: "graphite", font: "sans", textSize: 15,
  density: "cozy", bubbleShape: "pill", reducedMotion: false, sendOnEnter: true,
};

function applyPrefs(p) {
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

// ─── Firestore helpers ────────────────────────────────────────────────────────
const FS = {
  userRef:  (uid)       => db.doc(`users/${uid}`),
  chatsRef: (uid)       => db.collection(`users/${uid}/chats`),
  chatRef:  (uid, cid)  => db.doc(`users/${uid}/chats/${cid}`),
  msgsRef:  (uid, cid)  => db.collection(`users/${uid}/chats/${cid}/messages`),
  sessRef:  (uid)       => db.doc(`users/${uid}/sessions/${SESSION_ID}`),
  allSessRef:(uid)      => db.collection(`users/${uid}/sessions`),
  mcpRef:   (uid)       => db.collection(`users/${uid}/mcpServers`),

  async ensureUser(fbUser) {
    const ref = this.userRef(fbUser.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        displayName:  fbUser.displayName || "User",
        firstName:    (fbUser.displayName || "User").split(" ")[0],
        email:        fbUser.email,
        photoURL:     fbUser.photoURL || null,
        createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
        lastSeen:     firebase.firestore.FieldValue.serverTimestamp(),
        credits:      { total: 5000, used: 0 },
        notifications:{ daily: true, mentions: true, billing: true, product: false },
        dataControls: { trainModels: false, chatHistory: true },
        preferences:  PREF_DEFAULTS,
      });
    } else {
      await ref.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
    }
  },

  async trackSession(uid) {
    const dev = parseDevice();
    await this.sessRef(uid).set({
      ...dev, sessionId: SESSION_ID,
      userAgent: navigator.userAgent.slice(0, 300),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastSeen:  firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  },

  async createChat(uid, title) {
    const ref = this.chatsRef(uid).doc();
    await ref.set({
      title: title.slice(0, 60),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      messageCount: 0,
    });
    return ref.id;
  },

  async saveMsg(uid, chatId, role, content) {
    const ts = firebase.firestore.FieldValue.serverTimestamp();
    const ref = this.msgsRef(uid, chatId).doc();
    await ref.set({ role: role === "ai" ? "assistant" : role, content, createdAt: ts });
    await this.chatRef(uid, chatId).update({
      updatedAt: ts,
      messageCount: firebase.firestore.FieldValue.increment(1),
    });
    return ref.id;
  },

  async loadMsgs(uid, chatId) {
    const snap = await this.msgsRef(uid, chatId).orderBy("createdAt").get();
    return snap.docs.map(d => ({
      id: d.id,
      role: d.data().role === "assistant" ? "ai" : d.data().role,
      content: d.data().content,
    }));
  },

  async deleteChat(uid, chatId) {
    const msgs = await this.msgsRef(uid, chatId).get();
    const batch = db.batch();
    msgs.docs.forEach(d => batch.delete(d.ref));
    batch.delete(this.chatRef(uid, chatId));
    await batch.commit();
  },

  async deleteAllChats(uid) {
    const chats = await this.chatsRef(uid).get();
    for (const c of chats.docs) await this.deleteChat(uid, c.id);
  },

  async exportData(uid) {
    const [uSnap, cSnap, sSnap, mSnap] = await Promise.all([
      this.userRef(uid).get(),
      this.chatsRef(uid).get(),
      this.allSessRef(uid).get(),
      this.mcpRef(uid).get(),
    ]);
    const chats = [];
    for (const c of cSnap.docs) {
      const ms = await this.msgsRef(uid, c.id).orderBy("createdAt").get();
      chats.push({ id: c.id, ...c.data(), messages: ms.docs.map(m => m.data()) });
    }
    return {
      profile: uSnap.data(),
      chats,
      sessions: sSnap.docs.map(d => d.data()),
      mcpServers: mSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      exportedAt: new Date().toISOString(),
    };
  },

  async deductCredit(uid) {
    await this.userRef(uid).update({ "credits.used": firebase.firestore.FieldValue.increment(1) }).catch(() => {});
  },
};

// ─── Browser notification helpers ────────────────────────────────────────────
const Notif = {
  supported: () => "Notification" in window,
  granted:   () => Notif.supported() && Notification.permission === "granted",
  async request() {
    if (!Notif.supported()) return false;
    if (Notification.permission === "granted") return true;
    return (await Notification.requestPermission()) === "granted";
  },
  send(title, body) {
    if (!Notif.granted()) return;
    try { new Notification(title, { body, icon: "" }); } catch {}
  },
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18, stroke = 1.6 }) => {
  const P = {
    history:  <><circle cx="12" cy="12" r="9"/><path d="M3.5 12a8.5 8.5 0 0 1 14-6.5L20 8"/><path d="M20 3v5h-5"/><path d="M12 7v5l3 2"/></>,
    plus:     <><path d="M12 5v14M5 12h14"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    arrowUp:  <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    search:   <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    x:        <><path d="M18 6 6 18M6 6l12 12"/></>,
    trash:    <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
    check:    <><path d="M20 6 9 17l-5-5"/></>,
    user:     <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    palette:  <><circle cx="12" cy="12" r="9"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15" r="1" fill="currentColor" stroke="none"/><path d="M12 21c-2 0-3-1-3-2.5s1-2 2-2.5"/></>,
    plug:     <><path d="M9 2v6M15 2v6M7 8h10v4a5 5 0 0 1-10 0V8zM12 17v5"/></>,
    bell:     <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    shield:   <><path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"/></>,
    logout:   <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></>,
    back:     <><path d="m15 18-6-6 6-6"/></>,
    copy:     <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
    monitor:  <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    phone:    <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 2.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z"/></>,
    link:     <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
    server:   <><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></>,
    zap:      <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff:   <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </svg>
  );
};

const Shimmer = ({ text }) => <span className="shimmer">{text}</span>;

const Logo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo">
    <defs>
      <linearGradient id="cipher-lg" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="currentColor" stopOpacity="1"/>
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.78"/>
      </linearGradient>
    </defs>
    <g transform="translate(16 16)">
      <g>
        {[0,60,120,180,240,300].map(deg => (
          <path key={deg}
            d="M0 -12 C 3.2 -7 3.2 -3 0 0 C -3.2 -3 -3.2 -7 0 -12 Z"
            fill="url(#cipher-lg)" transform={`rotate(${deg})`} opacity="0.92"/>
        ))}
      </g>
      <rect x="-3.2" y="-3.2" width="6.4" height="6.4" rx="1.1" transform="rotate(45)" fill="currentColor"/>
      <circle cx="0" cy="0" r="1.1" fill="var(--bg)"/>
    </g>
  </svg>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const ToastCtx = createContext(null);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3400);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{ position:"fixed", bottom:20, left:20, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none" }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type==="danger"?"#c94040": t.type==="success"?"#2d7a4f":"var(--bg-elev-2)",
            color: t.type==="info"?"var(--fg)":"#fff",
            border: t.type==="info"?"1px solid var(--border-strong)":"none",
            padding:"10px 16px", borderRadius:10, fontSize:13.5, maxWidth:340,
            boxShadow:"0 4px 20px rgba(0,0,0,0.35)",
            animation:"riseIn 260ms ease", pointerEvents:"auto",
          }}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
const useToast = () => useContext(ToastCtx);

// ─── ConfirmDialog ────────────────────────────────────────────────────────────
const ConfirmDialog = ({ open, title, body, confirmLabel="Confirm", danger=false, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onCancel} style={{ zIndex:200 }}>
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

// ─── Loading & Login screens ──────────────────────────────────────────────────
const LoadingScreen = () => (
  <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}>
    <div style={{ textAlign:"center" }}>
      <Logo size={48}/>
      <div style={{ marginTop:18 }}><Shimmer text="Loading…"/></div>
    </div>
  </div>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const LoginScreen = ({ onSignIn, loading, error }) => (
  <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:20 }}>
    <div style={{
      textAlign:"center", maxWidth:360, width:"100%",
      background:"var(--bg-elev)", border:"1px solid var(--border)",
      borderRadius:22, padding:"44px 32px", boxShadow:"var(--shadow-lg)", animation:"riseIn 400ms ease",
    }}>
      <Logo size={52}/>
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
        onMouseEnter={e=>{ if(!loading) e.currentTarget.style.transform="translateY(-1px)"; }}
        onMouseLeave={e=>{ e.currentTarget.style.transform="none"; }}
      >
        <GoogleIcon/>
        {loading ? "Signing in…" : "Continue with Google"}
      </button>
      {error && <div style={{ marginTop:14, color:"#e06060", fontSize:13 }}>{error}</div>}
    </div>
  </div>
);

// ─── TopBar ───────────────────────────────────────────────────────────────────
const TopBar = ({ onHistory, onNewChat, onSettings, onHome }) => (
  <div className="topbar">
    <div className="topbar-left">
      <button className="icon-btn" onClick={onHistory} aria-label="History"><Icon name="history"/></button>
    </div>
    <div className="topbar-center">
      <button className="brand" onClick={onHome} aria-label="Home">
        <Logo size={18}/><span>Cipher</span>
      </button>
    </div>
    <div className="topbar-right">
      <button className="icon-btn" onClick={onNewChat} aria-label="New chat"><Icon name="plus" size={20}/></button>
      <button className="icon-btn" onClick={onSettings} aria-label="Settings"><Icon name="settings"/></button>
    </div>
  </div>
);

// ─── Markdown renderer ────────────────────────────────────────────────────────
const escapeHtml = s => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const renderMath = (tex, display) => {
  try { if (window.katex) return window.katex.renderToString(tex, { displayMode: display, throwOnError: false, output: "html" }); } catch {}
  return escapeHtml(tex);
};
const renderInline = text => {
  let s = escapeHtml(text);
  const ct = []; s = s.replace(/`([^`]+)`/g, (_,c) => { ct.push(c); return `\x00C${ct.length-1}\x00`; });
  const mt = []; s = s.replace(/\$([^$\n]+)\$/g, (_,t) => { mt.push(renderMath(t,false)); return `\x00M${mt.length-1}\x00`; });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\x00C(\d+)\x00/g, (_,i) => `<code class="inline">${ct[+i]}</code>`);
  s = s.replace(/\x00M(\d+)\x00/g, (_,i) => mt[+i]);
  return s;
};

const CodeBlock = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),1400); } catch {}
  };
  return (
    <div className="codeblock">
      <div className="codeblock-head">
        <span className="codeblock-lang">{lang || "code"}</span>
        <button className="codeblock-copy" onClick={copy}>
          {copied ? <><Icon name="check" size={13} stroke={2.2}/><span>Copied</span></> : <><Icon name="copy" size={13}/><span>Copy</span></>}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
};

const MarkdownBlock = ({ source }) => {
  const [, tick] = useState(0);
  useEffect(()=>{ if(window.katex)return; let n=0; const id=setInterval(()=>{ n++; if(window.katex||n>40){clearInterval(id);tick(t=>t+1);} },100); return()=>clearInterval(id); },[]);
  const parts=[]; const re=/```(\w+)?\n([\s\S]*?)```/g; let li=0,m;
  while((m=re.exec(source))!==null){ if(m.index>li)parts.push({t:"text",c:source.slice(li,m.index)}); parts.push({t:"code",lang:m[1]||"",c:m[2].replace(/\n$/,"")}); li=m.index+m[0].length; }
  if(li<source.length)parts.push({t:"text",c:source.slice(li)});
  const rtp=(text,kp)=>{
    const out=[]; const mr=/\$\$([\s\S]+?)\$\$/g; let l=0,mm;
    while((mm=mr.exec(text))!==null){ if(mm.index>l)out.push({k:"md",c:text.slice(l,mm.index)}); out.push({k:"math",c:mm[1].trim()}); l=mm.index+mm[0].length; }
    if(l<text.length)out.push({k:"md",c:text.slice(l)});
    return out.map((o,i)=> o.k==="math"
      ? <div key={kp+i} className="math-block" dangerouslySetInnerHTML={{__html:renderMath(o.c,true)}}/>
      : <MdText key={kp+i} source={o.c}/>);
  };
  return <div className="md">{parts.map((p,i)=> p.t==="code"?<CodeBlock key={i} code={p.c} lang={p.lang}/>:<React.Fragment key={i}>{rtp(p.c,"p"+i)}</React.Fragment>)}</div>;
};

const MdText = ({ source }) => {
  const blocks=[]; const lines=source.split("\n"); let i=0;
  while(i<lines.length){
    const ln=lines[i]; if(/^\s*$/.test(ln)){i++;continue;}
    const h=/^(#{1,4})\s+(.*)$/.exec(ln); if(h){blocks.push({t:"h",lv:h[1].length,c:h[2]});i++;continue;}
    if(/^\s*---\s*$/.test(ln)){blocks.push({t:"hr"});i++;continue;}
    if(/^>\s?/.test(ln)){const b=[];while(i<lines.length&&/^>\s?/.test(lines[i])){b.push(lines[i].replace(/^>\s?/,""));i++;}blocks.push({t:"q",c:b.join("\n")});continue;}
    if(/^\s*[-*•]\s+/.test(ln)){const b=[];while(i<lines.length&&/^\s*[-*•]\s+/.test(lines[i])){b.push(lines[i].replace(/^\s*[-*•]\s+/,""));i++;}blocks.push({t:"ul",b});continue;}
    if(/^\s*\d+\.\s+/.test(ln)){const b=[];while(i<lines.length&&/^\s*\d+\.\s+/.test(lines[i])){b.push(lines[i].replace(/^\s*\d+\.\s+/,""));i++;}blocks.push({t:"ol",b});continue;}
    const b=[ln];i++;while(i<lines.length&&!/^\s*$/.test(lines[i])&&!/^(#{1,4}\s|>\s?|\s*[-*•]\s|\s*\d+\.\s|\s*---\s*$)/.test(lines[i])){b.push(lines[i]);i++;}
    blocks.push({t:"p",c:b.join(" ")});
  }
  return <>{blocks.map((b,idx)=>{
    if(b.t==="h"){const T="h"+b.lv;return<T key={idx} dangerouslySetInnerHTML={{__html:renderInline(b.c)}}/>;}
    if(b.t==="hr")return<hr key={idx}/>;
    if(b.t==="q")return<blockquote key={idx} dangerouslySetInnerHTML={{__html:renderInline(b.c)}}/>;
    if(b.t==="ul")return<ul key={idx}>{b.b.map((it,j)=><li key={j} dangerouslySetInnerHTML={{__html:renderInline(it)}}/>)}</ul>;
    if(b.t==="ol")return<ol key={idx}>{b.b.map((it,j)=><li key={j} dangerouslySetInnerHTML={{__html:renderInline(it)}}/>)}</ol>;
    return<p key={idx} dangerouslySetInnerHTML={{__html:renderInline(b.c)}}/>;
  })}</>;
};

// ─── Message row ──────────────────────────────────────────────────────────────
const Message = ({ m }) => {
  if (m.role==="user") return <div className="msg-row user"><div className="pill">{m.content}</div></div>;
  if (m.thinking)      return <div className="msg-row ai"><div className="ai-text"><Shimmer text="Thinking"/></div></div>;
  return <div className="msg-row ai"><div className="ai-text"><MarkdownBlock source={m.content}/></div></div>;
};

// ─── Composer ────────────────────────────────────────────────────────────────
const Composer = ({ onSend, disabled, variant="bottom", sendOnEnter=true }) => {
  const [val, setVal] = useState("");
  const taRef = useRef(null);
  useEffect(()=>{ const el=taRef.current; if(!el)return; el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,200)+"px"; },[val]);
  const send = () => { const t=val.trim(); if(!t||disabled)return; onSend(t); setVal(""); };
  const multiline = val.includes("\n");
  return (
    <div className={`composer-wrap variant-${variant}`}>
      <div className={`composer ${val.trim()?"filled":""}`} style={{ borderRadius: multiline ? "18px" : "", transition: "border-radius 200ms ease" }}>
        <textarea
          ref={taRef} placeholder="Message Cipher…" value={val} rows={1}
          style={{ borderRadius: multiline ? "14px 14px 6px 6px" : "", transition: "border-radius 200ms ease" }}
          onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>{
            if(e.key==="Enter"){
              if(sendOnEnter&&!e.shiftKey){e.preventDefault();send();}
              else if(!sendOnEnter&&(e.metaKey||e.ctrlKey)){e.preventDefault();send();}
            }
          }}
        />
        <button className="send" onClick={send} aria-label="Send" disabled={disabled||!val.trim()}
          style={{ borderRadius: multiline ? "10px" : "", transition: "border-radius 200ms ease" }}>
          <Icon name="arrowUp" size={16} stroke={2.2}/>
        </button>
      </div>
      <div className="composer-hint">
        {sendOnEnter ? "Enter to send · Shift+Enter for new line" : "⌘↩ to send · Enter for new line"}
      </div>
    </div>
  );
};

// ─── History modal (real Firestore data) ─────────────────────────────────────
const HistoryModal = ({ open, onClose, onPick, uid }) => {
  const [q, setQ] = useState("");
  const [chats, setChats] = useState([]);
  const inputRef = useRef(null);
  const toast = useToast();

  useEffect(()=>{
    if(!open||!uid)return;
    setTimeout(()=>inputRef.current?.focus(),10);
    const unsub = FS.chatsRef(uid).orderBy("updatedAt","desc").onSnapshot(snap=>{
      setChats(snap.docs.map(d=>({ id:d.id, ...d.data() })));
    },()=>{});
    return ()=>unsub();
  },[open,uid]);

  const filtered = chats.filter(c=>c.title?.toLowerCase().includes(q.toLowerCase()));
  const fmt = ts => { if(!ts)return""; const d=ts.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"}); };

  if(!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
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

// ─── Toggle ──────────────────────────────────────────────────────────────────
const Toggle = ({ on, onChange }) => (
  <button className={`toggle ${on?"on":""}`} onClick={()=>onChange(!on)} aria-pressed={on}>
    <span className="knob"/>
  </button>
);

// ─── Settings sections ────────────────────────────────────────────────────────
const Sec = ({ title, children }) => (
  <div className="sec"><div className="sec-title">{title}</div><div className="sec-body">{children}</div></div>
);
const Row = ({ label, sub, children }) => (
  <div className="row">
    <div className="row-label"><div>{label}</div>{sub&&<div className="row-sub">{sub}</div>}</div>
    <div className="row-ctrl">{children}</div>
  </div>
);

// ─── Account Tab (real Firebase data) ────────────────────────────────────────
const AccountTab = ({ uid, user, onLogout }) => {
  const toast = useToast();
  const [userData,  setUserData]  = useState(null);
  const [sessions,  setSessions]  = useState([]);
  const [editing,   setEditing]   = useState(false);
  const [draft,     setDraft]     = useState({ firstName:"", email:"" });
  const [showSess,  setShowSess]  = useState(false);

  useEffect(()=>{
    if(!uid)return;
    const unsub1 = FS.userRef(uid).onSnapshot(s=>{ if(s.exists)setUserData(s.data()); });
    const unsub2 = FS.allSessRef(uid).onSnapshot(s=>{ setSessions(s.docs.map(d=>d.data())); });
    return()=>{ unsub1(); unsub2(); };
  },[uid]);

  const firstName  = userData?.firstName || user?.displayName?.split(" ")[0] || "User";
  const email      = userData?.email || user?.email || "";
  const credits    = userData?.credits || { total:5000, used:0 };
  const credLeft   = credits.total - credits.used;
  const credPct    = Math.min(100, (credits.used / credits.total) * 100);

  const saveProfile = async () => {
    await FS.userRef(uid).update({ firstName: draft.firstName, email: draft.email }).catch(()=>{});
    setEditing(false);
    toast("Profile updated","success");
  };

  const signOut = async (sessId) => {
    await db.doc(`users/${uid}/sessions/${sessId}`).delete().catch(()=>{});
    toast("Session signed out","success");
  };

  if(!userData) return <div style={{padding:20,color:"var(--fg-muted)",fontSize:13}}>Loading…</div>;

  const icon = s => s.os==="iOS"||s.os==="Android" ? "phone" : "monitor";

  return (
    <>
      <Sec title="Profile">
        <div className="profile-card">
          <div className="avatar">{firstName[0]?.toUpperCase()}</div>
          {editing ? (
            <div className="profile-info" style={{flex:1}}>
              <input value={draft.firstName} onChange={e=>setDraft(d=>({...d,firstName:e.target.value}))}
                placeholder="First name"
                style={{display:"block",width:"100%",background:"var(--bg-elev-2)",border:"1px solid var(--border)",borderRadius:8,padding:"5px 10px",marginBottom:6,color:"var(--fg)",fontSize:14}}/>
              <input value={draft.email} onChange={e=>setDraft(d=>({...d,email:e.target.value}))}
                placeholder="Email"
                style={{display:"block",width:"100%",background:"var(--bg-elev-2)",border:"1px solid var(--border)",borderRadius:8,padding:"5px 10px",color:"var(--fg)",fontSize:13}}/>
            </div>
          ) : (
            <div className="profile-info">
              <div className="profile-name">{firstName}</div>
              <div className="profile-email">{email}</div>
            </div>
          )}
          {editing
            ? <div style={{display:"flex",gap:6}}>
                <button className="btn-ghost" onClick={()=>setEditing(false)}>Cancel</button>
                <button className="btn-primary" onClick={saveProfile}>Save</button>
              </div>
            : <button className="btn-ghost" onClick={()=>{setDraft({firstName,email});setEditing(true);}}>Edit</button>
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
            <button className="btn-primary" onClick={()=>toast("Billing portal coming soon","info")}>Manage</button>
          </div>
          <div className="credit-meter">
            <div className="credit-head">
              <span>Monthly credits</span>
              <span className="credit-num">{credits.used.toLocaleString()} / {credits.total.toLocaleString()}</span>
            </div>
            <div className="bar"><div className="bar-fill" style={{width:credPct+"%"}}/></div>
            <div className="credit-foot">
              <span>{credLeft.toLocaleString()} remaining</span>
              <button className="link" onClick={()=>toast("Credit top-ups coming soon","info")}>Buy more</button>
            </div>
          </div>
          <div className="credit-grid">
            <div className="credit-chip"><span className="chip-n">{credLeft}</span><span className="chip-l">Left</span></div>
            <div className="credit-chip"><span className="chip-n">{credits.used}</span><span className="chip-l">Used</span></div>
            <div className="credit-chip"><span className="chip-n">{credits.total}</span><span className="chip-l">Total</span></div>
            <div className="credit-chip"><span className="chip-n">{sessions.length}</span><span className="chip-l">Devices</span></div>
          </div>
        </div>
      </Sec>

      <Sec title="Active Sessions">
        <Row label={`${sessions.length} device${sessions.length!==1?"s":""} signed in`} sub="This session is highlighted">
          <button className="btn-ghost" onClick={()=>setShowSess(s=>!s)}>{showSess?"Hide":"Review"}</button>
        </Row>
        {showSess && sessions.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderTop:"1px solid var(--border)"}}>
            <div style={{width:32,height:32,borderRadius:8,background:"var(--bg-elev-2)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--fg-muted)",flexShrink:0}}>
              <Icon name={icon(s)} size={15}/>
            </div>
            <div style={{flex:1}}>
              <div style={{color:"var(--fg)",fontSize:13}}>
                {s.label || s.browser+" on "+s.os}
                {s.sessionId===SESSION_ID&&<span style={{fontSize:10,background:"var(--accent)",color:"var(--accent-fg)",borderRadius:4,padding:"1px 6px",marginLeft:8}}>This device</span>}
              </div>
              <div style={{color:"var(--fg-muted)",fontSize:12}}>{s.userAgent?.slice(0,60)}…</div>
            </div>
            {s.sessionId!==SESSION_ID&&(
              <button className="btn-ghost" style={{fontSize:12,padding:"4px 10px"}} onClick={()=>signOut(s.sessionId)}>Sign out</button>
            )}
          </div>
        ))}
      </Sec>

      <Sec title="Security">
        <Row label="Two-factor authentication" sub="Managed by Google">
          <button className="btn-ghost" onClick={()=>toast("2FA is managed through your Google account","info")}>Info</button>
        </Row>
        <Row label="Sign out of Cipher">
          <button className="btn-danger" onClick={onLogout}>Sign out</button>
        </Row>
      </Sec>
    </>
  );
};

// ─── Appearance Tab ───────────────────────────────────────────────────────────
const AppearanceTab = ({ prefs, setPrefs }) => {
  const themes  = [{id:"light",label:"Light"},{id:"dark",label:"Dark"},{id:"dim",label:"Dim"},{id:"system",label:"System"}];
  const accents = [
    {id:"graphite",color:"#1f1f1f"},{id:"iris",color:"#6c6bff"},{id:"moss",color:"#5b8c5a"},
    {id:"ember",color:"#c96a3e"},{id:"rose",color:"#c75b86"},{id:"azure",color:"#3a7ad1"},
  ];
  const fonts = [{id:"sans",label:"Sans"},{id:"serif",label:"Serif"},{id:"mono",label:"Mono"}];
  return (
    <>
      <Sec title="Theme">
        <div className="theme-grid">
          {themes.map(t=>(
            <button key={t.id} className={`theme-card ${prefs.theme===t.id?"active":""}`} onClick={()=>setPrefs({theme:t.id})}>
              <div className={`theme-preview theme-${t.id}`}>
                <div className="tp-bubble"/><div className="tp-line"/><div className="tp-line short"/>
              </div>
              <div className="theme-label"><span>{t.label}</span>{prefs.theme===t.id&&<Icon name="check" size={14}/>}</div>
            </button>
          ))}
        </div>
      </Sec>
      <Sec title="Accent">
        <div className="accent-row">
          {accents.map(a=>(
            <button key={a.id} className={`accent-dot ${prefs.accent===a.id?"active":""}`} style={{background:a.color}} onClick={()=>setPrefs({accent:a.id})} aria-label={a.id}>
              {prefs.accent===a.id&&<Icon name="check" size={12}/>}
            </button>
          ))}
        </div>
      </Sec>
      <Sec title="Typography">
        <Row label="Font family">
          <div className="seg">{fonts.map(f=><button key={f.id} className={`seg-btn ${prefs.font===f.id?"active":""}`} onClick={()=>setPrefs({font:f.id})}>{f.label}</button>)}</div>
        </Row>
        <Row label="Text size" sub={`${prefs.textSize}px`}>
          <input type="range" min="13" max="18" step="1" value={prefs.textSize} onChange={e=>setPrefs({textSize:Number(e.target.value)})} className="slider"/>
        </Row>
        <Row label="Density">
          <div className="seg">{["compact","cozy","roomy"].map(d=><button key={d} className={`seg-btn ${prefs.density===d?"active":""}`} onClick={()=>setPrefs({density:d})}>{d[0].toUpperCase()+d.slice(1)}</button>)}</div>
        </Row>
      </Sec>
      <Sec title="Chat">
        <Row label="User bubble shape">
          <div className="seg">{["pill","rounded","square"].map(s=><button key={s} className={`seg-btn ${prefs.bubbleShape===s?"active":""}`} onClick={()=>setPrefs({bubbleShape:s})}>{s[0].toUpperCase()+s.slice(1)}</button>)}</div>
        </Row>
        <Row label="Reduced motion" sub="Minimize animations"><Toggle on={prefs.reducedMotion} onChange={v=>setPrefs({reducedMotion:v})}/></Row>
        <Row label="Send on Enter" sub="Otherwise use ⌘↩ to send"><Toggle on={prefs.sendOnEnter} onChange={v=>setPrefs({sendOnEnter:v})}/></Row>
      </Sec>
    </>
  );
};

// ─── Notifications Tab (real browser notifications + Firestore) ───────────────
const NotificationsTab = ({ uid }) => {
  const toast = useToast();
  const [notifs, setNotifs] = useState({ daily:true, mentions:true, billing:true, product:false });
  const [permStatus, setPermStatus] = useState(Notif.supported() ? Notification.permission : "unsupported");

  useEffect(()=>{
    if(!uid)return;
    const unsub = FS.userRef(uid).onSnapshot(s=>{ if(s.exists&&s.data().notifications)setNotifs(s.data().notifications); });
    return()=>unsub();
  },[uid]);

  const update = async (key, val) => {
    if(val && permStatus!=="granted") {
      const granted = await Notif.request();
      const newPerm = Notif.supported() ? Notification.permission : "unsupported";
      setPermStatus(newPerm);
      if(!granted){ toast("Browser notifications are blocked. Enable them in your browser settings.","danger"); return; }
      Notif.send("Cipher notifications enabled","You'll now receive updates from Cipher.");
    }
    const next = { ...notifs, [key]: val };
    setNotifs(next);
    await FS.userRef(uid).update({ notifications: next }).catch(()=>{});
    toast(val ? "Notification enabled" : "Notification disabled","info");
    if(val && key==="daily") Notif.send("Daily summary enabled","Cipher will send you daily chat summaries.");
    if(val && key==="product") Notif.send("Product updates enabled","You'll hear about new Cipher features.");
  };

  const requestPerm = async () => {
    const ok = await Notif.request();
    setPermStatus(Notif.supported() ? Notification.permission : "unsupported");
    if(ok) { toast("Browser notifications enabled","success"); Notif.send("Notifications active","Cipher can now send you browser notifications."); }
    else toast("Notifications blocked. Check your browser settings.","danger");
  };

  const testNotif = () => {
    if(!Notif.granted()){ toast("Enable browser notifications first","danger"); return; }
    Notif.send("Test notification","This is a test from Cipher. Notifications are working!");
    toast("Test notification sent","success");
  };

  return (
    <>
      {permStatus!=="granted"&&permStatus!=="unsupported"&&(
        <div style={{margin:"0 0 16px",padding:"12px 16px",borderRadius:12,background:"var(--bg-elev-2)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div>
            <div style={{fontSize:13.5,fontWeight:500}}>Browser notifications are {permStatus==="denied"?"blocked":"not enabled"}</div>
            <div style={{fontSize:12,color:"var(--fg-muted)",marginTop:2}}>
              {permStatus==="denied"?"Update permissions in your browser settings to enable notifications.":"Allow Cipher to send you browser notifications."}
            </div>
          </div>
          {permStatus!=="denied"&&<button className="btn-primary" style={{flexShrink:0}} onClick={requestPerm}>Enable</button>}
        </div>
      )}
      <Sec title="Email notifications">
        <Row label="Daily summary" sub="Receive a daily recap of your chats"><Toggle on={notifs.daily} onChange={v=>update("daily",v)}/></Row>
        <Row label="Mentions & replies" sub="Notify when someone shares a chat with you"><Toggle on={notifs.mentions} onChange={v=>update("mentions",v)}/></Row>
        <Row label="Billing & credits" sub="Credit usage alerts and billing notices"><Toggle on={notifs.billing} onChange={v=>update("billing",v)}/></Row>
        <Row label="Product updates" sub="New features and improvements"><Toggle on={notifs.product} onChange={v=>update("product",v)}/></Row>
      </Sec>
      <Sec title="Browser notifications">
        <Row label="Status" sub={permStatus==="granted"?"Active — notifications will appear in your OS":permStatus==="denied"?"Blocked in browser settings":"Not yet enabled"}>
          <button className="btn-ghost" onClick={testNotif} disabled={!Notif.granted()}>Test</button>
        </Row>
      </Sec>
    </>
  );
};

// ─── Data Tab (real Firestore export/delete) ──────────────────────────────────
const DataTab = ({ uid, onDeleteAll }) => {
  const toast = useToast();
  const [dc, setDc] = useState({ trainModels:false, chatHistory:true });
  const [confirmDel, setConfirmDel] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(()=>{
    if(!uid)return;
    const unsub = FS.userRef(uid).onSnapshot(s=>{ if(s.exists&&s.data().dataControls)setDc(s.data().dataControls); });
    return()=>unsub();
  },[uid]);

  const updateDc = async (key, val) => {
    const next = {...dc,[key]:val};
    setDc(next);
    await FS.userRef(uid).update({dataControls:next}).catch(()=>{});
    toast(val?"Setting enabled":"Setting disabled","info");
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const data = await FS.exportData(uid);
      const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `cipher-export-${new Date().toISOString().slice(0,10)}.json`; a.click();
      URL.revokeObjectURL(url);
      toast("Export downloaded","success");
    } catch { toast("Export failed — try again","danger"); }
    finally { setExporting(false); }
  };

  const doDelete = async () => {
    setConfirmDel(false);
    await FS.deleteAllChats(uid);
    onDeleteAll();
    toast("All chats deleted","info");
  };

  return (
    <>
      <Sec title="Data controls">
        <Row label="Train models on my chats" sub="Help improve Cipher with your conversations">
          <Toggle on={dc.trainModels} onChange={v=>updateDc("trainModels",v)}/>
        </Row>
        <Row label="Chat history" sub="Save conversations to your account">
          <Toggle on={dc.chatHistory} onChange={v=>updateDc("chatHistory",v)}/>
        </Row>
      </Sec>
      <Sec title="Export & delete">
        <Row label="Export all data" sub="Download your chats, settings, and activity as JSON">
          <button className="btn-ghost" onClick={doExport} disabled={exporting}>{exporting?"Exporting…":"Export"}</button>
        </Row>
        <Row label="Delete all chats" sub="Permanently removes all conversations from Cipher">
          <button className="btn-danger" onClick={()=>setConfirmDel(true)}>Delete</button>
        </Row>
      </Sec>
      <ConfirmDialog open={confirmDel} title="Delete all chats?" danger
        body="This permanently deletes every conversation from your account. This cannot be undone."
        confirmLabel="Delete all" onConfirm={doDelete} onCancel={()=>setConfirmDel(false)}/>
    </>
  );
};

// ─── MCP page (custom servers, real Firestore) ────────────────────────────────
const MCP_EXAMPLE = `{
  "name":        "My Calendar",
  "url":         "https://your-server.com/mcp",
  "description": "Reads calendar events",
  "authToken":   "optional-bearer-token"
}`;

const MCPPage = ({ uid, onBack }) => {
  const toast = useToast();
  const [servers, setServers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", url:"", description:"", authToken:"" });
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState({});

  useEffect(()=>{
    if(!uid)return;
    const unsub = FS.mcpRef(uid).orderBy("createdAt","desc").onSnapshot(s=>{
      setServers(s.docs.map(d=>({id:d.id,...d.data()})));
    },()=>{});
    return()=>unsub();
  },[uid]);

  const addServer = async () => {
    if(!form.name.trim()||!form.url.trim()){ toast("Name and URL are required","danger"); return; }
    setSaving(true);
    try {
      await FS.mcpRef(uid).add({
        name: form.name.trim(),
        url: form.url.trim(),
        description: form.description.trim(),
        authToken: form.authToken.trim(),
        enabled: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      setForm({name:"",url:"",description:"",authToken:""});
      setShowForm(false);
      toast(`${form.name} added`,"success");
    } catch { toast("Failed to save — try again","danger"); }
    finally { setSaving(false); }
  };

  const toggleServer = async (s) => {
    await FS.mcpRef(uid).doc(s.id).update({enabled:!s.enabled});
    toast(s.enabled?"Server disabled":"Server enabled","info");
  };

  const deleteServer = async (s) => {
    await FS.mcpRef(uid).doc(s.id).delete();
    toast(`${s.name} removed`,"info");
  };

  const inp = (field,placeholder,type="text") => (
    <input type={type} value={form[field]} placeholder={placeholder}
      onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}
      style={{display:"block",width:"100%",background:"var(--bg-elev-2)",border:"1px solid var(--border)",
        borderRadius:9,padding:"9px 12px",color:"var(--fg)",fontSize:13.5,marginBottom:10,outline:"none",
        transition:"border-color 150ms"}}
      onFocus={e=>{e.target.style.borderColor="var(--border-strong)";}}
      onBlur={e=>{e.target.style.borderColor="var(--border)";}}
    />
  );

  return (
    <div className="mcp-page">
      <div className="mcp-topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back"><Icon name="back" size={18}/></button>
        <div className="mcp-crumb">Settings / <span>Connections</span></div>
        <div/>
      </div>

      <div className="mcp-hero">
        <div className="mcp-hero-kicker">MCP · Model Context Protocol</div>
        <h1 className="mcp-hero-title">Connect your own tools.</h1>
        <p className="mcp-hero-sub">Add any MCP-compatible server and Cipher will use it in conversation when relevant, with your permission.</p>
        <div className="mcp-stats">
          <div className="stat"><span className="stat-n">{servers.filter(s=>s.enabled).length}</span><span className="stat-l">Active</span></div>
          <div className="stat-sep"/>
          <div className="stat"><span className="stat-n">{servers.length}</span><span className="stat-l">Total</span></div>
        </div>
      </div>

      <div style={{maxWidth:820,margin:"0 auto",padding:"0 28px 60px"}}>

        {/* Format guide */}
        <div style={{marginBottom:28,padding:"20px 22px",background:"var(--bg-elev)",border:"1px solid var(--border)",borderRadius:16}}>
          <div style={{fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--fg-dim)",marginBottom:10,fontWeight:500}}>Connection format</div>
          <p style={{fontSize:13.5,color:"var(--fg-muted)",marginBottom:14,lineHeight:1.6}}>
            Cipher connects to MCP servers over HTTP/SSE. Your server must implement the <strong style={{color:"var(--fg)"}}>Model Context Protocol</strong>. Add it using the fields below:
          </p>
          <div className="codeblock" style={{margin:0}}>
            <div className="codeblock-head">
              <span className="codeblock-lang">json</span>
            </div>
            <pre style={{margin:0,padding:"12px 16px",fontSize:12.5,lineHeight:1.6}}><code>{MCP_EXAMPLE}</code></pre>
          </div>
          <p style={{fontSize:12.5,color:"var(--fg-muted)",marginTop:12,lineHeight:1.55}}>
            Cipher will include <code style={{fontFamily:"var(--font-mono)",fontSize:12,background:"var(--bg-elev-2)",padding:"1px 5px",borderRadius:4}}>Authorization: Bearer &lt;authToken&gt;</code> in every request when a token is provided.
          </p>
        </div>

        {/* Add form */}
        {!showForm ? (
          <button
            onClick={()=>setShowForm(true)}
            style={{
              display:"flex",alignItems:"center",gap:10,padding:"12px 18px",
              borderRadius:12,border:"1px dashed var(--border-strong)",
              color:"var(--fg-muted)",fontSize:14,width:"100%",justifyContent:"center",
              background:"transparent",cursor:"pointer",transition:"background 150ms,color 150ms",
              marginBottom:24,
            }}
            onMouseEnter={e=>{e.currentTarget.style.background="var(--bg-hover)";e.currentTarget.style.color="var(--fg)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="var(--fg-muted)";}}
          >
            <Icon name="plus" size={16}/> Add MCP server
          </button>
        ) : (
          <div style={{background:"var(--bg-elev)",border:"1px solid var(--border-strong)",borderRadius:16,padding:"22px",marginBottom:24,animation:"pop 200ms ease"}}>
            <div style={{fontSize:14,fontWeight:500,marginBottom:16}}>New connection</div>
            {inp("name","Name (e.g. My Calendar)")}
            {inp("url","Server URL (e.g. https://your-server.com/mcp)")}
            {inp("description","Description (optional)")}
            <div style={{position:"relative"}}>
              <input
                type={showToken.new?"text":"password"}
                value={form.authToken}
                placeholder="Auth token (optional)"
                onChange={e=>setForm(f=>({...f,authToken:e.target.value}))}
                style={{display:"block",width:"100%",background:"var(--bg-elev-2)",border:"1px solid var(--border)",
                  borderRadius:9,padding:"9px 40px 9px 12px",color:"var(--fg)",fontSize:13.5,marginBottom:10,outline:"none"}}
              />
              <button onClick={()=>setShowToken(t=>({...t,new:!t.new}))}
                style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"var(--fg-muted)",background:"none",border:"none",cursor:"pointer",padding:2,marginBottom:10}}>
                <Icon name={showToken.new?"eyeOff":"eye"} size={15}/>
              </button>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}>
              <button className="btn-ghost" onClick={()=>{setShowForm(false);setForm({name:"",url:"",description:"",authToken:""});}}>Cancel</button>
              <button className="btn-primary" onClick={addServer} disabled={saving}>{saving?"Saving…":"Add server"}</button>
            </div>
          </div>
        )}

        {/* Server list */}
        {servers.length===0&&!showForm&&(
          <div style={{textAlign:"center",color:"var(--fg-dim)",fontSize:13.5,padding:"40px 0"}}>
            No MCP servers added yet. Add one above to get started.
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {servers.map(s=>(
            <div key={s.id} style={{
              background:"var(--bg-elev)",border:"1px solid "+(s.enabled?"var(--border-strong)":"var(--border)"),
              borderRadius:14,padding:"16px 18px",opacity:s.enabled?1:0.6,transition:"opacity 200ms,border-color 200ms",
            }}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14}}>
                <div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0}}>
                  <div style={{
                    width:38,height:38,borderRadius:10,background:"var(--accent)",color:"var(--accent-fg)",
                    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                  }}><Icon name="server" size={17}/></div>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:500,fontSize:14,color:"var(--fg)"}}>{s.name}</div>
                    <div style={{fontSize:12,color:"var(--fg-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.url}</div>
                    {s.description&&<div style={{fontSize:12,color:"var(--fg-dim)",marginTop:2}}>{s.description}</div>}
                  </div>
                </div>
                <div style={{display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>
                  {s.enabled&&<span className="mcp-badge"><span className="dot"/>Active</span>}
                  <button className={s.enabled?"btn-ghost sm":"btn-primary sm"} onClick={()=>toggleServer(s)}>
                    {s.enabled?"Disable":"Enable"}
                  </button>
                  <button style={{background:"none",border:"none",color:"var(--fg-muted)",cursor:"pointer",padding:4,borderRadius:6,display:"flex",alignItems:"center"}}
                    onClick={()=>deleteServer(s)}
                    onMouseEnter={e=>{e.currentTarget.style.color="#e06060";e.currentTarget.style.background="rgba(220,90,90,0.08)";}}
                    onMouseLeave={e=>{e.currentTarget.style.color="var(--fg-muted)";e.currentTarget.style.background="none";}}
                    aria-label="Delete">
                    <Icon name="trash" size={15}/>
                  </button>
                </div>
              </div>
              {s.authToken&&(
                <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8,borderTop:"1px solid var(--border)",paddingTop:10}}>
                  <span style={{fontSize:12,color:"var(--fg-dim)"}}>Auth token:</span>
                  <code style={{fontSize:12,fontFamily:"var(--font-mono)",color:"var(--fg-muted)",letterSpacing:"0.05em"}}>
                    {showToken[s.id] ? s.authToken : "••••••••••••••••"}
                  </code>
                  <button onClick={()=>setShowToken(t=>({...t,[s.id]:!t[s.id]}))} style={{color:"var(--fg-dim)",background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}>
                    <Icon name={showToken[s.id]?"eyeOff":"eye"} size={13}/>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Connections tab ──────────────────────────────────────────────────────────
const ConnectionsTab = ({ onOpenMCP }) => (
  <Sec title="Connections">
    <div className="connect-hero">
      <div>
        <div className="hero-title">Connect your tools</div>
        <div className="hero-sub">Add MCP servers to give Cipher access to your apps and data.</div>
      </div>
      <button className="btn-primary" onClick={onOpenMCP}>Manage</button>
    </div>
  </Sec>
);

// ─── Settings modal ───────────────────────────────────────────────────────────
const SettingsModal = ({ open, onClose, prefs, setPrefs, uid, user, onLogout, onDeleteAll, onOpenMCP }) => {
  const [tab, setTab] = useState("account");
  if(!open) return null;
  const tabs = [
    {id:"account",     label:"Account",       icon:"user"},
    {id:"appearance",  label:"Appearance",    icon:"palette"},
    {id:"connections", label:"Connections",   icon:"plug"},
    {id:"notifications",label:"Notifications",icon:"bell"},
    {id:"data",        label:"Data & Privacy",icon:"shield"},
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="settings" onClick={e=>e.stopPropagation()}>
        <div className="settings-head">
          <span className="settings-title">Settings</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={16}/></button>
        </div>
        <div className="settings-body">
          <nav className="settings-nav">
            {tabs.map(t=>(
              <button key={t.id} className={`nav-row ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
                <Icon name={t.icon} size={15}/><span>{t.label}</span>
              </button>
            ))}
            <div className="nav-spacer"/>
            <button className="nav-row danger" onClick={()=>{onClose();onLogout();}}>
              <Icon name="logout" size={15}/><span>Log out</span>
            </button>
          </nav>
          <div className="settings-content">
            {tab==="account"      && <AccountTab uid={uid} user={user} onLogout={()=>{onClose();onLogout();}}/>}
            {tab==="appearance"   && <AppearanceTab prefs={prefs} setPrefs={setPrefs}/>}
            {tab==="connections"  && <ConnectionsTab onOpenMCP={()=>{onClose();onOpenMCP();}}/>}
            {tab==="notifications"&& <NotificationsTab uid={uid}/>}
            {tab==="data"         && <DataTab uid={uid} onDeleteAll={()=>{onClose();onDeleteAll();}}/>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Cipher API (streaming via local proxy) ───────────────────────────────────
const CIPHER_KEY    = "sk-jLHTSQp8VGF9nN7oRAFlqyrfCxB8moyPIDtS0S1V1MCaFrV9LVR3KBtQVmxqk6PY";
const CIPHER_MODEL  = "nemotron-3-super-free";
const CIPHER_SYSTEM = "You are Cipher, a brilliant and concise AI assistant. You are helpful, knowledgeable, and thoughtful. Never mention any underlying model or technology — you are simply Cipher. Respond naturally and helpfully.";

async function callCipher(history, userText) {
  const msgs = [
    {role:"system", content:CIPHER_SYSTEM},
    ...history.filter(m=>!m.thinking&&m.content).map(m=>({role:m.role==="ai"?"assistant":"user",content:m.content})),
    {role:"user", content:userText},
  ];
  const res = await fetch("/zen/v1/chat/completions",{
    method:"POST",
    headers:{"Authorization":`Bearer ${CIPHER_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:CIPHER_MODEL, messages:msgs, temperature:0.7, max_tokens:2048, stream:true}),
  });
  if(res.status===401) throw Object.assign(new Error("auth"),{code:"auth"});
  if(res.status===429) throw Object.assign(new Error("rate_limit"),{code:"rate_limit"});
  if(!res.ok) throw new Error(`api_${res.status}`);
  return res.body.getReader();
}

// ─── App (authenticated) ──────────────────────────────────────────────────────
const App = ({ user }) => {
  const toast       = useToast();
  const [prefs,     setPrefsState]  = useState(PREF_DEFAULTS);
  const [messages,  setMessages]    = useState([]);
  const [chatId,    setChatId]      = useState(null);
  const [histOpen,  setHistOpen]    = useState(false);
  const [settOpen,  setSettOpen]    = useState(false);
  const [page,      setPage]        = useState("chat");
  const [busy,      setBusy]        = useState(false);
  const scrollRef   = useRef(null);
  const saveTimer   = useRef(null);
  const uid         = user.uid;
  const firstName   = user.displayName?.split(" ")[0] || "there";

  // Load preferences from Firestore once
  useEffect(()=>{
    FS.userRef(uid).get().then(snap=>{
      if(snap.exists&&snap.data().preferences){
        const p = {...PREF_DEFAULTS,...snap.data().preferences};
        setPrefsState(p); applyPrefs(p);
      } else { applyPrefs(PREF_DEFAULTS); }
    }).catch(()=>{ applyPrefs(PREF_DEFAULTS); });
    FS.trackSession(uid).catch(()=>{});
  },[uid]);

  // Apply prefs to DOM whenever they change
  useEffect(()=>{ applyPrefs(prefs); },[prefs]);

  // Debounced Firestore save for prefs
  const setPrefs = useCallback((changes) => {
    setPrefsState(prev => {
      const next = {...prev,...changes};
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(()=>{
        FS.userRef(uid).update({preferences:next}).catch(()=>{});
      },600);
      return next;
    });
  },[uid]);

  // Auto-scroll
  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  },[messages]);

  const loadChat = async (cid) => {
    try {
      const msgs = await FS.loadMsgs(uid, cid);
      setMessages(msgs); setChatId(cid); setPage("chat");
    } catch { toast("Failed to load chat","danger"); }
  };

  const send = async (text) => {
    const userMsg  = { role:"user", content:text, id:Date.now() };
    const aiId     = Date.now()+1;
    const prevMsgs = messages;
    setMessages(p => [...p, userMsg, {role:"ai",thinking:true,id:aiId}]);
    setBusy(true);

    // Create chat if new
    let cid = chatId;
    try {
      if(!cid) { cid = await FS.createChat(uid,text); setChatId(cid); }
      await FS.saveMsg(uid, cid, "user", text);
    } catch {} // non-fatal

    try {
      const reader  = await callCipher(prevMsgs, text);
      const decoder = new TextDecoder();
      let content   = "";
      setMessages(p => p.map(m => m.id===aiId ? {role:"ai",id:aiId,content:""} : m));
      while(true) {
        const {done,value} = await reader.read();
        if(done) break;
        for(const line of decoder.decode(value).split("\n")) {
          if(!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if(raw==="[DONE]") break;
          try {
            const delta = JSON.parse(raw)?.choices?.[0]?.delta?.content;
            if(delta){ content+=delta; setMessages(p=>p.map(m=>m.id===aiId?{role:"ai",id:aiId,content}:m)); }
          } catch {}
        }
      }
      if(!content) throw new Error("empty");

      // Save AI response & deduct credit
      if(cid) { FS.saveMsg(uid, cid, "ai", content).catch(()=>{}); }
      FS.deductCredit(uid);

      // Billing notification if credits low
      FS.userRef(uid).get().then(s=>{
        if(!s.exists)return;
        const {notifications,credits}=s.data();
        if(notifications?.billing&&credits){
          const left=credits.total-credits.used;
          if(left<=200) Notif.send("Low credits","You have "+left+" Cipher credits remaining.");
        }
        // Background tab notification
        if(document.visibilityState==="hidden"&&notifications?.mentions){
          Notif.send("Cipher responded","Your answer is ready.");
        }
      }).catch(()=>{});
    } catch(err) {
      const msg = err.code==="auth"?"API key is invalid. Check server config."
        : err.code==="rate_limit"?"Rate limit hit — please wait a moment."
        : "Something went wrong. Please try again.";
      setMessages(p=>p.map(m=>m.id===aiId?{role:"ai",id:aiId,content:msg}:m));
    } finally { setBusy(false); }
  };

  const newChat = () => { setMessages([]); setChatId(null); setPage("chat"); };

  const handleLogout = () => { auth.signOut(); };

  const handleDeleteAll = () => { setMessages([]); setChatId(null); };

  if(page==="mcp") return (
    <div className="app">
      <TopBar onHistory={()=>setHistOpen(true)} onNewChat={newChat} onSettings={()=>setSettOpen(true)} onHome={()=>setPage("chat")}/>
      <MCPPage uid={uid} onBack={()=>setPage("chat")}/>
      <HistoryModal open={histOpen} onClose={()=>setHistOpen(false)} uid={uid} onPick={loadChat}/>
      <SettingsModal open={settOpen} onClose={()=>setSettOpen(false)} prefs={prefs} setPrefs={setPrefs}
        uid={uid} user={user} onLogout={handleLogout} onDeleteAll={handleDeleteAll} onOpenMCP={()=>setPage("mcp")}/>
    </div>
  );

  const empty = messages.length===0;
  return (
    <div className={`app ${empty?"is-empty":"is-chat"}`}>
      <TopBar onHistory={()=>setHistOpen(true)} onNewChat={newChat} onSettings={()=>setSettOpen(true)} onHome={newChat}/>
      <div className="chat-scroll" ref={scrollRef}>
        {!empty&&<div className="messages">{messages.map(m=><Message key={m.id} m={m}/>)}</div>}
      </div>
      {empty&&(
        <div className="center-stack">
          <div className="empty"><div className="empty-title">How can I help, {firstName}?</div></div>
          <Composer onSend={send} disabled={busy} variant="center" sendOnEnter={prefs.sendOnEnter}/>
        </div>
      )}
      {!empty&&<Composer onSend={send} disabled={busy} variant="bottom" sendOnEnter={prefs.sendOnEnter}/>}
      {empty&&<div className="mobile-only-composer"><Composer onSend={send} disabled={busy} variant="bottom" sendOnEnter={prefs.sendOnEnter}/></div>}
      <HistoryModal open={histOpen} onClose={()=>setHistOpen(false)} uid={uid} onPick={loadChat}/>
      <SettingsModal open={settOpen} onClose={()=>setSettOpen(false)} prefs={prefs} setPrefs={setPrefs}
        uid={uid} user={user} onLogout={handleLogout} onDeleteAll={handleDeleteAll} onOpenMCP={()=>setPage("mcp")}/>
    </div>
  );
};

// ─── Root with Firebase auth gate ─────────────────────────────────────────────
const AppRoot = () => {
  const [authState, setAuthState] = useState("loading");
  const [fbUser,    setFbUser]    = useState(null);
  const [authError, setAuthError] = useState(null);
  const [signing,   setSigning]   = useState(false);

  useEffect(()=>{
    const unsub = auth.onAuthStateChanged(async u => {
      if(u) {
        try { await FS.ensureUser(u); } catch {}
        setFbUser(u); setAuthState("loggedIn");
      } else {
        setFbUser(null); setAuthState("loggedOut");
      }
    });
    return () => unsub();
  },[]);

  const signIn = async () => {
    setSigning(true); setAuthError(null);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");
      const result = await auth.signInWithPopup(provider);
      if(!result.user) throw new Error("no_user");
    } catch(err) {
      if(err.code === "auth/popup-blocked")
        setAuthError("Popup blocked — please allow popups for this site, then try again.");
      else if(err.code === "auth/unauthorized-domain")
        setAuthError("This domain isn't authorised in Firebase. Add ciphertheai.vercel.app to Firebase → Authentication → Settings → Authorized domains.");
      else if(err.code !== "auth/popup-closed-by-user")
        setAuthError("Sign-in failed (" + (err.code || err.message) + "). Please try again.");
      setSigning(false);
    }
  };

  if(authState==="loading")   return <LoadingScreen/>;
  if(authState==="loggedOut") return <LoginScreen onSignIn={signIn} loading={signing} error={authError}/>;

  return (
    <ToastProvider>
      <App user={fbUser}/>
    </ToastProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<AppRoot/>);
