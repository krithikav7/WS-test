// server.js
// A minimal Express site that doubles as a Writesonic "custom log drain".
// Every incoming request is captured and forwarded to the Writesonic ingestion
// endpoint AFTER the response is sent, so analytics never slows down the page.

import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPayload, forward } from "./analytics.js";

// --- tiny .env loader (no external dependency) --------------------------------
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
} catch {
  // No .env file — rely on real environment variables instead.
}
// -----------------------------------------------------------------------------

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy headers (X-Forwarded-For / X-Real-IP) when running behind a CDN/LB.
app.set("trust proxy", true);

// Log-drain middleware: forward every request once the response finishes.
app.use((req, res, next) => {
  res.on("finish", () => {
    const payload = buildPayload(req, { responseStatus: res.statusCode });
    // Fire-and-forget: do not await, so the client is never blocked.
    forward(payload);
  });
  next();
});

// Serve the demo webpage + any static assets from /public.
app.use(express.static(join(__dirname, "public")));

// A couple of extra routes so you can generate varied traffic.
app.get("/about-us", (_req, res) => {
  res.type("html").send("<h1>About us</h1><p>Custom log drain test page.</p>");
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`\n  Test site running:  http://localhost:${PORT}`);
  console.log(`  Forwarding logs to: ${process.env.WRITESONIC_INGEST_URL ||
    "https://ingestion.writesonic.com/api/v1/analytics/ingest"}`);
  console.log(
    `  API key:            ${
      process.env.WRITESONIC_API_KEY ? "set ✓" : "NOT SET ✗ (copy .env.example -> .env)"
    }\n`
  );
});
