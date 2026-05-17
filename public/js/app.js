(function () {
  "use strict";

  const security = window.SonaSecurity;
  const store = window.SonaStore;
  const ALL_VALUE = "все";

  const state = {
    route: "home",
    mobileAction: "home",
    products: [],
    baseProducts: [],
    filters: {
      section: ALL_VALUE,
      category: ALL_VALUE,
      group: "",
      size: ALL_VALUE,
      maxPrice: 260000,
      fastDelivery: false,
      saleOnly: false,
      favoritesOnly: false,
      query: "",
      sort: "popular"
    }
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SORT_LABELS = {
    popular: "по популярности",
    priceAsc: "сначала дешевле",
    priceDesc: "сначала дороже",
    rating: "по рейтингу"
  };
  const DEFAULT_ADS = [
    {
      eyebrow: "",
      title: "",
      badge: "",
      cta: "",
      visual: "assets/ads/sona-living-01.png",
      fullBleed: true,
      focal: "center center",
      mobileFocal: "58% center"
    },
    {
      eyebrow: "",
      title: "",
      badge: "",
      cta: "",
      visual: "assets/ads/sona-living-02.png",
      fullBleed: true,
      focal: "center center",
      mobileFocal: "63% center"
    },
    {
      eyebrow: "",
      title: "",
      badge: "",
      cta: "",
      visual: "assets/ads/sona-bedroom-03.png",
      fullBleed: true,
      focal: "center center",
      mobileFocal: "67% center"
    }
  ];
  let revealObserver;
  let particlesStarted = false;
  let activeAdIndex = 0;
  let adTimer = 0;

  const els = {
    marketplace: document.querySelector(".marketplace"),
    productGrid: document.getElementById("productGrid"),
    popularProductGrid: document.getElementById("popularProductGrid"),
    newProductGrid: document.getElementById("newProductGrid"),
    saleProductGrid: document.getElementById("saleProductGrid"),
    heroCarousel: document.getElementById("heroCarousel"),
    heroTrack: document.getElementById("heroTrack"),
    heroDots: document.getElementById("heroDots"),
    heroPrev: document.getElementById("heroPrev"),
    heroNext: document.getElementById("heroNext"),
    heroAdUpload: document.getElementById("heroAdUpload"),
    emptyState: document.getElementById("emptyState"),
    categoryFilters: document.getElementById("categoryFilters"),
    sizeFilters: document.getElementById("sizeFilters"),
    priceRange: document.getElementById("priceRange"),
    priceValue: document.getElementById("priceValue"),
    fastDeliveryOnly: document.getElementById("fastDeliveryOnly"),
    saleOnly: document.getElementById("saleOnly"),
    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    sortControl: document.getElementById("sortControl"),
    sortDropdownButton: document.getElementById("sortDropdownButton"),
    sortLabel: document.getElementById("sortLabel"),
    sortOptions: document.querySelectorAll("[data-sort-option]"),
    quickLinks: document.querySelectorAll("[data-quick-filter]"),
    catalogTitle: document.getElementById("catalogTitle"),
    resetFilters: document.getElementById("resetFilters"),
    filterButton: document.getElementById("filterButton"),
    filterDrawer: document.getElementById("filterDrawer"),
    catalogTabs: document.querySelectorAll("[data-catalog-tab]"),
    catalogViews: document.querySelectorAll("[data-catalog-view]"),
    mobileConsultButton: document.getElementById("mobileConsultButton"),
    mobileConsultMenu: document.getElementById("mobileConsultMenu"),
    mobileSupportOpen: document.getElementById("mobileSupportOpen"),
    cartButton: document.getElementById("cartButton"),
    favoritesButton: document.getElementById("favoritesButton"),
    profilePage: document.getElementById("profilePage"),
    profilePageContent: document.getElementById("profilePageContent"),
    favoritesPage: document.getElementById("favoritesPage"),
    favoritesPageContent: document.getElementById("favoritesPageContent"),
    adminPage: document.getElementById("adminPage"),
    adminPageContent: document.getElementById("adminPageContent"),
    supportChatRoot: document.getElementById("supportChatRoot"),
    cartPage: document.getElementById("cartPage"),
    cartBadge: document.getElementById("cartBadge"),
    mobileCartBadge: document.getElementById("mobileCartBadge"),
    cartCountLabel: document.getElementById("cartCountLabel"),
    cartItems: document.getElementById("cartItems"),
    cartSubtotal: document.getElementById("cartSubtotal"),
    deliveryPrice: document.getElementById("deliveryPrice"),
    cartTotal: document.getElementById("cartTotal"),
    checkoutButton: document.getElementById("checkoutButton"),
    productModal: document.getElementById("productModal"),
    productDetail: document.getElementById("productDetail"),
    profileButton: document.getElementById("profileButton"),
    profileButtonLabel: document.getElementById("profileButtonLabel"),
    profileModal: document.getElementById("profileModal"),
    profileForm: document.getElementById("profileForm"),
    profileDisplayName: document.getElementById("profileDisplayName"),
    profileNameInput: document.getElementById("profileNameInput"),
    profileEmailInput: document.getElementById("profileEmailInput"),
    profilePhoneInput: document.getElementById("profilePhoneInput"),
    profileAddressInput: document.getElementById("profileAddressInput"),
    profileCartCount: document.getElementById("profileCartCount"),
    profileFavoriteCount: document.getElementById("profileFavoriteCount"),
    profileOrderCount: document.getElementById("profileOrderCount"),
    profileCloseButton: document.getElementById("profileCloseButton"),
    profileDoneButton: document.getElementById("profileDoneButton"),
    favoriteList: document.getElementById("favoriteList"),
    orderList: document.getElementById("orderList"),
    clearProfile: document.getElementById("clearProfile"),
    toast: document.getElementById("toast")
  };

  const formatter = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  });

  function money(value) {
    return formatter.format(value);
  }

  function displayText(value) {
    return window.SonaText?.fix(value) || String(value ?? "");
  }

  function byId(id) {
    return state.products.find((product) => product.id === id);
  }

  function applyProductAdminState(products, data = store.read(), options = {}) {
    const deleted = new Set(data.deletedProducts || []);
    const overrides = data.productOverrides || {};
    const custom = Array.isArray(data.customProducts) ? data.customProducts : [];

    return [...products, ...custom]
      .filter((product) => product?.id && !deleted.has(product.id))
      .map((product) => ({
        ...product,
        ...(overrides[product.id] || {})
      }))
      .filter((product) => options.includeHidden || !product.hidden);
  }

  function refreshProductsFromAdmin() {
    state.products = applyProductAdminState(state.baseProducts);
  }

  function saveAdminProduct(product) {
    const productInput = { ...product };
    delete productInput.imageFile;
    const cleanId = security.safeProductId(product.id || product.name || `product-${Date.now()}`) || `product-${Date.now()}`;
    const normalized = {
      ...productInput,
      id: cleanId,
      name: security.sanitizeText(product.name || "Новый товар", 80),
      brand: security.sanitizeText(product.brand || "Soна", 50),
      category: security.sanitizeText(product.category || "Мебель", 50),
      marketSection: security.sanitizeText(product.marketSection || "Мебель", 50),
      size: security.sanitizeText(product.size || "M", 10),
      price: Math.max(0, Number(product.price) || 0),
      oldPrice: Math.max(0, Number(product.oldPrice) || 0),
      stock: Math.max(0, Number(product.stock) || 0),
      deliveryDays: Math.max(1, Number(product.deliveryDays) || 3),
      status: product.status || "active",
      hidden: Boolean(product.hidden),
      room: security.sanitizeText(product.room || "", 40),
      dimensions: security.sanitizeText(product.dimensions || "", 80),
      warranty: security.sanitizeText(product.warranty || "", 60),
      supplier: security.sanitizeText(product.supplier || "", 70),
      description: security.sanitizeText(product.description || "", 600),
      colors: String(product.colors || "")
        .split(",")
        .map((color) => security.sanitizeText(color.trim(), 24))
        .filter(Boolean),
      materials: String(product.materials || "")
        .split(",")
        .map((item) => security.sanitizeText(item, 40))
        .filter(Boolean),
      specs: String(product.specs || "")
        .split(",")
        .map((item) => security.sanitizeText(item, 60))
        .filter(Boolean),
      tags: String(product.tags || "")
        .split(",")
        .map((tag) => security.sanitizeText(tag, 24))
        .filter(Boolean)
    };

    store.update((data) => {
      const baseExists = state.baseProducts.some((item) => item.id === cleanId);
      if (baseExists) {
        data.productOverrides = {
          ...(data.productOverrides || {}),
          [cleanId]: normalized
        };
      } else {
        const rows = (data.customProducts || []).filter((item) => item.id !== cleanId);
        rows.push(normalized);
        data.customProducts = rows;
      }
      data.deletedProducts = (data.deletedProducts || []).filter((id) => id !== cleanId);
    });

    refreshProductsFromAdmin();
    render();
    showToast("Товар сохранён");
  }

  function deleteAdminProduct(productId) {
    store.update((data) => {
      data.deletedProducts = [...new Set([...(data.deletedProducts || []), productId])];
      data.customProducts = (data.customProducts || []).filter((item) => item.id !== productId);
    });

    refreshProductsFromAdmin();
    render();
    showToast("Товар удалён с витрины");
  }

  function updateAdminOrder(orderId, patch) {
    store.update((data) => {
      data.orders = (data.orders || []).map((order) => (
        order.id === orderId ? { ...order, ...patch } : order
      ));
    });
    render();
  }

  function deleteAdminOrder(orderId) {
    store.update((data) => {
      data.orders = (data.orders || []).filter((order) => order.id !== orderId);
    });
    render();
  }

  function updateAdminReview(reviewId, patch) {
    store.update((data) => {
      data.reviews = (data.reviews || []).map((review) => (
        review.id === reviewId ? { ...review, ...patch } : review
      ));
    });
    render();
  }

  function updateAdminUser(phone, patch) {
    store.update((data) => {
      data.users = (data.users || []).map((user) => (
        user.phone === phone ? { ...user, ...patch } : user
      ));
      if (data.profile?.phone === phone) {
        data.profile = { ...data.profile, ...patch };
      }
    });
    render();
  }

  function saveAdminAd(ad) {
    store.update((data) => {
      const id = ad.id || `AD-${Date.now()}`;
      const rows = (data.customAds || []).filter((item) => item.id !== id);
      const adInput = { ...ad };
      delete adInput.visualFile;
      rows.push({
        ...adInput,
        id,
        title: security.sanitizeText(ad.title, 90),
        eyebrow: security.sanitizeText(ad.eyebrow || "Реклама Soна", 50),
        badge: security.sanitizeText(ad.badge || "", 40),
        cta: security.sanitizeText(ad.cta || "Смотреть", 40),
        link: security.sanitizeText(ad.link || "#catalog", 120),
        active: ad.active !== false,
        uploaded: Boolean(ad.uploaded || (ad.visual && !ad.title))
      });
      data.customAds = rows;
    });
    renderAds();
    renderAdminPage();
  }

  function deleteAdminAd(adId) {
    store.update((data) => {
      data.customAds = (data.customAds || []).filter((ad) => ad.id !== adId);
    });
    renderAds();
    renderAdminPage();
  }

  function saveShopSettings(settings) {
    store.update((data) => {
      data.shopSettings = {
        ...(data.shopSettings || {}),
        ...settings
      };
    });
    renderAdminPage();
  }

  function reviewSummary(productId, data = store.read()) {
    return window.SonaReviews?.summary(data.reviews || [], productId) || { count: 0, average: 0, label: "0 отзывов" };
  }

  function reviewLabel(productId, data = store.read()) {
    const summary = reviewSummary(productId, data);
    return summary.count ? `${summary.average} ★ · ${summary.count} оценок` : "0 отзывов";
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = displayText(text);
    }
    return element;
  }

  function createSvgIcon(name, className) {
    const icons = {
      heart: ["M12 20.1s-7.4-4.4-8.9-9.2C2 7.4 4.1 4.2 7.6 4.2c2 0 3.4 1 4.4 2.4 1-1.4 2.4-2.4 4.4-2.4 3.5 0 5.6 3.2 4.5 6.7-1.5 4.8-8.9 9.2-8.9 9.2Z"],
      close: ["M6.5 6.5 17.5 17.5", "M17.5 6.5 6.5 17.5"]
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add(className || "inline-icon");
    (icons[name] || icons.heart).forEach((d) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", name === "close" ? "none" : "currentColor");
      path.setAttribute("stroke", name === "close" ? "currentColor" : "none");
      path.setAttribute("stroke-width", name === "close" ? "2.4" : "0");
      path.setAttribute("stroke-linecap", "round");
      svg.append(path);
    });
    return svg;
  }

  function showToast(message) {
    els.toast.textContent = displayText(message);
    els.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      els.toast.classList.remove("is-visible");
    }, 2400);
  }

  function routeFromLocation() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";

    if (path === "/cart" || window.location.hash === "#cart") return "cart";
    if (path === "/admin") return "admin";
    if (path === "/profile") return "profile";
    if (path === "/favorites") return "favorites";
    return "home";
  }

  function routePath(route) {
    if (route === "cart") return "/cart";
    if (route === "profile") return "/profile";
    if (route === "favorites") return "/favorites";
    if (route === "admin") return "/admin";
    return "/";
  }

  function navigateTo(route, syncUrl = true) {
    const nextRoute = ["home", "profile", "cart", "favorites", "admin"].includes(route) ? route : "home";

    state.route = nextRoute;
    state.mobileAction = nextRoute === "admin" ? "profile" : nextRoute;
    closeFilters();
    closeProduct();
    closeSortMenu();
    renderRoute();

    if (syncUrl) {
      const nextPath = routePath(nextRoute);
      if (window.location.pathname !== nextPath || window.location.hash) {
        window.history.pushState({ route: nextRoute }, "", nextPath);
      }
    }

    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function goToCatalog() {
    state.filters.favoritesOnly = false;
    navigateTo("home");
    state.mobileAction = "catalog";
    updateNavState();
    window.requestAnimationFrame(() => {
      document.getElementById("catalog")?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  function getAds() {
    const data = store.read();
    const customAds = (data.customAds || []).filter((ad) => {
      const title = String(ad.title || "").toLowerCase();
      const eyebrow = String(ad.eyebrow || "").toLowerCase();
      const visual = String(ad.visual || "");
      return ad.active !== false
        && !ad.uploaded
        && !visual.startsWith("data:")
        && !title.includes("новый баннер")
        && !eyebrow.includes("ваша реклама");
    });
    return [...DEFAULT_ADS, ...customAds].filter((ad) => ad.active !== false);
  }

  function createAdSlide(ad, index) {
    const isFullBleedAd = Boolean(ad.fullBleed || (ad.uploaded && !ad.title));
    const slide = createElement("article", "hero-slide");
    const copy = createElement("div", "hero-copy");
    const visual = createElement("div", "hero-sofa");
    const eyebrow = createElement("p", "eyebrow", ad.eyebrow || "Soна");
    const title = createElement("h1", "", ad.title || "Реклама Soна");
    const badge = createElement("div", "discount-pill", ad.badge || "акция");
    const button = createElement("button", "light-button", ad.cta || "Смотреть");

    slide.dataset.adIndex = String(index);
    slide.classList.toggle("is-uploaded-ad", isFullBleedAd);
    slide.classList.toggle("is-brand-ad", Boolean(ad.fullBleed));
    if (ad.focal) {
      slide.style.setProperty("--ad-focal", ad.focal);
    }
    if (ad.mobileFocal) {
      slide.style.setProperty("--ad-mobile-focal", ad.mobileFocal);
    }
    button.type = "button";
    button.addEventListener("click", () => {
      const target = ad.link || "#catalog";
      if (target.startsWith("#")) {
        document.querySelector(target)?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
      } else {
        window.location.href = target;
      }
    });

    if (ad.visual) {
      const image = document.createElement("img");
      image.src = ad.visual;
      image.alt = "";
      visual.append(image);
    } else {
      visual.append(createElement("div", "hero-ad-placeholder", "Soна"));
    }

    if (isFullBleedAd) {
      if (ad.eyebrow) {
        copy.append(eyebrow);
      }
    } else {
      copy.append(eyebrow, title, badge, button);
    }

    if (copy.childNodes.length) {
      slide.append(copy);
    }
    slide.append(visual);
    return slide;
  }

  function setActiveAd(index) {
    const ads = getAds();
    if (!ads.length) return;

    activeAdIndex = (index + ads.length) % ads.length;
    els.heroTrack.querySelectorAll(".hero-slide").forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === activeAdIndex);
    });
    els.heroDots.querySelectorAll("button").forEach((button, dotIndex) => {
      button.classList.toggle("is-active", dotIndex === activeAdIndex);
      button.setAttribute("aria-current", dotIndex === activeAdIndex ? "true" : "false");
    });
  }

  function resetAdTimer() {
    window.clearInterval(adTimer);
    if (reduceMotion) return;
    adTimer = window.setInterval(() => setActiveAd(activeAdIndex + 1), 10000);
  }

  function renderAds() {
    const ads = getAds();
    els.heroTrack.replaceChildren(...ads.map(createAdSlide));
    els.heroDots.replaceChildren(...ads.map((ad, index) => {
      const dot = createElement("button", "", String(index + 1));
      dot.type = "button";
      dot.setAttribute("aria-label", `Показать рекламу ${index + 1}`);
      dot.addEventListener("click", () => {
        setActiveAd(index);
        resetAdTimer();
      });
      return dot;
    }));
    setActiveAd(Math.min(activeAdIndex, ads.length - 1));
    resetAdTimer();
  }

  function handleAdUpload(event) {
    const file = event.target.files?.[0];
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!file) return;

    if (!allowedTypes.includes(file.type)) {
      showToast("Загрузите PNG, JPG или WebP");
      event.target.value = "";
      return;
    }

    if (file.size > 900000) {
      showToast("Файл рекламы должен быть до 900 КБ");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      store.update((data) => {
        data.customAds = [
          ...(data.customAds || []),
          {
            eyebrow: "ваша реклама",
            title: "",
            badge: "",
            cta: "",
            uploaded: true,
            visual: String(reader.result || "")
          }
        ].slice(-6);
      });
      renderAds();
      setActiveAd(getAds().length - 1);
      showToast("Реклама добавлена в баннер");
      event.target.value = "";
    });
    reader.readAsDataURL(file);
  }

  function renderFilterButtons() {
    const categories = [ALL_VALUE, ...new Set(state.products.map((product) => product.category))];
    const sizes = [ALL_VALUE, "S", "M", "L", "XL"];

    els.categoryFilters.replaceChildren(...categories.map((category) => {
      const label = category === ALL_VALUE ? "все товары" : category;
      const button = createElement("button", "chip", label);
      button.type = "button";
      button.classList.toggle("is-active", state.filters.category === category);
      button.addEventListener("click", () => {
        state.filters.section = ALL_VALUE;
        state.filters.category = category;
        state.filters.group = "";
        state.filters.favoritesOnly = false;
        render();
      });
      return button;
    }));

    els.sizeFilters.replaceChildren(...sizes.map((size) => {
      const button = createElement("button", "", size === ALL_VALUE ? "любой" : size);
      button.type = "button";
      button.classList.toggle("is-active", state.filters.size === size);
      button.addEventListener("click", () => {
        state.filters.size = size;
        render();
      });
      return button;
    }));

    document.querySelectorAll("[data-category-shortcut]").forEach((button) => {
      const shortcut = button.dataset.categoryShortcut || ALL_VALUE;
      const category = shortcut === "все" ? ALL_VALUE : shortcut;
      button.classList.toggle("is-active", category === state.filters.category && !state.filters.group);
    });
    updateQuickNav();
  }

  function updateQuickNav() {
    els.quickLinks.forEach((link) => {
      const sale = link.dataset.sale === "true";
      const section = link.dataset.section || ALL_VALUE;
      const category = link.dataset.category || ALL_VALUE;
      const group = link.dataset.group || "";
      const active = sale
        ? state.route === "home" && state.filters.saleOnly
        : state.route === "home" &&
          !state.filters.saleOnly &&
          state.filters.section === section &&
          state.filters.category === category &&
          state.filters.group === group;

      link.classList.toggle("is-active", active);
    });

    els.favoritesButton?.classList.toggle("is-active", state.route === "favorites");
  }

  function getFilteredProducts() {
    const query = state.filters.query.toLowerCase();
    const data = store.read();
    const favoriteIds = new Set(data.favorites);

    const filtered = state.products.filter((product) => {
      const text = [
        product.name,
        product.brand,
        product.category,
        product.marketSection,
        product.size,
        ...(product.materials || []),
        ...(product.specs || []),
        ...(product.tags || [])
      ].join(" ").toLowerCase();

      return (
        (state.filters.section === ALL_VALUE || product.marketSection === state.filters.section) &&
        (!state.filters.group || (
          state.filters.group === "sofas" &&
          ["прямой", "угловой", "модульный", "диван-кровать"].includes(product.category)
        )) &&
        (state.filters.category === ALL_VALUE || product.category === state.filters.category) &&
        (state.filters.size === ALL_VALUE || product.size === state.filters.size) &&
        product.price <= state.filters.maxPrice &&
        (!state.filters.fastDelivery || product.deliveryDays <= 3) &&
        (!state.filters.saleOnly || Boolean(product.oldPrice)) &&
        (!state.filters.favoritesOnly || favoriteIds.has(product.id)) &&
        (!query || text.includes(query))
      );
    });

    return filtered.sort((a, b) => {
      if (state.filters.sort === "priceAsc") return a.price - b.price;
      if (state.filters.sort === "priceDesc") return b.price - a.price;
      const summaryA = reviewSummary(a.id, data);
      const summaryB = reviewSummary(b.id, data);
      if (state.filters.sort === "rating") return summaryB.average - summaryA.average;
      const reviewDelta = summaryB.count - summaryA.count;
      if (reviewDelta !== 0) return reviewDelta;
      return summaryB.average - summaryA.average;
    });
  }

  function renderProducts() {
    const data = store.read();
    const products = getFilteredProducts();
    const cards = products.map((product) => createProductCard(product, data));

    els.productGrid.replaceChildren(...cards);
    els.emptyState.hidden = products.length > 0;
    els.emptyState.textContent = state.filters.favoritesOnly
      ? "В избранном пока пусто. Нажмите на сердечко в карточке товара, чтобы добавить его сюда."
      : "Ничего не найдено. Попробуйте изменить фильтры.";
    updateCatalogTitle();
    updateQuickNav();
    observeAnimatedElements();
  }

  function renderHomeSections() {
    const data = store.read();
    const visible = state.products.filter((product) => !product.hidden);
    const sale = visible
      .filter((product) => product.oldPrice)
      .sort((a, b) => ((b.oldPrice || 0) - (b.price || 0)) - ((a.oldPrice || 0) - (a.price || 0)))
      .slice(0, 4);
    const popular = visible
      .slice()
      .sort((a, b) => (Number(b.reviews || b.reviewsCount) || 0) - (Number(a.reviews || a.reviewsCount) || 0))
      .slice(0, 4);
    const newItems = visible
      .filter((product) => (product.tags || []).includes("новинка") || ["Кухни", "Услуги"].includes(product.marketSection))
      .slice(0, 4);

    if (els.saleProductGrid) {
      els.saleProductGrid.replaceChildren(...sale.map((product, index) => createLookbookDealCard(product, data, index)));
    }
    if (els.popularProductGrid) {
      els.popularProductGrid.replaceChildren(...popular.map((product) => createProductCard(product, data)));
    }
    if (els.newProductGrid) {
      els.newProductGrid.replaceChildren(...(newItems.length ? newItems : visible.slice(4, 8)).map((product) => createProductCard(product, data)));
    }
  }

  function createLookbookDealCard(product, data, index) {
    const isFavorite = data.favorites.includes(product.id);
    const discount = product.oldPrice ? Math.max(0, Math.round((1 - product.price / product.oldPrice) * 100)) : 0;
    const card = createElement("article", `lookbook-card ${index === 0 ? "is-featured" : ""}`);
    const media = createElement("button", "lookbook-media");
    const copy = createElement("div", "lookbook-copy");
    const top = createElement("div", "lookbook-topline");
    const number = createElement("span", "lookbook-number", String(index + 1).padStart(2, "0"));
    const collection = createElement("span", "", product.marketSection || product.category || "SONA");
    const favorite = createElement("button", "lookbook-favorite");
    const title = createElement("h3", "", product.name);
    const price = createElement("div", "lookbook-price");
    const meta = createElement("div", "lookbook-meta");
    const actions = createElement("div", "lookbook-actions");
    const details = createElement("button", "lookbook-link", "Смотреть");
    const cart = createElement("button", "lookbook-cart", product.category === "услуга" ? "Заказать" : "В корзину");

    card.style.setProperty("--stagger", `${index * 90}ms`);
    media.type = "button";
    media.setAttribute("aria-label", `Открыть ${product.name}`);
    media.append(createProductPlaceholder(product, index === 0 ? "предложение недели" : "акция"));
    media.addEventListener("click", () => openProduct(product.id));

    favorite.type = "button";
    favorite.setAttribute("aria-label", isFavorite ? "Удалить из избранного" : "Добавить в избранное");
    favorite.classList.toggle("is-active", isFavorite);
    favorite.append(createSvgIcon("heart", "favorite-icon"));
    favorite.addEventListener("click", () => toggleFavorite(product.id));

    top.append(number, collection);
    price.append(createElement("strong", "", product.priceMode === "from" ? `от ${money(product.price)}` : money(product.price)));
    if (product.oldPrice) {
      price.append(createElement("del", "", money(product.oldPrice)), createElement("span", "lookbook-discount", `−${discount}%`));
    }
    (product.specs || product.materials || []).slice(0, index === 0 ? 3 : 2).forEach((item) => {
      meta.append(createElement("span", "", item));
    });
    meta.append(createElement("span", "", product.deliveryDays <= 3 ? "быстрая доставка" : `доставка ${product.deliveryDays} дн.`));

    details.type = "button";
    cart.type = "button";
    details.addEventListener("click", () => openProduct(product.id));
    cart.addEventListener("click", () => addToCart(product.id, cart));
    actions.append(details, cart);
    copy.append(top, title, price, meta, actions);
    card.append(media, favorite, copy);
    return card;
  }

  function updateCatalogTitle() {
    let title = "Все товары";

    if (state.filters.favoritesOnly) {
      title = "Избранное SONA";
    } else if (state.filters.saleOnly) {
      title = "Распродажа SONA";
    } else if (state.filters.group === "sofas") {
      title = "Диваны SONA";
    } else if (state.filters.category === "кресло") {
      title = "Кресла SONA";
    } else if (state.filters.section === "Мебель") {
      title = "Мебель SONA";
    } else if (state.filters.section === "Кухни") {
      title = "Кухни SONA";
    } else if (state.filters.section === "Услуги") {
      title = "Услуги и дизайн SONA";
    }

    els.catalogTitle.textContent = displayText(title);
  }

  function initExperience() {
    renderAds();
    initRevealObserver();
    bindHeaderMotion();
    bindButtonRipples();
    bindCardTilt();
    bindHeroPointer();
    bindParallax();
    observeAnimatedElements();
  }

  function bindHeaderMotion() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    let scheduled = false;
    const update = () => {
      scheduled = false;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      header.classList.toggle("is-elevated", scrollTop > 8);
      header.classList.toggle("is-compact", scrollTop > 44);
    };

    const request = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    update();
  }

  function initRevealObserver() {
    if (revealObserver || reduceMotion) return;

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  }

  function observeAnimatedElements() {
    if (reduceMotion) return;

    const targets = document.querySelectorAll(
      ".hero-banner, .catalog-hub, .catalog-hub-card, .category-rail, .deal-strip, .home-section, .home-category-card, .catalog-toolbar, .listing-filter-bar, .product-card, .service-card"
    );

    targets.forEach((target, index) => {
      if (target.dataset.revealReady) return;
      target.dataset.revealReady = "true";
      target.classList.add("reveal");
      target.style.transitionDelay = `${Math.min(index % 8, 6) * 35}ms`;
      revealObserver?.observe(target);
    });
  }

  function bindButtonRipples() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button, .light-button, .primary-button, .soft-button, .filter-pill, .sale-switch");
      if (!button || reduceMotion) return;

      const rect = button.getBoundingClientRect();
      const ripple = createElement("span", "button-ripple");
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      button.append(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    });
  }

  function bindCardTilt() {
    if (reduceMotion) return;

    els.productGrid.addEventListener("mousemove", (event) => {
      const card = event.target.closest(".product-card");
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      card.style.setProperty("--tilt-x", `${(0.5 - y) * 5}deg`);
      card.style.setProperty("--tilt-y", `${(x - 0.5) * 5}deg`);
      card.style.setProperty("--shine-x", `${x * 100}%`);
    });

    els.productGrid.addEventListener("mouseleave", () => {
      els.productGrid.querySelectorAll(".product-card").forEach((card) => {
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
        card.style.setProperty("--shine-x", "50%");
      });
    });
  }

  function bindHeroPointer() {
    if (reduceMotion) return;

    const hero = document.querySelector(".hero-banner");
    if (!hero) return;

    const reset = () => {
      hero.style.setProperty("--hero-mx", "0px");
      hero.style.setProperty("--hero-my", "0px");
      hero.style.setProperty("--hero-bg-x", "84%");
      hero.style.setProperty("--hero-bg-y", "28%");
    };

    hero.addEventListener("mousemove", (event) => {
      const rect = hero.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

      hero.style.setProperty("--hero-mx", `${x * 10}px`);
      hero.style.setProperty("--hero-my", `${y * 8}px`);
      hero.style.setProperty("--hero-bg-x", `${84 + x * 2}%`);
      hero.style.setProperty("--hero-bg-y", `${28 + y * 3}%`);
    }, { passive: true });

    hero.addEventListener("mouseleave", reset);
    reset();
  }

  function bindParallax() {
    if (reduceMotion) return;

    let scheduled = false;
    const update = () => {
      scheduled = false;
      document.querySelectorAll(".hero-banner, .catalog-hub, .deal-strip").forEach((element) => {
        const rect = element.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const offset = (viewportCenter - center) * 0.035;
        element.style.setProperty("--parallax-y", `${Math.max(-16, Math.min(16, offset))}px`);
      });
    };

    const request = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    request();
  }

  function initParticles() {
    if (particlesStarted || reduceMotion) return;

    const canvas = document.getElementById("particleField");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const pointer = { x: -9999, y: -9999 };
    const particles = [];
    let width = 0;
    let height = 0;
    let rafId = 0;

    particlesStarted = true;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const count = Math.max(22, Math.min(52, Math.floor(width / 34)));
      particles.length = 0;
      for (let index = 0; index < count; index += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2.2 + 1.2,
          speedX: (Math.random() - 0.5) * 0.22,
          speedY: (Math.random() - 0.5) * 0.22,
          opacity: Math.random() * 0.22 + 0.08
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        const dx = pointer.x - particle.x;
        const dy = pointer.y - particle.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 120) {
          particle.x -= dx * 0.003;
          particle.y -= dy * 0.003;
        }

        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;

        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = `rgba(34, 58, 94, ${particle.opacity})`;
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        ctx.restore();
      });

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance < 94) {
            ctx.strokeStyle = `rgba(34, 58, 94, ${0.055 * (1 - distance / 94)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }, { passive: true });
    window.addEventListener("mouseleave", () => {
      pointer.x = -9999;
      pointer.y = -9999;
    });

    resize();
    rafId = requestAnimationFrame(draw);
    window.addEventListener("pagehide", () => cancelAnimationFrame(rafId), { once: true });
  }

  function createProductCard(product, data) {
    const isFavorite = data.favorites.includes(product.id);
    const card = createElement("article", "product-card");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Открыть ${product.name}`);
    card.addEventListener("click", () => openProduct(product.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProduct(product.id);
      }
    });

    const media = createElement("div", "product-media");
    const placeholder = createProductPlaceholder(product);
    const tagWrap = createElement("div", "product-tags");
    const favoriteButton = createElement("button", "favorite-button");
    const body = createElement("div", "product-body");
    const topLine = createElement("div", "product-top-line");
    const brand = createElement("span", "product-brand", product.brand || "Soна");
    const rating = createElement("span", "rating", `★ ${reviewLabel(product.id, data)}`);
    const titleRow = createElement("div", "product-title-row");
    const title = createElement("h3", "", product.name);
    const meta = createElement("div", "product-meta");
    const swatches = createElement("div", "swatches");
    const footer = createElement("div", "product-footer");
    const price = createElement("div", "price");
    const priceStrong = createElement("strong", "", money(product.price));
    const delivery = createElement("div", "delivery-note", product.deliveryDays <= 3 ? "доставим быстро" : `доставка от ${product.deliveryDays} дней`);
    const bonus = createElement("div", "bonus-note", `+ ${Math.max(300, Math.round(product.price * 0.02)).toLocaleString("ru-RU")} бонусов`);
    const addButton = createElement("button", "primary-button", product.category === "услуга" ? "Заказать" : "В корзину");

    if (product.oldPrice) {
      const discount = Math.round((1 - product.price / product.oldPrice) * 100);
      tagWrap.append(createElement("span", "tag discount-tag", `−${discount}%`));
    }

    (product.tags || []).slice(0, 2).forEach((tag) => {
      tagWrap.append(createElement("span", "tag", tag));
    });

    favoriteButton.type = "button";
    favoriteButton.setAttribute("aria-label", isFavorite ? "Удалить из избранного" : "Добавить в избранное");
    favoriteButton.classList.toggle("is-active", isFavorite);
    favoriteButton.append(createSvgIcon("heart", "favorite-icon"));
    favoriteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(product.id);
    });

    meta.append(createElement("span", "", product.marketSection || "Маркетплейс"));
    meta.append(createElement("span", "", product.category));

    (product.specs || []).slice(0, 3).forEach((spec) => {
      meta.append(createElement("span", "", spec));
    });

    (product.colors || []).forEach((color) => {
      const swatch = createElement("span", "swatch");
      swatch.style.background = color;
      swatches.append(swatch);
    });

    if (product.oldPrice) {
      const oldPrice = createElement("del", "", money(product.oldPrice));
      const economy = createElement("span", "economy", `экономия ${money(product.oldPrice - product.price)}`);
      price.append(priceStrong, oldPrice, economy);
    } else {
      price.append(priceStrong);
    }

    addButton.type = "button";
    addButton.addEventListener("click", (event) => {
      event.stopPropagation();
      addToCart(product.id, addButton);
    });

    topLine.append(brand, rating);
    titleRow.append(title);
    footer.append(price, bonus, delivery, addButton);
    media.append(placeholder, tagWrap, favoriteButton);
    body.append(topLine, titleRow, meta, swatches, footer);
    card.append(media, body);

    return card;
  }

  function createProductPlaceholder(product, viewLabel = "Фото товара") {
    const placeholder = createElement("div", "product-placeholder");
    if (product.image) {
      const image = document.createElement("img");
      image.src = product.image;
      image.alt = displayText(product.name || "");
      placeholder.classList.add("has-image");
      placeholder.append(image);
      return placeholder;
    }
    const section = createElement("span", "placeholder-section", product.marketSection || "SONA");
    const title = createElement("strong", "", product.name);
    const line = createElement("span", "placeholder-line", (product.specs || product.materials || []).slice(0, 2).join(" · "));
    const mark = createElement("i", "", viewLabel);

    placeholder.dataset.kind = product.marketSection || "market";
    placeholder.append(section, title, line, mark);
    return placeholder;
  }

  function openProduct(productId) {
    const product = byId(productId);
    if (!product) return;

    renderProductDetail(product);
    els.productModal.classList.add("is-open");
    els.productModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-lock");
  }

  function closeProduct() {
    els.productModal.classList.remove("is-open");
    els.productModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-lock");
  }

  function renderProductDetail(product) {
    const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
    const main = createElement("div", "detail-main");
    const gallery = createElement("div", "detail-gallery");
    const thumbList = createElement("div", "detail-thumbs");
    const stage = createElement("div", "detail-stage");
    const info = createElement("div", "detail-info");
    const close = createElement("button", "detail-close");
    const titleRow = createElement("div", "detail-title-row");
    const titleWrap = createElement("div");
    const title = createElement("h2", "", product.name);
    const code = createElement("span", "", `#${product.id.toUpperCase()}`);
    const rating = createElement("div", "detail-rating", `★ ${reviewLabel(product.id)}`);
    const warranty = createElement("span", "detail-warranty", product.category === "услуга" ? "договор и этапы работ" : "гарантия 3 года");
    const price = createElement("div", "detail-price");
    const actions = createElement("div", "detail-actions");
    const addButton = createElement("button", "primary-button", product.category === "услуга" ? "Заказать услугу" : "В корзину");
    const buyButton = createElement("button", "secondary-action", "Купить в 1 клик");
    const sellerCall = createSellerCall(product);
    const variants = createVariantsSection(product);
    const optionGrid = createElement("div", "detail-options");
    const delivery = createElement("div", "detail-delivery");
    const galleryLabels = ["Фото товара", "Вид спереди", "Детали", "Материал", "В интерьере"];

    close.type = "button";
    close.setAttribute("aria-label", "Закрыть товар");
    close.append(createSvgIcon("close", "detail-close-icon"));
    close.addEventListener("click", closeProduct);

    function setGallery(index) {
      stage.replaceChildren(createProductPlaceholder(product, galleryLabels[index]));
      thumbList.querySelectorAll(".detail-thumb").forEach((button, buttonIndex) => {
        button.classList.toggle("is-active", buttonIndex === index);
      });
    }

    galleryLabels.forEach((label, index) => {
      const thumb = createElement("button", "detail-thumb", index === 0 ? "Фото" : `Вид ${index + 1}`);
      thumb.type = "button";
      if (index === 0) thumb.classList.add("is-active");
      thumb.addEventListener("click", () => setGallery(index));
      thumbList.append(thumb);
    });

    setGallery(0);
    gallery.append(thumbList, stage);

    titleWrap.append(title, code);
    titleRow.append(titleWrap, close);

    price.append(createElement("strong", "", money(product.price)));
    if (product.oldPrice) {
      price.append(createElement("del", "", money(product.oldPrice)));
      price.append(createElement("span", "", `−${discount}%`));
    }

    addButton.type = "button";
    addButton.addEventListener("click", () => {
      addToCart(product.id, addButton);
      closeProduct();
    });

    buyButton.type = "button";
    buyButton.addEventListener("click", () => {
      sellerCall.hidden = !sellerCall.hidden;
    });
    actions.append(addButton, buyButton);

    optionGrid.append(
      createDetailOption("Категория", product.category),
      createDetailOption("Раздел", product.marketSection || "Маркетплейс"),
      createDetailOption("Материалы", (product.materials || []).join(", ")),
      createDetailOption("Характеристики", (product.specs || []).join(", "))
    );

    delivery.append(
      createElement("h3", "", "Доставка"),
      createElement("p", "", product.deliveryDays <= 3 ? "Доставим быстро по Москве и области." : `Доставка от ${product.deliveryDays} дней. Самовывоз доступен из пункта выдачи.`)
    );

    info.append(titleRow, rating, warranty, price, actions, sellerCall, variants, optionGrid, delivery);
    main.append(gallery, info);
    els.productDetail.replaceChildren(main, createReviewsSection(product), createSimilarSection(product));
  }

  function createVariantsSection(product) {
    const section = createElement("section", "variant-section");
    const head = createElement("div", "variant-head");
    const title = createElement("h3", "", product.category === "услуга" ? "Пакет услуги" : "Материал и цена");
    const note = createElement("span", "", "Цена зависит от выбранного варианта");
    const grid = createElement("div", "variant-grid");

    head.append(title, note);
    (product.variants || []).forEach((variant, index) => {
      const option = createElement("button", "variant-option");
      const color = createElement("span", "variant-color");
      const text = createElement("strong", "", variant.name);
      const price = createElement("span", "", money(variant.price));

      option.type = "button";
      option.classList.toggle("is-active", index === 0);
      color.style.background = variant.color;
      option.addEventListener("click", () => {
        grid.querySelectorAll(".variant-option").forEach((button) => button.classList.remove("is-active"));
        option.classList.add("is-active");
      });
      option.append(color, text, price);
      grid.append(option);
    });

    section.append(head, grid);
    return section;
  }

  function createSellerCall(product) {
    const panel = createElement("div", "seller-call");
    const text = createElement("div");
    const title = createElement("strong", "", "Заказ у продавца");
    const note = createElement("span", "", `${product.brand || "SONA"} оформит заказ по телефону без оплаты на сайте.`);
    const phone = createElement("a", "seller-phone", "8 800 200-40-90");

    panel.hidden = true;
    phone.href = "tel:+78002004090";
    text.append(title, note);
    panel.append(text, phone);
    return panel;
  }

  function createReviewsSection(product) {
    const section = createElement("section", "detail-reviews");
    const head = createElement("div", "section-head");
    const cards = createElement("div", "review-grid");
    const data = store.read();
    const reviews = window.SonaReviews?.list(data.reviews || [], product.id) || [];
    const summary = reviewSummary(product.id, data);

    head.append(createElement("h2", "", "Отзывы"), createElement("span", "", summary.count ? `${summary.average} ★ · ${summary.count} оценок` : "0 отзывов"));

    if (!reviews.length) {
      const empty = createElement("div", "sona-review-empty");
      empty.append(
        createElement("strong", "", "Отзывов пока нет"),
        createElement("span", "", "Оставить отзыв можно только после получения заказа. Когда покупатель подтвердит доставку, форма появится в личном кабинете.")
      );
      section.append(head, empty);
      return section;
    }

    reviews.forEach((review) => {
      const card = createElement("article", "review-card");
      const top = createElement("div");
      const stars = "★★★★★".slice(0, Number(review.rating) || 5);
      const rating = Number(review.rating) || 5;
      const date = window.SonaReviews?.displayMoment(review) || review.date || "";

      top.append(createElement("strong", "", review.author), createElement("span", "", date));
      card.append(top, createElement("b", "", `${stars} ${rating}/5`), createElement("p", "", review.text));
      if (review.reply) {
        const reply = createElement("div", "review-reply");
        reply.append(createElement("strong", "", "Ответ Soна"), createElement("p", "", review.reply));
        card.append(reply);
      }
      cards.append(card);
    });

    section.append(head, cards);
    return section;
  }

  function createSimilarSection(product) {
    const section = createElement("section", "detail-similar");
    const grid = createElement("div", "similar-grid");
    const similar = state.products
      .filter((item) => item.id !== product.id && (item.category === product.category || item.marketSection === product.marketSection))
      .slice(0, 6);

    section.append(createElement("h2", "", "Похожие товары"));
    similar.forEach((item) => grid.append(createSimilarCard(item)));
    section.append(grid);
    return section;
  }

  function createSimilarCard(product) {
    const card = createElement("button", "similar-card");
    const media = createProductPlaceholder(product, "Фото");
    const title = createElement("strong", "", product.name);
    const price = createElement("span", "", money(product.price));

    card.type = "button";
    card.addEventListener("click", () => openProduct(product.id));
    card.append(media, title, price);
    return card;
  }

  function createDetailOption(label, value) {
    const item = createElement("div", "detail-option");
    item.append(createElement("span", "", label), createElement("strong", "", value || "уточняется"));
    return item;
  }

  function toggleFavorite(productId) {
    const id = security.safeProductId(productId);
    let added = false;

    store.update((data) => {
      added = !data.favorites.includes(id);
      data.favorites = added
        ? [...data.favorites, id]
        : data.favorites.filter((item) => item !== id);
    });
    render();
    showToast(added ? "Товар добавлен в избранное" : "Товар удалён из избранного");
  }

  function playCartMotion(triggerButton) {
    if (triggerButton && !reduceMotion) {
      const originalText = triggerButton.textContent;
      triggerButton.classList.add("is-added");
      triggerButton.textContent = "Р”РѕР±Р°РІР»РµРЅРѕ";

      window.clearTimeout(triggerButton.motionTimer);
      triggerButton.motionTimer = window.setTimeout(() => {
        triggerButton.classList.remove("is-added");
        triggerButton.textContent = originalText;
      }, 1100);
    }

    if (reduceMotion) return;

    [els.cartButton, els.cartBadge, els.mobileCartBadge].forEach((element) => {
      if (!element) return;
      element.classList.remove("is-bouncing");
      void element.offsetWidth;
      element.classList.add("is-bouncing");
    });
  }

  function addToCart(productId, triggerButton) {
    const id = security.safeProductId(productId);
    store.update((data) => {
      data.cart[id] = Math.min((Number(data.cart[id]) || 0) + 1, 20);
    });
    renderCart();
    renderProfilePage();
    renderFavoritesPage();
    playCartMotion(triggerButton);
    showToast("Товар добавлен в корзину");
  }

  function setQuantity(productId, quantity) {
    const id = security.safeProductId(productId);
    const nextQuantity = Math.max(0, Math.min(Number(quantity) || 0, 20));

    store.update((data) => {
      if (nextQuantity === 0) {
        delete data.cart[id];
      } else {
        data.cart[id] = nextQuantity;
      }
    });

    renderCart();
    renderProfilePage();
    renderFavoritesPage();
  }

  function cartRows() {
    const data = store.read();
    return Object.entries(data.cart)
      .map(([id, quantity]) => ({ product: byId(id), quantity: Number(quantity) || 0 }))
      .filter((row) => row.product && row.quantity > 0);
  }

  function isProfileActive() {
    return Boolean(store.read().profile?.isActive);
  }

  function renderCart() {
    const rows = cartRows();
    const count = rows.reduce((sum, row) => sum + row.quantity, 0);
    const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
    const delivery = subtotal > 120000 || subtotal === 0 ? 0 : 2500;
    const total = subtotal + delivery;
    els.cartBadge.textContent = String(count);
    if (els.mobileCartBadge) {
      els.mobileCartBadge.textContent = String(count);
      els.mobileCartBadge.hidden = count === 0;
    }
    if (els.cartCountLabel) {
      els.cartCountLabel.textContent = `Товары: ${count}`;
    }
    els.cartSubtotal.textContent = money(subtotal);
    els.deliveryPrice.textContent = delivery ? money(delivery) : "0 ₽";
    els.cartTotal.textContent = money(total);
    els.checkoutButton.disabled = !rows.length;
    if (els.profileButtonLabel) {
      els.profileButtonLabel.textContent = window.SonaAdmin?.isAdmin(store.read()) ? "Админ" : (isProfileActive() ? "Профиль" : "Войти");
    }

    if (!rows.length) {
      const empty = createElement("div", "cart-empty cart-empty-page");
      const icon = createElement("div", "empty-icon", "Soна");
      const title = createElement("strong", "", "Корзина пока пустая");
      const text = createElement("span", "", "Добавьте товары из каталога, а здесь появятся количество, стоимость и оформление заказа.");
      const button = createElement("button", "primary-button", "Перейти к товарам");

      button.type = "button";
      button.addEventListener("click", goToCatalog);
      empty.append(icon, title, text, button);
      els.cartItems.replaceChildren(empty);
      return;
    }

    els.cartItems.replaceChildren(...rows.map(({ product, quantity }) => createCartItem(product, quantity)));
  }

  function createCartItem(product, quantity) {
    const item = createElement("article", "cart-item");
    const thumb = createProductPlaceholder(product);
    const body = createElement("div", "cart-item-body");
    const titleRow = createElement("div", "cart-item-title");
    const title = createElement("strong", "", product.name);
    const remove = createElement("button", "remove-button", "×");
    const quantityRow = createElement("div", "quantity-row");
    const control = createElement("div", "quantity-control");
    const minus = createElement("button", "", "−");
    const amount = createElement("span", "", String(quantity));
    const plus = createElement("button", "", "+");
    const price = createElement("span", "cart-item-price", money(product.price * quantity));

    thumb.classList.add("cart-placeholder");

    remove.type = "button";
    remove.setAttribute("aria-label", "Удалить товар");
    remove.addEventListener("click", () => setQuantity(product.id, 0));

    minus.type = "button";
    minus.setAttribute("aria-label", "Уменьшить количество");
    minus.addEventListener("click", () => setQuantity(product.id, quantity - 1));

    plus.type = "button";
    plus.setAttribute("aria-label", "Увеличить количество");
    plus.addEventListener("click", () => setQuantity(product.id, quantity + 1));

    titleRow.append(title, remove);
    control.append(minus, amount, plus);
    quantityRow.append(control, price);
    body.append(titleRow, quantityRow);
    item.append(thumb, body);

    return item;
  }

  function openCart(syncUrl = true) {
    navigateTo("cart", syncUrl);
  }

  function closeCart(syncUrl = true) {
    if (state.route === "cart") {
      navigateTo("home", syncUrl);
    }
  }

  function cartTotals() {
    const rows = cartRows();
    const count = rows.reduce((sum, row) => sum + row.quantity, 0);
    const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
    const delivery = subtotal > 120000 || subtotal === 0 ? 0 : 2500;

    return {
      rows,
      count,
      subtotal,
      delivery,
      total: subtotal + delivery
    };
  }

  function createPageHead(eyebrowText, titleText, text) {
    const head = createElement("div", "account-head");
    const copy = createElement("div");
    const eyebrow = createElement("p", "eyebrow", eyebrowText);
    const title = createElement("h2", "", titleText);
    const description = createElement("span", "", text);

    copy.append(eyebrow, title, description);
    head.append(copy);
    return head;
  }

  function createMiniProductRow(product, note, actionText, action) {
    const row = createElement("article", "mini-product-row");
    const thumb = createProductPlaceholder(product);
    const body = createElement("div");
    const title = createElement("strong", "", product.name);
    const meta = createElement("span", "", note);
    const button = createElement("button", "soft-button", actionText);

    thumb.classList.add("cart-placeholder");
    button.type = "button";
    button.addEventListener("click", action);
    body.append(title, meta);
    row.append(thumb, body, button);
    return row;
  }

  function openSupportChat() {
    if (!els.supportChatRoot || !window.SonaSupport) return;
    window.SonaSupport.renderWidget({
      container: els.supportChatRoot,
      onChange: () => {
        renderAdminPage();
      }
    });
    window.requestAnimationFrame(() => {
      const widget = els.supportChatRoot.querySelector(".sona-support-widget");
      const panel = els.supportChatRoot.querySelector(".sona-support-panel");
      const button = els.supportChatRoot.querySelector(".sona-support-launcher");
      widget?.classList.add("is-open");
      document.body.classList.add("support-chat-open");
      if (panel) {
        panel.hidden = false;
        panel.style.display = "grid";
        panel.setAttribute("aria-hidden", "false");
      }
      button?.setAttribute("aria-expanded", "true");
    });
  }

  function closeMobileConsultMenu() {
    if (!els.mobileConsultButton || !els.mobileConsultMenu) return;
    els.mobileConsultMenu.hidden = true;
    els.mobileConsultButton.setAttribute("aria-expanded", "false");
  }

  function toggleMobileConsultMenu() {
    if (!els.mobileConsultButton || !els.mobileConsultMenu) return;
    const nextOpen = els.mobileConsultMenu.hidden;
    els.mobileConsultMenu.hidden = !nextOpen;
    els.mobileConsultButton.setAttribute("aria-expanded", String(nextOpen));
  }

  function renderSupportChat() {
    if (!els.supportChatRoot || !window.SonaSupport) return;
    window.SonaSupport.renderWidget({
      container: els.supportChatRoot,
      onChange: () => {
        renderAdminPage();
      }
    });
  }

  function completeOrder(orderId) {
    store.update((data) => {
      data.orders = (data.orders || []).map((order) => (
        order.id === orderId
          ? { ...order, status: "completed", completedAt: new Date().toISOString() }
          : order
      ));
    });

    render();
    showToast("Заказ отмечен как полученный. Теперь можно оставить отзыв.");
  }

  function deleteOrder(orderId) {
    store.update((data) => {
      data.orders = (data.orders || []).filter((order) => order.id !== orderId);
    });

    render();
    showToast("Заказ удалён из профиля");
  }

  function createReview(payload) {
    let added = false;
    const cleanText = security.sanitizeText(payload.text || "", 600);

    if (!cleanText) {
      showToast("Напишите текст отзыва");
      return;
    }

    store.update((data) => {
      const order = (data.orders || []).find((item) => item.id === payload.orderId);
      const isCompleted = window.SonaOrders?.isCompleted(order);
      const isInOrder = order?.items?.some((item) => item.id === payload.productId);
      const alreadyReviewed = window.SonaReviews?.hasReview(data.reviews || [], payload.orderId, payload.productId);

      if (!order || !isCompleted || !isInOrder || alreadyReviewed) {
        return;
      }

      const review = window.SonaReviews?.create({
        ...payload,
        text: cleanText,
        profile: data.profile
      });

      if (review?.text) {
        data.reviews = [...(data.reviews || []), review];
        added = true;
      }
    });

    render();
    if (els.productModal?.classList.contains("is-open") && payload.productId) {
      const product = byId(payload.productId);
      if (product) renderProductDetail(product);
    }
    showToast(added ? "Отзыв опубликован" : "Отзыв можно оставить только после получения заказа");
  }

  function renderProfilePage() {
    if (!els.profilePageContent || !state.products.length || !window.SonaProfile) return;
    if (window.SonaAdmin?.isAdmin(store.read())) return;

    window.SonaProfile.render({
      container: els.profilePageContent,
      data: store.read(),
      products: state.products,
      byId,
      addToCart,
      checkout,
      openCart: () => navigateTo("cart"),
      openFavorites: () => navigateTo("favorites"),
      openCatalog: goToCatalog,
      openEdit: openProfileModal,
      openSupportChat,
      onAuthChange: () => {
        render();
        showToast("Вход выполнен");
      },
      completeOrder,
      createReview,
      logout: () => {
        store.clearProfile();
        window.SonaProfile?.setSection("home");
        render();
        showToast("Вы вышли из аккаунта");
      }
    });
  }

  function renderAdminPage() {
    if (!els.adminPageContent || !window.SonaAdmin) return;

    window.SonaAdmin.render({
      container: els.adminPageContent,
      products: applyProductAdminState(state.baseProducts, store.read(), { includeHidden: true }),
      baseProducts: state.baseProducts,
      actions: {
        saveProduct: saveAdminProduct,
        deleteProduct: deleteAdminProduct,
        updateOrder: updateAdminOrder,
        deleteOrder: deleteAdminOrder,
        updateReview: updateAdminReview,
        updateUser: updateAdminUser,
        saveAd: saveAdminAd,
        deleteAd: deleteAdminAd,
        saveSettings: saveShopSettings
      },
      onChange: () => {
        refreshProductsFromAdmin();
        renderAds();
        renderAdminPage();
        renderSupportChat();
      }
    });
  }

  function renderFavoritesPage() {
    if (!els.favoritesPageContent || !state.products.length) return;

    const data = store.read();
    const favorites = data.favorites.map(byId).filter(Boolean);
    const page = createElement("div", "favorites-page-grid");
    const head = createPageHead("подборка", "Избранное", "Сохранённые товары можно удалить или сразу добавить в корзину.");
    const summary = createElement("div", "favorites-summary");
    const countBadge = createElement("span", "favorites-count", `${favorites.length} ${favorites.length === 1 ? "товар" : "товаров"}`);
    const catalogButton = createElement("button", "soft-button", "Продолжить покупки");
    const list = createElement("div", "favorites-grid");

    catalogButton.type = "button";
    catalogButton.addEventListener("click", goToCatalog);
    summary.append(countBadge, catalogButton);
    head.append(summary);

    if (!favorites.length) {
      const empty = createElement("div", "favorites-empty");
      const icon = createElement("div", "empty-icon", "Soна");
      const title = createElement("strong", "", "В избранном пока пусто");
      const text = createElement("span", "", "Сохраняйте товары сердечком, сравнивайте варианты и быстро добавляйте лучшее в корзину.");
      const button = createElement("button", "primary-button", "Перейти к товарам");

      button.type = "button";
      button.addEventListener("click", goToCatalog);
      empty.append(icon, title, text, button);
      page.append(head, empty);
      els.favoritesPageContent.replaceChildren(page);
      return;
    }

    favorites.forEach((product) => {
      const card = createElement("article", "favorite-card");
      const media = createElement("div", "favorite-card-media");
      const thumb = createProductPlaceholder(product);
      const body = createElement("div", "favorite-card-body");
      const top = createElement("div", "favorite-card-top");
      const brand = createElement("span", "product-brand", product.brand || "Soна");
      const title = createElement("h3", "", product.name);
      const rating = createElement("span", "rating", `★ ${reviewLabel(product.id, data)}`);
      const meta = createElement("div", "favorite-meta");
      const price = createElement("strong", "", money(product.price));
      const delivery = createElement("span", "", product.deliveryDays <= 3 ? "Быстрая доставка" : `Доставка от ${product.deliveryDays} дней`);
      const actions = createElement("div", "favorite-actions");
      const cart = createElement("button", "primary-button", "В корзину");
      const remove = createElement("button", "soft-button", "Удалить");

      cart.type = "button";
      remove.type = "button";
      remove.setAttribute("aria-label", `Удалить ${product.name} из избранного`);
      cart.addEventListener("click", () => addToCart(product.id, cart));
      remove.addEventListener("click", () => toggleFavorite(product.id));
      top.append(brand, rating);
      meta.append(price, delivery);
      actions.append(cart, remove);
      media.append(thumb);
      body.append(top, title, meta, actions);
      card.append(media, body);
      list.append(card);
    });

    page.append(head, list);
    els.favoritesPageContent.replaceChildren(page);
  }

  function updateNavState() {
    els.profileButton?.classList.toggle("is-active", state.route === "profile");
    els.favoritesButton?.classList.toggle("is-active", state.route === "favorites");
    els.cartButton?.classList.toggle("is-active", state.route === "cart");
    document.querySelectorAll("[data-mobile-action]").forEach((button) => {
      const action = button.dataset.mobileAction;
      const isActive = action === state.mobileAction || (state.route === "admin" && action === "profile");
      button.classList.toggle("is-active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    [
      [els.profileButton, "profile"],
      [els.favoritesButton, "favorites"],
      [els.cartButton, "cart"]
    ].forEach(([button, route]) => {
      if (!button) return;
      if (state.route === route) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }

  function renderRoute() {
    if (state.route === "profile" && window.SonaAdmin?.isAdmin(store.read())) {
      state.route = "admin";
      if (window.location.pathname !== "/admin") {
        window.history.replaceState({ route: "admin" }, "", "/admin");
      }
    }

    const isHome = state.route === "home";
    const isCart = state.route === "cart";
    const isProfile = state.route === "profile";
    const isFavorites = state.route === "favorites";
    const isAdmin = state.route === "admin";

    els.marketplace.hidden = !isHome;
    els.cartPage.hidden = !isCart;
    if (els.profilePage) els.profilePage.hidden = !isProfile;
    if (els.favoritesPage) els.favoritesPage.hidden = !isFavorites;
    if (els.adminPage) els.adminPage.hidden = !isAdmin;
    document.body.classList.toggle("cart-view", isCart);
    document.body.classList.toggle("account-view", isProfile || isFavorites || isAdmin);

    renderCart();
    renderProfilePage();
    renderFavoritesPage();
    renderAdminPage();
    renderSupportChat();
    updateNavState();
    updateQuickNav();
  }

  function openFilters() {
    els.filterDrawer.classList.add("is-open");
    els.filterDrawer.setAttribute("aria-hidden", "false");
  }

  function closeFilters() {
    els.filterDrawer.classList.remove("is-open");
    els.filterDrawer.setAttribute("aria-hidden", "true");
  }

  function setCatalogTab(tabName) {
    els.catalogTabs.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.catalogTab === tabName);
    });

    els.catalogViews.forEach((view) => {
      view.classList.toggle("is-active", view.dataset.catalogView === tabName);
    });
  }

  function openProfileModal() {
    store.update((data) => {
      data.profile = {
        ...data.profile,
        isActive: true
      };
    });
    renderProfile();
    renderCart();
    renderProducts();
    els.profileModal.showModal();
    window.requestAnimationFrame(() => {
      els.profileCloseButton?.focus({ preventScroll: true });
    });
  }

  function renderProfile() {
    const data = store.read();
    const cartCount = cartRows().reduce((sum, row) => sum + row.quantity, 0);

    if (els.profileDisplayName) {
      els.profileDisplayName.textContent = displayText(security.sanitizeText(data.profile.name, 40) || "Гость Soна");
    }
    if (els.profileNameInput) {
      els.profileNameInput.value = security.sanitizeText(data.profile.name, 40);
    }
    if (els.profileEmailInput) {
      els.profileEmailInput.value = security.sanitizeEmail(data.profile.email);
    }
    if (els.profilePhoneInput) {
      els.profilePhoneInput.value = security.sanitizePhone(data.profile.phone);
    }
    if (els.profileAddressInput) {
      els.profileAddressInput.value = security.sanitizeText(data.profile.address, 120);
    }
    if (els.profileCartCount) {
      els.profileCartCount.textContent = String(cartCount);
    }
    if (els.profileFavoriteCount) {
      els.profileFavoriteCount.textContent = String(data.favorites.length);
    }
    if (els.profileOrderCount) {
      els.profileOrderCount.textContent = String(data.orders.length);
    }

    const favoriteItems = data.favorites
      .map(byId)
      .filter(Boolean)
      .map((product) => {
        const row = createElement("div");
        row.append(createElement("span", "", product.name), createElement("strong", "", money(product.price)));
        return row;
      });

    els.favoriteList.replaceChildren(...(favoriteItems.length ? favoriteItems : [createElement("p", "", "Нет избранных товаров")]));

    const orderItems = data.orders.slice(-3).reverse().map((order) => {
      const row = createElement("div");
      row.append(createElement("span", "", order.date), createElement("strong", "", money(order.total)));
      return row;
    });

    els.orderList.replaceChildren(...(orderItems.length ? orderItems : [createElement("p", "", "Заказов пока нет")]));
  }

  function saveProfile(event) {
    event.preventDefault();
    store.update((data) => {
      const phone = security.sanitizePhone(els.profilePhoneInput?.value || "");
      const role = data.profile?.role || (window.SonaAdmin?.ADMIN_PHONE && phone.replace(/\D/g, "").endsWith(window.SonaAdmin.ADMIN_PHONE.slice(1)) ? "admin" : "user");
      data.profile = {
        ...data.profile,
        isActive: true,
        name: security.sanitizeText(els.profileNameInput?.value || "", 40),
        email: security.sanitizeEmail(els.profileEmailInput?.value || ""),
        phone,
        address: security.sanitizeText(els.profileAddressInput?.value || "", 120),
        role,
        registeredAt: data.profile?.registeredAt || new Date().toISOString()
      };
      data.users = [
        ...(data.users || []).filter((user) => user.phone !== phone),
        {
          id: `USER-${phone.replace(/\D/g, "") || Date.now()}`,
          name: data.profile.name || "Покупатель Soна",
          email: data.profile.email || "",
          phone,
          role,
          status: data.profile.status || "active",
          registeredAt: data.profile.registeredAt
        }
      ];
    });

    els.profileModal.close();
    render();
    showToast("Профиль сохранён");
  }

  function checkout() {
    const rows = cartRows();
    if (!rows.length) {
      showToast("Корзина пустая");
      return;
    }

    const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
    const delivery = subtotal > 120000 ? 0 : 2500;
    const total = subtotal + delivery;

    store.update((nextData) => {
      nextData.orders.push({
        id: `SONA-${Date.now()}`,
        date: new Date().toLocaleDateString("ru-RU"),
        createdAt: Date.now(),
        status: "new",
        total,
        profile: {
          name: security.sanitizeText(nextData.profile?.name, 40),
          email: security.sanitizeEmail(nextData.profile?.email),
          phone: security.sanitizePhone(nextData.profile?.phone),
          userId: `USER-${String(nextData.profile?.phone || "").replace(/\D/g, "")}`,
          address: security.sanitizeText(nextData.profile?.address, 120)
        },
        items: rows.map((row) => ({
          id: row.product.id,
          quantity: row.quantity
        }))
      });
      nextData.cart = {};
    });

    renderCart();
    renderProfilePage();
    renderFavoritesPage();
    navigateTo("profile");
    showToast("Заказ создан");
  }

  function resetFilters() {
    state.filters = {
      section: ALL_VALUE,
      category: ALL_VALUE,
      group: "",
      size: ALL_VALUE,
      maxPrice: 260000,
      fastDelivery: false,
      saleOnly: false,
      favoritesOnly: false,
      query: "",
      sort: "popular"
    };

    els.priceRange.value = String(state.filters.maxPrice);
    els.fastDeliveryOnly.checked = false;
    els.saleOnly.checked = false;
    els.searchInput.value = "";
    els.sortSelect.value = "popular";
    updateSortControl();
    render();
  }

  function applyQuickFilter(link) {
    state.filters.section = link.dataset.section || ALL_VALUE;
    state.filters.category = link.dataset.category || ALL_VALUE;
    state.filters.group = link.dataset.group || "";
    state.filters.saleOnly = link.dataset.sale === "true";
    state.filters.favoritesOnly = false;
    state.filters.query = "";
    state.filters.size = ALL_VALUE;

    els.saleOnly.checked = state.filters.saleOnly;
    els.searchInput.value = "";
    state.route = "home";
    render();
    closeFilters();
    window.history.pushState({ route: "home" }, "", "/");
    document.getElementById("catalog").scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }

  function showFavorites() {
    state.filters.favoritesOnly = false;
    navigateTo("favorites");
  }

  function updateSortControl() {
    const label = SORT_LABELS[state.filters.sort] || SORT_LABELS.popular;

    if (els.sortLabel) {
      els.sortLabel.textContent = displayText(label);
    }

    if (els.sortSelect) {
      els.sortSelect.value = state.filters.sort;
    }

    els.sortOptions.forEach((button) => {
      const active = button.dataset.sortOption === state.filters.sort;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function closeSortMenu() {
    if (!els.sortControl) return;
    els.sortControl.classList.remove("is-open");
    els.sortDropdownButton?.setAttribute("aria-expanded", "false");
  }

  function setSort(value) {
    state.filters.sort = SORT_LABELS[value] ? value : "popular";
    updateSortControl();
    closeSortMenu();
    renderProducts();
  }

  function bindEvents() {
    els.heroPrev.addEventListener("click", () => {
      setActiveAd(activeAdIndex - 1);
      resetAdTimer();
    });
    els.heroNext.addEventListener("click", () => {
      setActiveAd(activeAdIndex + 1);
      resetAdTimer();
    });
    els.heroAdUpload?.addEventListener("change", handleAdUpload);
    els.heroCarousel.addEventListener("mouseenter", () => window.clearInterval(adTimer));
    els.heroCarousel.addEventListener("mouseleave", resetAdTimer);
    window.addEventListener("popstate", () => {
      state.route = routeFromLocation();
      renderRoute();
    });
    document.querySelector(".brand")?.addEventListener("click", (event) => {
      event.preventDefault();
      navigateTo("home");
    });

    els.priceRange.addEventListener("input", () => {
      state.filters.maxPrice = Number(els.priceRange.value);
      render();
    });

    els.fastDeliveryOnly.addEventListener("change", () => {
      state.filters.fastDelivery = els.fastDeliveryOnly.checked;
      renderProducts();
    });

    els.saleOnly.addEventListener("change", () => {
      state.filters.saleOnly = els.saleOnly.checked;
      state.filters.favoritesOnly = false;
      if (!state.filters.saleOnly) {
        updateQuickNav();
      }
      renderProducts();
    });

    els.searchInput.addEventListener("input", () => {
      state.filters.query = security.sanitizeText(els.searchInput.value, 80);
      renderProducts();
    });

    els.sortSelect.addEventListener("change", () => setSort(els.sortSelect.value));
    els.sortDropdownButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = els.sortControl.classList.toggle("is-open");
      els.sortDropdownButton.setAttribute("aria-expanded", String(isOpen));
    });
    els.sortOptions.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        setSort(button.dataset.sortOption);
      });
    });
    document.addEventListener("click", (event) => {
      if (!els.sortControl.contains(event.target)) {
        closeSortMenu();
      }
    });

    els.resetFilters.addEventListener("click", resetFilters);
    els.filterButton.addEventListener("click", () => {
      if (state.route !== "home") {
        navigateTo("home");
      }
      openFilters();
    });
    els.quickLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        applyQuickFilter(link);
      });
    });
    els.catalogTabs.forEach((button) => {
      button.addEventListener("click", () => setCatalogTab(button.dataset.catalogTab));
    });
    document.querySelectorAll("[data-close-filters]").forEach((button) => button.addEventListener("click", closeFilters));
    document.querySelectorAll("[data-category-shortcut]").forEach((button) => {
      button.addEventListener("click", () => {
        const shortcut = button.dataset.categoryShortcut || ALL_VALUE;
        state.route = "home";
        state.filters.section = "Мебель";
        state.filters.category = shortcut === "все" ? ALL_VALUE : shortcut;
        state.filters.group = "";
        state.filters.saleOnly = false;
        state.filters.favoritesOnly = false;
        els.saleOnly.checked = false;
        render();
        closeFilters();
        window.history.pushState({ route: "home" }, "", "/");
        document.getElementById("catalog").scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
      });
    });

    els.cartButton.addEventListener("click", openCart);
    els.mobileConsultButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMobileConsultMenu();
    });
    els.mobileSupportOpen?.addEventListener("click", (event) => {
      event.preventDefault();
      closeMobileConsultMenu();
      openSupportChat();
    });
    document.addEventListener("click", (event) => {
      if (!els.mobileConsultMenu || !els.mobileConsultButton) return;
      if (els.mobileConsultMenu.hidden) return;
      if (els.mobileConsultMenu.contains(event.target) || els.mobileConsultButton.contains(event.target)) return;
      closeMobileConsultMenu();
    });
    els.favoritesButton?.addEventListener("click", showFavorites);
    document.querySelectorAll("[data-mobile-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.mobileAction;
        if (action === "home") navigateTo("home");
        if (action === "catalog") goToCatalog();
        if (action === "favorites") showFavorites();
        if (action === "cart") openCart();
        if (action === "profile") navigateTo(window.SonaAdmin?.isAdmin(store.read()) ? "admin" : "profile");
      });
    });
    document.querySelectorAll("[data-close-cart]").forEach((button) => button.addEventListener("click", closeCart));
    document.querySelectorAll("[data-close-product]").forEach((button) => button.addEventListener("click", closeProduct));
    els.checkoutButton.addEventListener("click", checkout);

    els.profileButton.addEventListener("click", () => navigateTo(window.SonaAdmin?.isAdmin(store.read()) ? "admin" : "profile"));
    els.profileCloseButton?.addEventListener("click", () => els.profileModal.close());

    els.profileForm.addEventListener("submit", saveProfile);
    els.clearProfile.addEventListener("click", () => {
      store.clearProfile();
      state.filters.favoritesOnly = false;
      renderProfile();
      renderCart();
      renderProducts();
      closeCart();
      els.profileModal.close();
      showToast("Р’С‹ РІС‹С€Р»Рё РёР· РїСЂРѕС„РёР»СЏ");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMobileConsultMenu();
        closeSortMenu();
        closeCart();
        closeFilters();
        closeProduct();
      }
    });
  }

  function render() {
    els.priceValue.textContent = money(state.filters.maxPrice);
    updateSortControl();
    updateCatalogTitle();
    renderFilterButtons();
    renderHomeSections();
    renderProducts();
    renderRoute();
    window.SonaText?.repairDom(document.body);
  }

  async function init() {
    try {
      await store.init?.();
      bindEvents();
      initExperience();
      const response = await fetch("data/products.json", { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error("Products loading failed");
      }
      state.baseProducts = await response.json();
      refreshProductsFromAdmin();
      state.route = routeFromLocation();
      render();
    } catch (error) {
      els.emptyState.hidden = false;
      els.emptyState.textContent = "Каталог временно недоступен.";
    }
  }

  init();
})();

