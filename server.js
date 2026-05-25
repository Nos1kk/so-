const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const PORT = Number(process.env.PORT || process.env.AMVERA_PORT || process.env.APP_PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.SONA_DATA_DIR || path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const smsCodes = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'"
    ].join("; ")
  );
}

function sendJson(res, statusCode, payload) {
  setSecurityHeaders(res);
  res.writeHead(statusCode, { "Content-Type": MIME_TYPES[".json"] });
  res.end(JSON.stringify(payload));
}

function cacheControlFor(ext) {
  if (ext === ".html") return "no-store";
  if ([".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"].includes(ext)) {
    return "public, max-age=604800";
  }
  if ([".css", ".js"].includes(ext)) {
    return "public, max-age=3600, must-revalidate";
  }
  if (ext === ".json") return "no-cache";
  return "no-store";
}

function canGzip(req, contentType) {
  const acceptsGzip = String(req.headers["accept-encoding"] || "").includes("gzip");
  return acceptsGzip && /^(text\/|application\/(javascript|json)|image\/svg\+xml)/.test(contentType);
}

function readJsonBody(req, callback, options = {}) {
  let raw = "";
  const maxBytes = options.maxBytes || 10000;

  req.on("data", (chunk) => {
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBytes) {
      req.destroy();
    }
  });

  req.on("end", () => {
    try {
      callback(null, raw ? JSON.parse(raw) : {});
    } catch (error) {
      callback(error);
    }
  });
}

function readStore(callback) {
  fs.readFile(STORE_FILE, "utf8", (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        callback(null, null);
        return;
      }
      callback(error);
      return;
    }

    try {
      callback(null, JSON.parse(content));
    } catch (parseError) {
      callback(parseError);
    }
  });
}

function writeStore(state, callback) {
  fs.mkdir(DATA_DIR, { recursive: true }, (mkdirError) => {
    if (mkdirError) {
      callback(mkdirError);
      return;
    }

    fs.writeFile(STORE_FILE, JSON.stringify(state, null, 2), "utf8", callback);
  });
}

function handleStoreGet(req, res) {
  readStore((error, state) => {
    if (error) {
      sendJson(res, 500, { ok: false, error: "Store unavailable" });
      return;
    }

    sendJson(res, 200, { ok: true, state });
  });
}

function handleStorePut(req, res) {
  readJsonBody(req, (error, body) => {
    if (error || !body || typeof body.state !== "object") {
      sendJson(res, 400, { ok: false, error: "Invalid store payload" });
      return;
    }

    writeStore(body.state, (writeError) => {
      if (writeError) {
        sendJson(res, 500, { ok: false, error: "Store write failed" });
        return;
      }

      sendJson(res, 200, { ok: true, state: body.state });
    });
  }, { maxBytes: 12 * 1024 * 1024 });
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  return digits;
}

function createSmsCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function sendSms(phone, code, callback) {
  const apiId = process.env.SMSRU_API_ID;

  if (!apiId) {
    console.log(`[SONA demo SMS] +${phone}: ${code}`);
    callback(null, { demo: true });
    return;
  }

  const message = encodeURIComponent(`Код входа Soна: ${code}`);
  const url = `https://sms.ru/sms/send?api_id=${encodeURIComponent(apiId)}&to=${encodeURIComponent(phone)}&msg=${message}&json=1`;

  https.get(url, (smsRes) => {
    let raw = "";
    smsRes.on("data", (chunk) => {
      raw += chunk;
    });
    smsRes.on("end", () => {
      if (smsRes.statusCode >= 200 && smsRes.statusCode < 300) {
        callback(null, { demo: false, provider: "sms.ru" });
      } else {
        callback(new Error(raw || "SMS provider error"));
      }
    });
  }).on("error", callback);
}

function handleAuthRequest(req, res) {
  readJsonBody(req, (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }

    const phone = normalizePhone(body.phone);
    if (phone.length < 10 || phone.length > 15) {
      sendJson(res, 400, { ok: false, error: "Invalid phone" });
      return;
    }

    const code = createSmsCode();
    smsCodes.set(phone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    sendSms(phone, code, (smsError, result) => {
      if (smsError) {
        sendJson(res, 502, { ok: false, error: "SMS provider failed" });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        demo: Boolean(result.demo),
        devCode: result.demo ? code : undefined
      });
    });
  });
}

function handleAuthVerify(req, res) {
  readJsonBody(req, (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }

    const phone = normalizePhone(body.phone);
    const code = String(body.code || "").trim();
    const record = smsCodes.get(phone);

    if (!record || record.expiresAt < Date.now()) {
      smsCodes.delete(phone);
      sendJson(res, 400, { ok: false, error: "Code expired" });
      return;
    }

    if (record.code !== code) {
      sendJson(res, 400, { ok: false, error: "Wrong code" });
      return;
    }

    smsCodes.delete(phone);
    sendJson(res, 200, { ok: true, phone });
  });
}

function resolveSafePath(urlPath) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  } catch (error) {
    return null;
  }

  const cleanPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const requestedPath = path.normalize(path.join(PUBLIC_DIR, cleanPath));
  const relativePath = path.relative(PUBLIC_DIR, requestedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return requestedPath;
}

function createServer() {
  return http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/auth/request-sms") {
    handleAuthRequest(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/verify-sms") {
    handleAuthVerify(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/store") {
    handleStoreGet(req, res);
    return;
  }

  if (req.method === "PUT" && req.url === "/api/store") {
    handleStorePut(req, res);
    return;
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (req.url === "/health") {
    sendJson(res, 200, { status: "ok", service: "sona-marketplace" });
    return;
  }

  const filePath = resolveSafePath(req.url || "/");

  if (!filePath) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      const fallbackPath = path.join(PUBLIC_DIR, "index.html");

      fs.readFile(fallbackPath, (fallbackError, fallbackContent) => {
        if (fallbackError) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }

        setSecurityHeaders(res);
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[".html"],
          "Cache-Control": "no-store"
        });
        res.end(req.method === "HEAD" ? undefined : fallbackContent);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const cacheControl = cacheControlFor(ext);

    fs.readFile(filePath, (readError, content) => {
      if (readError) {
        sendJson(res, 500, { error: "Server error" });
        return;
      }

      setSecurityHeaders(res);
      const headers = {
        "Content-Type": contentType,
        "Cache-Control": cacheControl
      };

      if (req.method === "HEAD") {
        res.writeHead(200, headers);
        res.end();
        return;
      }

      if (content.length > 1024 && canGzip(req, contentType)) {
        zlib.gzip(content, { level: 6 }, (zipError, zipped) => {
          if (zipError) {
            res.writeHead(200, headers);
            res.end(content);
            return;
          }

          res.writeHead(200, {
            ...headers,
            "Content-Encoding": "gzip",
            "Vary": "Accept-Encoding"
          });
          res.end(zipped);
        });
        return;
      }

      res.writeHead(200, headers);
      res.end(content);
    });
  });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`SONA marketplace is running on http://${HOST}:${PORT}`);
  });

  function shutdown(signal) {
    console.log(`Received ${signal}. Closing SONA server...`);
    server.close(() => {
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = {
  createServer
};
