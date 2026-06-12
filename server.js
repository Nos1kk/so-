const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const net = require("net");
const tls = require("tls");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || process.env.AMVERA_PORT || process.env.APP_PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.SONA_DATA_DIR || path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const ACCOUNTS_DIR = path.join(DATA_DIR, "accounts");
const ACCOUNTS_FILE = path.join(ACCOUNTS_DIR, "accounts.json");
const ADMIN_EMAIL = normalizeEmail(process.env.SONA_ADMIN_EMAIL || "kcel046@gmail.com");
const emailCodes = new Map();
const authRateLimits = new Map();
const authBlockedClients = new Map();
const lastCodeHashes = new Map();
const CODE_TTL_MS = 10 * 60 * 1000;
const BLOCK_TTL_MS = 24 * 60 * 60 * 1000;

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

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separator = trimmed.indexOf("=");
    if (separator < 1) return;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) return;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

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
  setApiCorsHeaders(res);
  res.writeHead(statusCode, { "Content-Type": MIME_TYPES[".json"] });
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res) {
  sendJson(res, 405, { ok: false, error: "Method not allowed" });
}

function setApiCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(normalizeEmail(value));
}

function hashAuthCode(email, code) {
  const secret = process.env.SONA_AUTH_SECRET || process.env.SESSION_SECRET || "sona-local-auth-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${normalizeEmail(email)}:${String(code || "").trim()}`)
    .digest("hex");
}

function createAuthCode(email) {
  let code = "";
  let hash = "";
  const previousHash = lastCodeHashes.get(normalizeEmail(email));

  do {
    code = String(crypto.randomInt(100000, 1000000));
    hash = hashAuthCode(email, code);
  } while (hash === previousHash);

  lastCodeHashes.set(normalizeEmail(email), hash);
  return { code, hash };
}

function safeAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    name: account.name || "",
    role: account.role || "user",
    status: account.status || "active",
    createdAt: account.createdAt || "",
    lastLoginAt: account.lastLoginAt || ""
  };
}

function readAccounts(callback) {
  fs.readFile(ACCOUNTS_FILE, "utf8", (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        callback(null, { accounts: [] });
        return;
      }
      callback(error);
      return;
    }

    try {
      const parsed = JSON.parse(content);
      callback(null, { accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [] });
    } catch (parseError) {
      callback(parseError);
    }
  });
}

function writeAccounts(state, callback) {
  fs.mkdir(ACCOUNTS_DIR, { recursive: true }, (mkdirError) => {
    if (mkdirError) {
      callback(mkdirError);
      return;
    }

    const payload = {
      updatedAt: new Date().toISOString(),
      accounts: Array.isArray(state.accounts) ? state.accounts : []
    };
    fs.writeFile(ACCOUNTS_FILE, JSON.stringify(payload, null, 2), "utf8", callback);
  });
}

function accountIdFor(email) {
  return `USER-${crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 12)}`;
}

function upsertAccount(email, callback) {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();

  readAccounts((readError, state) => {
    if (readError) {
      callback(readError);
      return;
    }

    const existing = state.accounts.find((account) => account.email === normalizedEmail);
    const account = {
      ...(existing || {}),
      id: existing?.id || accountIdFor(normalizedEmail),
      email: normalizedEmail,
      role: normalizedEmail === ADMIN_EMAIL ? "admin" : (existing?.role || "user"),
      status: existing?.status || "active",
      createdAt: existing?.createdAt || now,
      lastLoginAt: now
    };

    if (account.status === "blocked") {
      callback(null, account, state, true);
      return;
    }

    state.accounts = [
      ...state.accounts.filter((item) => item.email !== normalizedEmail),
      account
    ].sort((a, b) => String(a.email).localeCompare(String(b.email)));

    writeAccounts(state, (writeError) => {
      callback(writeError, account, state, false);
    });
  });
}

function requestKey(req, email) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket.remoteAddress || "local";
  return `${ip}:${normalizeEmail(email)}`;
}

function deviceKey(req, email) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket.remoteAddress || "local";
  const userAgent = String(req.headers["user-agent"] || "unknown").slice(0, 180);
  const fingerprint = crypto.createHash("sha256").update(`${ip}:${userAgent}`).digest("hex").slice(0, 18);
  return `${normalizeEmail(email)}:${fingerprint}`;
}

function checkRateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();
  const current = authRateLimits.get(key);
  if (!current || current.resetAt < now) {
    authRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  current.count += 1;
  return current.count <= maxAttempts;
}

function blockClient(req, email) {
  authBlockedClients.set(deviceKey(req, email), {
    until: Date.now() + BLOCK_TTL_MS,
    email: normalizeEmail(email)
  });
}

function blockInfo(req, email) {
  const key = deviceKey(req, email);
  const block = authBlockedClients.get(key);
  if (!block) return null;

  if (block.until <= Date.now()) {
    authBlockedClients.delete(key);
    return null;
  }

  return block;
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

function smtpRead(socket) {
  return new Promise((resolve, reject) => {
    let raw = "";
    const onData = (chunk) => {
      raw += chunk.toString("utf8");
      const lines = raw.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || "";
      if (/^\d{3} /.test(last)) {
        cleanup();
        resolve(raw);
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function smtpCommand(socket, command, expectedCodes) {
  socket.write(`${command}\r\n`);
  const response = await smtpRead(socket);
  const code = Number(response.slice(0, 3));
  const expected = Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes];
  if (!expected.includes(code)) {
    throw new Error(`SMTP command failed: ${response.trim()}`);
  }
  return response;
}

function connectSmtp({ host, port, secure }) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });
    socket.setTimeout(12000);
    socket.once("connect", () => {
      if (!secure) resolve(socket);
    });
    socket.once("secureConnect", () => resolve(socket));
    socket.once("timeout", () => reject(new Error("SMTP connection timeout")));
    socket.once("error", reject);
  });
}

