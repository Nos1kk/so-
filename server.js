const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const net = require("net");
const tls = require("tls");
const { spawn } = require("child_process");
const { DomainStore, AnalyticsJournal, MediaStore, MailOutbox } = require("./lib/infrastructure");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || process.env.AMVERA_PORT || process.env.APP_PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const PERSISTENT_DATA_DIR = process.platform !== "win32" && fs.existsSync("/data") ? "/data" : "";
const DATA_DIR = process.env.SONA_DATA_DIR || PERSISTENT_DATA_DIR || path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const STORE_BACKUP_FILE = path.join(BACKUP_DIR, "store.latest.json");
const ACCOUNTS_BACKUP_FILE = path.join(BACKUP_DIR, "accounts.latest.json");
const STORE_BACKUP_SCHEMA = "sona-admin-backup/v1";
const ACCOUNTS_DIR = path.join(DATA_DIR, "accounts");
const ACCOUNTS_FILE = path.join(ACCOUNTS_DIR, "accounts.json");
const SESSIONS_FILE = path.join(ACCOUNTS_DIR, "sessions.json");
const ADMIN_EMAIL = envFileValue("SONA_ADMIN_EMAIL", process.env.SONA_ADMIN_EMAIL || "kcel046@gmail.com").trim().toLowerCase();
const SUPPORT_EMAIL = envFileValue("SONA_SUPPORT_EMAIL", process.env.SONA_SUPPORT_EMAIL || ADMIN_EMAIL || "sonahome@yandex.ru").trim().toLowerCase();
const AUTH_SECRET = resolveAuthSecret();
const emailCodes = new Map();
const telegramLoginCodes = new Map();
const authRateLimits = new Map();
const authBlockedClients = new Map();
const lastCodeHashes = new Map();
const authSessions = new Map();
const authActionTokens = new Map();
const telegramLinkTokens = new Map();
let storeCache = null;
let accountsCache = null;
let storeBackupTimer = null;
let pendingStoreBackup = null;
let accountsBackupTimer = null;
let pendingAccountsBackup = null;
const domainStore = new DomainStore({ dataDir: DATA_DIR, legacyFile: STORE_FILE });
const analyticsJournal = new AnalyticsJournal(DATA_DIR);
const mediaStore = new MediaStore(DATA_DIR);
const storeEventClients = new Set();
const staticAssetCache = new Map();
let mailOutbox = null;
const CODE_TTL_MS = 10 * 60 * 1000;
const BLOCK_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_IDLE_TTL_MS = 5 * 24 * 60 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const AUTH_ACTION_TTL_MS = 15 * 60 * 1000;
const TELEGRAM_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_COOKIE = "sona_session";
const PASSWORD_SCRYPT = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 });
const DUMMY_PASSWORD_SALT = Buffer.alloc(16, 0x53);
const DUMMY_PASSWORD_HASH = crypto.scryptSync("sona-invalid-password", DUMMY_PASSWORD_SALT, PASSWORD_SCRYPT.keylen, PASSWORD_SCRYPT);
const TEST_ADMIN_PASSWORD = process.env.NODE_ENV === "test" ? String(process.env.SONA_TEST_ADMIN_PASSWORD || "") : "";
const ADMIN_PASSWORD_VERSION = TEST_ADMIN_PASSWORD ? "admin-password-test-v1" : "admin-password-20260621-v1";
const ADMIN_PASSWORD_HASH = TEST_ADMIN_PASSWORD ? (() => {
  const salt = crypto.createHash("sha256").update("sona-test-admin").digest().subarray(0, 16);
  const derived = crypto.scryptSync(TEST_ADMIN_PASSWORD, salt, PASSWORD_SCRYPT.keylen, PASSWORD_SCRYPT);
  return ["scrypt", PASSWORD_SCRYPT.N, PASSWORD_SCRYPT.r, PASSWORD_SCRYPT.p, salt.toString("base64url"), derived.toString("base64url")].join("$");
})() : "scrypt$16384$8$1$rZv_NWOYY4yBvVnzoPJ-Ug$pCyzvs15cGESnnsRL47UHHg13E8DjQJ_e9QybbaxIJpt9lL4OAOeLxV80v4Xs_u3Qqb3RpqnwRRgtF85rZz4nw";
const adminCredentialsChanged = ensureAdminCredentials();
loadPersistentSessions();
if (adminCredentialsChanged) revokeSessionsForEmail(ADMIN_EMAIL);
const securityCleanupTimer = setInterval(() => {
  const now = Date.now();
  let sessionsChanged = false;
  for (const [key, value] of authRateLimits) if (value.resetAt <= now) authRateLimits.delete(key);
  for (const [key, value] of authBlockedClients) if (value.until <= now) authBlockedClients.delete(key);
  for (const [key, value] of authSessions) {
    if (value.expiresAt <= now) {
      authSessions.delete(key);
      sessionsChanged = true;
    }
  }
  for (const [key, value] of emailCodes) if (value.expiresAt <= now) emailCodes.delete(key);
  for (const [key, value] of telegramLoginCodes) if (value.expiresAt <= now) telegramLoginCodes.delete(key);
  for (const [key, value] of authActionTokens) if (value.expiresAt <= now) authActionTokens.delete(key);
  for (const [key, value] of telegramLinkTokens) if (value.expiresAt <= now) telegramLinkTokens.delete(key);
  if (sessionsChanged) persistSessions();
}, 10 * 60 * 1000);
securityCleanupTimer.unref();

if (process.env.NODE_ENV === "production" && !isStrongAuthSecret(AUTH_SECRET)) {
  throw new Error("SONA_AUTH_SECRET must be set to a strong unique value in production");
}
if (process.env.NODE_ENV === "production" && process.env.SMTP_SECURE === "false") {
  throw new Error("SMTP_SECURE=false is not allowed in production");
}
mailOutbox = new MailOutbox(DATA_DIR, sendSmtpMail);
domainStore.on("change", broadcastStoreChange);

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
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg"
};

function loadEnvFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separator = trimmed.indexOf("=");
    if (separator < 1) return;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key || (!options.override && process.env[key] !== undefined)) return;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

function refreshRuntimeEnv() {
  loadEnvFile(path.join(__dirname, ".env"), { override: true });
}

function telegramBotToken() {
  refreshRuntimeEnv();
  return String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
}

function telegramBotUsername() {
  refreshRuntimeEnv();
  return String(process.env.TELEGRAM_BOT_USERNAME || "SonaShop_bot").replace(/^@/, "").trim();
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

function sendJson(res, statusCode, payload, options = {}) {
  setSecurityHeaders(res);
  setApiCorsHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".json"],
    "Cache-Control": options.cacheControl || "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    ...(options.headers || {})
  });
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res) {
  sendJson(res, 405, { ok: false, error: "Method not allowed" });
}

