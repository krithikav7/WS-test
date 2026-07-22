// analytics.js
// Builds the Writesonic ingestion payload from an incoming request and forwards it
// to the custom log-drain endpoint. Designed to never throw into your request path:
// forwarding happens asynchronously and all errors are swallowed/logged.

const INGEST_URL = "https://ingestion.writesonic.com/api/v1/analytics/ingest";
const API_KEY = "1b2c38c9-8cf7-40ac-99fe-ec6d297e6287";
const DEBUG = "true";

// Pull the first IP out of an X-Forwarded-For chain ("client, proxy1, proxy2").
function firstIp(xff) {
  if (!xff) return "";
  return String(xff).split(",")[0].trim();
}

// Map an Express request -> the exact field names Writesonic expects.
export function buildPayload(req, { responseStatus } = {}) {
  const xff =
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";
  const xRealIp = req.headers["x-real-ip"] || firstIp(xff) || req.ip || "";

  return {
    ip: firstIp(xff) || req.ip || req.socket?.remoteAddress || "",
    x_real_ip: String(xRealIp),
    ua: req.headers["user-agent"] || "",
    country_code: req.headers["cf-ipcountry"] || req.headers["x-country-code"] || "",
    referrer: req.headers["referer"] || req.headers["referrer"] || "",
    url:
      req.protocol +
      "://" +
      (req.headers["host"] || "localhost") +
      req.originalUrl,
    method: req.method,
    response_status: String(responseStatus ?? ""),
    x_forwarded_for: String(xff || ""),
  };
}

// Fire-and-forget POST to Writesonic. The body is a JSON ARRAY of one or more events.
export async function forward(payload) {
  if (!API_KEY) {
    if (DEBUG) console.warn("[analytics] No WRITESONIC_API_KEY set — skipping forward.");
    return;
  }

  const events = Array.isArray(payload) ? payload : [payload];

  try {
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(events),
    });

    if (DEBUG) {
      const text = await res.text().catch(() => "");
      console.log(
        `[analytics] -> ${res.status} ${res.statusText} :: ` +
          JSON.stringify(events) +
          (text ? ` :: resp=${text.slice(0, 300)}` : "")
      );
    }

    if (!res.ok && !DEBUG) {
      console.error(`[analytics] ingestion returned ${res.status}`);
    }
  } catch (err) {
    // Never let analytics break the app.
    console.error("[analytics] forward failed:", err.message);
  }
}
