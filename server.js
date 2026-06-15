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
const AUTH_SECRET = process.env.SONA_AUTH_SECRET || process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const emailCodes = new Map();
const authRateLimits = new Map();
const authBlockedClients = new Map();
const lastCodeHashes = new Map();
const authSessions = new Map();
const telegramLinkTokens = new Map();
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_BOT_USERNAME = String(process.env.TELEGRAM_BOT_USERNAME || "SonaShop_bot").replace(/^@/, "").trim();
const CODE_TTL_MS = 10 * 60 * 1000;
const BLOCK_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const TELEGRAM_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_COOKIE = "sona_session";
const securityCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of authRateLimits) if (value.resetAt <= now) authRateLimits.delete(key);
  for (const [key, value] of authBlockedClients) if (value.until <= now) authBlockedClients.delete(key);
  for (const [key, value] of authSessions) if (value.expiresAt <= now) authSessions.delete(key);
  for (const [key, value] of emailCodes) if (value.expiresAt <= now) emailCodes.delete(key);
  for (const [key, value] of telegramLinkTokens) if (value.expiresAt <= now) telegramLinkTokens.delete(key);
}, 10 * 60 * 1000);
securityCleanupTimer.unref();

if (process.env.NODE_ENV === "production" && (
  !(process.env.SONA_AUTH_SECRET || process.env.SESSION_SECRET)
  || String(process.env.SONA_AUTH_SECRET || process.env.SESSION_SECRET).length < 32
  || ["change-me", "sona-local-auth-secret"].includes(process.env.SONA_AUTH_SECRET || process.env.SESSION_SECRET)
)) {
  throw new Error("SONA_AUTH_SECRET must be set to a strong unique value in production");
}
if (process.env.NODE_ENV === "production" && process.env.SMTP_SECURE === "false") {
  throw new Error("SMTP_SECURE=false is not allowed in production");
}

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
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "media-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'"
    ].join("; ")
  );
}

function sendJson(res, statusCode, payload) {
  setSecurityHeaders(res);
  setApiCorsHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".json"],
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res) {
  sendJson(res, 405, { ok: false, error: "Method not allowed" });
}

function setApiCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function clientIp(req) {
  const trustProxy = process.env.TRUST_PROXY === "true";
  const forwarded = trustProxy ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
  return forwarded || req.socket.remoteAddress || "local";
}

function securityEvent(event, req, details = {}) {
  const record = {
    type: "security",
    event,
    at: new Date().toISOString(),
    ipHash: crypto.createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 12),
    method: req.method,
    path: String(req.url || "").split("?")[0].slice(0, 160),
    ...details
  };
  console.warn(JSON.stringify(record));
}

function requestOrigin(req) {
  const origin = String(req.headers.origin || "").trim();
  if (!origin) return "";
  try {
    return new URL(origin).origin;
  } catch {
    return "invalid";
  }
}

function isSameOriginRequest(req) {
  const origin = requestOrigin(req);
  if (!origin) return true;
  if (origin === "invalid") return false;
  try {
    const originUrl = new URL(origin);
    const trustProxy = process.env.TRUST_PROXY === "true";
    const host = String((trustProxy ? req.headers["x-forwarded-host"] : "") || req.headers.host || "").split(",")[0].trim();
    return ["http:", "https:"].includes(originUrl.protocol) && originUrl.host === host;
  } catch {
    return false;
  }
}

function parseCookies(req) {
  return String(req.headers.cookie || "").split(";").reduce((cookies, item) => {
    const separator = item.indexOf("=");
    if (separator < 1) return cookies;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    cookies[key] = value;
    return cookies;
  }, {});
}

function sessionFor(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? authSessions.get(token) : null;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    authSessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function createSession(req, res, account) {
  const token = crypto.randomBytes(32).toString("base64url");
  authSessions.set(token, {
    account: safeAccount(account),
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  const secure = process.env.NODE_ENV === "production"
    || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https"
    || Boolean(req.socket.encrypted);
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ].filter(Boolean).join("; "));
}

function clearSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) authSessions.delete(token);
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

