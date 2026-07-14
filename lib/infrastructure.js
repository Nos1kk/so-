"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { EventEmitter } = require("events");

const DOMAIN_KEYS = Object.freeze({
  catalog: ["productOverrides", "customProducts", "deletedProducts", "shopSettings", "customAds", "homeCollections"],
  commerce: ["orders", "reviews"],
  support: ["supportMessages"],
  customers: ["customerStates"],
  personal: ["cart", "favorites", "viewedProductIds", "profile", "accountSessions"],
  legacy: []
});

const EPHEMERAL_KEYS = new Set(["__revision", "analytics", "users", "admin"]);
const KEY_DOMAIN = new Map();
Object.entries(DOMAIN_KEYS).forEach(([domain, keys]) => keys.forEach((key) => KEY_DOMAIN.set(key, domain)));

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableEqual(left, right) {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

function atomicWrite(filePath, payload) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  return fs.promises.writeFile(tempPath, JSON.stringify(payload), { encoding: "utf8", mode: 0o600 })
    .then(() => fs.promises.rename(tempPath, filePath))
    .catch(async (error) => {
      await fs.promises.unlink(tempPath).catch(() => null);
      throw error;
    });
}

function atomicWriteSync(filePath, payload) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

function canonicalState(value) {
  const state = clone(value && typeof value === "object" && !Array.isArray(value) ? value : {}) || {};
  EPHEMERAL_KEYS.forEach((key) => delete state[key]);
  return state;
}

class DomainStore extends EventEmitter {
  constructor(options) {
    super();
    this.dataDir = options.dataDir;
    this.domainDir = path.join(this.dataDir, "domains");
    this.metaFile = path.join(this.domainDir, "meta.json");
    this.legacyFile = options.legacyFile;
    this.revision = 0;
    this.state = {};
    this.history = new Map();
    this.writeQueue = Promise.resolve();
    this.initialize();
  }

  initialize() {
    fs.mkdirSync(this.domainDir, { recursive: true });
    let foundDomain = false;
    Object.keys(DOMAIN_KEYS).forEach((domain) => {
      const filePath = path.join(this.domainDir, `${domain}.json`);
      if (!fs.existsSync(filePath)) return;
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const data = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
      Object.assign(this.state, data);
      this.revision = Math.max(this.revision, Number(parsed?.revision) || 0);
      foundDomain = true;
    });

    if (fs.existsSync(this.metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(this.metaFile, "utf8"));
        this.revision = Math.max(this.revision, Number(meta.revision) || 0);
      } catch (error) {
        console.warn("Unable to read domain store metadata:", error.message);
      }
    }

    if (!foundDomain && this.legacyFile && fs.existsSync(this.legacyFile)) {
      this.state = canonicalState(JSON.parse(fs.readFileSync(this.legacyFile, "utf8")));
      this.revision = Math.max(1, this.revision);
      this.persistAllSync();
    }

    this.state = canonicalState(this.state);
    this.remember();
  }

  groupState(state) {
    const groups = Object.fromEntries(Object.keys(DOMAIN_KEYS).map((domain) => [domain, {}]));
    Object.entries(state || {}).forEach(([key, value]) => {
      if (EPHEMERAL_KEYS.has(key)) return;
      const domain = KEY_DOMAIN.get(key) || "legacy";
      groups[domain][key] = value;
    });
    return groups;
  }

  persistAllSync() {
    const groups = this.groupState(this.state);
    Object.entries(groups).forEach(([domain, data]) => {
      atomicWriteSync(path.join(this.domainDir, `${domain}.json`), {
        schema: "sona-domain/v1",
        domain,
        revision: this.revision,
        data
      });
    });
    atomicWriteSync(this.metaFile, { schema: "sona-domain-meta/v1", revision: this.revision, updatedAt: new Date().toISOString() });
  }

  remember() {
    this.history.set(this.revision, clone(this.state));
    while (this.history.size > 24) this.history.delete(this.history.keys().next().value);
  }

  read() {
    const snapshot = clone(this.state);
    snapshot.__revision = this.revision;
    return snapshot;
  }

  write(value) {
    const incoming = canonicalState(value);
    const baseRevision = Number(value?.__revision);
    const base = this.history.get(baseRevision);
    this.writeQueue = this.writeQueue.then(async () => {
      const compareFrom = base || this.state;
      const keys = new Set([...Object.keys(compareFrom), ...Object.keys(incoming)]);
      const changedKeys = [...keys].filter((key) => !EPHEMERAL_KEYS.has(key) && !stableEqual(compareFrom[key], incoming[key]));
      if (!changedKeys.length) return { revision: this.revision, domains: [] };

      const next = clone(this.state);
      changedKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(incoming, key)) next[key] = incoming[key];
        else delete next[key];
      });
      const changedDomains = [...new Set(changedKeys.map((key) => KEY_DOMAIN.get(key) || "legacy"))];
      const nextRevision = this.revision + 1;
      const groups = this.groupState(next);

      await Promise.all(changedDomains.map((domain) => atomicWrite(path.join(this.domainDir, `${domain}.json`), {
        schema: "sona-domain/v1",
        domain,
        revision: nextRevision,
        data: groups[domain]
      })));
      await atomicWrite(this.metaFile, {
        schema: "sona-domain-meta/v1",
        revision: nextRevision,
        updatedAt: new Date().toISOString()
      });

      this.state = next;
      this.revision = nextRevision;
      this.remember();
      const result = { revision: this.revision, domains: changedDomains, keys: changedKeys };
      this.emit("change", result);
      return result;
    });
    return this.writeQueue;
  }
}

