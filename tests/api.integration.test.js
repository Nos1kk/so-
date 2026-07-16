"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DomainStore, MediaStore, migrateStoreMedia } = require("../lib/infrastructure");

const dataDir = path.join(os.tmpdir(), `sona-integration-${process.pid}-${Date.now()}`);
process.env.NODE_ENV = "test";
process.env.SONA_DATA_DIR = dataDir;
process.env.SONA_TEST_ADMIN_PASSWORD = "SonaTest2026!";
process.env.SONA_TEST_AUTH_CODE = "123456";

const { createServer } = require("../server");

test("legacy Base64 catalog media is migrated to compact persistent files", async (context) => {
  const migrationDir = path.join(os.tmpdir(), `sona-media-migration-${process.pid}-${Date.now()}`);
  context.after(() => fs.rmSync(migrationDir, { recursive: true, force: true }));
  const legacyStore = new DomainStore({ dataDir: migrationDir, legacyFile: path.join(migrationDir, "store.json") });
  const legacyMedia = new MediaStore(migrationDir);
  const dataUrl = `data:image/png;base64,${Buffer.alloc(256 * 1024, 7).toString("base64")}`;
  await legacyStore.write({
    customProducts: Array.from({ length: 6 }, (_, index) => ({
      id: `legacy-${index}`,
      name: `Legacy ${index}`,
      image: dataUrl
    }))
  });
  const beforeBytes = Buffer.byteLength(JSON.stringify(legacyStore.read()));
  const migration = await migrateStoreMedia(legacyStore, legacyMedia);
  const migrated = legacyStore.read();
  const afterBytes = Buffer.byteLength(JSON.stringify(migrated));

  assert.equal(migration.migratedItems, 6);
  assert.ok(afterBytes < beforeBytes / 100);
  assert.ok(migrated.customProducts.every((product) => /^\/media\/[a-f0-9]{64}\.png$/.test(product.image)));
  assert.equal(fs.readdirSync(path.join(migrationDir, "media")).length, 1);
  context.diagnostic(`legacy catalog bytes: ${beforeBytes} -> ${afterBytes}; migrated media: ${migration.migratedItems}`);
});

function jar() {
  return { cookie: "" };
}

