import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Fingerprint, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const BLOG_POSTS: Record<string, { title: string, date: string, category: string, content: string }> = {
  'architecture': {
    title: 'The Architecture of Cipher: How Dimitris Trained a Protocol',
    date: 'Oct 12, 2025',
    category: 'Engineering',
    content: `Cipher was born from a singular vision by 17-year-old developer Dimitris Vatistas. Dissatisfied with the sluggish, bloated, and restrictive nature of contemporary frontier models, Dimitris set out to engineer a protocol from the ground up that prioritized raw logic inference and terminal-speed execution over generic pleasantries.

By focusing purely on structural datasets and stripping away the "slop" that plagues modern conversational AI, Cipher emerged as an exceptionally fast reasoning engine. 

### The Neural Vault Paradigm

The initial training phase involved feeding raw OS documentation, massive open-source logic trees, and complex mathematical theorems into a heavily distilled parameter set. The architecture leans heavily on what we refer to as the "Neural Vault", an persistent local memory store that avoids repetitious context windows by appending known truths natively at compute-time. 

### Overcoming Latency Limits

A core directive given to the engineering team was to bypass standard HTTP inference delays. Through direct Model Context Protocol (MCP) integrations, Cipher can natively run computations directly where the data lives rather than shifting it across vast networks.

*This foundational work paves the way for Cipher Prime and the bleeding-edge testing seen in Cipher Oracle.*`
  },
  'connectivity': {
    title: 'Native Connectivity: Bridging OS and Neural Inference',
    date: 'Nov 28, 2025',
    category: 'Research',
    content: `Most modern AI tools are heavily sandboxed—they read text and write text in a persistent, isolated container. Cipher breaks that barrier natively through our implementation of the **Model Context Protocol (MCP)**.

Dimitris Vatistas structured Cipher to natively understand remote and local execution hooks. When operating through the Cipher CLI or a registered Node endpoint, Cipher isn't just generating terminal code for you to paste—it is analyzing your environment, querying the filesystem, executing code, and pulling the parsed outputs directly back into its logic stream automatically.

### The Cipher Node Sub-layer

By establishing an ephemeral model subset (Cipher Node) explicitly designed for these operations, parsing times drop to milliseconds.

When a user requests system data (e.g. *“Check the docker containers and restart the database”*), Cipher does the following:
1. Validates the command intent structurally.
2. Formats a payload against the registered MCP definitions.
3. Automatically triggers the webhook on the developer's side to enact the command.
4. Pauses and awaits the deterministic output log, streaming it directly into the user dialogue without missing a beat.

Real AI agency does not happen in an isolated web tab; it happens directly in the OS.`
  },
  'max': {
    title: 'In Memoriam: Announcing Cipher Max',
    date: 'Coming Soon',
    category: 'Company',
    content: `We are developing the next major theoretical evolution in Cipher's deep reasoning capabilities, internally dubbed **Cipher Max**. 

This model architecture is named in memory of Dimitris's beloved dog, Max, who recently passed away. Max represented unwavering loyalty, grounded presence, and a deep, unspoken understanding of his surroundings. 

### The Philosophy Behind Max

Cipher Max is being trained to embody these exact traits within its computational architecture: unyielding stability in logic, unshakeable memory retention, and a profound, coherent understanding of deep spatial sequence processing.

Where Cipher Prime acts as a highly capable and versatile worker, and Cipher Oracle focuses strictly on brute-force mathematics, Max is being constructed as an immutable pillar of analytical perfection. 

Parameters within Max are constrained so deeply that hallucinations become mathematically improbable. It is an homage to unconditional trust—translating organic loyalty directly into silicon logic. 

**Waitlist Access** will open to select researchers next quarter.`
  },
  'agency': {
    title: 'Accelerating the next phase of AI agency',
    date: 'Mar 31, 2026',
    category: 'Company',
    content: 'Our mission is to create capable, reliable agents that can interact with the digital world seamlessly. By extending the core Cipher protocol natively into terminals, servers, and scripts, we are moving beyond chat interfaces into active, autonomous digital collaboration.'
  },
  'golf': {
    title: 'Cipher Model Craft: Parameter Golf',
    date: 'Mar 30, 2026',
    category: 'Product',
    content: 'Parameter golf is the internal engineering discipline of achieving peak reasoning performance with the smallest possible active weight count. Through intense distillation processes utilizing Cipher Oracle, we compress massive reasoning capabilities into ultra-lightweight schemas.'
  },
  'math': {
    title: 'New ways to learn math and science in Cipher',
    date: 'Mar 10, 2026',
    category: 'Product',
    content: 'With the introduction of the Cipher Oracle architecture, our systems natively render and solve complex mathematical equations, formatting outputs directly in KaTeX and LaTeX for strict academic clarity without prompting overhead.'
  },
  'security': {
    title: 'Cipher Security: now in research preview',
    date: 'Mar 6, 2026',
    category: 'Product',
    content: 'We are introducing a dedicated analysis suite designed for infosec professionals to audit smart contracts, scan binary outputs, and trace variable leaks natively within the Cipher OS terminal using deep contextual arrays.'
  },
  'hierarchy': {
    title: 'Improving instruction hierarchy in frontier LLMs',
    date: 'Mar 10, 2026',
    category: 'Research',
    content: 'We have developed a strict priority routing system within Cipher Prime that ensures core system prompts explicitly override adversarial user inputs, drastically flattening the surface area of classical jailbreak attacks and hardening the trust boundary.'
  },
  'reasoning': {
    title: 'Reasoning models struggle to control their chains of thought, and that\'s good',
    date: 'Mar 5, 2026',
    category: 'Research',
    content: 'Current internal analyses on Cipher Oracle indicate that allowing the underlying routing algorithms to freely traverse associative logic paths—even seemingly irrational ones—drastically increases the probability of discovering novel mathematical proofs before distillation.'
  },
  'gravitons': {
    title: 'Extending single-minus amplitudes to gravitons',
    date: 'Mar 4, 2026',
    category: 'Research',
    content: 'By clustering Cipher Oracle arrays, we have computationally observed entirely novel approaches to generating single-minus amplitudes in localized gravitational physics models. Native integrations with Python graphing libraries validate these theories instantly.'
  }
};