class AnalyticsJournal {
  constructor(dataDir, limit = 5000) {
    this.dir = path.join(dataDir, "analytics");
    this.file = path.join(this.dir, "events.ndjson");
    this.limit = limit;
    this.events = [];
    this.queue = Promise.resolve();
    fs.mkdirSync(this.dir, { recursive: true });
    this.loadTail();
  }

  loadTail() {
    if (!fs.existsSync(this.file)) return;
    try {
      const stats = fs.statSync(this.file);
      const bytes = Math.min(stats.size, 2 * 1024 * 1024);
      const handle = fs.openSync(this.file, "r");
      const buffer = Buffer.alloc(bytes);
      fs.readSync(handle, buffer, 0, bytes, Math.max(0, stats.size - bytes));
      fs.closeSync(handle);
      this.events = buffer.toString("utf8").split(/\r?\n/).filter(Boolean).slice(-this.limit).map((line) => JSON.parse(line));
    } catch (error) {
      console.warn("Unable to load analytics journal:", error.message);
      this.events = [];
    }
  }

  append(event) {
    const clean = clone(event);
    this.events.push(clean);
    this.events = this.events.slice(-this.limit);
    this.queue = this.queue.then(() => fs.promises.appendFile(this.file, `${JSON.stringify(clean)}\n`, { encoding: "utf8", mode: 0o600 }));
    return this.queue;
  }

  snapshot() {
    return { events: clone(this.events), updatedAt: this.events.at(-1)?.at || 0 };
  }
}

const MEDIA_TYPES = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/json": "json",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg"
});

class MediaStore {
  constructor(dataDir) {
    this.dir = path.join(dataDir, "media");
    fs.mkdirSync(this.dir, { recursive: true });
  }

  async saveDataUrl(value) {
    const match = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(String(value || ""));
    if (!match) return value;
    const type = match[1].toLowerCase();
    const extension = MEDIA_TYPES[type];
    if (!extension) throw new Error("Unsupported media type");
    const content = Buffer.from(match[2].replace(/\s/g, ""), "base64");
    if (!content.length || content.length > 10 * 1024 * 1024) throw new Error("Media payload is too large");
    const digest = crypto.createHash("sha256").update(content).digest("hex");
    const fileName = `${digest}.${extension}`;
    const filePath = path.join(this.dir, fileName);
    await fs.promises.writeFile(filePath, content, { mode: 0o600, flag: "wx" }).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    return `/media/${fileName}`;
  }

  async externalize(value) {
    if (typeof value === "string") return value.startsWith("data:") ? this.saveDataUrl(value) : value;
    if (Array.isArray(value)) return Promise.all(value.map((item) => this.externalize(item)));
    if (!value || typeof value !== "object") return value;
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await this.externalize(item)]));
    return Object.fromEntries(entries);
  }

  resolve(urlPath) {
    const match = /^\/media\/([a-f0-9]{64}\.[a-z0-9]{2,5})$/i.exec(String(urlPath || "").split("?")[0]);
    return match ? path.join(this.dir, match[1]) : null;
  }
}

class MailOutbox {
  constructor(dataDir, sender) {
    this.dir = path.join(dataDir, "outbox");
    this.sender = sender;
    this.running = false;
    fs.mkdirSync(this.dir, { recursive: true });
    this.timer = setInterval(() => this.process().catch((error) => console.warn("Mail outbox error:", error.message)), 1000);
    this.timer.unref?.();
  }

  queue(mail) {
    const id = `mail-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    const job = {
      id,
      to: String(mail.to || "").slice(0, 320),
      subject: String(mail.subject || "").slice(0, 500),
      text: String(mail.text || "").slice(0, 200000),
      attempts: 0,
      createdAt: new Date().toISOString(),
      nextAttemptAt: Date.now()
    };
    return atomicWrite(path.join(this.dir, `${id}.json`), job).then(() => ({ queued: true, id }));
  }

  async process() {
    if (this.running) return;
    this.running = true;
    try {
      const names = (await fs.promises.readdir(this.dir)).filter((name) => /^mail-.+\.json$/.test(name)).sort();
      for (const name of names) {
        const filePath = path.join(this.dir, name);
        let job;
        try {
          job = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
        } catch (error) {
          console.warn("Unable to read mail job:", error.message);
          continue;
        }
        if (Number(job.nextAttemptAt) > Date.now()) continue;
        try {
          await this.sender(job);
          await fs.promises.unlink(filePath);
        } catch (error) {
          job.attempts = Number(job.attempts || 0) + 1;
          job.lastError = String(error.message || error).slice(0, 300);
          job.nextAttemptAt = Date.now() + Math.min(60 * 60 * 1000, 5000 * (2 ** Math.min(job.attempts, 8)));
          await atomicWrite(filePath, job);
        }
        break;
      }
    } finally {
      this.running = false;
    }
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = {
  DomainStore,
  AnalyticsJournal,
  MediaStore,
  MailOutbox,
  canonicalState,
  clone
};