function setApiCorsHeaders(res) {
  const origin = requestOrigin(res.sonaRequest || { headers: {} });
  if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, PATCH, OPTIONS");
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
    if (!["http:", "https:"].includes(originUrl.protocol)) return false;
    if (originUrl.host === host) return true;
    const requestHostname = host.replace(/^\[/, "").replace(/\].*$/, "").split(":")[0];
    return ["127.0.0.1", "localhost"].includes(originUrl.hostname)
      && ["127.0.0.1", "localhost"].includes(requestHostname);
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

function sessionTokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function isStrongAuthSecret(value) {
  const secret = String(value || "").trim();
  return secret.length >= 32 && !/^(?:change-me|sona-local-auth-secret|replace-with-)/i.test(secret);
}

function resolveAuthSecret() {
  const configured = String(process.env.SONA_AUTH_SECRET || process.env.SESSION_SECRET || "").trim();
  if (isStrongAuthSecret(configured)) return configured;

  const secretFile = path.join(ACCOUNTS_DIR, "auth-secret");
  try {
    fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
    if (fs.existsSync(secretFile)) {
      const stored = fs.readFileSync(secretFile, "utf8").trim();
      if (isStrongAuthSecret(stored)) return stored;
    }

    const generated = crypto.randomBytes(48).toString("base64url");
    try {
      fs.writeFileSync(secretFile, generated, { encoding: "utf8", mode: 0o600, flag: "wx" });
      return generated;
    } catch (writeError) {
      if (writeError.code !== "EEXIST") throw writeError;
      const stored = fs.readFileSync(secretFile, "utf8").trim();
      if (isStrongAuthSecret(stored)) return stored;
      throw writeError;
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Unable to initialize persistent authentication secret: ${error.message}`);
    }
    return crypto.randomBytes(48).toString("base64url");
  }
}

function ensureAdminCredentials() {
  try {
    fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
    let state = { accounts: [] };
    try {
      const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
      state.accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
    } catch (readError) {
      if (readError.code !== "ENOENT") throw readError;
    }

    const now = new Date().toISOString();
    const existing = state.accounts.find((account) => normalizeEmail(account.email) === ADMIN_EMAIL);
    if (existing?.adminCredentialVersion === ADMIN_PASSWORD_VERSION && existing.passwordHash) {
      if (existing.role !== "admin") {
        existing.role = "admin";
      } else {
        return false;
      }
    }

    const account = {
      ...(existing || {}),
      id: existing?.id || accountIdFor(ADMIN_EMAIL),
      email: ADMIN_EMAIL,
      name: existing?.name || "Администратор SONA",
      role: "admin",
      status: "active",
      createdAt: existing?.createdAt || now,
      lastLoginAt: existing?.lastLoginAt || "",
      passwordHash: ADMIN_PASSWORD_HASH,
      passwordChangedAt: now,
      adminCredentialVersion: ADMIN_PASSWORD_VERSION
    };
    state.accounts = [
      ...state.accounts.filter((item) => normalizeEmail(item.email) !== ADMIN_EMAIL),
      account
    ].sort((a, b) => String(a.email).localeCompare(String(b.email)));

    const tempPath = `${ACCOUNTS_FILE}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify({ updatedAt: now, accounts: state.accounts }, null, 2), {
      encoding: "utf8",
      mode: 0o600
    });
    fs.renameSync(tempPath, ACCOUNTS_FILE);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Unable to initialize administrator account: ${error.message}`);
    }
    console.warn("Unable to initialize administrator account:", error.message);
    return false;
  }
}

function loadPersistentSessions() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    const now = Date.now();
    for (const record of Array.isArray(parsed.sessions) ? parsed.sessions : []) {
      if (!/^[a-f0-9]{64}$/.test(String(record.tokenHash || ""))) continue;
      if (!record.account?.id || !record.account?.email || Number(record.expiresAt) <= now) continue;
      authSessions.set(record.tokenHash, {
        account: safeAccount(record.account),
        createdAt: Number(record.createdAt) || now,
        lastSeenAt: Number(record.lastSeenAt) || now,
        lastPersistedAt: Number(record.lastSeenAt) || now,
        expiresAt: Number(record.expiresAt)
      });
    }
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("Unable to load auth sessions:", error.message);
  }
}

function persistSessions() {
  try {
    fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
    const tempPath = `${SESSIONS_FILE}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    const sessions = Array.from(authSessions, ([tokenHash, session]) => ({
      tokenHash,
      account: safeAccount(session.account),
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt
    }));
    fs.writeFileSync(tempPath, JSON.stringify({ updatedAt: new Date().toISOString(), sessions }, null, 2), {
      encoding: "utf8",
      mode: 0o600
    });
    fs.renameSync(tempPath, SESSIONS_FILE);
  } catch (error) {
    console.warn("Unable to persist auth sessions:", error.message);
  }
}

function setSessionCookie(req, res, token) {
  const requestHost = String(req.headers.host || "").split(":")[0];
  const isLocalhost = ["127.0.0.1", "localhost"].includes(requestHost);
  const secure = !isLocalhost && (process.env.NODE_ENV === "production"
    || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https"
    || Boolean(req.socket.encrypted));
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
    `Max-Age=${Math.floor(SESSION_IDLE_TTL_MS / 1000)}`
  ].filter(Boolean).join("; "));
}

function sessionFor(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const tokenHash = token ? sessionTokenHash(token) : "";
  const session = tokenHash ? authSessions.get(tokenHash) : null;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    authSessions.delete(tokenHash);
    persistSessions();
    return null;
  }
  const now = Date.now();
  session.lastSeenAt = now;
  session.expiresAt = now + SESSION_IDLE_TTL_MS;
  if (res && token) setSessionCookie(req, res, token);
  if (now - session.lastPersistedAt >= SESSION_TOUCH_INTERVAL_MS) {
    session.lastPersistedAt = now;
    persistSessions();
  }
  return session;
}

function createSession(req, res, account) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  authSessions.set(sessionTokenHash(token), {
    account: safeAccount(account),
    createdAt: now,
    lastSeenAt: now,
    lastPersistedAt: now,
    expiresAt: now + SESSION_IDLE_TTL_MS
  });
  persistSessions();
  setSessionCookie(req, res, token);
}

function clearSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) {
    authSessions.delete(sessionTokenHash(token));
    persistSessions();
  }
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

function revokeSessionsForEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  let changed = false;
  for (const [tokenHash, session] of authSessions) {
    if (normalizeEmail(session.account?.email) !== normalizedEmail) continue;
    authSessions.delete(tokenHash);
    changed = true;
  }
  if (changed) persistSessions();
}

function requireAdmin(req, res) {
  const session = sessionFor(req, res);
  if (session?.account?.role === "admin" && session.account.status !== "blocked") return session.account;
  securityEvent("admin_access_denied", req);
  sendJson(res, 403, { ok: false, error: "Administrator authorization required" });
  return null;
}

function requireAuth(req, res) {
  const session = sessionFor(req, res);
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
    customAds: (state?.customAds || []).filter((ad) => ad?.active !== false),
    homeCollections: {
      hits: Array.isArray(state?.homeCollections?.hits) ? state.homeCollections.hits : [],
      new: Array.isArray(state?.homeCollections?.new) ? state.homeCollections.new : []
    }
  };
}

function envFileValue(key, fallback = "") {
  const filePath = path.join(__dirname, ".env");
  if (!fs.existsSync(filePath)) return String(fallback || "");
  let value = "";
  fs.readFileSync(filePath, "utf8").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator < 1 || trimmed.slice(0, separator).trim() !== key) return;
    let next = trimmed.slice(separator + 1).trim();
    if ((next.startsWith('"') && next.endsWith('"')) || (next.startsWith("'") && next.endsWith("'"))) {
      next = next.slice(1, -1);
    }
    value = next;
  });
  return String(value || fallback || "");
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

function dataUrlPayloadBytes(dataUrl) {
  const raw = String(dataUrl || "");
  const comma = raw.indexOf(",");
  if (comma < 0) return 0;
  const payload = raw.slice(comma + 1);
  if (raw.slice(0, comma).toLowerCase().includes(";base64")) {
    return Math.floor(payload.replace(/=+$/, "").length * 0.75);
  }
  try {
    return Buffer.byteLength(decodeURIComponent(payload), "utf8");
  } catch (error) {
    return 0;
  }
}

function supportMessageIds(rows) {
  return new Set((Array.isArray(rows) ? rows : []).map((message) => message?.id).filter(Boolean));
}

