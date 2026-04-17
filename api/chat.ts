export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENCODE_API_KEY is not configured in Vercel environment variables." });
  }

  try {
    const skipSlop = req.body.skipSlop ?? true;
    const baseSystem = "Format ALL your responses using Markdown. Use standard markdown for code blocks. For mathematics, use $ for inline math and $$ for block math.";
    const slopSystem = skipSlop 
      ? "You are a concise, highly capable AI. Do NOT output any conversational filler, pleasantries, or 'AI slop'. Get straight to the point. " 
      : "You are a helpful and conversational AI assistant. ";
    
    const systemContent = slopSystem + baseSystem;

    const response = await fetch("https://opencode.ai/zen/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: req.body.model || "nemotron-3-super-free",
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
      return res.status(response.status).json({ error: errorData.error?.message || `HTTP ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