function requireAdmin(req, res) {
  const session = sessionFor(req);
  if (session?.account?.role === "admin" && session.account.status !== "blocked") return session.account;
  securityEvent("admin_access_denied", req);
  sendJson(res, 403, { ok: false, error: "Administrator authorization required" });
  return null;
}

function requireAuth(req, res) {
  const session = sessionFor(req);
  if (session?.account && session.account.status !== "blocked") return session.account;
  securityEvent("authenticated_access_denied", req);
  sendJson(res, 401, { ok: false, error: "Authorization required" });
  return null;
}

function sanitizeJsonValue(value, depth = 0) {
  if (depth > 8) return null;
  if (typeof value === "string") {
    const limit = value.startsWith("data:") ? 20 * 1024 * 1024 : 4000;
    return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, limit);
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => sanitizeJsonValue(item, depth + 1));
  if (!value || typeof value !== "object") return null;

  const clean = {};
  Object.entries(value).slice(0, 500).forEach(([key, item]) => {
    if (["__proto__", "prototype", "constructor"].includes(key)) return;
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key)) return;
    clean[key] = sanitizeJsonValue(item, depth + 1);
  });
  return clean;
}

function publicStoreState(state, account = null) {
  const personal = account ? state?.customerStates?.[account.id] || {} : {};
  const email = normalizeEmail(account?.email);
  const ownOrders = account
    ? (state?.orders || []).filter((order) => normalizeEmail(order?.profile?.email) === email)
    : [];
  const ownOrderIds = new Set(ownOrders.map((order) => order.id));
  const ownReviews = account
    ? (state?.reviews || []).filter((review) => ownOrderIds.has(review.orderId))
    : [];
  const publishedReviews = (state?.reviews || []).filter((review) => (review.status || "published") === "published");
  const reviewMap = new Map(publishedReviews.map((review) => [review.id, review]));
  ownReviews.forEach((review) => reviewMap.set(review.id, review));
  const ownSupport = account
    ? (state?.supportMessages || []).filter((message) => (
      normalizeEmail(message.email) === email || message.accountKey === `user:${email}`
    ))
    : [];

  const hiddenOverrideIds = Object.entries(state?.productOverrides || {})
    .filter(([, product]) => product?.hidden || product?.status === "hidden" || product?.status === "draft")
    .map(([id]) => id);
  const publicOverrides = Object.fromEntries(Object.entries(state?.productOverrides || {}).filter(([, product]) => (
    !product?.hidden && product?.status !== "hidden" && product?.status !== "draft"
  )));

  return {
    cart: personal.cart || {},
    favorites: personal.favorites || [],
    viewedProductIds: personal.viewedProductIds || [],
    profile: account ? {
      ...(personal.profile || {}),
      isActive: true,
      id: account.id,
      email: account.email,
      role: account.role
    } : {},
    orders: ownOrders,
    reviews: [...reviewMap.values()],
    users: [],
    accountSessions: personal.accountSessions || [],
    productOverrides: publicOverrides,
    customProducts: (state?.customProducts || []).filter((product) => (
      !product?.hidden && product?.status !== "hidden" && product?.status !== "draft"
    )),
    deletedProducts: [...new Set([...(state?.deletedProducts || []), ...hiddenOverrideIds])],
    supportMessages: ownSupport,
    admin: {},
    shopSettings: state?.shopSettings || {},
    customAds: (state?.customAds || []).filter((ad) => ad?.active !== false)
  };
}

function mergeNewRows(existing, incoming, predicate) {
  const rows = Array.isArray(existing) ? existing.slice() : [];
  const ids = new Set(rows.map((item) => item?.id).filter(Boolean));
  (Array.isArray(incoming) ? incoming : []).slice(0, 20).forEach((item) => {
    const clean = sanitizeJsonValue(item);
    if (!clean?.id || ids.has(clean.id) || !predicate(clean)) return;
    rows.push(clean);
    ids.add(clean.id);
  });
  return rows;
}

