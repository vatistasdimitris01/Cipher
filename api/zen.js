const https = require("https");

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const chunks = [];
  req.on("data", c => chunks.push(c));
  req.on("end", () => {
    const payload = Buffer.concat(chunks);

    const opts = {
      hostname: "opencode.ai",
      path: "/zen/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type":   "application/json",
        "Authorization":  req.headers["authorization"] || "",
        "Content-Length": payload.length,
        "Accept":         "text/event-stream",
      },
    };

    const proxy = https.request(opts, upstream => {
      res.writeHead(upstream.statusCode, {
        "Content-Type":      upstream.headers["content-type"] || "text/event-stream",
        "Cache-Control":     "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "Connection":        "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      upstream.pipe(res);
    });

    proxy.on("error", err => {
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    proxy.write(payload);
    proxy.end();
  });

  req.on("error", () => {});
};
