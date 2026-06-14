(function () {
  "use strict";

  const security = window.SonaSecurity;
  const store = window.SonaStore;
  const ALL_VALUE = "все";
  const REMOVED_PRODUCT_IDS = new Set(["breeze-mini", "compact-nova-sofa"]);
  const SOFA_IMAGE_BY_NAME = {
    "аляска мд": "assets/фотографии диванов/аляска МД бф.png",
    "аляска": "assets/фотографии диванов/аляска бф.png",
    "андреас": "assets/фотографии диванов/андреас бф.png",
    "бостон": "assets/фотографии диванов/бостон бф.png",
    "валенсия": "assets/фотографии диванов/валенсия бф.png",
    "виктория": "assets/фотографии диванов/виктория бф.png",
    "гудзон": "assets/фотографии диванов/гудзон бф.png",
    "дублин": "assets/фотографии диванов/дублин бф.png",
    "инфинити": "assets/фотографии диванов/инфинити бф.png",
    "канзас 8 мд": "assets/фотографии диванов/канзас 8 мд бф.png",
    "мальта к": "assets/фотографии диванов/мальта к бф.png",
    "марк": "assets/фотографии диванов/марк бф.png",
    "милан": "assets/фотографии диванов/милан бф.png",
    "монтана": "assets/фотографии диванов/монтана бф.png",
    "неаполь мд": "assets/фотографии диванов/неаполь мд бф.png",
    "неаполь мд белый": "assets/фотографии диванов/неаполь мд белый бф.png",
    "ницца": "assets/фотографии диванов/ницца бф.png",
    "нумо": "assets/фотографии диванов/нумо бф.png",
    "паула": "assets/фотографии диванов/паула бф.png",
    "рейн": "assets/фотографии диванов/рейн бф.png",
    "сиэтл м": "assets/фотографии диванов/сиэтл бф.png",
    "томас": "assets/фотографии диванов/томас бф.png"
  };
  const SOFA_IMAGE_BY_ID = {
    "sona-mark-large": "assets/фотографии диванов/марк бф.png",
    "sona-mark-compact": "assets/фотографии диванов/марк маленький бф.png"
  };
  const PERMANENT_SOFA_PRODUCTS = [
    { id: "sona-numo", name: "Нумо", category: "прямой", dimensions: "2200 × 1000 × 960", price: 0 },
    { id: "sona-paula", name: "Паула", category: "диван-кровать", dimensions: "2300 × 950 × 1000", sleepingPlace: "1950 × 1400", mechanism: "Книжка", oldPrice: 47500, price: 37900, discountPercent: 20, benefit: 9600 },
    { id: "sona-montana", name: "Монтана", category: "диван-кровать", dimensions: "2100 × 1100 × 1000", sleepingPlace: "1600 × 2000", mechanism: "Высоковыкатной", oldPrice: 95000, price: 76000, discountPercent: 20, benefit: 19000 },
    { id: "sona-alaska", name: "Аляска", category: "диван-кровать", dimensions: "2250 × 1100 × 920", sleepingPlace: "2100 × 1600", mechanism: "Высоковыкатной", oldPrice: 90000, price: 72000, discountPercent: 20, benefit: 18000 },
    { id: "sona-infinity", name: "Инфинити", category: "модульный", dimensions: "4000 × 1210 × 1800", sleepingPlace: "1400 × 3500", mechanism: "Пума / Еврокнижка", price: 167200, priceMode: "from" },
    { id: "sona-valencia", name: "Валенсия", category: "диван-кровать", dimensions: "2200 × 1100 × 1000", sleepingPlace: "1600 × 2000", mechanism: "Еврокнижка / Тик-так", oldPrice: 80000, price: 59900, discountPercent: 25, benefit: 20000 },
    { id: "sona-malta-k", name: "Мальта К", category: "диван-кровать", dimensions: "1670 × 1100 × 1000", sleepingPlace: "1630 × 2080", mechanism: "Аккордеон", oldPrice: 95000, price: 66500, discountPercent: 30, benefit: 23500 },
    { id: "sona-malta-2", name: "Мальта 2", category: "диван-кровать", dimensions: "1740 × 1100 × 1000", sleepingPlace: "1500 × 2080", mechanism: "Аккордеон", oldPrice: 83500, price: 66800, discountPercent: 20, benefit: 16700 },
    { id: "sona-alaska-md", name: "Аляска Мд", category: "угловой", dimensions: "3630 × 1840 × 1950", sleepingPlace: "1720 × 2050", mechanism: "Высоковыкатной", price: 141900, priceMode: "from" },
    { id: "sona-seattle-m", name: "Сиэтл М", category: "угловой", dimensions: "2530 × 1590 × 930", sleepingPlace: "2000 × 1450", mechanism: "Дельфин", oldPrice: 95000, price: 79900, discountPercent: 15, benefit: 15000 },
    { id: "sona-nice", name: "Ницца", category: "угловой", dimensions: "2800 × 1800 × 940", sleepingPlace: "2410 × 1600", mechanism: "Дельфин", oldPrice: 112000, price: 89600, discountPercent: 20, benefit: 22400 },
    { id: "sona-boston", name: "Бостон", category: "угловой", dimensions: "3050 × 1750 × 950", sleepingPlace: "1500 × 2500", mechanism: "Тик-так", oldPrice: 115000, price: 97750, discountPercent: 15, benefit: 17250 },
    { id: "sona-mark-large", name: "Марк", category: "угловой", dimensions: "3400 × 1500 × 990", sleepingPlace: "1450 × 3000", oldPrice: 92200, price: 59800, discountPercent: 35, benefit: 32400 },
    { id: "sona-victoria", name: "Виктория", category: "угловой", dimensions: "2700 × 1700 × 1000", sleepingPlace: "1500 × 2080", oldPrice: 98000, price: 78400, discountPercent: 20, benefit: 19600 },
    { id: "sona-rhine", name: "Рейн", category: "диван-кровать", dimensions: "2030 × 1000 × 920", sleepingPlace: "2030 × 1350", price: 65344, priceMode: "from" },
    { id: "sona-thomas", name: "Томас", category: "угловой", dimensions: "2300 × 1600 × 950", sleepingPlace: "1450 × 2000", oldPrice: 62200, price: 49800, discountPercent: 20, benefit: 12600 },
    { id: "sona-naples-md", name: "Неаполь МД", category: "диван-кровать", dimensions: "2500 × 1180 × 860", sleepingPlace: "1600 × 2000", oldPrice: 97500, price: 78650, discountPercent: 20, benefit: 18850 },
    { id: "sona-naples-md-white", name: "Неаполь МД Белый", category: "угловой", dimensions: "3160 × 1700 × 860", sleepingPlace: "1600 × 3000", price: 123882 },
    { id: "sona-broadway-2", name: "Бродвей 2", category: "прямой", dimensions: "1660 × 950 × 930", price: 35224 },
    { id: "sona-andreas", name: "Андреас", category: "диван-кровать", dimensions: "1840 × 1130 × 900", sleepingPlace: "2000 × 1500", mechanism: "Аккордеон", price: 46900, image: "assets/sofas/andreas.png", tags: ["новинка"] },
    { id: "sona-kansas-8-md", name: "Канзас 8 Мд", category: "угловой", dimensions: "3980 × 1700 × 1000", sleepingPlace: "1500 × 2000", price: 138700, priceMode: "from" },
    { id: "sona-dublin", name: "Дублин", category: "прямой", oldPrice: 112000, price: 89600, discountPercent: 20, benefit: 22400 },
    { id: "sona-mark-compact", name: "Марк", category: "диван-кровать", dimensions: "2430 × 1050 × 1000", sleepingPlace: "1450 × 2000", oldPrice: 60000, price: 41900, discountPercent: 30, benefit: 18000 },
    { id: "sona-hudson", name: "Гудзон", category: "угловой", dimensions: "3100 × 2280 × 1000", sleepingPlace: "1600 × 2000", oldPrice: 180000, price: 144000, discountPercent: 20, benefit: 36000 },
    { id: "sona-charlie", name: "Чарли", category: "прямой", dimensions: "1850 × 790 × 800", price: 45600, priceMode: "from" },
    { id: "sona-milan", name: "Милан", category: "диван-кровать", dimensions: "2700 × 1350 × 1000", sleepingPlace: "2100 × 1650", price: 127000, priceMode: "from" }
  ].map((product) => {
    const attachedImage = SOFA_IMAGE_BY_ID[product.id]
      || SOFA_IMAGE_BY_NAME[String(product.name || "").trim().toLowerCase()]
      || "";
    const image = attachedImage || product.image || "";

    return {
      brand: "SONA",
      marketSection: "Мебель",
      size: product.category === "угловой" || product.category === "модульный" ? "XL" : "M",
      rating: 0,
      reviews: 0,
      deliveryDays: 14,
      image: "",
      materials: [],
      colors: [],
      variants: [],
      tags: product.oldPrice ? ["скидка"] : [],
      specs: [
        product.dimensions ? `Габаритные размеры: ${product.dimensions}` : "",
        product.sleepingPlace ? `Спальное место: ${product.sleepingPlace}` : "",
        product.mechanism ? `Механизм: ${product.mechanism}` : ""
      ].filter(Boolean),
      ...product,
      image,
      ...(attachedImage ? {
        gallery: [{ id: "main", src: attachedImage, alt: product.name, main: true }]
      } : {})
    };
  });

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
    },
    categoryPage: null,
    activeQuickKey: "",
    activeProductId: "",
    productReturnPath: ""
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileViewport = window.matchMedia("(max-width: 760px)");
  const SORT_LABELS = {
    popular: "по популярности",
    priceAsc: "сначала дешевле",
    priceDesc: "сначала дороже",
    rating: "по рейтингу"
  };
  const CATEGORY_PAGE_PRESETS = {
    all: {
      key: "all",
      title: "Все товары SONA",
      eyebrow: "каталог",
      text: "Вся витрина товаров и услуг в одном аккуратном списке.",
      section: ALL_VALUE,
      category: ALL_VALUE,
      group: "",
      saleOnly: false
    },
    sofas: {
      key: "sofas",
      title: "Диваны SONA",
      eyebrow: "диваны",
      text: "Прямые, угловые, модульные и компактные модели для дома.",
      section: "Мебель",
      category: ALL_VALUE,
      group: "sofas",
      saleOnly: false
    },
    beds: {
      key: "beds",
      title: "Кровати SONA",
      eyebrow: "кровати",
      text: "Модели для спальни, хранения и спокойного сна.",
      section: "Мебель",
      category: "кровать",
      group: "",
      saleOnly: false
    },
    chairs: {
      key: "chairs",
      title: "Кресла SONA",
      eyebrow: "кресла",
      text: "Лаунж, рабочие и акцентные кресла для разных комнат.",
      section: "Мебель",
      category: "кресло",
      group: "",
      saleOnly: false
    },
    services: {
      key: "services",
      title: "Услуги SONA",
      eyebrow: "сервис",
      text: "Поддержка проекта: дизайн, разработка, визуал и запуск.",
      section: "Услуги",
      category: ALL_VALUE,
      group: "",
      saleOnly: false
    },
    sale: {
      key: "sale",
      title: "Распродажа SONA",
      eyebrow: "выгода",
      text: "Товары и услуги со скидками в одной подборке.",
      section: ALL_VALUE,
      category: ALL_VALUE,
      group: "",
      saleOnly: true
    }
  };
  const CATEGORY_PAGE_GROUPS = {
    sofas: [
      { key: "sofas", label: "Все диваны", title: "Диваны SONA", category: ALL_VALUE, group: "sofas", text: "Все диваны: компактные, просторные, акцентные и детские модели." },
      { key: "диван-кровать", label: "Компактные", title: "Компактные модели", category: "диван-кровать", group: "", text: "Диваны для студий, спален и небольших гостиных." },
      { key: "угловой", label: "Просторные", title: "Просторные диваны", category: "угловой", group: "", text: "Больше места для семьи, гостей и спокойных вечеров." },
      { key: "модульный", label: "Акцентные", title: "Акцентные модели", category: "модульный", group: "", text: "Выразительные диваны, которые становятся центром комнаты." },
      { key: "прямой", label: "Детская серия", title: "Детская серия", category: "прямой", group: "", text: "Мягкие и практичные модели для сна, игр и роста." }
    ],
    beds: [
      { key: "beds", label: "Все кровати", title: "Кровати SONA", category: "кровать", group: "", text: "Кровати для спальни, хранения и спокойного сна." }
    ],
    chairs: [
      { key: "chairs", label: "Все кресла", title: "Кресла SONA", category: "кресло", group: "", text: "Лаунж, рабочие и акцентные кресла для разных комнат." }
    ],
    services: [
      { key: "development", label: "Разработка", title: "Разработка", section: "Услуги", category: ALL_VALUE, group: "", query: "разработка", text: "Сайты, магазины, кабинеты и цифровые продукты." },
      { key: "design", label: "Дизайн", title: "Дизайн", section: "Услуги", category: ALL_VALUE, group: "", query: "дизайн", text: "Интерфейсы, брендинг и визуальные системы." },
      { key: "motion", label: "Видеомоушен", title: "Видеомоушен", section: "Услуги", category: ALL_VALUE, group: "", query: "видеомоушен", text: "Анимация, ролики и движение для брендов." },
      { key: "production", label: "Продакшен", title: "Продакшен", section: "Услуги", category: ALL_VALUE, group: "", query: "продакшен", text: "Комплексное производство и сопровождение контента." }
    ],
    sale: [
      { key: "sale", label: "Все скидки", title: "Распродажа SONA", section: ALL_VALUE, category: ALL_VALUE, group: "", saleOnly: true, text: "Товары и услуги со скидками в одной подборке." },
      { key: "sale-sofas", label: "Диваны", title: "Диваны со скидкой", section: "Мебель", category: ALL_VALUE, group: "sofas", saleOnly: true, text: "Все диваны с актуальной сниженной ценой." },
      { key: "sale-beds", label: "Кровати", title: "Кровати со скидкой", section: "Мебель", category: "кровать", group: "", saleOnly: true, text: "Кровати для спальни по специальной цене." },
      { key: "sale-chairs", label: "Кресла", title: "Кресла со скидкой", section: "Мебель", category: "кресло", group: "", saleOnly: true, text: "Акцентные и комфортные кресла со скидкой." },
      { key: "sale-services", label: "Услуги", title: "Услуги со скидкой", section: "Услуги", category: ALL_VALUE, group: "", saleOnly: true, text: "Дизайн, разработка и продакшен по специальной цене." }
    ],
    all: [
      { key: "all", label: "Все товары", title: "Все товары SONA", section: ALL_VALUE, category: ALL_VALUE, group: "", text: "Вся витрина товаров и услуг в одном списке." }
    ]
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
  const SOURCE_PRODUCT_IMAGES = {
    sofa: "assets/source/диван в категории-no-bg-preview (carve.photos).png",
    chair: "assets/source/кресло в категории-no-bg-preview (carve.photos).png",
    bed: "assets/source/кровать в категории-no-bg-preview (carve.photos).png",
    service: "assets/source/услуги в категории -edited-free (carve.photos).png",
    all: "assets/source/вся категория -no-bg-preview (carve.photos).png"
  };
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
    searchResults: document.getElementById("searchResults"),
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
    catalogSwitches: document.querySelectorAll("[data-catalog-switch]"),
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
    categoryPage: document.getElementById("categoryPage"),
    categoryPageContent: document.getElementById("categoryPageContent"),
    cartPage: document.getElementById("cartPage"),
    cartBadge: document.getElementById("cartBadge"),
    mobileCartBadge: document.getElementById("mobileCartBadge"),
    cartCountLabel: document.getElementById("cartCountLabel"),
    cartItems: document.getElementById("cartItems"),
    cartRecommendations: document.getElementById("cartRecommendations"),
    cartSubtotal: document.getElementById("cartSubtotal"),
    deliveryPrice: document.getElementById("deliveryPrice"),
    cartTotal: document.getElementById("cartTotal"),
    checkoutButton: document.getElementById("checkoutButton"),
    productModal: document.getElementById("productModal"),
    productDetail: document.getElementById("productDetail"),
    profileButton: document.getElementById("profileButton"),
    profileButtonLabel: document.getElementById("profileButtonLabel"),
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

  function productPriceLabel(product) {
    if (!Number(product?.price)) return "Цена по запросу";
    return product.priceMode === "from" ? `от ${money(product.price)}` : money(product.price);
  }

  function displayText(value) {
    return window.SonaText?.fix(value) || String(value ?? "");
  }

  function authPhoneDigits(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("8") ? `7${digits.slice(1)}` : digits;
  }

  function byId(id) {
    return state.products.find((product) => product.id === id);
  }

  function applyProductAdminState(products, data = store.read(), options = {}) {
    const deleted = new Set(data.deletedProducts || []);
    const overrides = data.productOverrides || {};
    const custom = Array.isArray(data.customProducts) ? data.customProducts : [];

    return [...products, ...custom]
      .filter((product) => product?.id && !deleted.has(product.id) && !REMOVED_PRODUCT_IDS.has(product.id))
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

  async function updateAdminUser(identifier, patch) {
    await fetch("/api/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, ...patch })
    }).catch(() => null);
    store.update((data) => {
      data.users = (data.users || []).map((user) => (
        [user.phone, user.email, user.id].includes(identifier) ? { ...user, ...patch } : user
      ));
      if ([data.profile?.phone, data.profile?.email].includes(identifier)) {
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
      data.customAds = rows
        .sort((a, b) => Number(a.slot ?? 99) - Number(b.slot ?? 99))
        .slice(0, 3);
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

  async function saveShopSettings(settings) {
    store.update((data) => {
      data.shopSettings = {
        ...(data.shopSettings || {}),
        name: security.sanitizeText(settings.name || "", 80),
        supportEmail: security.sanitizeEmail(settings.supportEmail || ""),
        supportPhone: security.sanitizePhone(settings.supportPhone || ""),
        address: security.sanitizeText(settings.address || "", 160),
        baseDiscount: Math.max(0, Math.min(100, Number(settings.baseDiscount) || 0)),
        returnsPolicy: security.sanitizeText(settings.returnsPolicy || "", 700)
      };
    });
    await store.syncNow();
    renderAdminPage();
    showToast("Настройки магазина сохранены");
  }

  function reviewSummary(productId, data = store.read()) {
    return window.SonaReviews?.summary(data.reviews || [], productId) || { count: 0, average: 0, label: "0 отзывов" };
  }

  function reviewLabel(productId, data = store.read()) {
    const summary = reviewSummary(productId, data);
    return summary.count ? `★ ${summary.average} · ${summary.count} отзывов` : "0 отзывов";
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
      cart: ["M4 5h2l1.7 9.2a2 2 0 0 0 2 1.6h6.9a2 2 0 0 0 2-1.6L20 8H7", "M10 20h.1", "M17 20h.1"],
      close: ["M6.5 6.5 17.5 17.5", "M17.5 6.5 6.5 17.5"],
      image: ["M5 6.2h14a1.8 1.8 0 0 1 1.8 1.8v8a1.8 1.8 0 0 1-1.8 1.8H5A1.8 1.8 0 0 1 3.2 16V8A1.8 1.8 0 0 1 5 6.2Z", "m6.8 15 3.2-3.2 2.4 2.4 1.7-1.7 3.1 3.1", "M15.8 9.4h.1"]
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add(className || "inline-icon");
    (icons[name] || icons.heart).forEach((d) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", name === "heart" ? "currentColor" : "none");
      path.setAttribute("stroke", name === "heart" ? "none" : "currentColor");
      path.setAttribute("stroke-width", name === "close" ? "2.4" : "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
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

  function getProductGallery(product) {
    const gallery = Array.isArray(product.gallery) ? product.gallery : [];
    const rows = gallery
      .map((item, index) => {
        if (typeof item === "string") return { id: `gallery-${index}`, src: item, alt: product.name || "", main: index === 0 };
        return item && item.src ? item : null;
      })
      .filter(Boolean);

    if (product.image && !rows.some((item) => item.src === product.image)) {
      rows.unshift({ id: "main", src: product.image, alt: product.name || "", main: true });
    }

    return rows
      .filter((item) => item.src)
      .sort((a, b) => Number(Boolean(b.main)) - Number(Boolean(a.main)));
  }

  function isGalleryVideo(item) {
    return String(item?.type || "").startsWith("video/")
      || /^data:video\//i.test(String(item?.src || ""))
      || /\.(?:mp4|webm)(?:[?#].*)?$/i.test(String(item?.src || ""));
  }

  function safeImageSrc(value) {
    const source = String(value || "").trim();
    if (!source || /^(?:data:|blob:|https?:|\/)/i.test(source)) {
      return source;
    }
    return new URL(encodeURI(source.replace(/^(?:\.{1,2}\/)+/, "")), document.baseURI).href;
  }

  function isAttachedSofaPhoto(value) {
    return decodeURI(String(value || "")).includes("assets/фотографии диванов/");
  }

  function isSofaProduct(product) {
    return ["прямой", "угловой", "модульный", "диван-кровать"].includes(product.category)
      || displayText(`${product.name || ""} ${product.category || ""}`).toLowerCase().includes("диван");
  }

  function productCategoryLabel(product) {
    if (isSofaProduct(product)) return "Диваны";
    if (product.category === "кровать") return "Кровати";
    if (product.category === "кресло") return "Кресла";
    if (product.category === "услуга" || product.marketSection === "Услуги") return "Услуги";
    return product.marketSection || product.category || "Каталог";
  }

  function usesWhiteProductMedia(product) {
    return isSofaProduct(product)
      || ["кровать", "кресло", "услуга"].includes(product.category)
      || product.marketSection === "Услуги";
  }

  function defaultProductImage(product) {
    const id = String(product.id || "").toLowerCase();
    if (id.startsWith("sona-")) return SOURCE_PRODUCT_IMAGES.sofa;
    if (id === "breeze-mini") return "assets/sofas/breeze-mini.svg";
    if (id === "compact-nova-sofa") return "assets/sofas/azure-room.svg";
    if (id.includes("bed")) return SOURCE_PRODUCT_IMAGES.bed;
    if (id.includes("chair")) return SOURCE_PRODUCT_IMAGES.chair;
    if (id.includes("service") || id.includes("design") || id.includes("marketplace") || id.includes("motion")) return SOURCE_PRODUCT_IMAGES.service;
    if (id.includes("sofa") || id.includes("luna") || id.includes("nord") || id.includes("sona-island") || id.includes("azure") || id.includes("breeze")) {
      return SOURCE_PRODUCT_IMAGES.sofa;
    }

    const readable = displayText(`${product.name || ""} ${product.category || ""}`).toLowerCase();
    if (readable.includes("диван")) return SOURCE_PRODUCT_IMAGES.sofa;
    if (readable.includes("кровать")) return SOURCE_PRODUCT_IMAGES.bed;
    if (readable.includes("кресло")) return SOURCE_PRODUCT_IMAGES.chair;
    if (readable.includes("услуг")) return SOURCE_PRODUCT_IMAGES.service;
    return SOURCE_PRODUCT_IMAGES.all;
  }

  function resolveProductImage(product) {
    const gallery = getProductGallery(product);
    return safeImageSrc(gallery[0]?.src || product.image || defaultProductImage(product));
  }

  window.SonaProducts = {
    getImage: resolveProductImage,
    safeImageSrc
  };

  function syncFavoriteButtons(productId) {
    const favorites = new Set(store.read().favorites || []);
    const active = favorites.has(productId);

    document.querySelectorAll("[data-favorite-product-id]").forEach((button) => {
      if (button.dataset.favoriteProductId !== productId) return;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-label", active ? "Удалить из избранного" : "Добавить в избранное");
    });
  }

  function setCartButtonState(button, isInCart) {
    if (!button) return;
    if (!button.dataset.cartFocusGuard) {
      button.dataset.cartFocusGuard = "true";
      button.addEventListener("mousedown", (event) => event.preventDefault());
    }
    button.classList.toggle("is-in-cart", isInCart);
    button.setAttribute("aria-pressed", String(isInCart));
    const label = isInCart ? "В корзине" : (button.dataset.cartDefaultLabel || "В корзину");
    const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode) {
      textNode.textContent = label;
    } else {
      button.prepend(document.createTextNode(label));
    }
  }

  function routeFromLocation() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    const params = new URLSearchParams(window.location.search);
    const queryRoute = params.get("route");

    if (path === "/cart" || queryRoute === "cart" || window.location.hash === "#cart") return "cart";
    if (path === "/admin" || queryRoute === "admin") return "admin";
    if (path === "/profile" || queryRoute === "profile") return "profile";
    if (path === "/favorites" || queryRoute === "favorites") return "favorites";
    if (path === "/product" || queryRoute === "product") {
      state.activeProductId = params.get("id") || "";
      return "product";
    }
    if (path === "/category" || queryRoute === "category") {
      const key = params.get("type") || "all";
      state.categoryPage = { ...categoryPresetByKey(key) };
      return "category";
    }
    return "home";
  }

  function routePath(route) {
    const staticEntry = /\/(?:public\/)?index\.html$/i.test(window.location.pathname)
      ? window.location.pathname
      : "";
    if (staticEntry) {
      if (route === "home") return staticEntry;
      if (route === "product") return `${staticEntry}?route=product&id=${encodeURIComponent(state.activeProductId || "")}`;
      const type = route === "category"
        ? `&type=${encodeURIComponent((state.categoryPage || CATEGORY_PAGE_PRESETS.all).key || "all")}`
        : "";
      return `${staticEntry}?route=${encodeURIComponent(route)}${type}`;
    }
    if (route === "cart") return "/cart";
    if (route === "profile") return "/profile";
    if (route === "favorites") return "/favorites";
    if (route === "admin") return "/admin";
    if (route === "category") return `/category?type=${encodeURIComponent((state.categoryPage || CATEGORY_PAGE_PRESETS.all).key || "all")}`;
    if (route === "product") return `/product?id=${encodeURIComponent(state.activeProductId || "")}`;
    return "/";
  }

  function pageScrollBehavior(options = {}) {
    if (options.behavior) return options.behavior;
    return reduceMotion || mobileViewport.matches ? "auto" : "smooth";
  }

  function navigateTo(route, syncUrl = true, options = {}) {
    const nextRoute = ["home", "profile", "cart", "favorites", "admin", "category", "product"].includes(route) ? route : "home";
    const nextPath = syncUrl ? routePath(nextRoute) : "";

    state.route = nextRoute;
    state.mobileAction = nextRoute === "admin" ? "profile" : (nextRoute === "category" ? "catalog" : nextRoute);
    closeFilters();
    closeProduct();
    closeSortMenu();
    renderRoute();

    if (syncUrl) {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (currentPath !== nextPath || window.location.hash) {
        window.history.pushState({ route: nextRoute }, "", nextPath);
      }
    }

    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: pageScrollBehavior(options) });
    }
  }

  function goToCatalog() {
    state.filters.favoritesOnly = false;
    if (state.route !== "home") {
      const keepStaticUrl = /\/(?:public\/)?index\.html$/i.test(window.location.pathname);
      navigateTo("home", !keepStaticUrl);
    }
    setCatalogTab("sofaCollections");
    openFilters();
    state.mobileAction = "catalog";
    updateNavState();
  }

  function getAds() {
    const data = store.read();
    const customAds = (data.customAds || []).filter((ad) => ad.active !== false && ad.visual).slice(0, 3);
    return customAds.length ? customAds : DEFAULT_ADS;
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
        document.querySelector(target)?.scrollIntoView({ block: "start", behavior: pageScrollBehavior() });
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

    document.querySelectorAll("[data-catalog-intent]").forEach((button) => {
      const intent = button.dataset.catalogIntent || "all";
      const active = (
        (intent === "all" && !state.filters.saleOnly && !state.filters.fastDelivery && state.filters.section === ALL_VALUE && state.filters.category === ALL_VALUE && !state.filters.group) ||
        (intent === "compact" && state.filters.category === "диван-кровать") ||
        (intent === "family" && state.filters.category === "угловой") ||
        (intent === "sleep" && state.filters.category === "кровать") ||
        (intent === "fast" && state.filters.fastDelivery) ||
        (intent === "sale" && state.filters.saleOnly)
      );
      button.classList.toggle("is-active", active);
    });
    updateQuickNav();
  }

  function updateQuickNav() {
    els.quickLinks.forEach((link) => {
      if (link.dataset.navKey) {
        link.classList.toggle("is-active", state.activeQuickKey === link.dataset.navKey);
        return;
      }

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
      .sort((a, b) => {
        const aHit = (a.tags || []).some((tag) => displayText(tag).toLowerCase() === "хит") ? 1 : 0;
        const bHit = (b.tags || []).some((tag) => displayText(tag).toLowerCase() === "хит") ? 1 : 0;
        return bHit - aHit || (Number(b.reviews || b.reviewsCount) || 0) - (Number(a.reviews || a.reviewsCount) || 0);
      })
      .slice(0, 2);
    const newItems = visible
      .filter((product) => (product.tags || []).some((tag) => displayText(tag).toLowerCase() === "новинка") || ["Диваны", "Услуги"].includes(product.marketSection))
      .slice(0, 2);

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
    favorite.dataset.favoriteProductId = product.id;
    favorite.setAttribute("aria-label", isFavorite ? "Удалить из избранного" : "Добавить в избранное");
    favorite.classList.toggle("is-active", isFavorite);
    favorite.append(createSvgIcon("heart", "favorite-icon"));
    favorite.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(product.id);
    });

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
    cart.classList.add("product-cart-button");
    cart.dataset.cartProductId = product.id;
    cart.dataset.cartDefaultLabel = product.category === "услуга" ? "Заказать" : "В корзину";
    setCartButtonState(cart, Number(data.cart?.[product.id]) > 0);
    details.addEventListener("click", () => openProduct(product.id));
    cart.addEventListener("click", () => toggleCart(product.id, cart));
    actions.append(details, cart);
    copy.append(top, title, price, meta, actions);
    card.append(media, favorite, copy);
    return card;
  }

  function updateCatalogTitle() {
    let title = "Все товары";

    if (state.filters.favoritesOnly) {
      title = "Лайки SONA";
    } else if (state.filters.saleOnly) {
      title = "Распродажа SONA";
    } else if (state.filters.group === "sofas") {
      title = "Диваны SONA";
    } else if (state.filters.category === "кровать") {
      title = "Кровати SONA";
    } else if (state.filters.category === "кресло") {
      title = "Кресла SONA";
    } else if (state.filters.section === "Мебель") {
      title = "Мебель SONA";
    } else if (state.filters.section === "Диваны") {
      title = "Диваны SONA";
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
    let elevated = false;
    let compact = false;
    const update = () => {
      scheduled = false;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const isMobile = window.matchMedia("(max-width: 760px)").matches;

      if (!elevated && scrollTop > 16) elevated = true;
      if (elevated && scrollTop < 4) elevated = false;
      if (!compact && scrollTop > 120) compact = true;
      if (compact && scrollTop < 72) compact = false;

      header.classList.toggle("is-elevated", elevated);
      header.classList.toggle("is-compact", compact && !isMobile);
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

    const selector = [
      ".product-card",
      ".catalog-hub-card",
      ".home-category-card",
      ".sofa-collection-card",
      ".service-card",
      ".lookbook-card",
      ".similar-card",
      ".footer-contact-card"
    ].join(", ");
    let activeCard = null;
    let pointerFrame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const reset = (card) => {
      if (!card) return;
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
      card.style.setProperty("--shine-x", "50%");
      card.style.setProperty("--pointer-x", "0px");
      card.style.setProperty("--pointer-y", "0px");
    };

    const update = () => {
      pointerFrame = 0;
      if (!activeCard) return;

      const rect = activeCard.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (pointerX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (pointerY - rect.top) / rect.height));

      activeCard.style.setProperty("--tilt-x", `${(0.5 - y) * 2.4}deg`);
      activeCard.style.setProperty("--tilt-y", `${(x - 0.5) * 2.4}deg`);
      activeCard.style.setProperty("--shine-x", `${x * 100}%`);
      activeCard.style.setProperty("--pointer-x", `${(x - 0.5) * 5}px`);
      activeCard.style.setProperty("--pointer-y", `${(y - 0.5) * 4}px`);
    };

    document.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const nextCard = event.target.closest(selector);

      if (nextCard !== activeCard) {
        reset(activeCard);
        activeCard = nextCard;
      }
      if (!activeCard) return;

      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(update);
    }, { passive: true });

    document.addEventListener("pointerout", (event) => {
      if (event.relatedTarget || !activeCard) return;
      reset(activeCard);
      activeCard = null;
    }, { passive: true });
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
      document.querySelectorAll(".hero-banner, .catalog-hub, .deal-strip, .hits-showcase, .all-products-section, .category-page-hero").forEach((element) => {
        const rect = element.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const offset = (viewportCenter - center) * 0.018;
        element.style.setProperty("--parallax-y", `${Math.max(-10, Math.min(10, offset))}px`);
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
    const isInCart = Number(data.cart?.[product.id]) > 0;
    const card = createElement("article", "product-card");
    card.classList.toggle("is-sofa-card", isSofaProduct(product));
    card.classList.toggle("is-white-media-card", usesWhiteProductMedia(product));
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
    const brand = createElement("span", "product-brand", productCategoryLabel(product));
    const rating = createElement("span", "rating", reviewLabel(product.id, data));
    const titleRow = createElement("div", "product-title-row");
    const title = createElement("h3", "", product.name);
    const meta = createElement("div", "product-meta");
    const swatches = createElement("div", "swatches");
    const footer = createElement("div", "product-footer");
    const price = createElement("div", "price");
    const priceStrong = createElement("strong", "", productPriceLabel(product));
    const delivery = createElement("div", "delivery-note", product.deliveryDays <= 3 ? "доставим быстро" : `доставка от ${product.deliveryDays} дней`);
    const serviceNote = createElement("div", "service-note", product.category === "услуга" ? "согласуем детали после заявки" : "проверим наличие перед доставкой");
    const defaultCartLabel = product.category === "услуга" ? "Заказать" : "В корзину";
    const addButton = createElement("button", "primary-button", defaultCartLabel);
    addButton.classList.add("product-cart-button");
    addButton.dataset.cartProductId = product.id;
    addButton.dataset.cartDefaultLabel = defaultCartLabel;
    addButton.setAttribute("aria-label", product.category === "услуга" ? "Заказать услугу" : `Добавить ${product.name} в корзину`);
    addButton.append(createSvgIcon("cart", "product-cart-icon"));
    setCartButtonState(addButton, isInCart);

    if (product.oldPrice) {
      const discount = product.discountPercent || Math.round((1 - product.price / product.oldPrice) * 100);
      tagWrap.append(createElement("span", "tag discount-tag", `−${discount}%`));
    }

    (product.tags || [])
      .filter((tag) => {
        const label = displayText(tag).toLowerCase();
        const isStatusTag = label === "хит" || label === "новинка";
        return !isStatusTag && !(product.oldPrice && (label.includes("скид") || label.includes("%")));
      })
      .slice(0, product.oldPrice ? 1 : 2)
      .forEach((tag) => {
        tagWrap.append(createElement("span", "tag", tag));
      });

    favoriteButton.type = "button";
    favoriteButton.dataset.favoriteProductId = product.id;
    favoriteButton.setAttribute("aria-label", isFavorite ? "Удалить из избранного" : "Добавить в избранное");
    favoriteButton.classList.toggle("is-active", isFavorite);
    favoriteButton.append(createSvgIcon("heart", "favorite-icon"));
    favoriteButton.addEventListener("click", (event) => {
      event.preventDefault();
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
      event.preventDefault();
      event.stopPropagation();
      toggleCart(product.id, addButton);
    });

    topLine.append(brand, rating);
    titleRow.append(title);
    footer.append(price, serviceNote, delivery, addButton);
    media.append(placeholder, tagWrap, favoriteButton);
    body.append(topLine, titleRow, meta, swatches, footer);
    card.append(media, body);

    return card;
  }

  function createProductPlaceholder(product, viewLabel = "Фото товара") {
    const placeholder = createElement("div", "product-placeholder");
    const gallery = getProductGallery(product);
    const imageSource = resolveProductImage(product);

    if (imageSource) {
      const image = document.createElement("img");
      image.src = imageSource;
      image.alt = displayText(gallery[0]?.alt || product.name || "");
      image.loading = "eager";
      image.decoding = "async";
      image.setAttribute("fetchpriority", "high");
      image.addEventListener("error", () => {
        if (image.dataset.fallbackApplied === "true") return;
        image.dataset.fallbackApplied = "true";
        image.src = safeImageSrc(defaultProductImage(product));
      }, { once: true });
      placeholder.classList.add("has-image");
      placeholder.dataset.productId = product.id || "";
      if (isSofaProduct(product)) {
        placeholder.classList.add("is-sofa-image");
      }
      if (usesWhiteProductMedia(product)) {
        placeholder.classList.add("is-white-media-image");
      }
      placeholder.append(image);
      return placeholder;
    }

    const section = createElement("span", "placeholder-section", product.marketSection || "SONA");
    const slot = createElement("span", "photo-slot");
    const iconWrap = createElement("span", "photo-slot-icon");
    const mark = createElement("i", "", viewLabel);

    placeholder.dataset.kind = product.marketSection || "market";
    placeholder.classList.add("is-photo-slot");
    iconWrap.append(createSvgIcon("image", "photo-slot-svg"));
    slot.append(iconWrap, mark);
    placeholder.append(section, slot);
    return placeholder;
  }

  function openProduct(productId) {
    const product = byId(productId);
    if (!product) return;
    store.update((data) => {
      data.viewedProductIds = [
        product.id,
        ...(data.viewedProductIds || []).filter((id) => id !== product.id)
      ].slice(0, 12);
    });
    state.activeProductId = product.id;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (routeFromLocation() !== "product") {
      state.productReturnPath = currentPath;
    }

    closeSearchResults();
    if (els.searchInput) {
      const hadSearch = Boolean(els.searchInput.value || state.filters.query);
      els.searchInput.value = "";
      els.searchInput.blur();
      state.filters.query = "";
      if (hadSearch) renderProducts();
    }
    renderProductDetail(product);
    els.productDetail.scrollTo({ top: 0, left: 0, behavior: "instant" });
    els.productModal.classList.add("is-open");
    els.productModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-lock");
    const nextPath = routePath("product");
    if (currentPath !== nextPath) {
      window.history.pushState({ route: "product", productId: product.id }, "", nextPath);
    }
  }

  function closeProduct() {
    els.productModal.classList.remove("is-open");
    els.productModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-lock");
    const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
    const currentQueryRoute = new URLSearchParams(window.location.search).get("route");
    if (currentPath === "/product" || currentQueryRoute === "product") {
      const returnPath = state.productReturnPath || routePath("home");
      window.history.pushState({ route: "home" }, "", returnPath);
      state.route = routeFromLocation();
      renderRoute();
    }
  }

  function renderProductDetail(product) {
    const data = store.read();
    const isInCart = Number(data.cart?.[product.id]) > 0;
    const discount = product.discountPercent || (product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0);
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
    const rating = createElement("div", "detail-rating", reviewLabel(product.id));
    const warranty = createElement("span", "detail-warranty", product.category === "услуга" ? "договор и этапы работ" : "гарантия 3 года");
    const price = createElement("div", "detail-price");
    const actions = createElement("div", "detail-actions");
    const addButton = createElement("button", "primary-button", product.category === "услуга" ? "Заказать услугу" : "В корзину");
    const buyButton = createElement("button", "secondary-action", "Купить в 1 клик");
    const sellerCall = createSellerCall(product);
    const variants = createVariantsSection(product);
    const characteristics = createElement("section", "detail-characteristics");
    const delivery = createElement("div", "detail-delivery");
    const galleryItems = getProductGallery(product);
    const fallbackGallery = galleryItems.length
      ? galleryItems
      : [{ src: resolveProductImage(product), alt: product.name, main: true }];

    close.type = "button";
    close.setAttribute("aria-label", "Закрыть товар");
    close.append(createSvgIcon("close", "detail-close-icon"));
    close.addEventListener("click", closeProduct);

    function setGallery(index) {
      const item = fallbackGallery[index];
      if (item?.src) {
        const holder = createElement("div", "product-placeholder has-image");
        const image = document.createElement(isGalleryVideo(item) ? "video" : "img");
        image.src = safeImageSrc(item.src);
        if (image.tagName === "VIDEO") {
          image.controls = true;
          image.playsInline = true;
          image.preload = "metadata";
          holder.classList.add("is-video-media");
        } else {
          image.alt = displayText(item.alt || product.name || "");
          image.loading = "eager";
          image.decoding = "async";
        }
        if (isSofaProduct(product)) {
          holder.classList.add("is-sofa-image");
        }
        if (usesWhiteProductMedia(product)) {
          holder.classList.add("is-white-media-image");
        }
        if (isAttachedSofaPhoto(item.src)) {
          holder.classList.add("is-attached-sofa-photo");
        }
        holder.append(image);
        stage.replaceChildren(holder);
      } else {
        stage.replaceChildren(createProductPlaceholder(product, item?.label || "Фото товара"));
      }
      thumbList.querySelectorAll(".detail-thumb").forEach((button, buttonIndex) => {
        button.classList.toggle("is-active", buttonIndex === index);
      });
    }

    fallbackGallery.forEach((item, index) => {
      const thumb = createElement("button", "detail-thumb");
      thumb.type = "button";
      if (item?.src) {
        const thumbImage = document.createElement(isGalleryVideo(item) ? "video" : "img");
        thumbImage.src = safeImageSrc(item.src);
        if (thumbImage.tagName === "VIDEO") {
          thumbImage.muted = true;
          thumbImage.preload = "metadata";
          thumb.classList.add("is-video-thumb");
        } else {
          thumbImage.alt = "";
        }
        if (isAttachedSofaPhoto(item.src)) {
          thumb.classList.add("is-attached-sofa-photo");
        }
        thumb.append(thumbImage);
      } else {
        thumb.textContent = item?.label || (index === 0 ? "Фото" : `Вид ${index + 1}`);
      }
      if (index === 0) thumb.classList.add("is-active");
      thumb.addEventListener("click", () => setGallery(index));
      thumbList.append(thumb);
    });

    setGallery(0);
    gallery.append(thumbList, stage);

    titleWrap.append(title, code);
    titleRow.append(titleWrap, close);

    const priceMain = createElement("div", "detail-price-main");
    const priceMeta = createElement("div", "detail-price-meta");
    priceMain.append(createElement("strong", "", productPriceLabel(product)));
    if (product.oldPrice) {
      priceMeta.append(
        createElement("span", "detail-discount", `−${discount}%`),
        createElement("del", "", money(product.oldPrice))
      );
    }
    if (product.benefit) priceMeta.append(createElement("span", "detail-benefit", `Выгода ${money(product.benefit)}`));
    price.append(priceMain, priceMeta);

    addButton.type = "button";
    addButton.classList.add("product-cart-button");
    addButton.dataset.cartProductId = product.id;
    addButton.dataset.cartDefaultLabel = product.category === "услуга" ? "Заказать услугу" : "В корзину";
    setCartButtonState(addButton, isInCart);
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      toggleCart(product.id, addButton);
    });

    buyButton.type = "button";
    buyButton.setAttribute("aria-expanded", "false");
    buyButton.addEventListener("click", () => {
      const opening = sellerCall.hidden;
      sellerCall.hidden = !opening;
      buyButton.classList.toggle("is-open", opening);
      buyButton.classList.remove("is-opening", "is-closing");
      void buyButton.offsetWidth;
      buyButton.classList.add(opening ? "is-opening" : "is-closing");
      buyButton.setAttribute("aria-expanded", String(opening));
      window.setTimeout(() => buyButton.classList.remove("is-opening", "is-closing"), 620);
    });
    actions.append(addButton, buyButton);

    const characteristicGrid = createElement("div", "detail-characteristics-grid");
    [
      ["Габаритные размеры", product.dimensions],
      ["Спальное место", product.sleepingPlace],
      ["Механизм", product.mechanism],
      ["Материалы", (product.materials || []).join(", ")]
    ].filter(([, value]) => value).forEach(([label, value]) => characteristicGrid.append(createDetailOption(label, value)));
    characteristics.append(createElement("h3", "", "Характеристики"), characteristicGrid);

    delivery.append(
      createElement("h3", "", "Доставка"),
      createElement("p", "", "Доставка в любую точку России. Срок доставки зависит от вашего региона.")
    );

    info.append(titleRow, rating, warranty, price, actions, sellerCall, variants, characteristics, delivery);
    main.append(gallery, info);
    els.productDetail.replaceChildren(main, createReviewsSection(product), createSimilarSection(product));
  }

  function createVariantsSection(product) {
    const section = createElement("section", "variant-section");
    const head = createElement("div", "variant-head");
    const isService = displayText(product.category) === "услуга" || displayText(product.marketSection) === "Услуги";
    const title = createElement("h3", "", isService ? "Пакет услуги" : "Выбор ткани");
    const note = createElement("span", "", isService ? "Выберите подходящий вариант" : "Подберите цвет, фактуру и тип обивки");
    const grid = createElement("div", "variant-grid");
    const options = isService ? (product.variants || []) : getFabricOptions(product);

    head.append(title, note);
    if (!isService) section.classList.add("is-fabric-picker");

    if (!options.length) {
      const empty = createElement("p", "variant-empty", isService
        ? "Варианты услуги пока не добавлены."
        : "Доступные ткани уточнит продавец.");
      section.append(head, empty);
      return section;
    }

    options.forEach((variant, index) => {
      const option = createElement("button", "variant-option");
      const color = createElement("span", "variant-color");
      const copy = createElement("span", "variant-copy");
      const text = createElement("strong", "", variant.name || variant.title || "Вариант");
      const meta = createElement("span", "variant-meta", isService ? "вариант пакета" : fabricTypeLabel(variant, product, index));
      const variantPrice = Number(variant.price) || 0;
      const price = createElement("span", "variant-price", variantPrice > 0 ? money(variantPrice) : "Цена уточняется");

      option.type = "button";
      option.classList.toggle("is-active", index === 0);
      option.setAttribute("aria-pressed", String(index === 0));
      color.style.background = normalizeFabricColor(variant.color, index);
      option.addEventListener("click", () => {
        grid.querySelectorAll(".variant-option").forEach((button) => {
          button.classList.remove("is-active");
          button.setAttribute("aria-pressed", "false");
        });
        option.classList.add("is-active");
        option.setAttribute("aria-pressed", "true");
      });
      copy.append(text, meta);
      option.append(color, copy);
      option.append(price);
      grid.append(option);
    });

    section.append(head, grid);
    return section;
  }

  function getFabricOptions(product) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const materials = Array.isArray(product.materials) ? product.materials.map(displayText).filter(Boolean) : [];
    const colors = Array.isArray(product.colors) ? product.colors : [];
    return variants.map((variant, index) => {
      const title = displayText(variant.name || variant.title || materials[index % materials.length] || `Ткань ${index + 1}`);
      return {
        ...variant,
        name: title,
        color: variant.color || colors[index % colors.length],
        type: fabricTypeLabel(variant, product, index)
      };
    });
  }

  function fabricTypeLabel(variant, product, index) {
    const direct = variant.type || variant.material || variant.configuration || "";
    if (direct) return displayText(direct);
    const title = displayText(variant.name || variant.title || "");
    const [, fromTitle] = title.split(",");
    if (fromTitle) return fromTitle.trim();
    const materials = Array.isArray(product.materials) ? product.materials.map(displayText).filter(Boolean) : [];
    return materials[index % materials.length] || "ткань для обивки";
  }

  function normalizeFabricColor(color, index) {
    const fallback = ["#246aaf", "#9cc8e8", "#e8f5ff", "#9cc9b9", "#d7c4ad", "#506070", "#f1eee6", "#bd7462"];
    const value = String(color || "").trim();
    return /^(#|rgb|hsl)/i.test(value) ? value : fallback[index % fallback.length];
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
    const controls = createElement("div", "review-controls");
    const data = store.read();
    const reviews = window.SonaReviews?.list(data.reviews || [], product.id) || [];
    const summary = reviewSummary(product.id, data);
    const pageSize = 6;
    const pageCount = Math.max(1, Math.ceil(reviews.length / pageSize));
    let page = 0;

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

    const previous = createElement("button", "review-control", "Назад");
    const indicator = createElement("span", "review-page-indicator");
    const next = createElement("button", "review-control", "Вперёд");
    previous.type = "button";
    next.type = "button";

    function renderReviewPage() {
      const pageReviews = reviews.slice(page * pageSize, (page + 1) * pageSize);
      const reviewCards = pageReviews.map((review) => {
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
        return card;
      });

      cards.replaceChildren(...reviewCards);
      indicator.textContent = `${page + 1} / ${pageCount}`;
      previous.disabled = page === 0;
      next.disabled = page >= pageCount - 1;
      cards.scrollTo({ left: 0, behavior: pageScrollBehavior() });
    }

    previous.addEventListener("click", () => {
      page = Math.max(0, page - 1);
      renderReviewPage();
    });
    next.addEventListener("click", () => {
      page = Math.min(pageCount - 1, page + 1);
      renderReviewPage();
    });

    controls.append(previous, indicator, next);
    renderReviewPage();
    section.append(head, cards);
    if (pageCount > 1) section.append(controls);
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
    const body = createElement("span", "similar-card-body");
    const meta = createElement("span", "similar-card-meta", (product.specs || product.materials || []).slice(0, 2).join(" · "));
    const title = createElement("strong", "", product.name);
    const price = createElement("span", "", money(product.price));

    card.type = "button";
    card.dataset.similarProductId = product.id;
    card.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openProduct(product.id);
    });
    body.append(title, meta, price);
    card.append(media, body);
    return card;
  }

  function createDetailOption(label, value) {
    const item = createElement("div", "detail-option");
    item.append(createElement("span", "", label), createElement("strong", "", value || "уточняется"));
    return item;
  }

  function refreshProfileAfterMotion() {
    if (state.route === "profile") return;
    renderProfilePage();
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
    syncFavoriteButtons(id);
    refreshProfileAfterMotion();
    if (state.route === "favorites") {
      renderFavoritesPage();
    }
    if (state.filters.favoritesOnly) {
      renderProducts();
    }
    showToast(added ? "В избранном" : "Удалено из избранного");
  }

  function removeFavorite(productId) {
    const id = security.safeProductId(productId);

    store.update((data) => {
      data.favorites = (data.favorites || []).filter((item) => item !== id);
    });
    render();
    showToast("Товар удалён из избранного");
  }

  function playCartMotion(triggerButton, added = true) {
    if (triggerButton && !reduceMotion) {
      const motionClass = added ? "is-added" : "is-removed";
      triggerButton.classList.remove("is-added", "is-removed");
      void triggerButton.offsetWidth;
      triggerButton.classList.add(motionClass);

      window.clearTimeout(triggerButton.motionTimer);
      triggerButton.motionTimer = window.setTimeout(() => {
        triggerButton.classList.remove(motionClass);
      }, 720);
    }

    if (reduceMotion || !added) return;

    els.cartBadge?.classList.add("is-bouncing");
    els.mobileCartBadge?.classList.add("is-bouncing");
  }

  function preserveElementViewportPosition(element, renderAction) {
    if (!element || typeof renderAction !== "function") {
      renderAction?.();
      return;
    }

    const previousTop = element.getBoundingClientRect().top;
    renderAction();
    const nextTop = element.getBoundingClientRect().top;
    const offset = nextTop - previousTop;

    if (Math.abs(offset) > 0.5) {
      window.scrollBy({ top: offset, left: 0, behavior: "instant" });
    }
  }

  function addToCart(productId, triggerButton) {
    const id = security.safeProductId(productId);
    if (triggerButton && !triggerButton.dataset.cartDefaultLabel) {
      triggerButton.dataset.cartDefaultLabel = triggerButton.textContent.trim() || "В корзину";
    }
    store.update((data) => {
      data.cart[id] = Math.min((Number(data.cart[id]) || 0) + 1, 20);
    });
    preserveElementViewportPosition(
      state.route === "cart" ? els.cartRecommendations : null,
      renderCart
    );
    refreshProfileAfterMotion();
    syncCartButtons(id);
    setCartButtonState(triggerButton, true);
    playCartMotion(triggerButton, true);
    showToast("В корзине");
  }

  function toggleCart(productId, triggerButton) {
    const id = security.safeProductId(productId);
    const stableScrollY = state.route === "favorites" ? window.scrollY : null;
    let added = false;
    store.update((data) => {
      added = !(Number(data.cart[id]) > 0);
      if (added) {
        data.cart[id] = 1;
      } else {
        delete data.cart[id];
      }
    });
    preserveElementViewportPosition(
      state.route === "cart" ? els.cartRecommendations : null,
      renderCart
    );
    refreshProfileAfterMotion();
    syncCartButtons(id);
    playCartMotion(triggerButton, added);
    triggerButton?.blur();
    if (stableScrollY !== null) {
      window.requestAnimationFrame(() => window.scrollTo({ top: stableScrollY, left: 0, behavior: "instant" }));
    }
    showToast(added ? "В корзине" : "Удалено из корзины");
  }

  function syncCartButtons(productId) {
    const id = security.safeProductId(productId);
    const isInCart = Number(store.read().cart?.[id]) > 0;
    document.querySelectorAll(`[data-cart-product-id="${id}"]`).forEach((button) => {
      setCartButtonState(button, isInCart);
    });
  }

  function updateCartTotalsView() {
    const totals = cartTotals();
    els.cartBadge.textContent = String(totals.count);
    if (els.mobileCartBadge) {
      els.mobileCartBadge.textContent = String(totals.count);
      els.mobileCartBadge.hidden = totals.count === 0;
    }
    if (els.cartCountLabel) els.cartCountLabel.textContent = `Товары: ${totals.count}`;
    els.cartSubtotal.textContent = money(totals.subtotal);
    els.deliveryPrice.textContent = totals.delivery ? money(totals.delivery) : "0 ₽";
    els.cartTotal.textContent = money(totals.total);
    els.checkoutButton.disabled = !totals.rows.length;
  }

  function animateQuantityChange(item, triggerButton, direction) {
    if (!item || reduceMotion) return;
    item.classList.remove("is-quantity-up", "is-quantity-down");
    triggerButton?.classList.remove("is-quantity-pressed");
    void item.offsetWidth;
    item.classList.add(direction > 0 ? "is-quantity-up" : "is-quantity-down");
    triggerButton?.classList.add("is-quantity-pressed");
    window.setTimeout(() => {
      item.classList.remove("is-quantity-up", "is-quantity-down");
      triggerButton?.classList.remove("is-quantity-pressed");
    }, 460);
  }

  function setQuantity(productId, quantity, triggerButton = null) {
    const id = security.safeProductId(productId);
    const previousQuantity = Number(store.read().cart?.[id]) || 0;
    const nextQuantity = Math.max(0, Math.min(Number(quantity) || 0, 20));

    store.update((data) => {
      if (nextQuantity === 0) {
        delete data.cart[id];
      } else {
        data.cart[id] = nextQuantity;
      }
    });

    if (nextQuantity === 0) {
      renderCart();
      refreshProfileAfterMotion();
      if (state.route === "favorites") renderFavoritesPage();
      return;
    }

    const item = els.cartItems?.querySelector(`[data-cart-item-id="${id}"]`);
    if (!item) {
      renderCart();
      return;
    }

    const amount = item.querySelector("[data-cart-quantity]");
    const price = item.querySelector("[data-cart-item-price]");
    if (amount) amount.textContent = String(nextQuantity);
    if (price) price.textContent = money((byId(id)?.price || 0) * nextQuantity);
    item.querySelector("[data-quantity-minus]")?.setAttribute("aria-label", "Уменьшить количество");
    item.querySelector("[data-quantity-plus]")?.setAttribute("aria-label", "Увеличить количество");
    updateCartTotalsView();
    animateQuantityChange(item, triggerButton, nextQuantity - previousQuantity);
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
    const mobileProfileLabel = document.querySelector('[data-mobile-action="profile"] strong');
    if (mobileProfileLabel) {
      mobileProfileLabel.textContent = window.SonaAdmin?.isAdmin(store.read()) ? "Админ" : (isProfileActive() ? "Профиль" : "Войти");
    }

    if (!rows.length) {
      const empty = createElement("div", "cart-empty cart-empty-page");
      const title = createElement("strong", "", "Товаров нет");
      const text = createElement("span", "", "Корзина пустая.");

      empty.append(title, text);
      els.cartItems.replaceChildren(empty);
      renderCartRecommendations(rows);
      return;
    }

    els.cartItems.replaceChildren(...rows.map(({ product, quantity }) => createCartItem(product, quantity)));
    renderCartRecommendations(rows);
  }

  function renderCartRecommendations(rows = []) {
    if (!els.cartRecommendations) return;

    const inCart = new Set(rows.map((row) => row.product.id));
    const hits = state.products
      .filter((product) => !inCart.has(product.id))
      .filter((product) => product.available !== false)
      .sort((a, b) => ((Number(b.reviews) || 0) + (Number(b.rating) || 0) * 100) - ((Number(a.reviews) || 0) + (Number(a.rating) || 0) * 100))
      .slice(0, 4);

    if (!hits.length) {
      els.cartRecommendations.replaceChildren();
      return;
    }

    const head = createElement("div", "section-head cart-recommendations-head");
    const copy = createElement("div");
    const eyebrow = createElement("p", "eyebrow", "хиты SONA");
    const title = createElement("h2", "", "Добавить к заказу");
    const text = createElement("span", "", "Популярные товары, которые чаще всего смотрят вместе с корзиной.");
    const grid = createElement("div", "cart-recommendation-grid");

    copy.append(eyebrow, title, text);
    head.append(copy);
    hits.forEach((product) => grid.append(createCartRecommendationCard(product)));
    els.cartRecommendations.replaceChildren(head, grid);
  }

  function createCartRecommendationCard(product) {
    const card = createElement("article", "cart-recommendation-card");
    const thumb = createProductPlaceholder(product, "Хит SONA");
    const body = createElement("div", "cart-recommendation-body");
    const actions = createElement("div", "cart-recommendation-actions");
    const title = createElement("strong", "", product.name);
    const rating = createElement("span", "cart-recommendation-rating", reviewLabel(product.id));
    const price = createElement("span", "cart-recommendation-price", money(product.price));
    const button = createElement("button", "soft-button", "");
    const favorite = createElement("button", "favorite-button", "");

    thumb.classList.add("cart-recommendation-photo");
    button.type = "button";
    button.classList.add("product-cart-button");
    button.dataset.cartProductId = product.id;
    button.dataset.cartDefaultLabel = "В корзину";
    button.setAttribute("aria-label", `Добавить ${product.name} в корзину`);
    button.append(createSvgIcon("cart", "product-cart-icon"));
    setCartButtonState(button, Number(store.read().cart?.[product.id]) > 0);
    button.addEventListener("click", () => toggleCart(product.id, button));
    favorite.type = "button";
    favorite.dataset.favoriteProductId = product.id;
    favorite.setAttribute("aria-label", `Добавить ${product.name} в избранное`);
    favorite.classList.toggle("is-active", store.read().favorites.includes(product.id));
    favorite.append(createSvgIcon("heart", "favorite-icon"));
    favorite.addEventListener("click", () => toggleFavorite(product.id));
    actions.append(button, favorite);
    body.append(title, rating, price);
    card.append(thumb, actions, body);
    return card;
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

    item.dataset.cartItemId = product.id;
    thumb.classList.add("cart-placeholder");
    amount.dataset.cartQuantity = "";
    price.dataset.cartItemPrice = "";

    remove.type = "button";
    remove.setAttribute("aria-label", "Удалить товар");
    remove.addEventListener("click", () => setQuantity(product.id, 0));

    minus.type = "button";
    minus.setAttribute("aria-label", "Уменьшить количество");
    minus.dataset.quantityMinus = "";
    minus.addEventListener("click", () => {
      const current = Number(store.read().cart?.[product.id]) || 0;
      setQuantity(product.id, current - 1, minus);
    });

    plus.type = "button";
    plus.setAttribute("aria-label", "Увеличить количество");
    plus.dataset.quantityPlus = "";
    plus.addEventListener("click", () => {
      const current = Number(store.read().cart?.[product.id]) || 0;
      setQuantity(product.id, current + 1, plus);
    });

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
        if (state.route === "profile") renderProfilePage();
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
    els.mobileConsultMenu.classList.remove("is-open");
    els.mobileConsultButton.setAttribute("aria-expanded", "false");
    window.clearTimeout(closeMobileConsultMenu.timer);
    closeMobileConsultMenu.timer = window.setTimeout(() => {
      if (!els.mobileConsultMenu.classList.contains("is-open")) {
        els.mobileConsultMenu.hidden = true;
      }
    }, 240);
  }

  function toggleMobileConsultMenu() {
    if (!els.mobileConsultButton || !els.mobileConsultMenu) return;
    const nextOpen = els.mobileConsultMenu.hidden || !els.mobileConsultMenu.classList.contains("is-open");
    if (nextOpen) {
      window.clearTimeout(closeMobileConsultMenu.timer);
      els.mobileConsultMenu.hidden = false;
      window.requestAnimationFrame(() => els.mobileConsultMenu.classList.add("is-open"));
    } else {
      closeMobileConsultMenu();
    }
    els.mobileConsultButton.setAttribute("aria-expanded", String(nextOpen));
  }

  function renderSupportChat() {
    if (!els.supportChatRoot || !window.SonaSupport) return;
    window.SonaSupport.renderWidget({
      container: els.supportChatRoot,
      onChange: () => {
        renderAdminPage();
        if (state.route === "profile") renderProfilePage();
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
      toggleCart,
      toggleFavorite,
      removeFavorite,
      removeFromCart: (productId) => setQuantity(productId, 0),
      checkout,
      openCart: () => navigateTo("cart"),
      openFavorites: () => navigateTo("favorites"),
      openAdmin: () => navigateTo("admin"),
      openCatalog: goToCatalog,
      openProduct,
      openEdit: () => {
        window.SonaProfile?.setSection("settings");
        render();
      },
      openSupportChat,
      saveProfile: saveInlineProfile,
      sendTestNotification,
      onAuthChange: () => {
        render();
        showToast("Вход выполнен");
      },
      completeOrder,
      createReview,
      endSession: (sessionId) => {
        const currentId = window.SonaProfile?.currentDeviceId?.();
        store.update((data) => {
          data.accountSessions = (data.accountSessions || []).filter((session) => session.id !== sessionId);
        });
        if (sessionId === currentId) {
          window.SonaProfile?.clearLocalAuth?.();
          store.clearProfile();
          window.SonaProfile?.setSection("home");
          render();
          showToast("Текущий сеанс завершён");
          return;
        }
        render();
        showToast("Сеанс завершён");
      },
      logout: () => {
        const currentId = window.SonaProfile?.currentDeviceId?.();
        window.SonaProfile?.clearLocalAuth?.();
        store.update((data) => {
          data.accountSessions = (data.accountSessions || []).filter((session) => session.id !== currentId);
        });
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
    const head = createPageHead("подборка", "Лайки", "Товары с лайком можно удалить или сразу добавить в корзину.");
    const summary = createElement("div", "favorites-summary");
    const countBadge = createElement("span", "favorites-count", `${favorites.length} ${favorites.length === 1 ? "товар" : "товаров"}`);
    const catalogButton = createElement("button", "soft-button", "Продолжить покупки");
    const list = createElement("div", "favorites-grid category-product-grid");

    catalogButton.type = "button";
    catalogButton.addEventListener("click", goToCatalog);
    summary.append(countBadge, catalogButton);
    head.append(summary);

    if (!favorites.length) {
      const empty = createElement("div", "favorites-empty favorites-empty-simple");
      empty.append(createElement("strong", "", "Лайков пока нет"));
      page.append(head, empty, createFavoritesHitsSection(data));
      els.favoritesPageContent.replaceChildren(page);
      return;
    }

    favorites.forEach((product) => list.append(createProductCard(product, data)));

    page.append(head, list, createFavoritesHitsSection(data));
    els.favoritesPageContent.replaceChildren(page);
  }

  function createFavoritesHitsSection(data) {
    const hits = state.products
      .filter((product) => !product.hidden)
      .slice()
      .sort((left, right) => {
        const leftReviews = (data.reviews || []).filter((review) => review.productId === left.id).length;
        const rightReviews = (data.reviews || []).filter((review) => review.productId === right.id).length;
        return (right.rating || 0) - (left.rating || 0) || rightReviews - leftReviews || (right.price || 0) - (left.price || 0);
      })
      .slice(0, 4);
    const section = createElement("section", "favorites-hits");
    const head = createElement("div", "favorites-hits-head");
    const grid = createElement("div", "favorites-hits-grid");

    head.append(
      createElement("span", "eyebrow", "хиты SONA"),
      createElement("h2", "", "Популярные товары")
    );
    hits.forEach((product) => grid.append(createProductCard(product, data)));
    section.append(head, grid);
    return section;
  }

  function categoryPresetByKey(key) {
    if (CATEGORY_PAGE_PRESETS[key]) return CATEGORY_PAGE_PRESETS[key];

    const sofaPreset = CATEGORY_PAGE_GROUPS.sofas.find((item) => item.key === key);
    if (sofaPreset) {
      return {
        ...CATEGORY_PAGE_PRESETS.sofas,
        ...sofaPreset,
        eyebrow: "диваны",
        section: "Мебель",
        saleOnly: false
      };
    }

    const servicePreset = CATEGORY_PAGE_GROUPS.services.find((item) => item.key === key);
    if (servicePreset) {
      return {
        ...CATEGORY_PAGE_PRESETS.services,
        ...servicePreset,
        eyebrow: "услуги",
        section: "Услуги",
        saleOnly: false
      };
    }

    const salePreset = CATEGORY_PAGE_GROUPS.sale.find((item) => item.key === key);
    if (salePreset) {
      return {
        ...CATEGORY_PAGE_PRESETS.sale,
        ...salePreset,
        eyebrow: "распродажа",
        saleOnly: true
      };
    }

    const titles = {
      "прямой": "Прямые диваны",
      "угловой": "Угловые диваны",
      "модульный": "Модульные диваны",
      "диван-кровать": "Диваны-кровати",
      "кровать": "Кровати SONA",
      "кресло": "Кресла SONA",
      "услуга": "Услуги SONA"
    };
    const sofaCategories = ["прямой", "угловой", "модульный", "диван-кровать"];
    const category = titles[key] ? key : ALL_VALUE;
    const isService = key === "услуга";

    return {
      key: key || "all",
      title: titles[key] || "Все товары SONA",
      eyebrow: isService ? "сервис" : "категория",
      text: "Все товары из выбранной категории в одной странице.",
      section: isService ? "Услуги" : "Мебель",
      category,
      group: sofaCategories.includes(key) ? "" : "",
      saleOnly: false
    };
  }

  function getCategoryPageProducts(preset) {
    const data = store.read();
    const favoriteIds = new Set(data.favorites || []);
    const target = preset || CATEGORY_PAGE_PRESETS.all;
    const query = String(target.query || "").toLowerCase();

    return state.products
      .filter((product) => !product.hidden)
      .filter((product) => {
        const isSofa = ["прямой", "угловой", "модульный", "диван-кровать"].includes(product.category);
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
          (target.section === ALL_VALUE || product.marketSection === target.section) &&
          (!target.group || (target.group === "sofas" && isSofa)) &&
          (target.category === ALL_VALUE || product.category === target.category) &&
          (!target.maxDeliveryDays || product.deliveryDays <= target.maxDeliveryDays) &&
          (!target.saleOnly || Boolean(product.oldPrice)) &&
          (!target.favoritesOnly || favoriteIds.has(product.id)) &&
          (!query || text.includes(query))
        );
      })
      .sort((a, b) => {
        const summaryA = reviewSummary(a.id, data);
        const summaryB = reviewSummary(b.id, data);
        const reviewDelta = summaryB.count - summaryA.count;
        if (reviewDelta !== 0) return reviewDelta;
        return summaryB.average - summaryA.average;
      });
  }

  function renderCategoryPage() {
    if (!els.categoryPageContent || !state.products.length) return;

    const data = store.read();
    const preset = state.categoryPage || CATEGORY_PAGE_PRESETS.all;
    const products = getCategoryPageProducts(preset);
    const page = createElement("div", "category-page-inner");
    const head = createElement("section", "category-page-head");
    const copy = createElement("div");
    const eyebrow = createElement("p", "eyebrow", preset.eyebrow || "каталог");
    const title = createElement("h2", "", preset.title || "Все товары SONA");
    const text = createElement("span", "", preset.text || "Выберите товары из каталога SONA.");
    const switcher = createElement("div", "category-page-switcher");
    const grid = createElement("div", "category-product-grid");

    copy.append(eyebrow, title, text);
    head.append(copy);
    const back = createElement("button", "category-page-back");
    const backIcon = createElement("span", "category-page-back-icon");
    const backLabel = createElement("span", "category-page-back-label",
      preset.section === "Услуги" ? "Назад к услугам" : (preset.saleOnly ? "Назад к распродаже" : "Назад в каталог"));
    back.type = "button";
    back.setAttribute("aria-label", backLabel.textContent);
    back.append(backIcon, backLabel);
    back.addEventListener("click", () => {
      if (preset.saleOnly) {
        openCatalogCollection("sale", {
          section: ALL_VALUE,
          category: ALL_VALUE,
          group: "",
          saleOnly: true,
          navKey: "sale"
        });
        return;
      }
      openCatalogCollection(tabForCategoryPreset(preset), {
        section: preset.section || ALL_VALUE,
        category: preset.category || ALL_VALUE,
        group: preset.group || "",
        saleOnly: false,
        navKey: preset.key || ""
      });
    });
    head.append(back);

    categorySwitchItems(preset).forEach((item) => {
      const nextPreset = {
        ...preset,
        ...item,
        key: item.key,
        section: item.section || preset.section,
        saleOnly: Boolean(item.saleOnly)
      };
      const button = createElement("button", item.key === preset.key ? "is-active" : "", item.label || item.title.replace(" SONA", ""));
      button.type = "button";
      button.addEventListener("click", () => openCategoryPage(nextPreset));
      switcher.append(button);
    });

    if (products.length) {
      products.forEach((product) => grid.append(createProductCard(product, data)));
    } else {
      const empty = createElement("div", "category-page-empty");
      empty.append(
        createElement("strong", "", "Товаров пока нет"),
        createElement("span", "", "Фотографии и товары можно будет добавить позже через каталог или админ-панель.")
      );
      grid.append(empty);
    }

    page.append(head, switcher, grid);
    els.categoryPageContent.replaceChildren(page);
    observeAnimatedElements();
  }

  function categorySwitchItems(preset = {}) {
    if (preset.key === "fast") {
      return [
        {
          key: "fast",
          label: "Быстрая доставка",
          title: "Быстрая доставка",
          section: ALL_VALUE,
          category: ALL_VALUE,
          group: "",
          maxDeliveryDays: 3,
          text: "Товары, которые можно привезти за 1-3 дня."
        }
      ];
    }
    if (preset.key === "sale" || preset.key?.startsWith("sale-") || preset.saleOnly) return CATEGORY_PAGE_GROUPS.sale;
    if (preset.group === "sofas" || ["sofas", "прямой", "угловой", "модульный", "диван-кровать"].includes(preset.key) || ["прямой", "угловой", "модульный", "диван-кровать"].includes(preset.category)) {
      return CATEGORY_PAGE_GROUPS.sofas;
    }
    if (preset.key === "beds" || preset.category === "кровать") return CATEGORY_PAGE_GROUPS.beds;
    if (preset.key === "chairs" || preset.category === "кресло") return CATEGORY_PAGE_GROUPS.chairs;
    if (preset.key === "services" || preset.section === "Услуги" || preset.category === "услуга") return CATEGORY_PAGE_GROUPS.services;
    return CATEGORY_PAGE_GROUPS.all;
  }

  function tabForCategoryPreset(preset = {}) {
    if (preset.saleOnly || preset.key === "sale" || preset.key?.startsWith("sale-")) return "sale";
    if (preset.key === "beds" || preset.category === "кровать") return "bedCollections";
    if (preset.key === "chairs" || preset.category === "кресло") return "chairCollections";
    if (preset.key === "services" || preset.category === "услуга" || preset.section === "Услуги") return "serviceCollections";
    return "sofaCollections";
  }

  function openCategoryPage(options = {}) {
    const preset = {
      ...categoryPresetByKey(options.key || options.category || "all"),
      ...options
    };
    state.categoryPage = preset;
    navigateTo("category");
  }

  function openCategoryPageFromShortcut(button) {
    const shortcut = button.dataset.categoryShortcut || "all";
    const title = button.querySelector("strong")?.textContent?.trim() || button.textContent.trim();
    const isSale = Boolean(button.closest('[data-catalog-view="sale"]'));
    const preset = {
      ...categoryPresetByKey(shortcut === "все" ? "sale" : shortcut),
      key: shortcut === "все" && isSale ? "sale" : shortcut,
      title: isSale && shortcut !== "все" ? `${title} со скидкой` : title,
      saleOnly: isSale
    };

    closeFilters();
    openCategoryPage(preset);
  }

  function openServiceCategory(button) {
    const key = button.dataset.serviceCategory || "development";
    const preset = CATEGORY_PAGE_GROUPS.services.find((item) => item.key === key) || CATEGORY_PAGE_GROUPS.services[0];
    closeFilters();
    openCategoryPage({
      ...CATEGORY_PAGE_PRESETS.services,
      ...preset,
      key: preset.key,
      section: "Услуги"
    });
  }

  function openCatalogIntent(button) {
    const intent = button.dataset.catalogIntent || "all";
    const presets = {
      all: {
        ...CATEGORY_PAGE_PRESETS.all,
        key: "all",
        title: "Вся витрина SONA",
        text: "Мебель, услуги и предложения каталога в одном списке."
      },
      compact: {
        ...categoryPresetByKey("диван-кровать"),
        key: "диван-кровать",
        title: "Компактные решения",
        text: "Диваны-кровати и модели для студий, небольших гостиных и гостевых комнат."
      },
      family: {
        ...categoryPresetByKey("угловой"),
        key: "угловой",
        title: "Для семьи и гостей",
        text: "Просторные модели для отдыха, общения и больших комнат."
      },
      sleep: {
        ...categoryPresetByKey("кровать"),
        key: "кровать",
        title: "Сон и хранение",
        text: "Кровати и решения для спокойной спальни, порядка и ежедневного комфорта."
      },
      fast: {
        ...CATEGORY_PAGE_PRESETS.all,
        key: "fast",
        title: "Быстрая доставка",
        text: "Товары, которые можно привезти за 1-3 дня.",
        maxDeliveryDays: 3
      },
      sale: {
        ...CATEGORY_PAGE_PRESETS.sale,
        key: "sale",
        title: "Скидки SONA",
        text: "Актуальные товары и услуги со сниженной ценой."
      }
    };

    closeFilters();
    openCategoryPage(presets[intent] || presets.all);
  }

  function updateNavState() {
    els.profileButton?.classList.toggle("is-active", state.route === "profile");
    els.favoritesButton?.classList.toggle("is-active", state.route === "favorites");
    els.cartButton?.classList.toggle("is-active", state.route === "cart");
    const mobileActiveAction = state.route === "home"
      ? (els.filterDrawer?.classList.contains("is-open") ? "catalog" : "home")
      : (state.route === "admin" ? "profile" : state.route);
    document.querySelectorAll("[data-mobile-action]").forEach((button) => {
      const action = button.dataset.mobileAction;
      const isActive = action === mobileActiveAction;
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

    const isProduct = state.route === "product";
    const isHome = state.route === "home" || isProduct;
    const isCart = state.route === "cart";
    const isProfile = state.route === "profile";
    const isFavorites = state.route === "favorites";
    const isAdmin = state.route === "admin";
    const isCategory = state.route === "category";

    els.marketplace.hidden = !isHome;
    if (els.categoryPage) els.categoryPage.hidden = !isCategory;
    els.cartPage.hidden = !isCart;
    if (els.profilePage) els.profilePage.hidden = !isProfile;
    if (els.favoritesPage) els.favoritesPage.hidden = !isFavorites;
    if (els.adminPage) els.adminPage.hidden = !isAdmin;
    document.body.classList.toggle("cart-view", isCart);
    document.body.classList.toggle("account-view", isProfile || isFavorites || isAdmin || isCategory);
    document.body.classList.toggle("profile-view", isProfile);
    document.body.classList.toggle("admin-view", isAdmin);

    renderCart();
    renderCategoryPage();
    renderProfilePage();
    renderFavoritesPage();
    renderAdminPage();
    renderSupportChat();
    updateNavState();
    updateQuickNav();
    if (isProduct && state.activeProductId) {
      const product = byId(state.activeProductId);
      if (product) {
        renderProductDetail(product);
        els.productModal.classList.add("is-open");
        els.productModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-lock");
      }
    }
  }

  function openFilters() {
    window.clearTimeout(closeFilters.timer);
    els.filterDrawer.classList.add("is-open");
    els.filterDrawer.setAttribute("aria-hidden", "false");
    els.filterButton?.classList.add("is-open");
    els.filterButton?.setAttribute("aria-expanded", "true");
  }

  function closeFilters() {
    els.filterDrawer.classList.remove("is-open");
    window.clearTimeout(closeFilters.timer);
    closeFilters.timer = window.setTimeout(() => {
      if (!els.filterDrawer.classList.contains("is-open")) {
        els.filterDrawer.setAttribute("aria-hidden", "true");
      }
    }, 320);
    els.filterButton?.classList.remove("is-open");
    els.filterButton?.setAttribute("aria-expanded", "false");
    if (state.route === "home") {
      state.mobileAction = "home";
      updateNavState();
    }
  }

  function searchProductText(product) {
    return [
      product.name,
      product.brand,
      product.category,
      product.marketSection,
      ...(product.materials || []),
      ...(product.specs || []),
      ...(product.tags || [])
    ].join(" ").toLowerCase();
  }

  function closeSearchResults() {
    if (!els.searchResults) return;
    els.searchResults.hidden = true;
    els.searchResults.replaceChildren();
  }

  function renderSearchResults() {
    if (!els.searchResults || !els.searchInput) return;
    const query = security.sanitizeText(els.searchInput.value, 80).trim().toLowerCase();
    if (!query) {
      closeSearchResults();
      return;
    }

    const matches = state.products
      .filter((product) => !product.hidden && searchProductText(product).includes(query))
      .slice(0, 6);

    const rows = matches.map((product) => {
      const button = createElement("button", "search-result");
      const image = document.createElement("img");
      const copy = createElement("span", "search-result-copy");
      image.src = safeImageSrc(resolveProductImage(product));
      image.alt = "";
      copy.append(
        createElement("strong", "", product.name),
        createElement("span", "", `${product.category || product.marketSection || "Товар"} · ${money(product.price)}`)
      );
      button.type = "button";
      button.append(image, copy, createElement("span", "search-result-arrow", "→"));
      button.addEventListener("click", () => {
        closeSearchResults();
        openProduct(product.id);
      });
      return button;
    });

    if (!rows.length) {
      rows.push(createElement("p", "search-results-empty", "Товары не найдены"));
    }
    els.searchResults.replaceChildren(...rows);
    els.searchResults.hidden = false;
  }

  function showFullSearchResults() {
    if (!state.filters.query.trim()) return;
    if (state.route !== "home") {
      navigateTo("home");
    }
    closeSearchResults();
    window.requestAnimationFrame(() => {
      document.getElementById("catalog")?.scrollIntoView({ block: "start", behavior: pageScrollBehavior() });
    });
  }

  function setCatalogTab(tabName) {
    els.catalogTabs.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.catalogTab === tabName);
    });

    els.catalogSwitches.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.catalogSwitch === tabName);
    });

    els.catalogViews.forEach((view) => {
      view.classList.toggle("is-active", view.dataset.catalogView === tabName);
    });
  }

  function openCatalogCollection(tabName, options = {}) {
    if (state.route !== "home") {
      navigateTo("home");
    }
    state.filters.section = options.section || "Мебель";
    state.filters.category = options.category || ALL_VALUE;
    state.filters.group = options.group || "";
    state.filters.saleOnly = Boolean(options.saleOnly);
    state.filters.favoritesOnly = false;
    state.activeQuickKey = options.navKey || "";
    els.saleOnly.checked = state.filters.saleOnly;
    setCatalogTab(tabName);
    renderProducts();
    openFilters();
  }

  function openSofaCollections() {
    openCatalogCollection("sofaCollections", {
      section: "Мебель",
      category: ALL_VALUE,
      group: "sofas"
    });
  }

  async function saveInlineProfile(payload) {
    const stableScrollY = state.route === "profile" ? window.scrollY : null;
    const nextData = store.update((data) => {
      data.profile = {
        ...data.profile,
        isActive: true,
        name: security.sanitizeText(payload.name || "", 40),
        email: security.sanitizeEmail(payload.email || ""),
        phone: security.sanitizePhone(payload.phone || ""),
        address: security.sanitizeText(payload.address || "", 120),
        notifications: {
          site: payload.notifications?.site !== false,
          email: payload.notifications?.email !== false
        },
        registeredAt: data.profile?.registeredAt || new Date().toISOString()
      };
    });
    window.SonaProfile?.syncLocalAuth?.(nextData.profile);
    await store.syncNow();
    if (state.route === "profile") {
      renderProfilePage();
    } else {
      render();
    }
    if (stableScrollY !== null) {
      window.scrollTo({ top: stableScrollY, left: 0, behavior: "instant" });
      window.requestAnimationFrame(() => window.scrollTo({ top: stableScrollY, left: 0, behavior: "instant" }));
    }
    showToast("Изменения профиля сохранены");
  }

  async function sendTestNotification({ site, email, emailAddress }) {
    const channels = [];
    if (site) {
      showToast("Тестовое уведомление SONA");
      channels.push("на сайте");
    }
    if (email) {
      const target = security.sanitizeEmail(emailAddress || "");
      if (!target) return { message: "Укажите email для отправки уведомления." };
      try {
        const response = await fetch("/api/notifications/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: target })
        });
        if (!response.ok) return { message: "Уведомление на сайте отправлено, но почта сейчас недоступна." };
        channels.push("на почту");
      } catch (error) {
        return { message: "Уведомление на сайте отправлено, но почта сейчас недоступна." };
      }
    }
    return { message: channels.length ? `Уведомление отправлено ${channels.join(" и ")}.` : "Сначала включите хотя бы один способ уведомлений." };
  }

  function checkout() {
    const rows = cartRows();
    if (!rows.length) {
      showToast("Корзина пустая");
      return;
    }
    if (!isProfileActive()) {
      navigateTo("profile");
      showToast("Войдите в аккаунт, чтобы оформить заказ");
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
    state.activeQuickKey = "";
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
    state.activeQuickKey = link.dataset.navKey || "";

    els.saleOnly.checked = state.filters.saleOnly;
    els.searchInput.value = "";
    state.route = "home";
    render();
    closeFilters();
    window.history.pushState({ route: "home" }, "", "/");
    document.getElementById("catalog").scrollIntoView({ block: "start", behavior: pageScrollBehavior() });
  }

  function openQuickCatalog(link) {
    const preset = categoryPresetByKey(link.dataset.navKey || "all");
    const options = {
      ...preset,
      section: link.dataset.section || preset.section || ALL_VALUE,
      category: link.dataset.category || preset.category || ALL_VALUE,
      group: link.dataset.group || preset.group || "",
      saleOnly: link.dataset.sale === "true" || Boolean(preset.saleOnly),
      navKey: link.dataset.navKey || preset.key || ""
    };
    openCatalogCollection(tabForCategoryPreset(options), options);
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

  function initLiveSearchPlaceholder() {
    if (!els.searchInput || reduceMotion) return;

    const phrases = [
      "Искать диван Luna Cloud",
      "Искать кровать с хранением",
      "Искать кресло для гостиной",
      "Искать услугу дизайна"
    ];
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer = 0;

    const tick = () => {
      if (document.activeElement === els.searchInput || els.searchInput.value) {
        timer = window.setTimeout(tick, 900);
        return;
      }

      const phrase = phrases[phraseIndex];
      els.searchInput.placeholder = phrase.slice(0, charIndex);

      if (!deleting && charIndex < phrase.length) {
        charIndex += 1;
        timer = window.setTimeout(tick, 58);
        return;
      }

      if (!deleting && charIndex === phrase.length) {
        deleting = true;
        timer = window.setTimeout(tick, 1300);
        return;
      }

      if (deleting && charIndex > 0) {
        charIndex -= 1;
        timer = window.setTimeout(tick, 34);
        return;
      }

      deleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      timer = window.setTimeout(tick, 320);
    };

    els.searchInput.addEventListener("focus", () => {
      els.searchInput.placeholder = "";
    });
    els.searchInput.addEventListener("blur", () => {
      if (!els.searchInput.value) {
        window.clearTimeout(timer);
        timer = window.setTimeout(tick, 240);
      }
    });

    tick();
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
    document.querySelectorAll(".brand, .footer-brand").forEach((logo) => {
      logo.addEventListener("click", (event) => {
        event.preventDefault();
        navigateTo("home");
      });
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
      renderSearchResults();
    });
    els.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        showFullSearchResults();
      }
      if (event.key === "Escape") {
        closeSearchResults();
        els.searchInput.blur();
      }
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".search")) closeSearchResults();
    });
    initLiveSearchPlaceholder();

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
      goToCatalog();
    });
    els.quickLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        if (link.dataset.openCatalogTab) {
          openCatalogCollection(link.dataset.openCatalogTab, {
            section: link.dataset.section || "Мебель",
            category: link.dataset.category || ALL_VALUE,
            group: link.dataset.group || "",
            saleOnly: link.dataset.sale === "true"
          });
          return;
        }
        if (link.dataset.openSofaCollections !== undefined) {
          openSofaCollections();
          return;
        }
        if (link.dataset.navKey) {
          openQuickCatalog(link);
          return;
        }
        applyQuickFilter(link);
      });
    });
    els.catalogTabs.forEach((button) => {
      button.addEventListener("click", () => setCatalogTab(button.dataset.catalogTab));
    });
    els.catalogSwitches.forEach((button) => {
      button.addEventListener("click", () => setCatalogTab(button.dataset.catalogSwitch));
    });
    document.querySelectorAll("[data-category-page]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        closeFilters();
        openCategoryPage(CATEGORY_PAGE_PRESETS[button.dataset.categoryPage] || CATEGORY_PAGE_PRESETS.all);
      });
    });
    document.querySelectorAll("[data-catalog-intent]").forEach((button) => {
      button.addEventListener("click", () => openCatalogIntent(button));
    });
    document.querySelectorAll("[data-close-filters]").forEach((button) => button.addEventListener("click", closeFilters));
    document.querySelectorAll("[data-category-shortcut]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        openCategoryPageFromShortcut(button);
      });
    });
    document.querySelectorAll("[data-service-category]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        openServiceCategory(button);
      });
    });
    document.querySelectorAll("[data-sale-category]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const preset = CATEGORY_PAGE_GROUPS.sale.find((item) => item.key === button.dataset.saleCategory) || CATEGORY_PAGE_PRESETS.sale;
        closeFilters();
        openCategoryPage({ ...CATEGORY_PAGE_PRESETS.sale, ...preset });
      });
    });

    els.cartButton.addEventListener("click", openCart);
    els.mobileConsultButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMobileConsultMenu();
    });
    els.mobileConsultMenu?.querySelector("[data-mobile-consult-close]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMobileConsultMenu();
    });
    els.mobileSupportOpen?.addEventListener("click", (event) => {
      event.preventDefault();
      closeMobileConsultMenu();
      openSupportChat();
    });
    els.mobileConsultMenu?.querySelector("a[href^='tel:']")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const href = event.currentTarget.href;
      closeMobileConsultMenu();
      window.location.href = href;
      window.setTimeout(openSupportChat, 450);
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
        button.blur();
      });
    });
    document.querySelectorAll("[data-close-cart]").forEach((button) => button.addEventListener("click", closeCart));
    document.querySelectorAll("[data-close-product]").forEach((button) => button.addEventListener("click", closeProduct));
    els.checkoutButton.addEventListener("click", checkout);

    els.profileButton.addEventListener("click", () => navigateTo(window.SonaAdmin?.isAdmin(store.read()) ? "admin" : "profile"));
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

  function storeStateSignature(data) {
    return JSON.stringify(data || {});
  }

  function bindPassiveStoreRefresh() {
    let refreshPending = false;
    let signature = storeStateSignature(store.read());

    const refreshWhenActive = async () => {
      if (refreshPending || document.hidden) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;

      refreshPending = true;
      try {
        const data = await store.refresh?.();
        const nextSignature = storeStateSignature(data || store.read());
        if (nextSignature === signature) return;

        signature = nextSignature;
        refreshProductsFromAdmin();
        if (state.route === "admin") {
          renderAdminPage();
          renderAds();
        } else if (["profile", "product", "home", "category"].includes(state.route)) {
          render();
        }
      } catch (error) {
        // Keep the current UI intact when background synchronization is unavailable.
      } finally {
        refreshPending = false;
      }
    };

    window.addEventListener("focus", refreshWhenActive, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshWhenActive();
    }, { passive: true });
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
      state.baseProducts = [...await response.json(), ...PERMANENT_SOFA_PRODUCTS];
      refreshProductsFromAdmin();
      state.route = routeFromLocation();
      render();
      bindPassiveStoreRefresh();
    } catch (error) {
      els.emptyState.hidden = false;
      els.emptyState.textContent = "Каталог временно недоступен.";
    }
  }

  init();
})();

