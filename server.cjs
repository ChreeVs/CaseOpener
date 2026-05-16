const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const steamPriceCache = new Map();
const STEAM_CACHE_MS = 1000 * 60 * 30;
const CHAT_LIMIT = 80;
const CHAT_COOLDOWN_MS = 900;
const chatMessages = [];
const chatRateLimit = new Map();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function parseSteamPrice(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}(,|$))/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 8192) {
        reject(new Error("Payload troppo grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("JSON non valido"));
      }
    });
    req.on("error", reject);
  });
}

function sanitizeText(value, fallback, maxLength) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return text || fallback;
}

function normalizeChatTeam(value) {
  return String(value || "").toLowerCase() === "t" ? "t" : "ct";
}

function publicChatMessages() {
  return chatMessages.slice(-CHAT_LIMIT);
}

function handleChatPost(req, res) {
  readBody(req)
    .then((body) => {
      const remote = req.socket.remoteAddress || "local";
      const lastAt = chatRateLimit.get(remote) || 0;
      if (Date.now() - lastAt < CHAT_COOLDOWN_MS) {
        sendJson(res, 429, { ok: false, error: "Invio troppo rapido." });
        return;
      }

      const text = sanitizeText(body.text, "", 180);
      if (!text) {
        sendJson(res, 400, { ok: false, error: "Messaggio vuoto." });
        return;
      }

      chatRateLimit.set(remote, Date.now());
      chatMessages.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: sanitizeText(body.name, "Operatore", 24),
        team: normalizeChatTeam(body.team),
        text,
        at: Date.now()
      });
      chatMessages.splice(0, Math.max(0, chatMessages.length - CHAT_LIMIT));
      sendJson(res, 200, { ok: true, messages: publicChatMessages() });
    })
    .catch((error) => sendJson(res, 400, { ok: false, error: error.message }));
}

async function fetchSteamPrice(name) {
  const cached = steamPriceCache.get(name);
  if (cached && Date.now() - cached.cachedAt < STEAM_CACHE_MS) {
    return cached.payload;
  }

  const endpoint = new URL("https://steamcommunity.com/market/priceoverview/");
  endpoint.searchParams.set("currency", "3");
  endpoint.searchParams.set("appid", "730");
  endpoint.searchParams.set("market_hash_name", name);

  try {
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "Mozilla/5.0 CaseOpener"
      }
    });
    const data = await response.json();
    const price = parseSteamPrice(data.lowest_price || data.median_price);
    const payload = {
      ok: Boolean(data.success && price),
      name,
      price,
      raw: data.lowest_price || data.median_price || "",
      volume: data.volume || "",
      source: price ? "steam" : "fallback"
    };
    steamPriceCache.set(name, { cachedAt: Date.now(), payload });
    return payload;
  } catch (error) {
    return {
      ok: false,
      name,
      price: null,
      raw: "",
      volume: "",
      source: "fallback",
      error: error.message
    };
  }
}

function serveStatic(url, res) {
  const cleanPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const requested = cleanPath || "index.html";
  const filePath = path.resolve(root, requested);

  if (!filePath.startsWith(root)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === "" || ext === ".html") {
        fs.readFile(path.join(root, "index.html"), (fallbackErr, fallback) => {
          if (fallbackErr) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not found");
            return;
          }
          res.writeHead(200, { "Content-Type": types[".html"], "Cache-Control": "no-store" });
          res.end(fallback);
        });
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const cacheControl = ext === ".js" || ext === ".css" || ext === ".html" ? "no-store" : "public, max-age=3600";
    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": cacheControl
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/social")) {
    sendJson(res, 410, { ok: false, error: "Multiplayer disattivato." });
    return;
  }

  if (url.pathname === "/api/chat") {
    if (req.method === "GET") {
      sendJson(res, 200, { ok: true, messages: publicChatMessages() });
      return;
    }
    if (req.method === "POST") {
      handleChatPost(req, res);
      return;
    }
    sendJson(res, 405, { ok: false, error: "Metodo non supportato." });
    return;
  }

  if (url.pathname === "/api/steam-prices") {
    const names = (url.searchParams.get("names") || "")
      .split("|")
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 80);
    Promise.all(names.map(fetchSteamPrice)).then((prices) => {
      sendJson(res, 200, { prices });
    });
    return;
  }

  serveStatic(url, res);
});

server.listen(port, () => {
  console.log(`Case Opener running at http://localhost:${port}`);
});
