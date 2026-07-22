// server-no-deps.js
// Same behavior as server.js but with ZERO npm dependencies (uses Node's built-in
// http module). Handy if you can't install express. Run with: node server-no-deps.js

import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { forward } from "./analytics.js";

// --- tiny .env loader ---------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envRaw = readFileSync(join(__dirname, ".env"), "utf8");
  for (const line of envRaw.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) {
      const val = m[2].replace(/^["']|["']$/g, "");
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  }
} catch {}
// -----------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;

function firstIp(xff) {
  return xff ? String(xff).split(",")[0].trim() : "";
}

const server = http.createServer((req, res) => {
  const host = req.headers["host"] || `localhost:${PORT}`;
  const xff = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

  // Respond first, then forward on 'finish' so the client is never blocked.
  res.on("finish", () => {
    forward({
      ip: firstIp(xff) || req.socket.remoteAddress || "",
      x_real_ip: String(req.headers["x-real-ip"] || firstIp(xff) || ""),
      ua: req.headers["user-agent"] || "",
      country_code:
        req.headers["cf-ipcountry"] || req.headers["x-country-code"] || "",
      referrer: req.headers["referer"] || req.headers["referrer"] || "",
      url: `http://${host}${req.url}`,
      method: req.method,
      response_status: String(res.statusCode),
      x_forwarded_for: String(xff || ""),
    });
  });

  if (req.url === "/about-us") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>About us</h1><p>Custom log drain test page.</p>");
  } else if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"ok":true}');
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<h1>👋 Log drain test page</h1><p>Run <code>npm run traffic</code> " +
        "to simulate AI-bot visits, then check your Writesonic dashboard.</p>"
    );
  }
});

server.listen(PORT, () => {
  console.log(`\n  Test site (no-deps) running: http://localhost:${PORT}`);
  console.log(
    `  API key: ${process.env.WRITESONIC_API_KEY ? "set ✓" : "NOT SET ✗"}\n`
  );
});