function mergeCustomerStoreState(current, incoming, account) {
  const email = normalizeEmail(account.email);
  const personal = sanitizeJsonValue({
    cart: incoming.cart || {},
    favorites: incoming.favorites || [],
    viewedProductIds: incoming.viewedProductIds || [],
    accountSessions: incoming.accountSessions || [],
    profile: {
      name: incoming.profile?.name || "",
      phone: incoming.profile?.phone || "",
      address: incoming.profile?.address || "",
      notifications: incoming.profile?.notifications || {}
    }
  });
  const incomingOrders = (Array.isArray(incoming.orders) ? incoming.orders : []).map((order) => ({
    ...order,
    status: "new",
    profile: {
      ...(order?.profile || {}),
      userId: account.id,
      email: account.email,
      role: "user"
    }
  }));
  const existingOrders = current.orders || [];
  const orders = mergeNewRows(existingOrders, incomingOrders, (order) => normalizeEmail(order?.profile?.email) === email);
  const reviewableOrderIds = new Set(orders.filter((order) => (
    normalizeEmail(order?.profile?.email) === email
    && ["delivered", "completed", "received"].includes(order.status)
  )).map((order) => order.id));
  const reviews = mergeNewRows(current.reviews, incoming.reviews, (review) => reviewableOrderIds.has(review.orderId));
  const incomingSupport = (Array.isArray(incoming.supportMessages) ? incoming.supportMessages : []).map((message) => {
    const attachments = (Array.isArray(message?.attachments) ? message.attachments : [])
      .slice(0, 3)
      .filter((attachment) => {
        const dataUrl = String(attachment?.dataUrl || "");
        const type = String(attachment?.type || "").toLowerCase();
        const acceptedType = /^(?:image\/(?:png|jpeg|webp|gif)|application\/(?:pdf|json|zip)|text\/(?:plain|csv)|video\/(?:mp4|webm)|audio\/(?:mpeg|wav|ogg))$/.test(type);
        return acceptedType && dataUrl.length <= 8 * 1024 * 1024 && dataUrl.toLowerCase().startsWith(`data:${type};`);
      });
    return {
      ...message,
      text: String(message?.text || "").slice(0, 1200),
      attachments,
      role: "user",
      email: account.email,
      accountKey: `user:${email}`
    };
  });
  const supportMessages = mergeNewRows(current.supportMessages, incomingSupport, (message) => (
    normalizeEmail(message.email) === email || message.accountKey === `user:${email}`
  ));

  return {
    ...current,
    customerStates: {
      ...(current.customerStates || {}),
      [account.id]: personal
    },
    orders,
    reviews,
    supportMessages
  };
}

function cacheControlFor(ext) {
  if ([".html", ".css", ".js", ".json"].includes(ext)) {
    return "no-store, no-cache, must-revalidate, proxy-revalidate";
  }
  if ([".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"].includes(ext)) {
    return "public, max-age=604800";
  }
  return "no-store";
}

function canGzip(req, contentType) {
  const acceptsGzip = String(req.headers["accept-encoding"] || "").includes("gzip");
  return acceptsGzip && /^(text\/|application\/(javascript|json)|image\/svg\+xml)/.test(contentType);
}

function readJsonBody(req, callback, options = {}) {
  let raw = "";
  let tooLarge = false;
  const maxBytes = options.maxBytes || 10000;
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    callback(new Error("JSON content type required"));
    req.resume();
    return;
  }
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > maxBytes) {
    callback(new Error("Payload too large"));
    req.resume();
    return;
  }

  req.on("data", (chunk) => {
    if (tooLarge) return;
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBytes) {
      tooLarge = true;
      raw = "";
    }
  });

  req.on("end", () => {
    if (tooLarge) {
      callback(new Error("Payload too large"));
      return;
    }
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
  return crypto
    .createHmac("sha256", AUTH_SECRET)
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
    lastLoginAt: account.lastLoginAt || "",
    telegramConnected: Boolean(account.telegramChatId)
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
    writeJsonAtomic(ACCOUNTS_FILE, payload, callback);
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

function handleAccountsUpdate(req, res) {
  if (!requireAdmin(req, res)) return;
  readJsonBody(req, (bodyError, body) => {
    const identifier = String(body?.identifier || "").trim().toLowerCase();
    if (bodyError || !identifier) {
      sendJson(res, 400, { ok: false, error: "Invalid account payload" });
      return;
    }
    readAccounts((readError, state) => {
      if (readError) {
        sendJson(res, 500, { ok: false, error: "Accounts unavailable" });
        return;
      }
      let found = false;
      state.accounts = state.accounts.map((account) => {
        if (![account.id, account.email].map((value) => String(value || "").toLowerCase()).includes(identifier)) return account;
        found = true;
        return {
          ...account,
          role: ["admin", "user"].includes(body.role) ? body.role : account.role,
          status: ["active", "blocked"].includes(body.status) ? body.status : account.status
        };
      });
      if (!found) {
        sendJson(res, 404, { ok: false, error: "Account not found" });
        return;
      }
      writeAccounts(state, (writeError) => {
        if (writeError) {
          sendJson(res, 500, { ok: false, error: "Account update failed" });
          return;
        }
        sendJson(res, 200, { ok: true });
      });
    });
  });
}

function requestKey(req, email) {
  return `${clientIp(req)}:${normalizeEmail(email)}`;
}

function deviceKey(req, email) {
  const ip = clientIp(req);
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

    writeJsonAtomic(STORE_FILE, state, callback);
  });
}

