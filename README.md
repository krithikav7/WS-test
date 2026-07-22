# Writesonic AI Bot Analytics — Custom Log Drain Test Kit

This project is a complete, working test harness for Writesonic's **AI Bot Analytics** using the **Custom log drain** integration. It gives you a real webpage that captures each incoming request's metadata and forwards it to Writesonic's ingestion endpoint, plus a script that simulates AI-bot traffic so you can watch data show up in your dashboard.

Based on Writesonic's docs: https://docs.writesonic.com/docs/integrating-with-custom-log-drain

---

## What's in the box

| File | What it does |
|------|--------------|
| `server.js` | Express site + middleware that forwards every request to Writesonic (main version) |
| `server-no-deps.js` | Same thing with **zero npm dependencies** (built-in `http`) — use if you can't `npm install` |
| `analytics.js` | Builds the exact Writesonic payload and POSTs it (shared by both servers) |
| `test-traffic.js` | Sends simulated GPTBot / PerplexityBot / ClaudeBot requests to your site |
| `public/index.html` | The demo webpage being served |
| `.env.example` | Template for your API key and settings |

---

## The full walkthrough, step by step

### Step 1 — Create the integration in Writesonic
1. Log in to Writesonic and open the **AI Bot Analytics** section.
2. When asked to choose a provider, select **Custom**.
3. Click **Continue**. Writesonic generates a **unique API key** for this integration — copy it. This is the credential your site will use to authenticate every log it sends.

You now have the two things you need:
- **Endpoint URL:** `https://ingestion.writesonic.com/api/v1/analytics/ingest`
- **Auth header:** `x-api-key: <your API key>`

### Step 2 — Get the code onto your machine
1. Unzip this project into a folder.
2. Make sure you have **Node.js 18 or newer** (`node -v`).

### Step 3 — Add your API key
1. Copy the template: `cp .env.example .env`
2. Open `.env` and paste your key:
   ```
   WRITESONIC_API_KEY=your_real_key_here
   WRITESONIC_INGEST_URL=https://ingestion.writesonic.com/api/v1/analytics/ingest
   PORT=3000
   DEBUG_FORWARD=true
   ```
   `DEBUG_FORWARD=true` prints every forwarded payload to your console so you can see exactly what's being sent while testing. Turn it off in production.

### Step 4 — Start the site (pick one)
- **With Express (recommended):**
  ```
  npm install
  npm start
  ```
- **No install needed:**
  ```
  node server-no-deps.js
  ```
Either way you should see:
```
  Test site running:  http://localhost:3000
  API key:            set ✓
```
Open http://localhost:3000 in a browser — that first visit is already being forwarded to Writesonic.

### Step 5 — Generate AI-bot traffic
In a second terminal (leave the server running):
```
npm run traffic
```
or
```
node test-traffic.js
```
This fires ~20 requests carrying real AI-crawler User-Agents (GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, Bytespider) and AI referrers (chatgpt.com, perplexity.ai, claude.ai, gemini). You'll see each request logged in both terminals.

To point it at a deployed site instead of localhost:
```
TARGET=https://your-site.com COUNT=50 node test-traffic.js
```

### Step 6 — Verify in Writesonic
1. Wait **1–5 minutes** (ingestion isn't instant).
2. Go back to the **AI Bot Analytics** page in Writesonic.
3. Click **Verify Integration**.
4. Once verified, your dashboard will start showing the bot visits — grouped by crawler, country, URL, and referrer.

---

## How the forwarding works (what to replicate on your real site)

Every request is captured **after the response is sent** (`res.on("finish")`), so analytics never slows your pages down. For each request the app builds this JSON and POSTs it as a **one-element array** to the ingestion endpoint:

```json
[{
  "ip": "203.0.113.1",
  "x_real_ip": "203.0.113.1",
  "ua": "Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)",
  "country_code": "US",
  "referrer": "https://chatgpt.com/",
  "url": "https://your-site.com/about-us",
  "method": "GET",
  "response_status": "200",
  "x_forwarded_for": "203.0.113.1,198.51.100.1"
}]
```

### The required fields
| Field | Source |
|-------|--------|
| `ip` | Client IP (first hop of `X-Forwarded-For`, or socket address) |
| `x_real_ip` | `X-Real-IP` header |
| `ua` | `User-Agent` header |
| `country_code` | ISO country code (e.g. from `CF-IPCountry` if you're behind Cloudflare) |
| `referrer` | `Referer` header |
| `url` | Full requested URL |
| `method` | HTTP method |
| `response_status` | HTTP status you returned |
| `x_forwarded_for` | Full `X-Forwarded-For` chain |

### The equivalent raw request (straight from the docs)
```bash
curl -X POST 'https://ingestion.writesonic.com/api/v1/analytics/ingest' \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY_HERE" \
  -d '[{
    "ip": "192.168.1.1",
    "x_real_ip": "203.0.113.1",
    "ua": "Mozilla/5.0 (compatible; Googlebot/2.1)",
    "referrer": "https://chatgpt.com/",
    "country_code": "US",
    "url": "https://writesonic.com/about-us",
    "method": "GET",
    "response_status": "200",
    "x_forwarded_for": "203.0.113.1,198.51.100.1"
  }]'
```
You can run this cURL directly with your real key as a one-off smoke test before wiring up the app.

---

## Best practices (from the docs)
- **Performance:** Forward logs asynchronously (this app does — it never `await`s the forward in the request path) and wrap it in error handling so an analytics failure can't break your site.
- **Security:** Keep the API key server-side only (never in browser code), always POST over HTTPS, and sanitize data before sending.
- **Batching:** The endpoint accepts an array, so on a busy site you can buffer several events and send them together instead of one request per hit.

## Troubleshooting
| Symptom | Likely cause / fix |
|---------|--------------------|
| `401 Unauthorized` | Wrong or missing `x-api-key` — recheck the key in `.env` |
| `422 Unprocessable Entity` | Malformed JSON or missing fields — remember the body must be an **array** |
| Network error | Your server can't make outbound HTTPS calls — check egress/firewall |
| Nothing in dashboard | Wait the full 1–5 min, confirm `API key: set ✓` at startup, keep `DEBUG_FORWARD=true` and confirm you see `-> 200 OK` lines |

---

## Deploying for a real test
Localhost works for verification, but to capture genuine AI-crawler traffic the site needs to be publicly reachable. Deploy `server.js` to any Node host (Render, Railway, Fly.io, a VPS, etc.), set the same environment variables there, and put the log-drain middleware in front of your real routes. When you're behind a CDN/load balancer, keep `app.set("trust proxy", true)` so the real client IP is read from `X-Forwarded-For` rather than the proxy's address.
