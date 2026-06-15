(function () {
  "use strict";

  const STORAGE_KEY = "sona.marketplace.v1";
  const API_URL = "/api/store";
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
    admin: {
      isAuthenticated: false
    },
    shopSettings: {
      name: "Soна",
      supportPhone: "8 800 200-40-90",
      supportEmail: "support@sona.local",
      address: "Москва",
      baseDiscount: 15,
      returnsPolicy: "Возврат и обмен по правилам магазина Soна."
    },
    customAds: []
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  let cache = null;
  let syncTimer = 0;

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
      admin: parsed.admin && typeof parsed.admin === "object"
        ? { ...clone(fallbackState.admin), ...parsed.admin }
        : clone(fallbackState.admin),
      shopSettings: parsed.shopSettings && typeof parsed.shopSettings === "object"
        ? { ...clone(fallbackState.shopSettings), ...parsed.shopSettings }
        : clone(fallbackState.shopSettings),
      customAds: Array.isArray(parsed.customAds) ? parsed.customAds : []
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

  async function syncNow() {
    if (!cache) return cache;
    const response = await fetch(API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ state: cache })
    });
    if (!response.ok) {
      throw new Error("Store sync failed");
    }
    return cache;
  }

  async function refresh() {
    const response = await fetch(API_URL, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("Store refresh failed");
    const payload = await response.json();
    if (payload?.state) cache = normalize(payload.state);
    return read();
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
    scheduleSync();
  }

  function update(recipe) {
    const state = read();
    recipe(state);
    write(state);
    return state;
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
      const response = await fetch(API_URL, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        if (payload && payload.state) {
          cache = normalize(payload.state);
          return cache;
        }
      }

      await syncNow();
    } catch (error) {
      cache = readLocalFallback();
    }
    return cache;
  }

  window.SonaStore = {
    init,
    read,
    refresh,
    write,
    syncNow,
    update,
    clearProfile
  };
})();
