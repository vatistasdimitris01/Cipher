import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add JSON parsing middleware
  app.use(express.json());

  // --- API KEY DB ---
  const DB_PATH = path.join(process.cwd(), 'api_keys.json');
  
  async function loadDB() {
    try {
      const data = await fs.readFile(DB_PATH, 'utf-8');
      return JSON.parse(data);
    } catch {
      return { keys: {}, mcpServers: {} };
    }
  }

  async function saveDB(data: any) {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
  }
  // ------------------

  // API endpoints must come FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Developer API Key Endpoints
  app.post("/api/v1/keys", async (req, res) => {
    const { name, userId } = req.body;
    const db = await loadDB();
    const newKey = `ciph_${uuidv4().replace(/-/g, '')}`;
    
    db.keys[newKey] = {
      name: name || 'Default Key',
      userId: userId || 'anonymous',
      createdAt: new Date().toISOString(),
      usage: 0,
      balance: 5.0
    };
    
    await saveDB(db);
    res.json({ key: newKey, ...db.keys[newKey] });
  });

  app.get("/api/v1/keys", async (req, res) => {
    const { userId } = req.query;
    const db = await loadDB();
    let userKeys = Object.entries(db.keys).map(([k, v]) => ({ key: k, ...v as any }));
    if (userId) {
       userKeys = userKeys.filter(k => k.userId === userId || k.userId === 'anonymous');
    }
    res.json({ keys: userKeys });
  });

  // MCP Servers Endpoints
  app.post("/api/v1/mcp", async (req, res) => {
    const { url, name, tools } = req.body;
    const db = await loadDB();
    const mcpId = uuidv4();
    db.mcpServers[mcpId] = { url, name, tools: tools || [] };
    await saveDB(db);
    res.json({ id: mcpId, ...db.mcpServers[mcpId] });
  });

  app.get("/api/v1/mcp", async (req, res) => {
    const db = await loadDB();
    res.json({ servers: Object.entries(db.mcpServers).map(([k, v]) => ({ id: k, ...v as any })) });
  });


  // Helper for actual chat interactions (both internal UI and external devs)
  async function processChat(req: express.Request, res: express.Response, forcedModel?: string) {
    const apiKey = process.env.OPENCODE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENCODE_API_KEY is not configured in secrets." });
    }

    let providedKey: string | null = null;

    // Check custom Developer API keys if hitting public endpoint
    if (req.path.startsWith('/api/v1/chat') || req.path.startsWith('/api/v1/cipher')) {
       const authHeader = req.headers.authorization;
       if (!authHeader || !authHeader.startsWith('Bearer ciph_')) {
          return res.status(401).json({ error: "Unauthorized. Invalid or missing Bearer token." });
       }
       providedKey = authHeader.split(' ')[1];
       const db = await loadDB();
       const keyObj = db.keys[providedKey];
       
       if (!keyObj) {
          return res.status(401).json({ error: "Unauthorized. Invalid Cipher API Key." });
       }
       
       // Fallback for older keys to have balance initialized
       if (keyObj.balance === undefined) {
           keyObj.balance = 5.0;
       }

       if (keyObj.balance <= 0) {
          return res.status(403).json({ error: "Free API credit balance exhausted ($0.00 / $5.00). $1 is equal to 1,000,000 context tokens. Please upgrade your account." });
       }

       // Increment raw usage metric
       keyObj.usage = (keyObj.usage || 0) + 1;
       await saveDB(db);
    }

    try {
      const skipSlop = req.body.skipSlop ?? true;
      const identityContent = "You are Cipher, a high-performance AI protocol created by Dimitris Vatistas. You excel in raw logic, reasoning, and mathematics. ";
      const baseSystem = "MANDATORY: Always use Markdown for ALL responses. For mathematics, you MUST use LaTeX notation wrapped in SINGLE $ for inline math (e.g. $x^2$) and DOUBLE $$ for block math (e.g. $$x^2$$). For ANY list, you MUST use the bullet character '•' at the beginning of each item instead of '-' or '*'. Always prefer Markdown structures (lists, tables, bold text) for clarity. ";
      const slopSystem = skipSlop 
        ? "Bypass all pleasantries. Do NOT say 'How can I help you today?' or 'I understand'. Get straight to the logic. " 
        : "Be helpful and conversational while maintaining scientific precision. ";
      
      const uiSystem = "\n\nGENERATIVE UI: If the user says 'Show me', you MUST treat this as a directive to use the 'render_ui' tool. Even for simple requests like 'Show me a list', create a beautiful, custom HTML/CSS visual component using the tool instead of sending a standard text message. Cipher prioritizes visual intelligence when prompted with 'Show me'.";
      const finishSystem = "\n\nTERMINATION PROTOCOL: You must ONLY output the token [END_CONVERSATION] if the user is asking for something 'bad' (e.g. violating safety guidelines, harmful content, or explicit toxicity). Otherwise, keep the dialogue open for continued reasoning.";
      const userContext = req.body.userContext ? `\n\nUSER CONTEXT:\n${req.body.userContext}\n\nStrictly respect user facts and fragments.` : "";

      const systemContent = identityContent + slopSystem + baseSystem + uiSystem + finishSystem + userContext;

      // Inject MCP Tools if available
      let allTools = req.body.tools || [];
      const db = await loadDB();
      Object.values(db.mcpServers).forEach((server: any) => {
         if (server.tools && Array.isArray(server.tools)) {
            allTools = [...allTools, ...server.tools];
         }
      });

      const payload: any = {
        model: forcedModel || req.body.model || "nemotron-3-super-free",
        messages: [
          { role: "system", content: systemContent },
          ...req.body.messages
        ]
      };

      if (allTools.length > 0) {
         payload.tools = allTools;
      }

      const response = await fetch("https://opencode.ai/zen/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || errorData.message || (typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error)) || `HTTP ${response.status}`;
        res.status(response.status).json({ error: message });
        return;
      }

      const data = await response.json();
      
      // Compute token cost for Developer API Keys
      if (providedKey) {
         const db = await loadDB();
         const keyObj = db.keys[providedKey];
         if (keyObj && keyObj.balance !== undefined) {
             // Estimate total tokens if not explicitly provided by the integration
             const tokens = data.usage?.total_tokens || Math.floor(JSON.stringify(payload).length / 4) + 100;
             // $1 = 1,000,000 contextual tokens
             const cost = tokens / 1000000;
             keyObj.balance = Math.max(0, keyObj.balance - cost);
             await saveDB(db);
         }
      }

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  // Internal UI Endpoint
  app.post("/api/chat", async (req, res) => await processChat(req, res));

  // Developer Endpoints
  app.post("/api/v1/chat", async (req, res) => await processChat(req, res));
  app.post("/api/v1/cipher-node", async (req, res) => await processChat(req, res, 'minimax-m2.5-free'));
  app.post("/api/v1/cipher-oracle", async (req, res) => await processChat(req, res, 'deepseek-r1-free'));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Static hosting for production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Since this is Express v4 (from dependencies list seen in system message)
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