function writeJsonAtomic(filePath, payload, callback) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFile(tempPath, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 }, (writeError) => {
    if (writeError) {
      callback(writeError);
      return;
    }
    fs.rename(tempPath, filePath, (renameError) => {
      if (!renameError) {
        callback(null);
        return;
      }
      fs.unlink(tempPath, () => callback(renameError));
    });
  });
}

function handleStoreGet(req, res) {
  readStore((error, state) => {
    if (error) {
      sendJson(res, 500, { ok: false, error: "Store unavailable" });
      return;
    }

    const session = sessionFor(req);
    if (session?.account?.role !== "admin") {
      sendJson(res, 200, { ok: true, state: publicStoreState(state || {}, session?.account || null) });
      return;
    }

    readAccounts((accountsError, accountsState) => {
      const accounts = accountsError ? [] : accountsState.accounts.map(safeAccount);
      sendJson(res, 200, { ok: true, state: { ...state, users: accounts } });
    });
  });
}

function handleStorePut(req, res) {
  const account = requireAuth(req, res);
  if (!account) return;
  readJsonBody(req, (error, body) => {
    if (error || !body || typeof body.state !== "object" || Array.isArray(body.state)) {
      sendJson(res, 400, { ok: false, error: "Invalid store payload" });
      return;
    }

    readStore((readError, current) => {
      if (readError) {
        sendJson(res, 500, { ok: false, error: "Store unavailable" });
        return;
      }
      const next = account.role === "admin"
        ? sanitizeJsonValue(body.state)
        : mergeCustomerStoreState(current || {}, body.state, account);
      writeStore(next, (writeError) => {
        if (writeError) {
          sendJson(res, 500, { ok: false, error: "Store write failed" });
          return;
        }
        sendJson(res, 200, { ok: true });
      });
    });
  }, { maxBytes: 40 * 1024 * 1024 });
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

async function telegramApi(method, payload = {}) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("Telegram bot is not configured");
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(method === "getUpdates" ? 35000 : 12000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Telegram API ${method} failed`);
  return result.result;
}

function sendTelegramMessage(chatId, text) {
  return telegramApi("sendMessage", {
    chat_id: String(chatId),
    text: String(text),
    disable_web_page_preview: true
  });
}

function sendTelegramCode(account, code) {
  if (!account?.telegramChatId) return Promise.reject(new Error("Telegram is not connected"));
  return sendTelegramMessage(
    account.telegramChatId,
    `Код входа в SONA: ${code}\n\nКод действует 10 минут. Никому его не сообщайте.`
  );
}

function accountByEmail(email) {
  return new Promise((resolve, reject) => {
    readAccounts((error, state) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(state.accounts.find((account) => account.email === normalizeEmail(email)) || null);
    });
  });
}

function updateTelegramAccount(email, details) {
  return new Promise((resolve, reject) => {
    readAccounts((readError, state) => {
      if (readError) {
        reject(readError);
        return;
      }
      const account = state.accounts.find((item) => item.email === normalizeEmail(email));
      if (!account) {
        reject(new Error("Account not found"));
        return;
      }
      Object.assign(account, details);
      writeAccounts(state, (writeError) => {
        if (writeError) reject(writeError);
        else resolve(account);
      });
    });
  });
}

async function processTelegramUpdate(update) {
  const message = update?.message;
  const match = String(message?.text || "").trim().match(/^\/start\s+([a-zA-Z0-9_-]{20,80})$/);
  if (!match || !message?.chat?.id) return;
  const token = match[1];
  const link = telegramLinkTokens.get(token);
  if (!link || link.expiresAt <= Date.now()) {
    telegramLinkTokens.delete(token);
    await sendTelegramMessage(message.chat.id, "Ссылка устарела. Создайте новую ссылку в настройках профиля SONA.");
    return;
  }
  await updateTelegramAccount(link.email, {
    telegramChatId: String(message.chat.id),
    telegramUsername: String(message.from?.username || "").slice(0, 80),
    telegramConnectedAt: new Date().toISOString()
  });
  telegramLinkTokens.delete(token);
  await sendTelegramMessage(message.chat.id, "Telegram подключён к аккаунту SONA. Теперь сюда можно получать коды входа и уведомления.");
}

let telegramPollingStarted = false;
function startTelegramPolling() {
  if (!TELEGRAM_BOT_TOKEN || telegramPollingStarted) return;
  telegramPollingStarted = true;
  let offset = 0;
  const poll = async () => {
    try {
      const updates = await telegramApi("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message"]
      });
      for (const update of updates) {
        offset = Math.max(offset, Number(update.update_id) + 1);
        await processTelegramUpdate(update);
      }
      setImmediate(poll);
    } catch (error) {
      console.warn(JSON.stringify({ type: "integration", event: "telegram_poll_failed", at: new Date().toISOString() }));
      setTimeout(poll, 5000).unref();
    }
  };
  telegramApi("deleteWebhook", { drop_pending_updates: false })
    .catch(() => null)
    .finally(poll);
}

function handleTelegramLink(req, res) {
  const account = requireAuth(req, res);
  if (!account) return;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_BOT_USERNAME) {
    sendJson(res, 503, { ok: false, error: "Telegram bot is not configured" });
    return;
  }
  const token = crypto.randomBytes(24).toString("base64url");
  telegramLinkTokens.set(token, {
    email: account.email,
    expiresAt: Date.now() + TELEGRAM_LINK_TTL_MS
  });
  sendJson(res, 200, {
    ok: true,
    url: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`,
    expiresIn: Math.floor(TELEGRAM_LINK_TTL_MS / 1000)
  });
}

