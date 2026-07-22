// test-traffic.js
// Simulates AI-bot traffic against your running test site. Each request carries a
// bot-like User-Agent and an AI referrer (ChatGPT, Perplexity, etc.), which is
// exactly what AI Bot Analytics is designed to surface.
//
// Usage:  node test-traffic.js            (hits http://localhost:3000)
//         TARGET=https://your-site.com node test-traffic.js

const TARGET = process.env.TARGET || "http://localhost:3000";

const paths = ["/", "/about-us", "/health"];

// Well-known AI crawler / assistant User-Agents.
const bots = [
  "Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
  "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  "Mozilla/5.0 (compatible; Google-Extended/1.0)",
  "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
];

const referrers = [
  "https://chatgpt.com/",
  "https://www.perplexity.ai/",
  "https://claude.ai/",
  "https://gemini.google.com/",
  "",
];

// Random public-ish IPs so the dashboard shows variety (documentation ranges).
function randIp() {
  const o = () => Math.floor(Math.random() * 254) + 1;
  return `203.0.${o()}.${o()}`;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function hit(i) {
  const path = pick(paths);
  const ip = randIp();
  const headers = {
    "User-Agent": pick(bots),
    "Referer": pick(referrers),
    // These are what a real CDN/proxy would attach; the server reads them.
    "X-Forwarded-For": `${ip},198.51.100.7`,
    "X-Real-IP": ip,
    "X-Country-Code": pick(["US", "GB", "IN", "DE", "CA"]),
  };
  try {
    const res = await fetch(TARGET + path, { headers });
    console.log(
      `#${String(i).padStart(2, "0")}  ${res.status}  ${path.padEnd(12)}  ${ip.padEnd(15)}  ${headers["User-Agent"].slice(0, 40)}`
    );
  } catch (err) {
    console.error(`#${i}  request failed:`, err.message);
  }
}

const COUNT = Number(process.env.COUNT || 20);

(async () => {
  console.log(`\nSending ${COUNT} simulated AI-bot requests to ${TARGET}\n`);
  for (let i = 1; i <= COUNT; i++) {
    await hit(i);
    await new Promise((r) => setTimeout(r, 150)); // small gap between hits
  }
  console.log(
    `\nDone. Give it 1–5 minutes, then click "Verify Integration" in Writesonic.\n`
  );
})();
