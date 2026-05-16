(function () {
  "use strict";

  const STORAGE_KEY = "sona.marketplace.v1";
  const fallbackState = {
    cart: {},
    favorites: [],
    profile: {
      isActive: false,
      name: "",
      email: "",
      phone: "",
      address: "",
      role: "user",
      registeredAt: ""
    },
    orders: [],
    reviews: [],
    users: [],
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

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return clone(fallbackState);
      }

      const parsed = JSON.parse(raw);
      return {
        cart: parsed.cart && typeof parsed.cart === "object" ? parsed.cart : {},
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        profile: parsed.profile && typeof parsed.profile === "object"
          ? { ...clone(fallbackState.profile), ...parsed.profile }
          : clone(fallbackState.profile),
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
        users: Array.isArray(parsed.users) ? parsed.users : [],
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
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
      return clone(fallbackState);
    }
  }

  function write(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

  window.SonaStore = {
    read,
    write,
    update,
    clearProfile
  };
})();