function handleTelegramStatus(req, res) {
  const account = requireAuth(req, res);
  if (!account) return;
  accountByEmail(account.email)
    .then((stored) => sendJson(res, 200, {
      ok: true,
      configured: Boolean(TELEGRAM_BOT_TOKEN),
      connected: Boolean(stored?.telegramChatId),
      username: stored?.telegramUsername ? `@${stored.telegramUsername}` : ""
    }))
    .catch(() => sendJson(res, 500, { ok: false, error: "Accounts unavailable" }));
}

function handleTelegramUnlink(req, res) {
  const account = requireAuth(req, res);
  if (!account) return;
  updateTelegramAccount(account.email, {
    telegramChatId: "",
    telegramUsername: "",
    telegramConnectedAt: ""
  })
    .then(() => sendJson(res, 200, { ok: true }))
    .catch(() => sendJson(res, 500, { ok: false, error: "Account update failed" }));
}

function handleTestNotification(req, res) {
  const account = requireAuth(req, res);
  if (!account) return;
  readJsonBody(req, (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
    accountByEmail(account.email).then(async (stored) => {
      const jobs = [];
      const requested = [];
      if (body.email !== false) {
        requested.push("email");
        jobs.push(sendSmtpMail({
          to: account.email,
          subject: "Тестовое уведомление SONA",
          text: "Уведомления SONA на почту успешно подключены."
        }));
      }
      if (body.telegram === true && stored?.telegramChatId) {
        requested.push("telegram");
        jobs.push(sendTelegramMessage(stored.telegramChatId, "Тестовое уведомление SONA. Telegram успешно подключён."));
      }
      const results = await Promise.allSettled(jobs);
      const sent = requested.filter((_channel, index) => results[index]?.status === "fulfilled");
      sendJson(res, sent.length ? 200 : 502, { ok: sent.length > 0, sent });
    }).catch(() => sendJson(res, 500, { ok: false, error: "Accounts unavailable" }));
  });
}