async function request(baseUrl, pathname, options = {}, cookieJar = null) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (cookieJar?.cookie) headers.Cookie = cookieJar.cookie;
  let body = options.body;
  if (body && typeof body !== "string") {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${baseUrl}${pathname}`, { ...options, headers, body });
  const setCookie = response.headers.get("set-cookie");
  if (cookieJar && setCookie) cookieJar.cookie = setCookie.split(";", 1)[0];
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (error) { data = text; }
  return { response, data };
}

test("marketplace performance and critical commerce regression", async (context) => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const health = await request(baseUrl, "/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.data.status, "ok");

  const staticFirst = await fetch(`${baseUrl}/js/app.js?v=integration`);
  assert.match(staticFirst.headers.get("cache-control"), /immutable/);
  const staticEtag = staticFirst.headers.get("etag");
  const staticSecond = await fetch(`${baseUrl}/js/app.js?v=integration`, { headers: { "If-None-Match": staticEtag } });
  assert.equal(staticSecond.status, 304);

  const adminJar = jar();
  const login = await request(baseUrl, "/api/auth/password-login", {
    method: "POST",
    body: { email: "00000000", password: "SonaTest2026!" }
  }, adminJar);
  assert.equal(login.response.status, 200);
  assert.equal(login.data.account.role, "admin");

  const sseAbort = new AbortController();
  const sse = await fetch(`${baseUrl}/api/events`, { signal: sseAbort.signal });
  assert.equal(sse.status, 200);
  const sseReader = sse.body.getReader();
  const product = {
    id: "integration-sofa",
    name: "Integration Sofa",
    brand: "SONA",
    category: "прямой",
    marketSection: "Мебель",
    size: "M",
    price: 88000,
    stock: 4,
    status: "active",
    hidden: false,
    image: ""
  };
  const imageDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const media = await request(baseUrl, "/api/admin/media", {
    method: "POST",
    body: { dataUrl: imageDataUrl }
  }, adminJar);
  assert.equal(media.response.status, 201);
  assert.match(media.data.url, /^\/media\/[a-f0-9]{64}\.png$/);
  product.image = media.data.url;
  const createBody = { product, baseProduct: false };
  assert.ok(Buffer.byteLength(JSON.stringify(createBody)) < 5000);
  const created = await request(baseUrl, `/api/admin/products/${product.id}`, {
    method: "PUT",
    body: createBody
  }, adminJar);
  assert.equal(created.response.status, 200);
  assert.match(created.response.headers.get("server-timing"), /^sona;dur=/);

  let eventText = "";
  const eventDeadline = Date.now() + 3000;
  while (!eventText.includes("event: store") && Date.now() < eventDeadline) {
    const chunk = await Promise.race([
      sseReader.read(),
      new Promise((resolve) => setTimeout(() => resolve({ done: true, value: null }), 500))
    ]);
    if (chunk.value) eventText += Buffer.from(chunk.value).toString("utf8");
  }
  sseAbort.abort();
  assert.match(eventText, /event: store/);
  assert.match(eventText, /catalog/);

  const publicStore = await request(baseUrl, "/api/store");
  assert.equal(publicStore.data.state.customProducts.find((item) => item.id === product.id)?.price, 88000);

  product.price = 91000;
  const editStartedAt = performance.now();
  const productEdit = await request(baseUrl, `/api/admin/products/${product.id}`, {
    method: "PUT",
    body: { product, baseProduct: false }
  }, adminJar);
  const editDuration = performance.now() - editStartedAt;
  assert.equal(productEdit.response.status, 200);
  assert.ok(editDuration < 1000, `compact product edit took ${editDuration.toFixed(1)} ms`);
  const editedStore = await request(baseUrl, "/api/store");
  const edited = editedStore.data.state.customProducts.find((item) => item.id === product.id);
  assert.equal(edited.price, 91000);
  assert.match(edited.image, /^\/media\/[a-f0-9]{64}\.png$/);
  assert.ok(Buffer.byteLength(JSON.stringify(editedStore.data)) < 50000);
  assert.equal((await fetch(`${baseUrl}${edited.image}`)).status, 200);

  const editDurations = [];
  const serverDurations = [];
  for (let index = 0; index < 12; index += 1) {
    product.price = 91000 + index;
    const startedAt = performance.now();
    const result = await request(baseUrl, `/api/admin/products/${product.id}`, {
      method: "PUT",
      body: { product, baseProduct: false }
    }, adminJar);
    editDurations.push(performance.now() - startedAt);
    serverDurations.push(Number((result.response.headers.get("server-timing") || "").match(/dur=([\d.]+)/)?.[1] || 0));
    assert.equal(result.response.status, 200);
  }
  const sortedDurations = [...editDurations].sort((left, right) => left - right);
  const p95 = sortedDurations[Math.ceil(sortedDurations.length * 0.95) - 1];
  const average = editDurations.reduce((total, value) => total + value, 0) / editDurations.length;
  const serverAverage = serverDurations.reduce((total, value) => total + value, 0) / serverDurations.length;
  assert.ok(p95 < 100, `compact product edit p95 took ${p95.toFixed(1)} ms`);
  context.diagnostic(`compact product edit (12 runs): avg=${average.toFixed(1)}ms p95=${p95.toFixed(1)}ms server-avg=${serverAverage.toFixed(1)}ms body=${Buffer.byteLength(JSON.stringify({ product, baseProduct: false }))}B store=${Buffer.byteLength(JSON.stringify(editedStore.data))}B`);

  const domainDir = path.join(dataDir, "domains");
  const domainTimes = new Map(fs.readdirSync(domainDir).map((name) => [name, fs.statSync(path.join(domainDir, name)).mtimeMs]));
  const analytics = await request(baseUrl, "/api/analytics/event", {
    method: "POST",
    body: { type: "visit", sessionId: "integration-session", path: "/integration" }
  });
  assert.equal(analytics.response.status, 202);
  for (const [name, mtime] of domainTimes) assert.equal(fs.statSync(path.join(domainDir, name)).mtimeMs, mtime);
  assert.ok(fs.statSync(path.join(dataDir, "analytics", "events.ndjson")).size > 0);

  const userJar = jar();
  const requestedCode = await request(baseUrl, "/api/auth/request-email", {
    method: "POST",
    body: { email: "integration-buyer@example.com" }
  }, userJar);
  assert.equal(requestedCode.response.status, 200);
  assert.equal(requestedCode.data.passwordAvailable, false);
  const verified = await request(baseUrl, "/api/auth/verify-email", {
    method: "POST",
    body: { email: "integration-buyer@example.com", code: "123456" }
  }, userJar);
  assert.equal(verified.data.requiresPasswordSetup, false);
  assert.equal(verified.data.account.role, "user");
  assert.equal(verified.data.account.hasPassword, false);
  const setup = await request(baseUrl, "/api/auth/password", {
    method: "POST",
    body: { password: "BuyerTest2026!", passwordConfirm: "BuyerTest2026!" }
  }, userJar);
  assert.equal(setup.data.account.role, "user");
  assert.equal(setup.data.account.hasPassword, true);
  assert.equal((await request(baseUrl, "/api/auth/request-email", {
    method: "POST",
    body: { email: "integration-buyer@example.com" }
  }, userJar)).data.passwordAvailable, true);
  const codeLogin = await request(baseUrl, "/api/auth/verify-email", {
    method: "POST",
    body: { email: "integration-buyer@example.com", code: "123456" }
  }, userJar);
  assert.equal(codeLogin.response.status, 200);
  assert.equal(codeLogin.data.account.hasPassword, true);

  await request(baseUrl, "/api/store", {
    method: "PATCH",
    body: {
      changes: {
        profile: { name: "Integration Buyer", phone: "+79990000000", address: "Москва" },
        cart: { [product.id]: 1 }
      }
    }
  }, userJar);
  const personal = await request(baseUrl, "/api/store", {}, userJar);
  assert.equal(personal.data.state.profile.name, "Integration Buyer");
  assert.equal(personal.data.state.cart[product.id], 1);

  const orderPayload = {
    idempotencyKey: "integration-order-key",
    total: 93500,
    profile: { name: "Integration Buyer", phone: "+79990000000", address: "Москва" },
    items: [{ id: product.id, name: product.name, quantity: 1 }]
  };
  const orderFirst = await request(baseUrl, "/api/orders", {
    method: "POST",
    headers: { "Idempotency-Key": orderPayload.idempotencyKey },
    body: orderPayload
  }, userJar);
  const orderSecond = await request(baseUrl, "/api/orders", {
    method: "POST",
    headers: { "Idempotency-Key": orderPayload.idempotencyKey },
    body: orderPayload
  }, userJar);
  assert.equal(orderFirst.response.status, 201);
  assert.equal(orderSecond.response.status, 200);
  assert.equal(orderSecond.data.duplicate, true);
  assert.equal(orderFirst.data.order.id, orderSecond.data.order.id);

  const orderUpdated = await request(baseUrl, `/api/orders/${encodeURIComponent(orderFirst.data.order.id)}`, {
    method: "PATCH",
    body: { status: "confirmed", paidAmount: 10000 }
  }, adminJar);
  assert.equal(orderUpdated.data.order.status, "confirmed");
  const customerAfterUpdate = await request(baseUrl, "/api/store", {}, userJar);
  const customerOrder = customerAfterUpdate.data.state.orders.find((item) => item.id === orderFirst.data.order.id);
  assert.equal(customerOrder.status, "confirmed");
  assert.equal(customerOrder.paidAmount, 10000);

  assert.ok(fs.readdirSync(path.join(dataDir, "outbox")).some((name) => name.endsWith(".json")));
});
