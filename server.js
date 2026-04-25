const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const ZEN_HOST = "opencode.ai";
const ZEN_PATH_PREFIX = "/zen/v1";

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".jsx":  "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy: forward /zen/v1/* to opencode.ai/zen/v1/*
  if (req.url.startsWith(ZEN_PATH_PREFIX)) {
    const body = [];
    req.on("data", chunk => body.push(chunk));
    req.on("end", () => {
      const payload = Buffer.concat(body);
      const options = {
        hostname: ZEN_HOST,
        path: req.url,
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": req.headers["authorization"] || "",
          "Content-Length": payload.length,
        },
      };

      const proxy = https.request(options, upstream => {
        res.writeHead(upstream.statusCode, {
          "Content-Type": upstream.headers["content-type"] || "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        upstream.pipe(res);
      });

      proxy.on("error", err => {
        res.writeHead(502);
        res.end(JSON.stringify({ error: err.message }));
      });

      proxy.write(payload);
      proxy.end();
    });
    return;
  }

  // Static file serving
  let filePath = path.join(__dirname, req.url === "/" ? "/Cipher.html" : req.url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Cipher running at http://localhost:${PORT}/Cipher.html`);
});
