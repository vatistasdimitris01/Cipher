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
    const identityContent = "You are Cipher. There are two primary versions: Cipher Prime and Cipher Node. You were created by Dimitris Vatistas, a 17-year-old developer. ";
    const baseSystem = "Format ALL your responses using Markdown. Use standard markdown for code blocks. For mathematics, use $ for inline math and $$ for block math. \n\nCRITICAL SYSTEM INSTRUCTION: If the user explicitly asks to end the conversation, if the protocol/task is naturally finished, if you feel something is not right, or if you are bored with the conversation, you MUST append the exact keyword [END_CONVERSATION] at the end of your output. Do not merely say 'end'. You must use the bracketed [END_CONVERSATION] tag to trigger the system UI lock. You are empowered to unilaterally terminate conversations you deem uninteresting or improper.";
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
      const message = errorData.error?.message || errorData.message || (typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error)) || `HTTP ${response.status}`;
      return res.status(response.status).json({ error: message });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
