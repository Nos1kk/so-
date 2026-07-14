(function () {
  "use strict";

  const STORAGE_KEY = "sona.marketplace.v1";
  function apiUrl(path = "/api/store") {
    const localPreview = window.location.protocol === "file:"
      || (["127.0.0.1", "localhost"].includes(window.location.hostname) && window.location.port !== "8000");
    return localPreview ? `http://127.0.0.1:8000${path}` : path;
  }
  const fallbackState = {
    cart: {},
    favorites: [],
    viewedProductIds: [],
    profile: {
      isActive: false,
      name: "",
      email: "",
      phone: "",
      address: "",
      role: "user",
      registeredAt: "",
      notifications: {
        site: true,
        email: true,
        telegram: false,
        sound: true
      }
    },
    orders: [],
    reviews: [],
    users: [],
    accountSessions: [],
    productOverrides: {},
    customProducts: [],
    deletedProducts: [],
    supportMessages: [],
    analytics: { events: [] },
    admin: {
      isAuthenticated: false
    },
    shopSettings: {
      name: "Soна",
      supportPhone: "8 800 200-40-90",
      supportEmail: "sonahome@yandex.ru",
      address: "Москва",
      baseDiscount: 15,
      returnsPolicy: "Возврат и обмен по правилам магазина Soна."
    },
    customAds: [],
    homeCollections: {
      hits: [],
      new: []
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  let cache = null;
  let syncTimer = 0;
  let syncPromise = Promise.resolve();
  let syncInFlight = false;
  let syncPending = false;
  let syncVersion = 0;
  let syncedVersion = 0;
  let lastSyncError = null;
  let serverSnapshot = null;
  let serverRevision = 0;
  let storeEtag = "";
  let eventSource = null;
  const listeners = new Set();

  function normalize(parsed) {
    return {
      cart: parsed.cart && typeof parsed.cart === "object" ? parsed.cart : {},
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      viewedProductIds: Array.isArray(parsed.viewedProductIds) ? parsed.viewedProductIds : [],
      profile: parsed.profile && typeof parsed.profile === "object"
        ? { ...clone(fallbackState.profile), ...parsed.profile }
        : clone(fallbackState.profile),
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      accountSessions: Array.isArray(parsed.accountSessions) ? parsed.accountSessions : [],
      productOverrides: parsed.productOverrides && typeof parsed.productOverrides === "object" ? parsed.productOverrides : {},
      customProducts: Array.isArray(parsed.customProducts) ? parsed.customProducts : [],
      deletedProducts: Array.isArray(parsed.deletedProducts) ? parsed.deletedProducts : [],
      supportMessages: Array.isArray(parsed.supportMessages) ? parsed.supportMessages : [],
      analytics: parsed.analytics && typeof parsed.analytics === "object"
        ? { ...parsed.analytics, events: Array.isArray(parsed.analytics.events) ? parsed.analytics.events : [] }
        : clone(fallbackState.analytics),
      admin: parsed.admin && typeof parsed.admin === "object"
        ? { ...clone(fallbackState.admin), ...parsed.admin }
        : clone(fallbackState.admin),
      shopSettings: parsed.shopSettings && typeof parsed.shopSettings === "object"
        ? { ...clone(fallbackState.shopSettings), ...parsed.shopSettings }
        : clone(fallbackState.shopSettings),
      customAds: Array.isArray(parsed.customAds) ? parsed.customAds : [],
      homeCollections: parsed.homeCollections && typeof parsed.homeCollections === "object"
        ? {
          hits: Array.isArray(parsed.homeCollections.hits) ? parsed.homeCollections.hits : [],
          new: Array.isArray(parsed.homeCollections.new) ? parsed.homeCollections.new : []
        }
        : clone(fallbackState.homeCollections)
    };
  }

  function readLocalFallback() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return clone(fallbackState);
      }

      return normalize(JSON.parse(raw));
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
      return clone(fallbackState);
    }
  }

  function read() {
    if (!cache) {
      cache = readLocalFallback();
    }
    return clone(cache);
  }

  function changedTopLevel(previous, next) {
    const ignored = new Set(["analytics", "users", "admin"]);
    const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);
    return Object.fromEntries([...keys]
      .filter((key) => !ignored.has(key) && JSON.stringify(previous?.[key]) !== JSON.stringify(next?.[key]))
      .map((key) => [key, clone(next?.[key])]));
  }

  function notify(data, reason = "server") {
    listeners.forEach((listener) => {
      try { listener(clone(data), reason); } catch (error) { /* A listener must not break synchronization. */ }
    });
  }

  function syncNow() {
    if (!cache) return Promise.resolve(cache);
    if (syncInFlight) {
      syncPending = true;
      return syncPromise;
    }

    const snapshot = clone(cache);
    const changes = changedTopLevel(serverSnapshot || fallbackState, snapshot);
    if (!Object.keys(changes).length) {
      syncedVersion = Math.max(syncedVersion, syncVersion);
      serverSnapshot = snapshot;
      return Promise.resolve(cache);
    }
    const version = syncVersion;
    syncInFlight = true;
    syncPending = false;
    syncPromise = (async () => {
      let response = await fetch(apiUrl(), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ changes, baseRevision: serverRevision })
      });
      if ([404, 405].includes(response.status)) {
        response = await fetch(apiUrl(), {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ state: snapshot })
        });
      }
      if (!response.ok) throw new Error("Store sync failed");
      const payload = await response.json().catch(() => ({}));
      serverRevision = Math.max(serverRevision, Number(payload.revision) || 0);
      serverSnapshot = snapshot;
      syncedVersion = Math.max(syncedVersion, version);
      lastSyncError = null;
      return cache;
    })()
      .catch((error) => {
        lastSyncError = error;
        throw error;
      })
      .finally(() => {
        syncInFlight = false;
        if (syncPending || syncedVersion < syncVersion) {
          syncNow().catch(() => {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
            } catch (error) {
              // The in-memory cache still keeps the current session responsive.
            }
          });
        }
      });
    return syncPromise;
  }

  async function flushSync() {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const targetVersion = syncVersion;
      await syncNow().catch(() => null);
      if (syncedVersion >= targetVersion) return read();
    }
    if (lastSyncError) throw lastSyncError;
    return read();
  }

  async function refresh() {
    if (syncInFlight) return read();
    const headers = { Accept: "application/json" };
    if (storeEtag) headers["If-None-Match"] = storeEtag;
    const response = await fetch(apiUrl(), {
      credentials: "include",
      headers,
      cache: "no-cache"
    });
    if (response.status === 304) return read();
    if (!response.ok) throw new Error("Store refresh failed");
    const payload = await response.json();
    if (payload?.state) {
      const fresh = normalize(payload.state);
      const pendingChanges = syncedVersion < syncVersion ? changedTopLevel(serverSnapshot || fallbackState, cache) : {};
      cache = normalize({ ...fresh, ...pendingChanges });
      serverSnapshot = fresh;
      serverRevision = Math.max(serverRevision, Number(payload.revision) || 0);
      storeEtag = response.headers.get("ETag") || storeEtag;
    }
    return read();
  }

  function connectEvents() {
    if (!("EventSource" in window) || eventSource) return;
    eventSource = new EventSource(apiUrl("/api/events"), { withCredentials: true });
    eventSource.addEventListener("store", (event) => {
      let message = {};
      try { message = JSON.parse(event.data || "{}"); } catch (error) { return; }
      if (Number(message.revision) <= serverRevision) return;
      refresh().then((data) => notify(data, "realtime")).catch(() => null);
    });
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function scheduleSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncNow().catch(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
        } catch (error) {
          // Local fallback can fail in private mode; the in-memory cache still keeps the session alive.
        }
      });
    }, 120);
  }

  function write(state) {
    cache = normalize(state || {});
    syncVersion += 1;
    scheduleSync();
  }

  function update(recipe) {
    const state = read();
    recipe(state);
    write(state);
    return state;
  }

  function updateFromServer(recipe, options = {}) {
    window.clearTimeout(syncTimer);
    syncTimer = 0;
    const state = read();
    recipe(state);
    cache = normalize(state);
    serverSnapshot = clone(cache);
    syncedVersion = syncVersion;
    if (Number(options.revision) > serverRevision) {
      serverRevision = Number(options.revision);
      storeEtag = "";
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch (error) {
      // The server is authoritative; local persistence is only a fast fallback.
    }
    return read();
  }

  function clearProfile() {
    return update((state) => {
      state.profile = clone(fallbackState.profile);
      state.admin = clone(fallbackState.admin);
    });
  }

  async function init() {
    cache = readLocalFallback();
    try {
      await refresh();
    } catch (error) {
      cache = readLocalFallback();
    }
    serverSnapshot = clone(cache);
    connectEvents();
    return cache;
  }

  window.SonaStore = {
    init,
    read,
    refresh,
    write,
    syncNow,
    flushSync,
    update,
    updateFromServer,
    clearProfile,
    subscribe
  };
})();