async function sendSmtpMail({ to, subject, text }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const secure = process.env.SMTP_SECURE !== "false";

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP is not configured");
  }

  const socket = await connectSmtp({ host, port, secure });
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text.replace(/^\./gm, "..")
  ].join("\r\n");

  try {
    await smtpRead(socket);
    await smtpCommand(socket, "EHLO sona.local", 250);
    await smtpCommand(socket, "AUTH LOGIN", 334);
    await smtpCommand(socket, Buffer.from(user).toString("base64"), 334);
    await smtpCommand(socket, Buffer.from(pass).toString("base64"), 235);
    await smtpCommand(socket, `MAIL FROM:<${from}>`, 250);
    await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await smtpCommand(socket, "DATA", 354);
    await smtpCommand(socket, `${message}\r\n.`, 250);
    await smtpCommand(socket, "QUIT", [221, 250]);
    return { provider: "smtp" };
  } finally {
    socket.destroy();
  }
}

function sendEmailCode(email, code, callback) {
  const subject = "Код входа SONA";
  const text = [
    `Ваш код входа в SONA: ${code}`,
    "",
    "Код действует 10 минут. Если вы не запрашивали вход, просто проигнорируйте это письмо."
  ].join("\n");

  sendSmtpMail({ to: email, subject, text })
    .then((result) => callback(null, result))
    .catch(callback);
}

function handleTestNotification(req, res) {
  readJsonBody(req, (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      sendJson(res, 400, { ok: false, error: "Invalid email" });
      return;
    }
    sendSmtpMail({
      to: email,
      subject: "Тестовое уведомление SONA",
      text: "Уведомления SONA на почту успешно подключены."
    })
      .then(() => sendJson(res, 200, { ok: true }))
      .catch(() => sendJson(res, 502, { ok: false, error: "Email provider failed" }));
  });
}

function handleAuthRequest(req, res) {
  readJsonBody(req, (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }

    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      sendJson(res, 400, { ok: false, error: "Invalid email" });
      return;
    }

    if (blockInfo(req, email)) {
      sendJson(res, 403, {
        ok: false,
        error: "Device blocked",
        message: "Доступ с этого устройства временно закрыт после неверных кодов."
      });
      return;
    }

    if (!checkRateLimit(requestKey(req, email), 5, 10 * 60 * 1000)) {
      sendJson(res, 429, { ok: false, error: "Too many code requests" });
      return;
    }

    const authCode = createAuthCode(email);
    emailCodes.set(email, {
      hash: authCode.hash,
      attempts: 0,
      expiresAt: Date.now() + CODE_TTL_MS
    });

    sendEmailCode(email, authCode.code, (mailError) => {
      if (mailError) {
        emailCodes.delete(email);
        sendJson(res, 502, { ok: false, error: "Email provider failed" });
        return;
      }

      sendJson(res, 200, {
        ok: true
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

    const email = normalizeEmail(body.email);
    const code = String(body.code || "").trim();
    const record = emailCodes.get(email);

    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      sendJson(res, 400, { ok: false, error: "Invalid auth payload" });
      return;
    }

    if (blockInfo(req, email)) {
      sendJson(res, 403, {
        ok: false,
        error: "Device blocked",
        message: "Доступ с этого устройства временно закрыт после неверных кодов."
      });
      return;
    }

    if (!record || record.expiresAt < Date.now()) {
      emailCodes.delete(email);
      sendJson(res, 400, { ok: false, error: "Code expired" });
      return;
    }

    if (record.hash !== hashAuthCode(email, code)) {
      record.attempts += 1;
      if (record.attempts >= 4) {
        emailCodes.delete(email);
        blockClient(req, email);
        sendJson(res, 403, {
          ok: false,
          error: "Device blocked",
          message: "Доступ с этого устройства закрыт после 4 неверных попыток."
        });
        return;
      }

      const payload = { ok: false, error: "Wrong code" };
      if (record.attempts === 3) {
        payload.warning = "Вы ввели код неверно 3 раза. Следующая ошибка может заблокировать этот IP для входа на сайт.";
      }
      sendJson(res, 400, payload);
      return;
    }

    emailCodes.delete(email);
    upsertAccount(email, (accountError, account, _state, blocked) => {
      if (accountError) {
        sendJson(res, 500, { ok: false, error: "Account store unavailable" });
        return;
      }

      if (blocked) {
        sendJson(res, 403, { ok: false, error: "Account blocked" });
        return;
      }

      sendJson(res, 200, { ok: true, account: safeAccount(account) });
    });
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
  if (req.method === "OPTIONS" && String(req.url || "").startsWith("/api/")) {
    setSecurityHeaders(res);
    setApiCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/request-email") {
    handleAuthRequest(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/verify-email") {
    handleAuthVerify(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/notifications/test") {
    handleTestNotification(req, res);
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
