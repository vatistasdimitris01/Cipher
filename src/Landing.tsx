import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowUp, Menu, X, Search, ChevronRight, Terminal, Hexagon, Cpu, Zap, Fingerprint } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

function PrimeVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 180, 270, 360],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
        className="relative w-[400px] h-[400px]"
      >
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 border border-blue-500/30 rounded-full"
            style={{ margin: i * 40 }}
            animate={{
              rotate: i % 2 === 0 ? 360 : -360,
              opacity: [0.1, 0.4, 0.1]
            }}
            transition={{
              duration: 10 + i * 5,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </motion.div>
      <div className="absolute w-32 h-32 bg-blue-500/20 blur-[80px] rounded-full" />
    </div>
  );
}

function OracleVisual() {
  const symbols = useMemo(() => ['∀', '∃', '∑', '∆', '∩', '∪', 'λ', 'φ', '∞', '≈', '≠', '⊥'], []);
  const [activeSymbols, setActiveSymbols] = useState<{id: number, char: string, x: number, y: number}[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSymbols(prev => {
        const next = [...prev, {
          id: Date.now(),
          char: symbols[Math.floor(Math.random() * symbols.length)],
          x: Math.random() * 80 + 10,
          y: Math.random() * 80 + 10
        }];
        if (next.length > 8) return next.slice(1);
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [symbols]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {activeSymbols.map(s => (
          <motion.span
            key={s.id}
            initial={{ opacity: 0, scale: 0.5, y: -20 }}
            animate={{ opacity: 0.3, scale: 1.2, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 3 }}
            className="absolute font-mono text-purple-400/40 text-2xl font-bold"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            {s.char}
          </motion.span>
        ))}
      </AnimatePresence>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(147,51,234,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(147,51,234,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
    </div>
  );
}

function NodeVisual() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="w-full h-full opacity-20" viewBox="0 0 400 400">
        <defs>
          <linearGradient id="zapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="1" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[...Array(5)].map((_, i) => (
          <motion.path
            key={i}
            d={`M ${Math.random()*400} ${Math.random()*400} L ${Math.random()*400} ${Math.random()*400}`}
            stroke="url(#zapGradient)"
            strokeWidth="1"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: [0, 1, 0],
              opacity: [0, 0.5, 0],
              d: [
                `M ${Math.random()*400} ${Math.random()*400} L ${Math.random()*400} ${Math.random()*400}`,
                `M ${Math.random()*400} ${Math.random()*400} L ${Math.random()*400} ${Math.random()*400}`
              ]
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </svg>
      <motion.div 
        animate={{ opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 bg-emerald-500/5 radial-gradient"
      />
    </div>
  );
}

function ThinkingVisual() {
  return (
    <div className="relative w-full h-[300px] md:h-[500px] rounded-3xl overflow-hidden mb-12 flex items-center justify-center bg-white border border-gray-100 shadow-sm">
      {/* Organic Blurred Gradients - Subtler for White Theme */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, 20, 0], scale: [1, 1.1, 1] }} 
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] bg-[#f72585] rounded-full blur-[140px] opacity-[0.05]"
        />
        <motion.div 
          animate={{ x: [0, -40, 0], y: [0, -30, 0], scale: [1, 1.2, 1] }} 
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/4 w-[120%] h-[120%] bg-[#ff8c42] rounded-full blur-[160px] opacity-[0.08]"
        />
        <motion.div 
          animate={{ x: [0, 30, 0], y: [0, 60, 0] }} 
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 right-1/4 w-[100%] h-[100%] bg-[#f9c74f] rounded-full blur-[180px] opacity-[0.05]"
        />
      </div>

      {/* Floating Pill Badge */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="relative z-10 px-8 py-4 bg-white/40 backdrop-blur-2xl rounded-[40px] shadow-sm border border-gray-100 flex items-center gap-3"
      >
        <div className="flex gap-1.5">
           {[...Array(3)].map((_, i) => (
             <motion.div 
               key={i}
               animate={{ opacity: [0.3, 1, 0.3] }}
               transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
               className="w-1.5 h-1.5 bg-black rounded-full"
             />
           ))}
        </div>
        <span className="text-xl md:text-2xl font-bold tracking-tight text-black flex items-center gap-2">
          Cipher<span className="text-black/30">Thinking</span>
        </span>
      </motion.div>
    </div>
  );
}

function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: {x: number, y: number, vx: number, vy: number, radius: number}[] = [];
    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const particleCount = Math.floor((window.innerWidth * window.innerHeight) / 20000); 
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          radius: Math.random() * 1 + 0.5,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      ctx.lineWidth = 0.2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 0, 0, ${0.03 - dist/(150/0.03)})`;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-0 pointer-events-none opacity-100"
    />
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState('');

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      navigate('/chat');
    }
  };

  return (
    <div className="h-screen w-full bg-white text-black font-sans overflow-x-hidden overflow-y-auto selection:bg-blue-500/10 pb-20">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-6 md:px-12 h-20 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-12">
            <Link to="/" className="font-bold text-2xl tracking-tighter text-black flex items-center gap-2">
              <Fingerprint size={24} className="text-black"/> Cipher
            </Link>
            <div className="hidden lg:flex items-center gap-10 text-[14px] font-medium tracking-tight text-gray-500">
              <Link to="/chat" className="hover:text-black transition-colors">Chat</Link>
              <Link to="/developers" className="hover:text-black transition-colors">API</Link>
              <Link to="/docs" className="hover:text-black transition-colors">Docs</Link>
              <Link to="/" className="hover:text-black transition-colors">Research</Link>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-8">
            <Link to="/chat" className="text-[14px] font-medium text-gray-500 hover:text-black transition-colors">Log in</Link>
            <Link to="/chat" className="bg-black text-white px-6 py-2.5 rounded-full text-[14px] font-semibold hover:bg-gray-800 transition-all">Launch</Link>
          </div>
          <button className="lg:hidden text-black" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
             {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-20 z-40 bg-white flex flex-col p-8 space-y-8 text-2xl font-semibold">
            <Link to="/chat" onClick={() => setMobileMenuOpen(false)}>Chat</Link>
            <Link to="/developers" onClick={() => setMobileMenuOpen(false)}>API</Link>
            <Link to="/docs" onClick={() => setMobileMenuOpen(false)}>Docs</Link>
            <hr className="border-gray-100"/>
            <Link to="/chat" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
            <Link to="/chat" onClick={() => setMobileMenuOpen(false)}>Launch</Link>
        </div>
      )}

      <ParticleNetwork />

      <main className="max-w-[1200px] mx-auto w-full pt-24 md:pt-40 px-6 md:px-12 relative z-10">
        
        {/* Simple Hero */}
        <section className="mb-48 text-center max-w-3xl mx-auto">
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8 }}
           >
             <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.05]">
               The future of intelligence is minimal.
             </h1>
             <p className="text-xl md:text-2xl text-gray-400 font-medium mb-12">
               Cipher is a native protocol designed for raw reasoning and seamless connectivity.
             </p>
             <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                <Link to="/chat" className="w-full md:w-auto px-10 py-4 bg-black text-white font-bold rounded-full text-lg hover:bg-gray-800 transition-all">
                  Start Chatting
                </Link>
                <Link to="/docs" className="w-full md:w-auto px-10 py-4 bg-transparent text-black border border-gray-200 font-bold rounded-full text-lg hover:bg-gray-50 transition-all">
                  Read Documentation
                </Link>
             </div>
           </motion.div>
        </section>

        {/* Minimal Thinking Visual */}
        <section className="mb-48 relative">
           <ThinkingVisual />
           <div className="mt-16 text-center">
              <h2 className="text-4xl md:text-6xl font-bold mb-12 tracking-tight">What can I help with?</h2>
              <form onSubmit={handlePromptSubmit} className="max-w-2xl mx-auto relative group">
                 <input 
                   type="text" 
                   value={prompt}
                   onChange={e => setPrompt(e.target.value)}
                   placeholder="Enter a prompt..." 
                   className="w-full bg-white border border-gray-200 rounded-2xl px-8 py-6 text-xl outline-none focus:border-black transition-all pr-16 shadow-sm hover:shadow-md" 
                 />
                 <button type="submit" disabled={!prompt.trim()} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50">
                    <ArrowUp size={24} />
                 </button>
              </form>
           </div>
        </section>

        {/* Minimal Bento */}
        <section className="mb-48">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Link to="/chat" className="group">
                 <div className="h-[600px] border border-gray-100 rounded-[40px] p-12 flex flex-col justify-between hover:border-gray-300 transition-all bg-gray-50/50 overflow-hidden relative">
                    <PrimeVisual />
                    <div className="relative z-10">
                       <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-4">Neural Model</p>
                       <h3 className="text-4xl font-bold mb-6 tracking-tight">Cipher Prime</h3>
                       <p className="text-lg text-gray-500 max-w-sm leading-relaxed">Our flagship protocol. Balanced for advanced reasoning, creative synthesis, and deep logic comprehension.</p>
                    </div>
                    <div className="relative z-10 text-sm font-bold flex items-center gap-2 group-hover:gap-4 transition-all">
                       Initialize Prime <ChevronRight size={18} />
                    </div>
                 </div>
              </Link>
              <div className="flex flex-col gap-8">
                 <Link to="/developers" className="group flex-1">
                    <div className="h-full border border-gray-100 rounded-[40px] p-10 flex flex-col justify-between hover:border-gray-300 transition-all relative overflow-hidden bg-gray-50/30">
                       <OracleVisual />
                       <div className="relative z-10">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-2">Scientific Layer</p>
                          <h4 className="text-3xl font-bold tracking-tight">Cipher Oracle</h4>
                       </div>
                       <p className="relative z-10 text-sm font-bold flex items-center gap-2 group-hover:gap-4 transition-all">
                          API Portal <ChevronRight size={16} />
                       </p>
                    </div>
                 </Link>
                 <Link to="/docs" className="group flex-1">
                    <div className="h-full border border-gray-100 rounded-[40px] p-10 flex flex-col justify-between hover:border-gray-300 transition-all relative overflow-hidden bg-gray-50/30">
                       <NodeVisual />
                       <div className="relative z-10">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Ephemeral Protocol</p>
                          <h4 className="text-3xl font-bold tracking-tight">Cipher Node</h4>
                       </div>
                       <p className="relative z-10 text-sm font-bold flex items-center gap-2 group-hover:gap-4 transition-all">
                          Documentation <ChevronRight size={16} />
                       </p>
                    </div>
                 </Link>
              </div>
           </div>
        </section>

        {/* News Feed Minimal */}
        <section className="mb-48">
            <div className="flex items-center justify-between mb-16 px-2">
                <h2 className="text-3xl font-bold tracking-tight">Latest News</h2>
                <Link to="/" className="text-sm font-bold hover:underline">View all</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 px-2">
                <Link to="/blog/architecture" className="group">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Engineering</p>
                    <h3 className="text-xl font-bold mb-4 leading-tight group-hover:underline">The Architecture of Cipher</h3>
                    <p className="text-gray-500 text-sm">Deep dive into training protocols and reasoning stripping.</p>
                </Link>
                <Link to="/blog/connectivity" className="group">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Research</p>
                    <h3 className="text-xl font-bold mb-4 leading-tight group-hover:underline">Native Connectivity</h3>
                    <p className="text-gray-500 text-sm">Bridging the gap between OS hooks and neural inference.</p>
                </Link>
                <Link to="/blog/max" className="group">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Company</p>
                    <h3 className="text-xl font-bold mb-4 leading-tight group-hover:underline">Remembering Max</h3>
                    <p className="text-gray-500 text-sm">Announcing our next generation model architecture.</p>
                </Link>
            </div>
        </section>

      </main>

      {/* Absolute Minimal Footer */}
      <footer className="border-t border-gray-100 bg-white py-24 px-8 mt-24 relative z-10">
         <div className="max-w-[1200px] mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-24">
               <div className="flex flex-col gap-4">
                  <h5 className="font-bold mb-4">Models</h5>
                  <Link to="/chat" className="text-gray-500 hover:text-black">Prime</Link>
                  <Link to="/chat" className="text-gray-500 hover:text-black">Oracle</Link>
                  <Link to="/chat" className="text-gray-500 hover:text-black">Node</Link>
               </div>
               <div className="flex flex-col gap-4">
                  <h5 className="font-bold mb-4">Ecosystem</h5>
                  <Link to="/developers" className="text-gray-500 hover:text-black">API</Link>
                  <Link to="/docs" className="text-gray-500 hover:text-black">Docs</Link>
                  <Link to="/banner" className="text-gray-500 hover:text-black">Assets</Link>
                  <Link to="/chat" className="text-gray-500 hover:text-black">Login</Link>
               </div>
               <div className="flex flex-col gap-4">
                  <h5 className="font-bold mb-4">Research</h5>
                  <Link to="/blog/architecture" className="text-gray-500 hover:text-black">History</Link>
                  <Link to="/blog/connectivity" className="text-gray-500 hover:text-black">Connectivity</Link>
                  <Link to="/blog/max" className="text-gray-500 hover:text-black">Future</Link>
               </div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400 border-t border-gray-50 border-padding pt-12">
               <div>Cipher Intelligence © 2026</div>
               <div className="flex gap-6 mt-4 md:mt-0">
                  <span>Dimitris Vatistas</span>
                  <span>Neural Vault™</span>
               </div>
            </div>
         </div>
      </footer>
    </div>
  );
}