export default function Blog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = BLOG_POSTS[id as string];

  if (!post) {
    return (
      <div className="h-screen w-full bg-white text-black flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold mb-4">Post Record Not Found</h1>
        <p className="text-gray-500 mb-8">The requested index does not exist in the neural registry.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-black text-white font-semibold rounded-full hover:bg-gray-800 transition-colors">
          Return to Hub
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto w-full bg-white text-gray-900 font-sans selection:bg-blue-100 flex flex-col">
      {/* Navbar Minimal */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 md:px-8 h-16 max-w-[1600px] mx-auto">
          <Link to="/" className="font-bold text-xl tracking-tighter text-black flex items-center gap-2">
            <Fingerprint size={20} className="text-blue-600"/> Cipher News
          </Link>
          <div className="flex items-center gap-5">
            <Link to="/chat" className="bg-black text-white px-5 py-2 rounded-full text-[13px] font-bold hover:bg-gray-800 transition-colors flex items-center gap-1.5">Launch Cipher <ChevronRight size={14}/></Link>
          </div>
        </div>
      </nav>

      {/* Main Read Area */}
      <main className="flex-1 w-full max-w-[800px] mx-auto pt-16 md:pt-24 px-6 md:px-8 pb-32">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-gray-400 hover:text-black transition-colors mb-12 uppercase tracking-widest font-semibold">
           <ArrowLeft size={16} /> Hub
        </button>
        
        <header className="mb-16">
           <div className="flex items-center gap-4 text-sm font-mono tracking-widest uppercase mb-6">
             <span className="text-blue-600 font-bold">{post.category}</span>
             <span className="text-gray-300">•</span>
             <span className="text-gray-400 font-medium">{post.date}</span>
           </div>
           <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-black leading-[1.1]">{post.title}</h1>
        </header>

        <article className="markdown-body prose prose-slate prose-lg max-w-none 
           prose-headings:text-black prose-headings:font-bold prose-headings:tracking-tight 
           prose-a:text-blue-600 hover:prose-a:text-blue-700 
           prose-p:text-gray-600 prose-p:leading-relaxed prose-p:font-light
           prose-strong:text-black prose-strong:font-semibold
           prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-100 prose-pre:text-gray-900">
           <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
               {post.content}
           </Markdown>
        </article>

        <div className="mt-24 pt-8 border-t border-gray-100 flex items-center justify-between">
           <h3 className="font-bold text-lg text-black">Share this article</h3>
           <div className="flex gap-4">
             <button className="px-4 py-2 bg-gray-50 border border-gray-100 text-sm text-gray-600 rounded-lg hover:bg-white hover:border-gray-200 transition-all">Copy Link</button>
           </div>
        </div>
      </main>
      
      {/* Footer Minimal */}
      <footer className="w-full border-t border-gray-100 py-12 px-6 bg-white">
         <div className="max-w-[800px] mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-gray-400 font-medium">
            <div className="flex items-center gap-6 mb-4 md:mb-0">
               <Link to="/" className="hover:text-black transition-colors uppercase tracking-widest">Return Home</Link>
            </div>
            <div className="uppercase tracking-widest">
               Cipher Intelligence © 2025–2026
            </div>
         </div>
      </footer>
    </div>
  );
}
