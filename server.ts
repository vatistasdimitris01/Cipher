import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add JSON parsing middleware
  app.use(express.json());

  // API endpoints must come FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/chat", async (req, res) => {
    const apiKey = process.env.OPENCODE_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "OPENCODE_API_KEY is not configured in secrets." });
      return;
    }

    try {
      const skipSlop = req.body.skipSlop ?? true;
      const identityContent = "You are Cipher. There are two primary versions: Cipher Prime and Cipher Node. You were created by Dimitris Vatistas, a 17-year-old developer. ";
      const baseSystem = "Format ALL your responses using Markdown. Use standard markdown for code blocks. For mathematics, use $ for inline math and $$ for block math.";
      const slopSystem = skipSlop 
        ? "You are a concise, highly capable AI. Do NOT output any conversational filler, pleasantries, or 'AI slop'. Get straight to the point. " 
        : "You are a helpful and conversational AI assistant. ";
      
      const systemContent = identityContent + slopSystem + baseSystem;

      const response = await fetch("https://opencode.ai/zen/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: req.body.model || "big-pickle",
          messages: [
            {
              role: "system", 
              content: systemContent
            },
            ...req.body.messages
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || errorData.message || (typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error)) || `HTTP ${response.status}`;
        res.status(response.status).json({ error: message });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

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