function handleAuthRequest(req, res) {
  readJsonBody(req, (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }

    const email = normalizeEmail(body.email);
    const channel = body.channel === "telegram" ? "telegram" : "email";
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

    if (!checkRateLimit(`auth-ip:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
      securityEvent("auth_request_rate_limited", req);
      sendJson(res, 429, { ok: false, error: "Too many authentication requests" });
      return;
    }

    if (!checkRateLimit(requestKey(req, email), 5, 10 * 60 * 1000)) {
      securityEvent("email_code_rate_limited", req, {
        emailHash: crypto.createHash("sha256").update(email).digest("hex").slice(0, 12)
      });
      sendJson(res, 429, { ok: false, error: "Too many code requests" });
      return;
    }

    const authCode = createAuthCode(email);
    emailCodes.set(email, {
      hash: authCode.hash,
      attempts: 0,
      expiresAt: Date.now() + CODE_TTL_MS
    });

    if (channel === "telegram") {
      accountByEmail(email)
        .then((account) => sendTelegramCode(account, authCode.code))
        .then(() => sendJson(res, 200, { ok: true, channel: "telegram" }))
        .catch(() => {
          emailCodes.delete(email);
          sendJson(res, 409, {
            ok: false,
            error: "Telegram is not connected",
            message: "Сначала подключите @SonaShop_bot в настройках профиля."
          });
        });
      return;
    }

    sendEmailCode(email, authCode.code, (mailError) => {
      if (mailError) {
        emailCodes.delete(email);
        sendJson(res, 502, { ok: false, error: "Email provider failed" });
        return;
      }
      sendJson(res, 200, { ok: true, channel: "email" });
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
      securityEvent("blocked_login_attempt", req, { emailHash: crypto.createHash("sha256").update(email).digest("hex").slice(0, 12) });
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
      securityEvent("invalid_login_code", req, {
        emailHash: crypto.createHash("sha256").update(email).digest("hex").slice(0, 12),
        attempts: record.attempts
      });
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

      createSession(req, res, account);
      sendJson(res, 200, { ok: true, account: safeAccount(account) });
    });
  });
}

function handleAuthLogout(req, res) {
  clearSession(req, res);
  sendJson(res, 200, { ok: true });
}

function handleAuthSession(req, res) {
  const session = sessionFor(req);
  sendJson(res, 200, { ok: true, account: session?.account || null });
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
  const isApiRequest = String(req.url || "").startsWith("/api/");
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (isApiRequest && isMutation && !isSameOriginRequest(req)) {
    securityEvent("cross_origin_api_request_blocked", req, { origin: requestOrigin(req).slice(0, 160) });
    sendJson(res, 403, { ok: false, error: "Cross-origin request blocked" });
    return;
  }

  if (req.method === "OPTIONS" && String(req.url || "").startsWith("/api/")) {
    if (!isSameOriginRequest(req)) {
      securityEvent("cross_origin_preflight_blocked", req, { origin: requestOrigin(req).slice(0, 160) });
      sendJson(res, 403, { ok: false, error: "Cross-origin request blocked" });
      return;
    }
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

  if (req.method === "POST" && req.url === "/api/auth/logout") {
    handleAuthLogout(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/auth/session") {
    handleAuthSession(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/telegram/link") {
    handleTelegramLink(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/telegram/status") {
    handleTelegramStatus(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/telegram/unlink") {
    handleTelegramUnlink(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/notifications/test") {
    handleTestNotification(req, res);
    return;
  }

  if (req.method === "PUT" && req.url === "/api/accounts") {
    handleAccountsUpdate(req, res);
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

  if (isApiRequest) {
    sendJson(res, 404, { ok: false, error: "API endpoint not found" });
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
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
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
      if ([".html", ".css", ".js", ".json"].includes(ext)) {
        headers.Pragma = "no-cache";
        headers.Expires = "0";
      }

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
    startTelegramPolling();
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