function notifySupportMessage(message) {
  const subject = "Новое обращение в поддержку SONA";
  const attachments = Array.isArray(message.attachments) && message.attachments.length
    ? message.attachments.map((file) => `- ${file.name || "file"} (${Math.ceil((Number(file.size) || 0) / 1024)} КБ)`).join("\n")
    : "Нет";
  const text = [
    "Пользователь написал в поддержку.",
    "",
    `Имя: ${message.author || "Не указано"}`,
    `Телефон: ${message.phone || "Не указан"}`,
    `Email: ${message.email || "Не указан"}`,
    `Тема/чат: ${message.threadId || message.accountKey || message.id}`,
    "",
    "Сообщение:",
    message.text || "(без текста)",
    "",
    "Вложения:",
    attachments
  ].join("\n");

  queueMail({ to: SUPPORT_EMAIL, subject, text })
    .catch((error) => console.warn("Unable to send support notification:", error.message));
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
  const incomingReviews = (Array.isArray(incoming.reviews) ? incoming.reviews : []).map((review) => ({
    ...review,
    status: "moderation",
    verified: false,
    submittedAt: Number(review?.submittedAt) || Date.now()
  }));
  const reviews = mergeNewRows(current.reviews, incomingReviews, (review) => reviewableOrderIds.has(review.orderId));
  const incomingSupport = (Array.isArray(incoming.supportMessages) ? incoming.supportMessages : []).map((message) => {
    const attachments = (Array.isArray(message?.attachments) ? message.attachments : [])
      .slice(0, 3)
      .filter((attachment) => {
        const dataUrl = String(attachment?.dataUrl || "");
        const type = String(attachment?.type || "").toLowerCase();
        const acceptedType = /^(?:image\/(?:png|jpeg|webp|gif)|application\/(?:pdf|json|zip|msword|vnd\.openxmlformats-officedocument\.(?:wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|vnd\.ms-(?:excel|powerpoint)|x-zip-compressed)|text\/(?:plain|csv)|video\/(?:mp4|webm|quicktime)|audio\/(?:mpeg|wav|ogg))$/.test(type);
        const storedMedia = /^\/media\/[a-f0-9]{64}\.[a-z0-9]{2,5}$/i.test(dataUrl);
        return acceptedType && (storedMedia || (
          dataUrlPayloadBytes(dataUrl) <= 10 * 1024 * 1024 && dataUrl.toLowerCase().startsWith(`data:${type};`)
        ));
      });
    return {
      ...message,
      text: String(message?.text || "").slice(0, 1200),
      attachments,
      author: String(incoming.profile?.name || message?.author || "Пользователь").slice(0, 120),
      phone: String(incoming.profile?.phone || message?.phone || "").slice(0, 40),
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

function cacheControlFor(ext, urlPath = "") {
  if (ext === ".html") return "no-cache, must-revalidate";
  if ([".css", ".js"].includes(ext)) {
    return /[?&]v=[a-z0-9._-]+/i.test(urlPath)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600, must-revalidate";
  }
  if (ext === ".json") return "public, max-age=300, stale-while-revalidate=86400";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico", ".pdf", ".zip", ".mp4", ".webm", ".mp3", ".ogg"].includes(ext)) {
    return "public, max-age=2592000, stale-while-revalidate=86400";
  }
  return "public, max-age=3600";
}

function canGzip(req, contentType) {
  const acceptsGzip = String(req.headers["accept-encoding"] || "").includes("gzip");
  return acceptsGzip && /^(text\/|application\/(javascript|json)|image\/svg\+xml)/.test(contentType);
}

function serveFile(req, res, filePath, stats, options = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const etag = `W/\"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}\"`;
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": options.cacheControl || cacheControlFor(ext, req.url || ""),
    ETag: etag,
    "Last-Modified": stats.mtime.toUTCString()
  };
  setSecurityHeaders(res);
  if (String(req.headers["if-none-match"] || "") === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  if (req.method === "HEAD") {
    res.writeHead(200, { ...headers, "Content-Length": stats.size });
    res.end();
    return;
  }

  if (stats.size > 1024 && canGzip(req, contentType)) {
    const cacheKey = `${filePath}:${stats.mtimeMs}:gzip`;
    const cached = staticAssetCache.get(cacheKey);
    if (cached) {
      res.writeHead(200, { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding", "Content-Length": cached.length });
      res.end(cached);
      return;
    }
    fs.readFile(filePath, (readError, content) => {
      if (readError) {
        sendJson(res, 500, { error: "Server error" });
        return;
      }
      zlib.gzip(content, { level: 6 }, (zipError, zipped) => {
        if (zipError) {
          res.writeHead(200, { ...headers, "Content-Length": content.length });
          res.end(content);
          return;
        }
        staticAssetCache.set(cacheKey, zipped);
        if (staticAssetCache.size > 120) staticAssetCache.delete(staticAssetCache.keys().next().value);
        res.writeHead(200, { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding", "Content-Length": zipped.length });
        res.end(zipped);
      });
    });
    return;
  }

  res.writeHead(200, { ...headers, "Content-Length": stats.size });
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
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

function normalizePhone(value) {
  const clean = String(value || "").replace(/\D/g, "");
  return clean.length === 11 && clean.startsWith("8") ? `7${clean.slice(1)}` : clean;
}

function isGenericCustomerName(value) {
  return /^(покупатель|пользователь)(\s+sona|\s+soна)?$/i.test(String(value || "").trim());
}

function resolveCustomerName(state, account, profile = {}) {
  const incomingName = String(profile.name || "").trim();
  const accountName = String(account?.name || "").trim();
  const email = normalizeEmail(account?.email || profile.email);
  const phone = normalizePhone(profile.phone);
  const savedOrder = (state?.orders || []).find((order) => {
    const orderEmail = normalizeEmail(order?.profile?.email);
    const orderPhone = normalizePhone(order?.profile?.phone);
    return (email && orderEmail === email) || (phone && orderPhone === phone);
  });
  const savedName = String(savedOrder?.profile?.name || "").trim();

  return [incomingName, accountName, savedName]
    .find((name) => name && !isGenericCustomerName(name))
    || incomingName
    || accountName
    || savedName
    || "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(normalizeEmail(value));
}

function isBlockedEmailProvider(value) {
  const domain = normalizeEmail(value).split("@").pop();
  return ["gmail.com", "googlemail.com"].includes(domain);
}

function hashAuthCode(email, code) {
  return crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${normalizeEmail(email)}:${String(code || "").trim()}`)
    .digest("hex");
}

function createAuthCode(email) {
  const testCode = process.env.NODE_ENV === "test" ? String(process.env.SONA_TEST_AUTH_CODE || "") : "";
  if (/^\d{6}$/.test(testCode)) {
    const hash = hashAuthCode(email, testCode);
    lastCodeHashes.set(normalizeEmail(email), hash);
    return { code: testCode, hash };
  }
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

function passwordValidationError(password) {
  if (typeof password !== "string" || password.length < 10 || password.length > 128) {
    return "Password must contain 10 to 128 characters";
  }
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
    return "Password must contain at least one letter and one number";
  }
  if (/^[\s]+$/.test(password) || password !== password.trim()) {
    return "Password cannot start or end with a space";
  }
  return "";
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, PASSWORD_SCRYPT.keylen, PASSWORD_SCRYPT, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve([
        "scrypt",
        PASSWORD_SCRYPT.N,
        PASSWORD_SCRYPT.r,
        PASSWORD_SCRYPT.p,
        salt.toString("base64url"),
        derivedKey.toString("base64url")
      ].join("$"));
    });
  });
}

function verifyPassword(password, encodedHash) {
  return new Promise((resolve) => {
    const parts = String(encodedHash || "").split("$");
    const validRecord = parts.length === 6
      && parts[0] === "scrypt"
      && Number(parts[1]) === PASSWORD_SCRYPT.N
      && Number(parts[2]) === PASSWORD_SCRYPT.r
      && Number(parts[3]) === PASSWORD_SCRYPT.p;
    let salt = DUMMY_PASSWORD_SALT;
    let expected = DUMMY_PASSWORD_HASH;
    if (validRecord) {
      try {
        salt = Buffer.from(parts[4], "base64url");
        expected = Buffer.from(parts[5], "base64url");
      } catch (error) {
        salt = DUMMY_PASSWORD_SALT;
        expected = DUMMY_PASSWORD_HASH;
      }
    }
    crypto.scrypt(String(password || ""), salt, expected.length, PASSWORD_SCRYPT, (error, actual) => {
      resolve(!error && validRecord && actual.length === expected.length && crypto.timingSafeEqual(actual, expected));
    });
  });
}

function issueAuthActionToken(email, purpose) {
  const token = crypto.randomBytes(32).toString("base64url");
  authActionTokens.set(sessionTokenHash(token), {
    email: normalizeEmail(email),
    purpose,
    expiresAt: Date.now() + AUTH_ACTION_TTL_MS
  });
  return token;
}

function consumeAuthActionToken(token, purpose) {
  if (!/^[a-zA-Z0-9_-]{40,80}$/.test(String(token || ""))) return null;
  const tokenHash = sessionTokenHash(token);
  const record = authActionTokens.get(tokenHash);
  authActionTokens.delete(tokenHash);
  if (!record || record.expiresAt <= Date.now() || record.purpose !== purpose) return null;
  return record;
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

function cleanAccountsSnapshot(state) {
  const clean = sanitizeJsonValue({
    updatedAt: state?.updatedAt || new Date().toISOString(),
    accounts: Array.isArray(state?.accounts) ? state.accounts : []
  });
  clean.accounts = Array.isArray(clean.accounts) ? clean.accounts : [];
  return clean;
}

function adminAccountRecord(existing = {}) {
  const now = new Date().toISOString();
  return {
    ...existing,
    id: existing.id || accountIdFor(ADMIN_EMAIL),
    email: ADMIN_EMAIL,
    name: existing.name || "Администратор SONA",
    role: "admin",
    status: "active",
    createdAt: existing.createdAt || now,
    lastLoginAt: existing.lastLoginAt || "",
    passwordHash: existing.passwordHash || ADMIN_PASSWORD_HASH,
    passwordChangedAt: existing.passwordChangedAt || now,
    adminCredentialVersion: existing.adminCredentialVersion || ADMIN_PASSWORD_VERSION
  };
}

function mergeRestoredAccountsWithCurrentAdmin(restoredState, currentState) {
  const restoredAccounts = Array.isArray(restoredState?.accounts) ? restoredState.accounts : [];
  const currentAdmin = (currentState?.accounts || []).find((account) => normalizeEmail(account.email) === ADMIN_EMAIL);
  const restoredAdmin = restoredAccounts.find((account) => normalizeEmail(account.email) === ADMIN_EMAIL);
  const admin = adminAccountRecord(currentAdmin || restoredAdmin || {});
  return cleanAccountsSnapshot({
    updatedAt: new Date().toISOString(),
    accounts: [
      ...restoredAccounts.filter((account) => normalizeEmail(account.email) !== ADMIN_EMAIL),
      admin
    ].sort((a, b) => String(a.email).localeCompare(String(b.email)))
  });
}

function readLatestAccountsBackup(callback) {
  fs.readFile(ACCOUNTS_BACKUP_FILE, "utf8", (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        callback(null, null);
        return;
      }
      callback(error);
      return;
    }
    try {
      callback(null, cleanAccountsSnapshot(JSON.parse(content)));
    } catch (parseError) {
      callback(parseError);
    }
  });
}

function writeLatestAccountsBackup(state, callback = () => {}) {
  fs.mkdir(BACKUP_DIR, { recursive: true }, (mkdirError) => {
    if (mkdirError) {
      callback(mkdirError);
      return;
    }
    writeJsonAtomic(ACCOUNTS_BACKUP_FILE, cleanAccountsSnapshot(state), callback);
  });
}

function scheduleAccountsBackup(state) {
  pendingAccountsBackup = cleanAccountsSnapshot(state);
  if (accountsBackupTimer) clearTimeout(accountsBackupTimer);
  accountsBackupTimer = setTimeout(() => {
    const snapshot = pendingAccountsBackup;
    pendingAccountsBackup = null;
    accountsBackupTimer = null;
    writeLatestAccountsBackup(snapshot, (backupError) => {
      if (backupError) {
        console.warn("Unable to write latest accounts backup:", backupError.message);
      }
    });
  }, 900);
  accountsBackupTimer.unref?.();
}

function readAccounts(callback) {
  if (accountsCache) {
    try {
      callback(null, JSON.parse(JSON.stringify(accountsCache)));
    } catch (error) {
      callback(error);
    }
    return;
  }

  fs.readFile(ACCOUNTS_FILE, "utf8", (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        readLatestAccountsBackup((backupError, backupState) => {
          if (backupError || !backupState) {
            callback(null, { accounts: [] });
            return;
          }
          writeAccounts(backupState, (writeError) => {
            callback(writeError || null, backupState);
          });
        });
        return;
      }
      callback(error);
      return;
    }

    try {
      const parsed = JSON.parse(content);
      accountsCache = { accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [] };
      callback(null, JSON.parse(JSON.stringify(accountsCache)));
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
    writeJsonAtomic(ACCOUNTS_FILE, payload, (writeError) => {
      if (writeError) {
        callback(writeError);
        return;
      }
      accountsCache = payload;
      callback(null);
      scheduleAccountsBackup(payload);
    });
  });
}

function accountIdFor(email) {
  return `USER-${crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 12)}`;
}

function telegramEmailFor(chatId) {
  return `telegram-${crypto.createHash("sha256").update(String(chatId)).digest("hex").slice(0, 12)}@sona.telegram`;
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
      role: normalizedEmail === ADMIN_EMAIL ? "admin" : "user",
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

function setAccountPassword(email, encodedHash, callback) {
  const normalizedEmail = normalizeEmail(email);
  readAccounts((readError, state) => {
    if (readError) {
      callback(readError);
      return;
    }
    const account = state.accounts.find((item) => item.email === normalizedEmail);
    if (!account) {
      callback(null, null);
      return;
    }
    account.passwordHash = encodedHash;
    account.passwordChangedAt = new Date().toISOString();
    account.lastLoginAt = account.passwordChangedAt;
    writeAccounts(state, (writeError) => callback(writeError, account));
  });
}

function updateAccountLogin(account, callback) {
  readAccounts((readError, state) => {
    if (readError) {
      callback(readError);
      return;
    }
    const stored = state.accounts.find((item) => item.id === account.id);
    if (!stored) {
      callback(null, null);
      return;
    }
    stored.lastLoginAt = new Date().toISOString();
    writeAccounts(state, (writeError) => callback(writeError, stored));
  });
}

function upsertTelegramAccount(chatId, username, callback) {
  const now = new Date().toISOString();
  const normalizedChatId = String(chatId || "").trim();
  if (!normalizedChatId) {
    callback(new Error("Telegram chat is empty"));
    return;
  }

  readAccounts((readError, state) => {
    if (readError) {
      callback(readError);
      return;
    }

    const existing = state.accounts.find((account) => String(account.telegramChatId || "") === normalizedChatId);
    const email = existing?.email || telegramEmailFor(normalizedChatId);
    const account = {
      ...(existing || {}),
      id: existing?.id || accountIdFor(email),
      email,
      role: existing?.role || "user",
      status: existing?.status || "active",
      createdAt: existing?.createdAt || now,
      lastLoginAt: now,
      telegramChatId: normalizedChatId,
      telegramUsername: String(username || existing?.telegramUsername || "").slice(0, 80),
      telegramConnectedAt: existing?.telegramConnectedAt || now
    };

    if (account.status === "blocked") {
      callback(null, account, state, true);
      return;
    }

    state.accounts = [
      ...state.accounts.filter((item) => item.id !== account.id && item.email !== account.email),
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
  try {
    const state = domainStore.read();
    state.analytics = analyticsJournal.snapshot();
    callback(null, state);
  } catch (error) {
    callback(error);
  }
}

function cleanStoreSnapshot(state) {
  const clean = sanitizeJsonValue(state || {});
  delete clean.admin;
  delete clean.users;
  delete clean.__revision;
  return clean;
}

function createStoreBackup(state, accountsState = null) {
  const backup = {
    schema: STORE_BACKUP_SCHEMA,
    createdAt: new Date().toISOString(),
    state: cleanStoreSnapshot(state)
  };
  if (accountsState) backup.accounts = cleanAccountsSnapshot(accountsState);
  return backup;
}

function stateFromStoreBackup(payload) {
  const source = payload?.schema === STORE_BACKUP_SCHEMA && payload.state
    ? payload.state
    : (payload?.state && typeof payload.state === "object" ? payload.state : payload);
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  return cleanStoreSnapshot(source);
}

function accountsFromStoreBackup(payload) {
  if (!payload?.accounts || typeof payload.accounts !== "object" || Array.isArray(payload.accounts)) return null;
  return cleanAccountsSnapshot(payload.accounts);
}

function readLatestStoreBackup(callback) {
  fs.readFile(STORE_BACKUP_FILE, "utf8", (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        callback(null, null);
        return;
      }
      callback(error);
      return;
    }
    try {
      callback(null, stateFromStoreBackup(JSON.parse(content)));
    } catch (parseError) {
      callback(parseError);
    }
  });
}

function writeLatestStoreBackup(state, callback = () => {}) {
  fs.mkdir(BACKUP_DIR, { recursive: true }, (mkdirError) => {
    if (mkdirError) {
      callback(mkdirError);
      return;
    }
    writeJsonAtomic(STORE_BACKUP_FILE, createStoreBackup(state), callback);
  });
}

function scheduleStoreBackup(state) {
  pendingStoreBackup = sanitizeJsonValue(state || {});
  if (storeBackupTimer) clearTimeout(storeBackupTimer);
  storeBackupTimer = setTimeout(() => {
    const snapshot = pendingStoreBackup;
    pendingStoreBackup = null;
    storeBackupTimer = null;
    writeLatestStoreBackup(snapshot, (backupError) => {
      if (backupError) {
        console.warn("Unable to write latest store backup:", backupError.message);
      }
    });
  }, 900);
  storeBackupTimer.unref?.();
}

function writeStore(state, callback) {
  domainStore.write(state)
    .then((result) => {
      callback(null, result);
      scheduleStoreBackup(domainStore.read());
    })
    .catch(callback);
}

function storeRevisionTag(req, account) {
  const audience = account?.id || account?.email || "public";
  const audienceHash = crypto.createHash("sha256").update(String(audience)).digest("hex").slice(0, 10);
  return `W/\"store-${domainStore.revision}-${audienceHash}\"`;
}

function broadcastStoreChange(change) {
  const payload = JSON.stringify({
    revision: change.revision,
    domains: change.domains || [],
    keys: (change.keys || []).filter((key) => !["customerStates", "supportMessages"].includes(key))
  });
  storeEventClients.forEach((client) => {
    try {
      client.write(`event: store\ndata: ${payload}\n\n`);
    } catch (error) {
      storeEventClients.delete(client);
    }
  });
}

function handleStoreEvents(req, res) {
  setSecurityHeaders(res);
  setApiCorsHeaders(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ revision: domainStore.revision })}\n\n`);
  storeEventClients.add(res);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25000);
  heartbeat.unref?.();
  req.on("close", () => {
    clearInterval(heartbeat);
    storeEventClients.delete(res);
  });
}

function writeJsonAtomic(filePath, payload, callback) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFile(tempPath, JSON.stringify(payload), { encoding: "utf8", mode: 0o600 }, (writeError) => {
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

    const session = sessionFor(req, res);
    const etag = storeRevisionTag(req, session?.account || null);
    if (String(req.headers["if-none-match"] || "") === etag) {
      setSecurityHeaders(res);
      setApiCorsHeaders(res);
      res.writeHead(304, { ETag: etag, "Cache-Control": "private, no-cache, must-revalidate" });
      res.end();
      return;
    }
    if (session?.account?.role !== "admin") {
      sendJson(res, 200, {
        ok: true,
        revision: domainStore.revision,
        state: publicStoreState(state || {}, session?.account || null)
      }, { cacheControl: "private, no-cache, must-revalidate", headers: { ETag: etag } });
      return;
    }

    readAccounts((accountsError, accountsState) => {
      const accounts = accountsError ? [] : accountsState.accounts.map(safeAccount);
      sendJson(res, 200, {
        ok: true,
        revision: domainStore.revision,
        state: { ...state, users: accounts }
      }, { cacheControl: "private, no-cache, must-revalidate", headers: { ETag: etag } });
    });
  });
}

function handleStorePatch(req, res) {
  const account = requireAuth(req, res);
  if (!account) return;
  readJsonBody(req, async (bodyError, body) => {
    const changes = body?.changes;
    if (bodyError || !changes || typeof changes !== "object" || Array.isArray(changes)) {
      sendJson(res, 400, { ok: false, error: "Invalid store patch" });
      return;
    }
    const denied = new Set(["analytics", "users", "admin", "customerStates", "__revision"]);
    const cleanChanges = Object.fromEntries(Object.entries(sanitizeJsonValue(changes)).filter(([key]) => !denied.has(key)));
    readStore(async (readError, current) => {
        if (readError) {
          sendJson(res, 500, { ok: false, error: "Store unavailable" });
          return;
        }
        const existingSupportIds = supportMessageIds(current?.supportMessages);
        let next;
        try {
          if (account.role === "admin") {
            const storedChanges = await mediaStore.externalize(cleanChanges);
            next = { ...(current || {}), ...storedChanges };
          } else {
          const allowedCustomerKeys = new Set([
            "cart", "favorites", "viewedProductIds", "profile", "accountSessions", "orders", "reviews", "supportMessages"
          ]);
          const customerChanges = Object.fromEntries(Object.entries(cleanChanges).filter(([key]) => allowedCustomerKeys.has(key)));
          const storedCustomerChanges = await mediaStore.externalize(customerChanges);
          const incoming = { ...publicStoreState(current || {}, account), ...storedCustomerChanges };
          next = mergeCustomerStoreState(current || {}, incoming, account);
          }
          const supportToNotify = account.role === "admin" ? [] : (next.supportMessages || []).filter((message) => (
            message?.role === "user" && !existingSupportIds.has(message.id)
          ));
          writeStore(next, (writeError, result) => {
            if (writeError) {
              sendJson(res, 500, { ok: false, error: "Store patch failed" });
              return;
            }
            sendJson(res, 200, { ok: true, revision: result?.revision || domainStore.revision });
            supportToNotify.forEach(notifySupportMessage);
          });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error.message || "Invalid media payload" });
        }
      });
  }, { maxBytes: 40 * 1024 * 1024 });
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
      const existingSupportIds = supportMessageIds(current?.supportMessages);
      const next = account.role === "admin"
        ? sanitizeJsonValue(body.state)
        : mergeCustomerStoreState(current || {}, body.state, account);
      const supportToNotify = account.role === "admin" ? [] : (next.supportMessages || []).filter((message) => (
        message?.role === "user" && !existingSupportIds.has(message.id)
      ));
      mediaStore.externalize(next).then((externalized) => {
        writeStore(externalized, (writeError, result) => {
          if (writeError) {
            sendJson(res, 500, { ok: false, error: "Store write failed" });
            return;
          }
          sendJson(res, 200, { ok: true, revision: result?.revision || domainStore.revision });
          supportToNotify.forEach(notifySupportMessage);
        });
      }).catch((mediaError) => sendJson(res, 400, { ok: false, error: mediaError.message || "Invalid media payload" }));
    });
  }, { maxBytes: 40 * 1024 * 1024 });
}

function handleStoreBackupDownload(req, res) {
  if (!requireAdmin(req, res)) return;
  readStore((error, state) => {
    if (error) {
      sendJson(res, 500, { ok: false, error: "Backup unavailable" });
      return;
    }
    readAccounts((accountsError, accountsState) => {
      const backup = createStoreBackup(state || {}, accountsError ? null : accountsState);
      writeLatestStoreBackup(backup.state, (backupError) => {
        if (backupError) console.warn("Unable to refresh downloadable store backup:", backupError.message);
      });
      if (backup.accounts) {
        writeLatestAccountsBackup(backup.accounts, (backupError) => {
          if (backupError) console.warn("Unable to refresh downloadable accounts backup:", backupError.message);
        });
      }
      sendJson(res, 200, { ok: true, backup });
    });
  });
}

function restoreAdminBackup(storeState, accountsState, callback) {
  writeStore(storeState, (storeError) => {
    if (storeError) {
      callback(storeError);
      return;
    }
    if (!accountsState) {
      callback(null);
      return;
    }
    readAccounts((readError, currentAccounts) => {
      if (readError) {
        callback(readError);
        return;
      }
      writeAccounts(mergeRestoredAccountsWithCurrentAdmin(accountsState, currentAccounts), callback);
    });
  });
}

function handleStoreBackupRestore(req, res) {
  if (!requireAdmin(req, res)) return;
  readJsonBody(req, (error, body) => {
    const payload = body?.backup || body;
    const next = stateFromStoreBackup(payload);
    const accounts = accountsFromStoreBackup(payload);
    if (error || !next) {
      sendJson(res, 400, { ok: false, error: "Invalid backup payload" });
      return;
    }
    restoreAdminBackup(next, accounts, (writeError) => {
      if (writeError) {
        sendJson(res, 500, { ok: false, error: "Backup restore failed" });
        return;
      }
      sendJson(res, 200, { ok: true, restoredAt: new Date().toISOString() });
    });
  }, { maxBytes: 80 * 1024 * 1024 });
}

function handleLatestStoreBackupRestore(req, res) {
  if (!requireAdmin(req, res)) return;
  readLatestStoreBackup((error, state) => {
    if (error || !state) {
      sendJson(res, 404, { ok: false, error: "Latest backup not found" });
      return;
    }
    readLatestAccountsBackup((accountsError, accountsState) => {
      restoreAdminBackup(state, accountsError ? null : accountsState, (writeError) => {
        if (writeError) {
          sendJson(res, 500, { ok: false, error: "Backup restore failed" });
          return;
        }
        sendJson(res, 200, { ok: true, restoredAt: new Date().toISOString() });
      });
    });
  });
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
  refreshRuntimeEnv();
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

function queueMail(mail) {
  if (!mailOutbox) return Promise.reject(new Error("Mail outbox is unavailable"));
  return mailOutbox.queue(mail);
}

function sendEmailCode(email, code, callback, purpose = "register") {
  const isReset = purpose === "reset";
  const subject = isReset ? "Восстановление доступа SONA" : "Подтверждение почты SONA";
  const text = [
    `${isReset ? "Ваш код восстановления доступа" : "Ваш код подтверждения почты"} SONA: ${code}`,
    "",
    "Код действует 10 минут и подходит только для одной попытки. Никому его не сообщайте.",
    "Если вы не запрашивали этот код, просто проигнорируйте письмо."
  ].join("\n");

  queueMail({ to: email, subject, text })
    .then((result) => callback(null, result))
    .catch(callback);
}

async function telegramApi(method, payload = {}) {
  const token = telegramBotToken();
  if (!token) throw new Error("Telegram bot is not configured");
  const body = JSON.stringify(payload);
  let result;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(method === "getUpdates" ? 35000 : 12000)
    });
    result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.description || `Telegram API ${method} failed`);
  } catch (error) {
    if (process.platform !== "win32") throw error;
    result = await telegramApiViaPowerShell(method, token, body);
  }
  if (!result.ok) throw new Error(result.description || `Telegram API ${method} failed`);
  return result.result;
}

function telegramApiViaPowerShell(method, token, body) {
  return new Promise((resolve, reject) => {
    const script = [
      "$body = [Console]::In.ReadToEnd()",
      "$uri = \"https://api.telegram.org/bot$env:SONA_TELEGRAM_TOKEN/$env:SONA_TELEGRAM_METHOD\"",
      "$result = Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 45",
      "$result | ConvertTo-Json -Depth 20 -Compress"
    ].join("; ");
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true,
      env: {
        ...process.env,
        SONA_TELEGRAM_TOKEN: token,
        SONA_TELEGRAM_METHOD: method
      }
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Telegram PowerShell fallback timeout"));
    }, method === "getUpdates" ? 55000 : 20000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Telegram PowerShell fallback exited with ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(body);
  });
}

async function checkTelegramApi() {
  if (!telegramBotToken()) return { ok: false, configured: false };
  const result = await telegramApi("getMe", {});
  return { ok: true, configured: true, username: result?.username || "" };
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
  const login = telegramLoginCodes.get(token);
  if (login) {
    if (login.expiresAt <= Date.now()) {
      telegramLoginCodes.delete(token);
      await sendTelegramMessage(message.chat.id, "Вход устарел. Нажмите Telegram на сайте ещё раз.");
      return;
    }
    const authCode = createAuthCode(`telegram:${token}`);
    telegramLoginCodes.set(token, {
      ...login,
      hash: authCode.hash,
      attempts: 0,
      chatId: String(message.chat.id),
      username: String(message.from?.username || "").slice(0, 80),
      expiresAt: Date.now() + CODE_TTL_MS
    });
    await sendTelegramMessage(message.chat.id, `Код входа в SONA: ${authCode.code}\n\nВведите его на сайте. Код действует 10 минут.`);
    return;
  }

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
  if (!telegramBotToken() || telegramPollingStarted) return;
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
  const botUsername = telegramBotUsername();
  if (!telegramBotToken() || !botUsername) {
    sendJson(res, 503, { ok: false, error: "Telegram bot is not configured" });
    return;
  }
  startTelegramPolling();
  const token = crypto.randomBytes(24).toString("base64url");
  telegramLinkTokens.set(token, {
    email: account.email,
    expiresAt: Date.now() + TELEGRAM_LINK_TTL_MS
  });
  sendJson(res, 200, {
    ok: true,
    url: `https://t.me/${botUsername}?start=${token}`,
    expiresIn: Math.floor(TELEGRAM_LINK_TTL_MS / 1000)
  });
}

function handleTelegramStatus(req, res) {
  const account = requireAuth(req, res);
  if (!account) return;
  accountByEmail(account.email)
    .then((stored) => sendJson(res, 200, {
      ok: true,
      configured: Boolean(telegramBotToken()),
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

function handleTelegramAuthRequest(req, res) {
  const botUsername = telegramBotUsername();
  if (!telegramBotToken() || !botUsername) {
    sendJson(res, 503, {
      ok: false,
      error: "Telegram bot is not configured",
      message: "Telegram-бот пока не настроен на сервере."
    });
    return;
  }
  startTelegramPolling();
  if (!checkRateLimit(`telegram-auth-ip:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
    securityEvent("telegram_auth_request_rate_limited", req);
    sendJson(res, 429, { ok: false, error: "Too many authentication requests" });
    return;
  }
  const loginId = crypto.randomBytes(24).toString("base64url");
  telegramLoginCodes.set(loginId, {
    attempts: 0,
    expiresAt: Date.now() + CODE_TTL_MS
  });
  sendJson(res, 200, {
    ok: true,
    loginId,
    url: `https://t.me/${botUsername}?start=${loginId}`,
    expiresIn: Math.floor(CODE_TTL_MS / 1000)
  });
}

function handleTelegramAuthVerify(req, res) {
  readJsonBody(req, (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
    const loginId = String(body.loginId || "").trim();
    const code = String(body.code || "").trim();
    const record = telegramLoginCodes.get(loginId);
    if (!/^[a-zA-Z0-9_-]{20,80}$/.test(loginId) || !/^\d{6}$/.test(code)) {
      sendJson(res, 400, { ok: false, error: "Invalid auth payload" });
      return;
    }
    if (!record || record.expiresAt < Date.now()) {
      telegramLoginCodes.delete(loginId);
      sendJson(res, 400, { ok: false, error: "Code expired" });
      return;
    }
    if (!record.hash || !record.chatId) {
      sendJson(res, 409, {
        ok: false,
        error: "Telegram start required",
        message: "Откройте @SonaShop_bot и нажмите Start, затем введите код из чата."
      });
      return;
    }
    if (record.hash !== hashAuthCode(`telegram:${loginId}`, code)) {
      record.attempts += 1;
      securityEvent("invalid_telegram_login_code", req, { attempts: record.attempts });
      if (record.attempts >= 4) {
        telegramLoginCodes.delete(loginId);
        sendJson(res, 403, { ok: false, error: "Too many wrong codes" });
        return;
      }
      sendJson(res, 400, { ok: false, error: "Wrong code" });
      return;
    }
    telegramLoginCodes.delete(loginId);
    upsertTelegramAccount(record.chatId, record.username, (accountError, account, _state, blocked) => {
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

    const rawIdentifier = String(body.email || "").trim();
    const isAdminShortcut = /^0{8}$/.test(rawIdentifier);
    const email = isAdminShortcut ? ADMIN_EMAIL : normalizeEmail(rawIdentifier);
    const codeKey = isAdminShortcut ? "admin:00000000" : email;
    if (!isValidEmail(email)) {
      sendJson(res, 400, { ok: false, error: "Invalid email" });
      return;
    }
    if (!isAdminShortcut && isBlockedEmailProvider(email)) {
      sendJson(res, 400, {
        ok: false,
        error: "Email provider is blocked",
        message: "Gmail-почта для входа недоступна. Используйте другую почту."
      });
      return;
    }

    if (blockInfo(req, codeKey)) {
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

    if (!checkRateLimit(requestKey(req, codeKey), 5, 10 * 60 * 1000)) {
      securityEvent("email_code_rate_limited", req, {
        emailHash: crypto.createHash("sha256").update(codeKey).digest("hex").slice(0, 12)
      });
      sendJson(res, 429, { ok: false, error: "Too many code requests" });
      return;
    }

    const authCode = createAuthCode(codeKey);
    emailCodes.set(codeKey, {
      hash: authCode.hash,
      attempts: 0,
      expiresAt: Date.now() + CODE_TTL_MS,
      email,
      purpose: "register"
    });

    sendEmailCode(email, authCode.code, (mailError) => {
      if (mailError) {
        emailCodes.delete(codeKey);
        sendJson(res, 502, {
          ok: false,
          error: "Email provider failed",
          message: "Почта не отправила код. Проверьте SMTP_HOST, SMTP_USER и пароль приложения SMTP_PASS."
        });
        return;
      }
      sendJson(res, 200, { ok: true, channel: "email", admin: isAdminShortcut });
    });
  });
}

function handleAuthVerify(req, res) {
  readJsonBody(req, (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }

    const rawIdentifier = String(body.email || "").trim();
    const isAdminShortcut = /^0{8}$/.test(rawIdentifier);
    const codeKey = isAdminShortcut ? "admin:00000000" : normalizeEmail(rawIdentifier);
    const email = isAdminShortcut ? ADMIN_EMAIL : normalizeEmail(rawIdentifier);
    const code = String(body.code || "").trim();
    const record = emailCodes.get(codeKey);

    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      sendJson(res, 400, { ok: false, error: "Invalid auth payload" });
      return;
    }
    if (!isAdminShortcut && isBlockedEmailProvider(email)) {
      sendJson(res, 400, {
        ok: false,
        error: "Email provider is blocked",
        message: "Gmail-почта для входа недоступна. Используйте другую почту."
      });
      return;
    }

    if (blockInfo(req, codeKey)) {
      securityEvent("blocked_login_attempt", req, { emailHash: crypto.createHash("sha256").update(codeKey).digest("hex").slice(0, 12) });
      sendJson(res, 403, {
        ok: false,
        error: "Device blocked",
        message: "Доступ с этого устройства временно закрыт после неверных кодов."
      });
      return;
    }

    if (!record || record.expiresAt < Date.now() || record.purpose !== "register") {
      emailCodes.delete(codeKey);
      sendJson(res, 400, { ok: false, error: "Code expired" });
      return;
    }

    if (record.hash !== hashAuthCode(codeKey, code)) {
      record.attempts += 1;
      securityEvent("invalid_login_code", req, {
        emailHash: crypto.createHash("sha256").update(codeKey).digest("hex").slice(0, 12),
        attempts: record.attempts
      });
      if (record.attempts >= 4) {
        emailCodes.delete(codeKey);
        blockClient(req, codeKey);
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

    emailCodes.delete(codeKey);
    upsertAccount(email, (accountError, account, _state, blocked) => {
      if (accountError) {
        sendJson(res, 500, { ok: false, error: "Account store unavailable" });
        return;
      }

      if (blocked) {
        sendJson(res, 403, { ok: false, error: "Account blocked" });
        return;
      }

      if (account.passwordHash) {
        sendJson(res, 409, {
          ok: false,
          error: "Account already exists",
          message: "Аккаунт уже создан. Войдите с помощью почты и пароля."
        });
        return;
      }

      const setupToken = issueAuthActionToken(account.email, "setup-password");
      sendJson(res, 200, {
        ok: true,
        requiresPasswordSetup: true,
        setupToken,
        account: safeAccount(account)
      });
    });
  });
}

function handleAnalyticsEvent(req, res) {
  if (!checkRateLimit(`analytics:${clientIp(req)}`, 180, 60 * 1000)) {
    sendJson(res, 429, { ok: false, error: "Too many analytics events" });
    return;
  }

  readJsonBody(req, (error, body) => {
    const allowedTypes = new Set(["visit", "route_view", "category_view", "product_view", "cart_add"]);
    const type = String(body?.type || "").trim();
    const sessionId = String(body?.sessionId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    if (error || !allowedTypes.has(type) || sessionId.length < 8) {
      sendJson(res, 400, { ok: false, error: "Invalid analytics event" });
      return;
    }

    const event = {
      id: `AE-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      type,
      sessionId,
      path: String(body?.path || "/").slice(0, 160),
      productId: String(body?.productId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80),
      category: String(body?.category || "").slice(0, 80),
      at: Date.now()
    };

    analyticsJournal.append(event)
      .then(() => sendJson(res, 202, { ok: true }))
      .catch(() => sendJson(res, 500, { ok: false, error: "Analytics write failed" }));
  }, { maxBytes: 16 * 1024 });
}

function orderEmailLines(order) {
  const paid = Math.max(0, Number(order.paidAmount) || 0);
  const total = Math.max(0, Number(order.total) || 0);
  return [
    `Заказ: ${order.id}`,
    `Клиент: ${order.profile?.name || "Не указано"}`,
    `Телефон: ${order.profile?.phone || "Не указан"}`,
    `Почта: ${order.profile?.email || "Не указана"}`,
    `Адрес: ${order.profile?.address || "Будет уточнен"}`,
    `Сумма: ${total.toLocaleString("ru-RU")} руб.`,
    `Оплачено: ${paid.toLocaleString("ru-RU")} руб.`,
    `Долг: ${Math.max(0, total - paid).toLocaleString("ru-RU")} руб.`,
    "",
    "Состав:",
    ...(order.items || []).map((item) => `- ${item.name || item.id} x ${item.quantity || 1}`)
  ];
}

function handleOrderCreate(req, res) {
  const account = requireAuth(req, res);
  if (!account) return;
  if (account.role === "admin") {
    sendJson(res, 403, { ok: false, error: "Customer account required" });
    return;
  }
  readJsonBody(req, (bodyError, body) => {
    const idempotencyKey = String(req.headers["idempotency-key"] || body?.idempotencyKey || "")
      .replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 120);
    const phone = String(body?.profile?.phone || "").replace(/[^\d+]/g, "").slice(0, 18);
    const items = (Array.isArray(body?.items) ? body.items : []).slice(0, 50).map((item) => ({
      id: String(item?.id || "").slice(0, 100),
      name: String(item?.name || "").slice(0, 160),
      quantity: Math.max(1, Math.min(20, Math.floor(Number(item?.quantity) || 1)))
    })).filter((item) => item.id);
    const total = Math.max(0, Math.min(100000000, Math.round(Number(body?.total) || 0)));
    if (bodyError || !items.length || phone.replace(/\D/g, "").length < 10 || !isValidEmail(account.email) || !total || idempotencyKey.length < 12) {
      sendJson(res, 400, { ok: false, error: "Order requires a valid phone, email and items" });
      return;
    }
    const now = new Date();
    const order = {
      id: `SONA-${Date.now()}-${crypto.randomInt(100, 1000)}`,
      date: now.toLocaleDateString("ru-RU"),
      createdAt: now.getTime(),
      status: "pending",
      total,
      paidAmount: 0,
      idempotencyKey,
      profile: {
        name: String(body.profile?.name || account.name || "").slice(0, 80),
        email: account.email,
        phone,
        userId: account.id,
        address: String(body.profile?.address || "").slice(0, 200)
      },
      items
    };
    readStore((readError, current) => {
      if (readError) {
        sendJson(res, 500, { ok: false, error: "Store unavailable" });
        return;
      }
      const duplicate = (current?.orders || []).find((item) => (
        item.idempotencyKey === idempotencyKey && normalizeEmail(item.profile?.email) === normalizeEmail(account.email)
      ));
      if (duplicate) {
        sendJson(res, 200, { ok: true, order: duplicate, duplicate: true, notified: true });
        return;
      }
      const next = current || {};
      order.profile.name = resolveCustomerName(next, account, { ...(body.profile || {}), phone });
      next.orders = [...(next.orders || []), order];
      writeStore(next, (writeError) => {
        if (writeError) {
          sendJson(res, 500, { ok: false, error: "Order write failed" });
          return;
        }
        sendJson(res, 201, { ok: true, order, notified: true });
        queueMail({
          to: ADMIN_EMAIL,
          subject: `Новая заявка ${order.id}`,
          text: ["Поступила новая заявка. Позвоните клиенту для уточнения и подтвердите заказ в админ-панели.", "", ...orderEmailLines(order)].join("\n")
        }).catch((error) => console.warn("Unable to send order notification:", error.message));
      });
    });
  }, { maxBytes: 100000 });
}

function handleOrderUpdate(req, res, orderId) {
  const account = requireAuth(req, res);
  if (!account || account.role !== "admin") {
    if (account) sendJson(res, 403, { ok: false, error: "Admin access required" });
    return;
  }
  readJsonBody(req, (bodyError, body) => {
    if (bodyError) {
      sendJson(res, 400, { ok: false, error: "Invalid order update" });
      return;
    }
    readStore((readError, current) => {
      const orders = current?.orders || [];
      const index = orders.findIndex((order) => order.id === orderId);
      if (readError || index < 0) {
        sendJson(res, index < 0 ? 404 : 500, { ok: false, error: "Order not found" });
        return;
      }
      const allowedStatuses = ["pending", "confirmed", "new", "processing", "paid", "assembling", "delivering", "arrived", "received", "completed", "canceled", "return"];
      const previous = orders[index];
      const status = allowedStatuses.includes(body.status) ? body.status : previous.status;
      const paidAmount = Math.max(0, Math.min(Number(previous.total) || 0, Math.round(Number(body.paidAmount ?? previous.paidAmount) || 0)));
      const updated = {
        ...previous,
        status,
        paidAmount,
        updatedAt: new Date().toISOString(),
        ...(status === "confirmed" && previous.status !== "confirmed" ? { confirmedAt: new Date().toISOString() } : {}),
        ...(status === "arrived" && previous.status !== "arrived" ? { arrivedAt: new Date().toISOString() } : {})
      };
      orders[index] = updated;
      writeStore({ ...current, orders }, (writeError) => {
        if (writeError) {
          sendJson(res, 500, { ok: false, error: "Order write failed" });
          return;
        }
        if (status === "arrived" && previous.status !== "arrived" && isValidEmail(updated.profile?.email)) {
          sendJson(res, 200, { ok: true, order: updated, notified: true });
          queueMail({
            to: updated.profile.email,
            subject: `Ваш заказ ${updated.id} прибыл`,
            text: [`Ваш заказ ${updated.id} прибыл.`, "Пожалуйста, подтвердите получение в личном кабинете после фактической передачи заказа.", "", ...orderEmailLines(updated)].join("\n")
          }).catch((error) => console.warn("Unable to send arrival notification:", error.message));
          return;
        }
        sendJson(res, 200, { ok: true, order: updated });
      });
    });
  }, { maxBytes: 20000 });
}

function handleOrderDelete(req, res, orderId) {
  const account = requireAuth(req, res);
  if (!account || account.role !== "admin") {
    if (account) sendJson(res, 403, { ok: false, error: "Admin access required" });
    return;
  }
  readStore((readError, current) => {
    if (readError) {
      sendJson(res, 500, { ok: false, error: "Store unavailable" });
      return;
    }
    const orders = current?.orders || [];
    const exists = orders.some((order) => order.id === orderId);
    if (!exists) {
      sendJson(res, 404, { ok: false, error: "Order not found" });
      return;
    }
    const next = {
      ...(current || {}),
      orders: orders.filter((order) => order.id !== orderId),
      reviews: (current?.reviews || []).filter((review) => review.orderId !== orderId)
    };
    writeStore(next, (writeError) => {
      if (writeError) {
        sendJson(res, 500, { ok: false, error: "Order delete failed" });
        return;
      }
      sendJson(res, 200, { ok: true, orderId });
    });
  });
}

function handleOrderReceive(req, res, orderId) {
  const account = requireAuth(req, res);
  if (!account) return;
  if (account.role === "admin") {
    sendJson(res, 403, { ok: false, error: "Customer account required" });
    return;
  }
  readStore((readError, current) => {
    const orders = current?.orders || [];
    const index = orders.findIndex((order) => order.id === orderId && normalizeEmail(order.profile?.email) === normalizeEmail(account.email));
    if (readError || index < 0) {
      sendJson(res, index < 0 ? 404 : 500, { ok: false, error: "Order not found" });
      return;
    }
    if (orders[index].status !== "arrived") {
      sendJson(res, 409, { ok: false, error: "Order has not arrived yet" });
      return;
    }
    orders[index] = { ...orders[index], status: "received", receivedAt: new Date().toISOString() };
    writeStore({ ...current, orders }, (writeError) => {
      if (writeError) sendJson(res, 500, { ok: false, error: "Order write failed" });
      else sendJson(res, 200, { ok: true, order: orders[index] });
    });
  });
}

function handlePasswordSetup(req, res) {
  readJsonBody(req, async (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
    const token = String(body.token || "");
    const password = String(body.password || "");
    const passwordConfirm = String(body.passwordConfirm || "");
    const passwordError = passwordValidationError(password);
    if (password !== passwordConfirm) {
      sendJson(res, 400, { ok: false, error: "Passwords do not match" });
      return;
    }
    if (passwordError) {
      sendJson(res, 400, { ok: false, error: passwordError });
      return;
    }
    const action = consumeAuthActionToken(token, "setup-password");
    if (!action) {
      sendJson(res, 400, { ok: false, error: "Setup token expired" });
      return;
    }
    try {
      const encodedHash = await hashPassword(password);
      setAccountPassword(action.email, encodedHash, (accountError, account) => {
        if (accountError || !account) {
          sendJson(res, 500, { ok: false, error: "Account store unavailable" });
          return;
        }
        if (account.status === "blocked") {
          sendJson(res, 403, { ok: false, error: "Account blocked" });
          return;
        }
        revokeSessionsForEmail(account.email);
        createSession(req, res, account);
        sendJson(res, 200, { ok: true, account: safeAccount(account) });
      });
    } catch (hashError) {
      sendJson(res, 500, { ok: false, error: "Password setup failed" });
    }
  });
}

function handlePasswordLogin(req, res) {
  readJsonBody(req, async (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
    const rawEmail = String(body.email || "").trim();
    const email = /^0{8}$/.test(rawEmail) ? ADMIN_EMAIL : normalizeEmail(rawEmail);
    const password = String(body.password || "");
    const rateKey = `password-login:${clientIp(req)}:${crypto.createHash("sha256").update(email).digest("hex").slice(0, 16)}`;
    if (!isValidEmail(email) || password.length > 128) {
      sendJson(res, 400, { ok: false, error: "Invalid email or password" });
      return;
    }
    if (!checkRateLimit(rateKey, 8, 15 * 60 * 1000)) {
      securityEvent("password_login_rate_limited", req);
      sendJson(res, 429, { ok: false, error: "Too many login attempts" });
      return;
    }
    try {
      const account = await accountByEmail(email);
      const validPassword = await verifyPassword(password, account?.passwordHash);
      if (!account || !validPassword || account.status === "blocked") {
        securityEvent("invalid_password_login", req, {
          emailHash: crypto.createHash("sha256").update(email).digest("hex").slice(0, 12)
        });
        sendJson(res, 401, { ok: false, error: "Invalid email or password" });
        return;
      }
      updateAccountLogin(account, (updateError, updatedAccount) => {
        if (updateError || !updatedAccount) {
          sendJson(res, 500, { ok: false, error: "Account store unavailable" });
          return;
        }
        createSession(req, res, updatedAccount);
        sendJson(res, 200, { ok: true, account: safeAccount(updatedAccount) });
      });
    } catch (accountError) {
      sendJson(res, 500, { ok: false, error: "Account store unavailable" });
    }
  });
}

function handlePasswordResetRequest(req, res) {
  readJsonBody(req, async (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      sendJson(res, 400, { ok: false, error: "Invalid email" });
      return;
    }
    if (!checkRateLimit(`password-reset-ip:${clientIp(req)}`, 10, 15 * 60 * 1000)
      || !checkRateLimit(requestKey(req, `reset:${email}`), 4, 15 * 60 * 1000)) {
      sendJson(res, 429, { ok: false, error: "Too many reset requests" });
      return;
    }
    try {
      const account = await accountByEmail(email);
      if (!account?.passwordHash || account.status === "blocked") {
        sendJson(res, 200, { ok: true });
        return;
      }
      const codeKey = `reset:${email}`;
      const authCode = createAuthCode(codeKey);
      emailCodes.set(codeKey, {
        hash: authCode.hash,
        attempts: 0,
        expiresAt: Date.now() + CODE_TTL_MS,
        email,
        purpose: "reset"
      });
      sendEmailCode(email, authCode.code, (mailError) => {
        if (mailError) {
          emailCodes.delete(codeKey);
          sendJson(res, 502, { ok: false, error: "Email provider failed" });
          return;
        }
        sendJson(res, 200, { ok: true });
      }, "reset");
    } catch (accountError) {
      sendJson(res, 500, { ok: false, error: "Account store unavailable" });
    }
  });
}

function handlePasswordResetVerify(req, res) {
  readJsonBody(req, (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
    const email = normalizeEmail(body.email);
    const code = String(body.code || "").trim();
    const codeKey = `reset:${email}`;
    const record = emailCodes.get(codeKey);
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      sendJson(res, 400, { ok: false, error: "Invalid reset payload" });
      return;
    }
    if (!record || record.expiresAt <= Date.now() || record.purpose !== "reset") {
      emailCodes.delete(codeKey);
      sendJson(res, 400, { ok: false, error: "Code expired" });
      return;
    }
    if (record.hash !== hashAuthCode(codeKey, code)) {
      record.attempts += 1;
      if (record.attempts >= 4) emailCodes.delete(codeKey);
      sendJson(res, 400, { ok: false, error: "Wrong code" });
      return;
    }
    emailCodes.delete(codeKey);
    sendJson(res, 200, {
      ok: true,
      resetToken: issueAuthActionToken(email, "reset-password")
    });
  });
}

function handlePasswordResetComplete(req, res) {
  readJsonBody(req, async (error, body) => {
    if (error) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
    const password = String(body.password || "");
    const passwordConfirm = String(body.passwordConfirm || "");
    if (password !== passwordConfirm) {
      sendJson(res, 400, { ok: false, error: "Passwords do not match" });
      return;
    }
    const passwordError = passwordValidationError(password);
    if (passwordError) {
      sendJson(res, 400, { ok: false, error: passwordError });
      return;
    }
    const action = consumeAuthActionToken(String(body.token || ""), "reset-password");
    if (!action) {
      sendJson(res, 400, { ok: false, error: "Reset token expired" });
      return;
    }
    try {
      const encodedHash = await hashPassword(password);
      setAccountPassword(action.email, encodedHash, (accountError, account) => {
        if (accountError || !account) {
          sendJson(res, 500, { ok: false, error: "Account store unavailable" });
          return;
        }
        revokeSessionsForEmail(account.email);
        createSession(req, res, account);
        sendJson(res, 200, { ok: true, account: safeAccount(account) });
      });
    } catch (hashError) {
      sendJson(res, 500, { ok: false, error: "Password reset failed" });
    }
  });
}

function handleAuthLogout(req, res) {
  clearSession(req, res);
  sendJson(res, 200, { ok: true });
}

function handleAuthSession(req, res) {
  const session = sessionFor(req, res);
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
  res.sonaRequest = req;
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

  if (req.method === "POST" && req.url === "/api/auth/request-telegram") {
    handleTelegramAuthRequest(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/verify-email") {
    handleAuthVerify(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/setup-password") {
    handlePasswordSetup(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/password-login") {
    handlePasswordLogin(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/request-password-reset") {
    handlePasswordResetRequest(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/verify-password-reset") {
    handlePasswordResetVerify(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/reset-password") {
    handlePasswordResetComplete(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/auth/verify-telegram") {
    handleTelegramAuthVerify(req, res);
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

  if (req.method === "GET" && req.url === "/api/admin/backup") {
    handleStoreBackupDownload(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/admin/backup/restore") {
    handleStoreBackupRestore(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/admin/backup/restore-latest") {
    handleLatestStoreBackupRestore(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/store") {
    handleStoreGet(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/events") {
    handleStoreEvents(req, res);
    return;
  }

  if (req.method === "PATCH" && req.url === "/api/store") {
    handleStorePatch(req, res);
    return;
  }

  if (req.method === "PUT" && req.url === "/api/store") {
    handleStorePut(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/analytics/event") {
    handleAnalyticsEvent(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/orders") {
    handleOrderCreate(req, res);
    return;
  }

  const orderUpdateMatch = String(req.url || "").match(/^\/api\/orders\/([^/?]+)$/);
  if (req.method === "DELETE" && orderUpdateMatch) {
    handleOrderDelete(req, res, orderUpdateMatch[1]);
    return;
  }

  if (req.method === "PATCH" && orderUpdateMatch) {
    handleOrderUpdate(req, res, orderUpdateMatch[1]);
    return;
  }

  const orderReceiveMatch = String(req.url || "").match(/^\/api\/orders\/([^/?]+)\/receive$/);
  if (req.method === "POST" && orderReceiveMatch) {
    handleOrderReceive(req, res, orderReceiveMatch[1]);
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
    sendJson(res, 200, {
      status: "ok",
      service: "sona-marketplace",
      storeRevision: domainStore.revision,
      realtimeClients: storeEventClients.size
    });
    return;
  }

  const mediaPath = mediaStore.resolve(req.url || "");
  if (mediaPath) {
    fs.stat(mediaPath, (mediaError, mediaStats) => {
      if (mediaError || !mediaStats.isFile()) sendJson(res, 404, { error: "Media not found" });
      else serveFile(req, res, mediaPath, mediaStats, { cacheControl: "public, max-age=31536000, immutable" });
    });
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
      fs.stat(fallbackPath, (fallbackError, fallbackStats) => {
        if (fallbackError || !fallbackStats.isFile()) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }
        serveFile(req, res, fallbackPath, fallbackStats, { cacheControl: "no-cache, must-revalidate" });
      });
      return;
    }
    serveFile(req, res, filePath, stats);
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
