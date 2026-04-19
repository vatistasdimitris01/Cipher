import { useState } from 'react';
import { ArrowLeft, Fingerprint, Terminal, Sparkles, Cpu, Zap, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const DOCS_CONTENT: Record<string, string> = {
  'introduction': `
# Introduction to Cipher

Cipher Intelligence is a premium, multi-modal protocol designed to process edge-logic requests incredibly fast. It operates using specialized "nodes" governed by distinct parameters. Designed by Dimitris Vatistas to rewrite the rules of conversational logic and inference.

### Core Architecture

- **Cipher Prime**: The standard workhorse. Highly balanced for general coding, intelligence, and language parsing.
- **Cipher Node**: Experimental sub-routine. Excellent for lightweight queries and fast OS terminal executions.
- **Cipher Oracle**: Dedicated to intensive mathematical simulation and deep reasoning tasks.

### Neural Memory Vault
Cipher actively learns about you. Instead of pasting the same context constantly, Cipher securely updates a private Neural Vault and injects those facts natively into the protocol stream automatically.

---
**Get started by generating an API key** in the Developer Portal.
  `,
  'authentication': `
# Authentication

Every API request strictly requires a \`Bearer\` token generated from your Cipher developer dashboard. All generated tokens start with the \`ciph_\` prefix prefix.

### High-level Security Protocol

Do not share your API keys in publicly accessible areas such as GitHub, client-side code, etc.

\`\`\`json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer ciph_YOUR_API_KEY_HERE"
}
\`\`\`

If your token is missing, expired, or invalid, you will instantly receive a \`401 Unauthorized\` error matrix.
  `,
  'models': `
# Model Index

Cipher allows you to explicitly define which sub-layer processes your node request.

### Cipher Prime (\`cipher-prime\`)
The default, ultra-powerful model for most tasks involving deep language comprehension, advanced reasoning, and code logic synthesis. 

### Cipher Node (\`cipher-node\`)
The lightning-fast, ephemeral logic stream. Use this for recursive tool-calling, rapid terminal hooks, or summarizations where latency is the ultimate priority.

### Cipher Oracle (\`cipher-oracle\`)
Optimized for rigid logic and deep spatial sequence reasoning. When sending mathematical equations or solving complex proofs, point your \`/v1/chat\` payloads specifically at Oracle.
  `,
  'chat_endpoint': `
# Universal Chat Endpoint

The core endpoint for sending messages to Cipher natively mimics standard LLM REST structures for ease of integration.

**POST** \`/api/v1/chat\`

### Request Body

\`\`\`json
{
  "model": "cipher-prime", // defaults to cipher-prime
  "messages": [
    {
      "role": "user",
      "content": "Analyze this array."
    }
  ]
}
\`\`\`

### Response Schema

\`\`\`json
{
  "id": "chatcmpl-1234",
  "model": "cipher-prime",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Analysis complete."
      }
    }
  ],
  "usage": {
    "total_tokens": 42
  }
}
\`\`\`
  `,
  'mcp_integration': `
# Model Context Protocol (MCP)

Cipher supports extended agency through MCP. You can connect custom servers exposing external tools natively to your instance.

### Native Wiring
1. Navigate to the Developer Settings page and register an MCP Hook.
2. Provide the tools schema you want Cipher to internalize.
3. Cipher's core engine appends these capabilities during context resolution.

### Example Tool Configuration

\`\`\`json
[
  {
    "type": "function",
    "function": {
      "name": "read_filesystem",
      "description": "Read a file from the host OS",
      "parameters": {
        "type": "object",
        "properties": {
          "path": { "type": "string" }
        },
        "required": ["path"]
      }
    }
  }
]
\`\`\`
  `,
  'cli_tool': `
# Cipher CLI

Run Cipher natively from your terminal. The CLI hooks directly into your OS for seamless script execution, file reading, and logic analysis.

### Installation

\`\`\`bash
# Clone the open-source CLI registry
git clone https://github.com/your-username/cipher-cli.git
cd cipher-cli

# Install dependencies and link the binary
npm install
npm link
\`\`\`

### Authentication Configuration

Set your environment variables using your minted API key:
\`\`\`bash
cipher config set --key "ciph_YOUR_KEY" --host "https://api.cipher.dev"
\`\`\`

### Example Commands

\`\`\`bash
# Analyze a file instantly
cipher "Find the memory leak in this file" < backend.ts

# Generate complex infrastructure
cipher generate kubernetes deployment for a nodejs app
\`\`\`
  `,
  'sdk_python': `
# Python SDK

Interact with Cipher sequentially using Python. Ideal for backend loops and scientific scripting.

### Make a Native Request

\`\`\`python
import requests

url = "https://your-cipher-instance/api/v1/chat"
headers = {
  "Authorization": "Bearer ciph_YOUR_KEY",
  "Content-Type": "application/json"
}
data = {
  "model": "cipher-oracle",
  "messages": [{"role": "user", "content": "Prove P=NP."}]
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
\`\`\`
  `,
  'sdk_node': `
# Node.js SDK

For Javascript/TypeScript environments, standard fetch bindings work perfectly natively.

\`\`\`typescript
const response = await fetch('https://your-cipher-instance/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ciph_YOUR_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'cipher-node',
    messages: [{ role: 'user', content: 'Ping.' }]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
\`\`\`
  `
};

export default function Docs() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('introduction');

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 overflow-hidden">
      {/* Enterprise Sidebar */}
      <div className="w-[280px] border-r border-gray-100 flex flex-col bg-gray-50/50 shrink-0">
        <div className="p-6 pb-4 border-b border-gray-100">
           <button 
             onClick={() => navigate('/')} 
             className="flex items-center gap-2 text-xs text-gray-400 hover:text-black transition-colors mb-6 uppercase tracking-wider font-semibold"
           >
             <ArrowLeft size={14} /> Back to Hub
           </button>
           <h2 className="text-base font-bold tracking-tight text-black flex items-center gap-2">
             <Fingerprint size={16} className="text-blue-600" /> Cipher Documentation
           </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          
          <div>
             <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-3">Getting Started</h3>
             <div className="space-y-1">
                <button onClick={() => setActiveSection('introduction')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeSection === 'introduction' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                   Introduction
                </button>
                <button onClick={() => setActiveSection('authentication')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeSection === 'authentication' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                   Authentication
                </button>
                <button onClick={() => setActiveSection('models')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeSection === 'models' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                   Model Index
                </button>
             </div>
          </div>

          <div>
             <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-3">Protocol API</h3>
             <div className="space-y-1">
                <button onClick={() => setActiveSection('chat_endpoint')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeSection === 'chat_endpoint' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                   Core REST Endpoint
                </button>
                <button onClick={() => setActiveSection('mcp_integration')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeSection === 'mcp_integration' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                   MCP Integration
                </button>
             </div>
          </div>

          <div>
             <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-3">Libraries & Tools</h3>
             <div className="space-y-1">
                <button onClick={() => setActiveSection('cli_tool')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeSection === 'cli_tool' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                   Cipher CLI
                </button>
                <button onClick={() => setActiveSection('sdk_node')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeSection === 'sdk_node' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                   Node.js / TS
                </button>
                <button onClick={() => setActiveSection('sdk_python')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeSection === 'sdk_python' ? 'text-black bg-white shadow-sm border border-gray-100 font-medium' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}>
                   Python (Requests)
                </button>
             </div>
          </div>

        </div>

        <div className="p-6 border-t border-gray-100">
           <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2">Protocol Status</p>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-xs text-black font-medium">Nodes Latency: 42ms</span>
              </div>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto w-full relative bg-white">
        <div className="absolute top-0 right-0 w-full h-[500px] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-white/0 to-transparent pointer-events-none"></div>
        <div className="max-w-3xl mx-auto p-10 lg:p-20 relative z-10 w-full markdown-body prose prose-slate prose-blue prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-100 prose-pre:text-gray-900 prose-headings:text-black prose-p:text-gray-600 prose-strong:text-black prose-li:text-gray-600 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none leading-relaxed">
           <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
               {DOCS_CONTENT[activeSection]}
           </Markdown>

           <div className="mt-24 pt-12 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div onClick={() => navigate('/dev')} className="group p-6 rounded-2xl border border-gray-100 hover:border-blue-500 transition-all cursor-pointer bg-gray-50/50">
                 <Terminal size={24} className="text-gray-900 mb-4" />
                 <h4 className="text-black font-bold mb-2">Developer Portal</h4>
                 <p className="text-sm text-gray-500 font-light">Mint neural keys and manage your integration balance pools.</p>
              </div>
              <div className="group p-6 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all cursor-pointer bg-gray-50/50">
                 <Sparkles size={24} className="text-gray-900 mb-4" />
                 <h4 className="text-black font-bold mb-2">API Reference</h4>
                 <p className="text-sm text-gray-500 font-light">Explore full request/response schemas for the Cipher Protocol.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
