(function () {
  "use strict";

  const ADMIN_EMAIL = "kcel046@gmail.com";
  let activeSection = "home";
let productQuery = "";
let orderQuery = "";
let orderStatusFilter = "all";
let orderDateFilter = "";
let orderPage = 1;
let statsPeriod = "month";
let reviewQuery = "";
let reviewStatusFilter = "all";
let adminSearchTimer = 0;
  let supportDialog = "";
  let editingProductId = "";
  let editingAdId = "";
  let preserveNextRender = false;

  const menu = [
    ["home", "Главная", "M4 5h16v14H4z M8 9h8 M8 13h5"],
    ["stats", "Статистика", "M5 19V9 M12 19V5 M19 19v-8"],
    ["orders", "Заказы", "M6 4h12v16H6z M9 8h6 M9 12h6 M9 16h4"],
    ["products", "Товары", "M4 7h16v10H4z M7 7V5h10v2 M8 17v2 M16 17v2"],
    ["users", "Пользователи", "M16 11a4 4 0 1 0-8 0 M4 20c1-4 4-6 8-6s7 2 8 6"],
    ["reviews", "Отзывы", "M5 5h14v10H9l-4 4z M9 9h6 M9 12h4"],
    ["ads", "Реклама", "M4 6h16v12H4z M8 10h5 M8 14h8"],
    ["support", "Поддержка", "M5 13v-1a7 7 0 0 1 14 0v1 M5 13h3v5H5z M16 13h3v5h-3z"],
    ["settings", "Настройки", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12h2 M3 12h2 M12 3v2 M12 19v2"],
    ["logout", "Выйти", "M9 5H5v14h4 M13 8l4 4-4 4 M8 12h9"]
  ];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = window.SonaText?.fix(text) || String(text);
    return node;
  }

  function icon(path) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    path.split(" M").forEach((part, index) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
      node.setAttribute("d", index ? `M${part}` : part);
      svg.append(node);
    });
    return svg;
  }

  function digits(value) {
    const clean = String(value || "").replace(/\D/g, "");
    return clean.length === 11 && clean.startsWith("8") ? `7${clean.slice(1)}` : clean;
  }

  function cleanEmail(value) {
    return window.SonaSecurity?.sanitizeEmail(value) || String(value || "").trim().toLowerCase();
  }

  function isGenericCustomerName(value) {
    return /^(покупатель|пользователь)(\s+sona|\s+soна)?$/i.test(String(value || "").trim());
  }

  function preferredCustomerName(currentName, nextName) {
    const current = String(currentName || "").trim();
    const next = String(nextName || "").trim();
    if (next && isGenericCustomerName(current)) return next;
    if (next && !isGenericCustomerName(next) && !current) return next;
    return current || next || "Покупатель";
  }

  function authApiUrl(path) {
    const localPreview = window.location.protocol === "file:"
      || (["127.0.0.1", "localhost"].includes(window.location.hostname) && window.location.port !== "8000");
    return localPreview ? `http://127.0.0.1:8000${path}` : path;
  }

  async function passwordLogin(email, password) {
    const response = await fetch(authApiUrl("/api/auth/password-login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return response.json();
  }

  function isAdmin(data) {
    const profileEmail = cleanEmail(data?.profile?.email);
    const adminEmail = cleanEmail(data?.admin?.email);
    return Boolean(
      (data?.admin?.isAuthenticated && adminEmail === ADMIN_EMAIL) ||
      (data?.profile?.role === "admin" && profileEmail === ADMIN_EMAIL)
    );
  }

  function logoutAdmin(onChange) {
    fetch(authApiUrl("/api/auth/logout"), { method: "POST", credentials: "include" }).catch(() => null);
    window.SonaStore.update((state) => {
      state.admin = { ...(state.admin || {}), isAuthenticated: false, email: "" };
      state.profile = { ...(state.profile || {}), role: "user", isActive: false };
    });
    activeSection = "home";
    onChange?.();
  }

  function money(value) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function shortDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("ru-RU");
  }

  function dataSet(options) {
    const data = window.SonaStore.read();
    const products = options.products || [];
    const orders = data.orders || [];
    const completedOrders = orders.filter((order) => window.SonaOrders?.isCompleted(order));
    const revenue = completedOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const users = buildUsers(data, orders);
    const reviews = window.SonaReviews?.all(data.reviews || []) || [];
    const support = data.supportMessages || [];
    return { data, products, orders, completedOrders, revenue, users, reviews, support };
  }

  function buildUsers(data, orders) {
    const map = new Map();
    const contactKey = (user = {}) => cleanEmail(user.email) || digits(user.phone) || String(user.id || "guest").toLowerCase();
    const findExistingKey = (user = {}) => {
      const email = cleanEmail(user.email);
      const phone = digits(user.phone);
      for (const [key, row] of map.entries()) {
        if ((email && cleanEmail(row.email) === email) || (phone && digits(row.phone) === phone)) return key;
      }
      return "";
    };
    const mergeUser = (incoming = {}) => {
      const key = findExistingKey(incoming) || contactKey(incoming);
      const current = map.get(key) || {};
      map.set(key, {
        ...current,
        ...incoming,
        id: current.id || incoming.id,
        name: preferredCustomerName(current.name, incoming.name),
        email: cleanEmail(incoming.email || current.email),
        phone: incoming.phone || current.phone,
        role: current.role === "admin" || incoming.role === "admin" ? "admin" : (incoming.role || current.role || "user"),
        status: incoming.status || current.status || "active"
      });
      return key;
    };

    (data.users || []).forEach((user) => {
      const realAccount = user.email && !String(user.email).endsWith("@sona.local") && !String(user.id || "").includes("TEMPORARY");
      if (realAccount) mergeUser(user);
    });
    if (data.profile?.phone || data.profile?.email) {
      mergeUser({
        id: `USER-${digits(data.profile.phone) || "local"}`,
        name: data.profile.name || "Пользователь",
        email: data.profile.email || "",
        phone: data.profile.phone || "",
        role: data.profile.role || "user",
        status: data.profile.status || "active",
        registeredAt: data.profile.registeredAt || ""
      });
    }
    orders.forEach((order) => {
      const phone = order.profile?.phone || "";
      const email = order.profile?.email || "";
      const key = findExistingKey({ email, phone, id: order.profile?.userId }) || contactKey({ email, phone, id: order.profile?.userId });
      const current = map.get(key) || {
        id: order.profile?.userId || `USER-${digits(phone) || key}`,
        name: order.profile?.name || "Пользователь",
        email,
        phone,
        role: "user",
        status: "active",
        registeredAt: order.createdAt ? new Date(order.createdAt).toISOString() : ""
      };
      current.name = preferredCustomerName(current.name, order.profile?.name || "Пользователь");
      current.email = cleanEmail(current.email || email);
      current.phone = current.phone || phone;
      current.ordersCount = (current.ordersCount || 0) + 1;
      current.totalSpent = (current.totalSpent || 0) + (Number(order.total) || 0);
      map.set(key, current);
    });
    return [...map.values()];
  }

  function resolveOrderCustomer(context, order) {
    const email = cleanEmail(order.profile?.email);
    const phone = digits(order.profile?.phone);
    const matchesContact = (profile = {}) => (
      (email && cleanEmail(profile.email) === email) ||
      (phone && digits(profile.phone) === phone)
    );
    const candidates = [
      ...(context.users || []),
      ...(context.data?.users || []),
      context.data?.profile || {},
      ...(context.orders || []).map((row) => row.profile || {})
    ].filter(matchesContact);

    return candidates.reduce((customer, candidate) => ({
      name: preferredCustomerName(customer.name, candidate.name),
      phone: customer.phone || candidate.phone || "",
      email: customer.email || candidate.email || ""
    }), {
      name: order.profile?.name || "Покупатель",
      phone: order.profile?.phone || "",
      email: order.profile?.email || ""
    });
  }

  function stat(title, value, text, tone = "", action) {
    const card = el(action ? "button" : "article", `sona-admin-stat ${tone ? `is-${tone}` : ""}`);
    if (action) {
      card.type = "button";
      card.addEventListener("click", action);
    }
    card.append(el("span", "", title), el("strong", "", value), el("small", "", text));
    return card;
  }

  function statusBadge(text, tone) {
    const badge = el("span", "sona-admin-status", text);
    badge.dataset.tone = tone || "progress";
    return badge;
  }

  function loginView(container, onChange) {
    const wrap = el("section", "sona-admin-login");
    const form = el("form", "");
    const input = el("input");
    const passwordInput = el("input");
    const button = el("button", "", "Войти");
    const hint = el("p", "sona-admin-muted", `Доступ разрешён только администратору ${ADMIN_EMAIL}.`);

    input.type = "email";
    input.placeholder = ADMIN_EMAIL;
    input.value = ADMIN_EMAIL;
    input.autocomplete = "email";
    passwordInput.type = "password";
    passwordInput.placeholder = "Пароль";
    passwordInput.autocomplete = "current-password";
    button.type = "submit";
    form.append(input, passwordInput, button);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = cleanEmail(input.value);
      if (email !== ADMIN_EMAIL) {
        hint.textContent = "Эта почта не имеет прав администратора.";
        input.focus();
        return;
      }

      button.disabled = true;
      button.textContent = "Проверяем...";
      const result = await passwordLogin(email, passwordInput.value).catch(() => null);
      button.disabled = false;
      button.textContent = "Войти";
      if (!result?.ok || result.account?.role !== "admin") {
        hint.textContent = "Неверная почта или пароль администратора.";
        passwordInput.focus();
        return;
      }

      await window.SonaStore.refresh().catch(() => null);
      window.SonaStore.update((data) => {
        data.admin = { ...(data.admin || {}), isAuthenticated: true, email };
        data.profile = {
          ...(data.profile || {}),
          isActive: true,
          email,
          role: "admin",
          name: data.profile?.name || "Администратор SONA",
          registeredAt: result.account?.createdAt || data.profile?.registeredAt || new Date().toISOString()
        };
      });
      onChange?.();
    });

    wrap.append(el("p", "eyebrow", "Защищённый раздел"), el("h1", "", "Админ-панель Soна"), hint, form);
    container.replaceChildren(wrap);
  }

  function homeView(context) {
    const { products, orders, completedOrders, revenue, users, reviews, support } = context;
    const newOrders = orders.filter((order) => ["pending", "new", "confirmed", "processing"].includes(order.status)).length;
    const canceled = orders.filter((order) => ["canceled", "return"].includes(order.status)).length;
    const avg = completedOrders.length ? revenue / completedOrders.length : 0;
    const unread = support.filter((message) => message.role === "user" && message.status === "new").length;
    const stockOut = products.filter((product) => Number(product.stock) <= 0 && product.stock !== undefined).length;
    const pendingReviews = reviews.filter((review) => review.status === "moderation").length;

    const page = el("div", "sona-admin-section");
    const stats = el("section", "sona-admin-stats");
    stats.append(
      stat("Всего заказов", orders.length, `${newOrders} новых`, "blue", () => { orderStatusFilter = "all"; activeSection = "orders"; context.render(); }),
      stat("В обработке", orders.filter((order) => !window.SonaOrders?.isCompleted(order) && !["canceled", "return"].includes(order.status)).length, "активные статусы", "", () => { orderStatusFilter = "active"; activeSection = "orders"; context.render(); }),
      stat("Завершено", completedOrders.length, `${canceled} отмен/возвратов`, "green", () => { orderStatusFilter = "received"; activeSection = "orders"; context.render(); }),
      stat("Товары", products.length, `${stockOut} без остатка`, "", () => { activeSection = "products"; context.render(); }),
      stat("Пользователи", users.length, "зарегистрированные", "", () => { activeSection = "users"; context.render(); }),
      stat("Отзывы", reviews.length, `${pendingReviews} ждут модерации`, "", () => { activeSection = "reviews"; context.render(); }),
      stat("Поддержка", support.length, `${unread} непрочитано`, "blue", () => { activeSection = "support"; context.render(); }),
      stat("Выручка", money(revenue), `средний чек ${money(avg)}`, "green", () => { activeSection = "stats"; context.render(); })
    );
    page.append(stats, dashboardPreview(context));
    return page;
  }

  function dashboardPreview(context) {
    const grid = el("section", "sona-admin-dashboard-grid");
    grid.append(
      ordersTable(context, { compact: true }),
      reviewsView(context, { compact: true })
    );
    return grid;
  }

  function statsView(context) {
    const page = el("section", "sona-admin-panel sona-admin-wide");
    const filters = el("div", "sona-admin-filters");
    [["today", "Сегодня"], ["week", "Неделя"], ["month", "Месяц"], ["year", "Год"]].forEach(([id, item]) => {
      const button = el("button", statsPeriod === id ? "is-active" : "", item);
      button.type = "button";
      button.addEventListener("click", () => { statsPeriod = id; context.render(); });
      filters.append(button);
    });

    const now = Date.now();
    const periodDays = { today: 1, week: 7, month: 31, year: 366 }[statsPeriod] || 31;
    const cutoff = now - periodDays * 86400000;
    const timestamp = (value, fallback = "") => {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) return numeric;
      const parsed = Date.parse(value || fallback || "");
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const periodOrders = context.orders.filter((order) => {
      const time = timestamp(order.createdAt, order.date);
      return !time || time >= cutoff;
    });
    const completed = periodOrders.filter((order) => window.SonaOrders?.isCompleted(order));
    const periodRevenue = completed.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const events = (context.data.analytics?.events || []).filter((event) => Number(event.at) >= cutoff);
    const visits = events.filter((event) => event.type === "visit");
    const productViews = events.filter((event) => event.type === "product_view");
    const visitorCounts = visits.reduce((map, event) => map.set(event.sessionId, (map.get(event.sessionId) || 0) + 1), new Map());
    const uniqueVisitors = visitorCounts.size;
    const returningVisitors = [...visitorCounts.values()].filter((count) => count > 1).length;
    const customerOrders = context.orders.reduce((map, order) => {
      const customer = resolveOrderCustomer(context, order);
      const key = cleanEmail(customer.email) || digits(customer.phone) || order.profile?.userId;
      if (!key) return map;
      const row = map.get(key) || { key, name: customer.name || key, orders: 0, spent: 0 };
      row.name = preferredCustomerName(row.name, customer.name);
      row.orders += 1;
      row.spent += Number(order.total) || 0;
      map.set(key, row);
      return map;
    }, new Map());
    const repeatCustomers = [...customerOrders.values()].filter((row) => row.orders >= 2).length;
    const conversion = uniqueVisitors ? (periodOrders.length / uniqueVisitors) * 100 : 0;
    const averageCheck = periodOrders.length ? periodOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0) / periodOrders.length : 0;
    const newCustomers = new Set(periodOrders.map((order) => cleanEmail(order.profile?.email) || digits(order.profile?.phone)).filter(Boolean)).size;
    const summary = el("div", "sona-admin-stats sona-admin-stats-compact");
    summary.append(
      stat("Визиты", visits.length, "загрузки сайта", "blue"),
      stat("Посетители", uniqueVisitors, "уникальные сессии"),
      stat("Вернувшиеся", returningVisitors, "повторные визиты", "green"),
      stat("Просмотры товаров", productViews.length, "переходы в карточки"),
      stat("Заказы", periodOrders.length, `за ${periodDays === 1 ? "сегодня" : `${periodDays} дней`}`, "blue"),
      stat("Выручка", money(periodRevenue), "по завершённым заказам", "green"),
      stat("Постоянные покупатели", repeatCustomers, "два заказа и более"),
      stat("Конверсия", `${conversion.toFixed(1)}%`, "заказы / посетители"),
      stat("Средний чек", money(averageCheck), "по всем заказам"),
      stat("Новые покупатели", newCustomers, "уникальные контакты")
    );
    const bucketCount = statsPeriod === "today" ? 12 : statsPeriod === "week" ? 7 : statsPeriod === "month" ? 10 : 12;
    const bucketSize = (periodDays * 86400000) / bucketCount;
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const start = cutoff + index * bucketSize;
      const end = start + bucketSize;
      return {
        start,
        visits: visits.filter((event) => event.at >= start && event.at < end).length,
        orders: periodOrders.filter((order) => {
          const time = timestamp(order.createdAt, order.date);
          return time >= start && time < end;
        }).length
      };
    });
    const maxActivity = Math.max(1, ...buckets.flatMap((bucket) => [bucket.visits, bucket.orders]));
    const chart = el("div", "sona-admin-chart sona-admin-activity-chart");
    buckets.forEach((bucket) => {
      const column = el("article", "sona-admin-chart-column");
      const value = el("strong", "", `${bucket.visits}/${bucket.orders}`);
      const bars = el("div", "sona-admin-chart-bars");
      const visitBar = el("i", "is-visits");
      const orderBar = el("i", "is-orders");
      visitBar.style.height = `${Math.max(bucket.visits ? 8 : 2, bucket.visits / maxActivity * 100)}%`;
      orderBar.style.height = `${Math.max(bucket.orders ? 8 : 2, bucket.orders / maxActivity * 100)}%`;
      bars.append(visitBar, orderBar);
      column.append(value, bars, el("small", "", new Date(bucket.start).toLocaleDateString("ru-RU", statsPeriod === "today" ? { hour: "2-digit" } : { day: "2-digit", month: "2-digit" })));
      chart.append(column);
    });
    const legend = el("div", "sona-admin-chart-legend");
    legend.append(el("span", "is-visits", "Визиты"), el("span", "is-orders", "Заказы"));

    const viewCounts = productViews.reduce((map, event) => map.set(event.productId, (map.get(event.productId) || 0) + 1), new Map());
    const popular = [...viewCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([productId, count]) => {
        const product = context.byId?.(productId);
        return infoRow(product?.name || productId || "Неизвестный товар", `${count} просмотров${product ? ` · ${money(product.price)}` : ""}`);
      });
    const loyal = [...customerOrders.values()]
      .sort((a, b) => b.orders - a.orders || b.spent - a.spent)
      .slice(0, 6)
      .map((customer) => infoRow(customer.name, `${customer.orders} заказов · ${money(customer.spent)}`));
    const statuses = Object.entries(periodOrders.reduce((acc, order) => {
      const key = window.SonaOrders?.statusLabel(order) || order.status || "Без статуса";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]).map(([name, count]) => infoRow(name, `${count} заказов`));
    const insights = el("div", "sona-admin-insights");
    const popularPanel = el("section", "sona-admin-insight");
    const loyalPanel = el("section", "sona-admin-insight");
    const statusPanel = el("section", "sona-admin-insight");
    popularPanel.append(el("h3", "", "Товары по просмотрам"), ...(popular.length ? popular : [el("p", "sona-admin-muted", "Просмотры начнут появляться после визитов покупателей.")]));
    loyalPanel.append(el("h3", "", "Постоянные покупатели"), ...(loyal.length ? loyal : [el("p", "sona-admin-muted", "Повторных заказов пока нет.")]));
    statusPanel.append(el("h3", "", "Статусы заказов"), ...(statuses.length ? statuses : [el("p", "sona-admin-muted", "Заказов за период пока нет.")]));
    insights.append(popularPanel, loyalPanel, statusPanel);

    page.append(el("h2", "", "Статистика бизнеса"), filters, summary, el("h3", "", "Активность: визиты и заказы"), legend, chart, insights);
    return page;
  }

  function infoRow(title, value) {
    const row = el("article", "sona-admin-info-row");
    row.append(el("strong", "", title), el("span", "", value));
    return row;
  }

  function ordersTable(context, options = {}) {
    const panel = el("section", `sona-admin-panel ${options.compact ? "" : "sona-admin-wide"}`);
    const filtered = context.orders
      .filter((order) => {
        const q = orderQuery.toLowerCase();
        const productNames = (order.items || []).map((item) => context.byId?.(item.id)?.name || item.id).join(" ");
        const normalizedStatus = window.SonaOrders?.normalize(order)?.status || order.status;
        const activeStatuses = ["pending", "confirmed", "assembling", "delivering", "arrived"];
        const matchesStatus = orderStatusFilter === "all"
          || normalizedStatus === orderStatusFilter
          || (orderStatusFilter === "active" && activeStatuses.includes(normalizedStatus));
        const matchesQuery = !q || [order.id, order.profile?.name, order.profile?.phone, order.profile?.email, productNames, order.date].join(" ").toLowerCase().includes(q);
        const orderDate = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : "";
        return matchesStatus && matchesQuery && (!orderDateFilter || orderDate === orderDateFilter);
      })
      .slice()
      .reverse();
    const pageSize = options.compact ? 3 : 8;
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    orderPage = Math.min(orderPage, pageCount);
    const rows = filtered.slice((orderPage - 1) * pageSize, orderPage * pageSize);

    panel.append(el("h2", "", "Заказы"));
    if (!options.compact) {
      const date = el("input", "sona-admin-search");
      date.type = "date";
      date.value = orderDateFilter;
      date.setAttribute("aria-label", "Фильтр заказов по дате");
      date.addEventListener("change", () => { orderDateFilter = date.value; orderPage = 1; context.render(); });
      panel.append(filterBar([
        searchInput("Диван, номер заказа, телефон или почта", orderQuery, (value) => { orderQuery = value; orderPage = 1; context.render(); }),
        date,
        select([["all", "Все статусы"], ["active", "Активные"], ...Object.entries(window.SonaOrders?.STATUS || {})], orderStatusFilter, (value) => { orderStatusFilter = value; orderPage = 1; context.render(); })
      ]));
    }
    if (!rows.length) {
      panel.append(el("p", "sona-admin-muted", "Заказов пока нет."));
      return panel;
    }

    const list = el("div", "sona-admin-order-list");
    rows.forEach((order) => {
      const card = el("article", "sona-admin-order-card");
      const head = el("div", "sona-admin-order-head");
      const customer = el("div", "sona-admin-order-customer");
      const items = el("div", "sona-admin-order-items");
      const normalizedOrder = window.SonaOrders?.normalize(order) || order;
      let dirty = false;
      const status = select(Object.entries(window.SonaOrders?.STATUS || {}), normalizedOrder.status || "pending", () => markDirty());
      const total = Math.max(0, Number(order.total) || 0);
      const paid = Math.max(0, Math.min(total, Number(order.paidAmount) || 0));
      const payment = el("label", "sona-admin-order-payment");
      const paidInput = el("input", "");
      paidInput.type = "number";
      paidInput.min = "0";
      paidInput.max = String(total);
      paidInput.step = "1";
      paidInput.value = String(paid);
      paidInput.setAttribute("aria-label", "Оплаченная сумма");
      const debt = el("strong", "", `Долг: ${money(Math.max(0, total - paid))}`);
      const save = el("button", "sona-admin-order-save", "Сохранить");
      save.type = "button";
      save.disabled = true;
      function markDirty() {
        dirty = true;
        save.disabled = false;
        const nextPaid = Math.max(0, Math.min(total, Number(paidInput.value) || 0));
        debt.textContent = `Долг: ${money(total - nextPaid)}`;
      }
      paidInput.addEventListener("input", markDirty);
      save.addEventListener("click", async () => {
        if (!dirty) return;
        save.disabled = true;
        save.textContent = "Сохраняем...";
        const saved = await context.actions.updateOrder(order.id, {
          status: status.value,
          paidAmount: Number(paidInput.value) || 0
        });
        if (saved === false) {
          save.disabled = false;
          save.textContent = "Повторить сохранение";
        }
      });
      payment.append(
        el("span", "", "Оплачено"),
        paidInput,
        debt
      );
      const resolvedCustomer = resolveOrderCustomer(context, order);
      head.append(el("strong", "", order.id || "Заказ"), el("span", "", order.date || shortDate(order.createdAt)), el("b", "", money(order.total)));
      customer.append(
        el("strong", "", resolvedCustomer.name || "Покупатель"),
        el("span", "", resolvedCustomer.phone || "Телефон не указан"),
        el("span", "", resolvedCustomer.email || "Почта не указана")
      );
      (order.items || []).forEach((item) => {
        const product = context.byId?.(item.id);
        const row = el("div", "sona-admin-order-item");
        const image = document.createElement("img");
        image.src = window.SonaSecurity?.safeMediaUrl(product?.image || product?.gallery?.find((photo) => photo.main)?.src, "assets/sona-logo.png") || "assets/sona-logo.png";
        image.alt = "";
        row.append(image, el("span", "", `${product?.name || item.name || item.id} × ${item.quantity || 1}`));
        items.append(row);
      });
      const controls = el("div", "sona-admin-order-controls");
      controls.append(status, payment, save);
      if (!options.compact) controls.append(actionButtons([["Удалить заказ", () => context.actions.deleteOrder(order.id), "danger"]]));
      card.append(head, customer, items, controls);
      list.append(card);
    });
    panel.append(list);
    if (!options.compact && pageCount > 1) {
      const pager = el("div", "sona-admin-pagination");
      const previous = el("button", "", "Назад");
      const next = el("button", "", "Дальше");
      previous.type = "button";
      next.type = "button";
      previous.disabled = orderPage === 1;
      next.disabled = orderPage === pageCount;
      previous.addEventListener("click", () => { orderPage -= 1; context.render(); });
      next.addEventListener("click", () => { orderPage += 1; context.render(); });
      pager.append(previous, el("strong", "", `${orderPage} из ${pageCount}`), next);
      panel.append(pager);
    }
    return panel;
  }

  function productsView(context) {
    if (window.SonaProductsPage) {
      return window.SonaProductsPage.render(context);
    }

    const panel = el("section", "sona-admin-panel sona-admin-wide");
    const form = productForm(context);
    const rows = context.products
      .filter((product) => !productQuery || product.name.toLowerCase().includes(productQuery.toLowerCase()))
      .slice(0, 120);

    panel.append(el("h2", "", "Товары"), searchInput("Поиск товара", productQuery, (value) => { productQuery = value; context.render(); }), form);
    const table = tableWrap(["Товар", "Категория", "Цена", "Склад", "Отзывы", "Статус", "Действия"]);
    rows.forEach((product) => {
      const summary = window.SonaReviews?.summary(context.data.reviews || [], product.id) || { count: 0, average: 0 };
      const tr = document.createElement("tr");
      tr.append(
        td(product.name),
        td(product.category || product.marketSection || "Мебель"),
        td(`${money(product.price)}${product.oldPrice ? ` / ${money(product.oldPrice)}` : ""}`),
        td(String(product.stock ?? "—")),
        td(`${summary.average || 0} · ${summary.count}`),
        td(statusBadge(product.hidden ? "Скрыт" : product.status || "Активен", product.hidden ? "muted" : "done")),
        td(actionButtons([
          ["Редактировать", () => { editingProductId = product.id; context.render(); }],
          [product.hidden ? "Вернуть" : "Скрыть", () => context.actions.saveProduct({ ...product, hidden: !product.hidden })],
          ["Удалить", () => context.actions.deleteProduct(product.id), "danger"]
        ]))
      );
      table.querySelector("tbody").append(tr);
    });
    panel.append(table);
    return panel;
  }

  function productForm(context) {
    const product = context.products.find((item) => item.id === editingProductId) || {};
    const form = el("form", "sona-admin-editor");
    const productTypes = ["Диван", "Кровать", "Кресло", "Услуга"];
    const sections = ["Мебель", "Диваны", "Свет", "Декор", "Текстиль", "Услуги"];
    const roomTypes = ["Гостиная", "Спальня", "Столовая", "Прихожая", "Детская", "Ванная", "Офис", "Сад"];
    const addField = (name, label, value, type = "text") => {
      const wrap = el("label", "sona-admin-field");
      const input = el("input");
      input.name = name;
      input.type = type;
      input.placeholder = label;
      input.value = value;
      wrap.append(el("span", "", label), input);
      form.append(wrap);
      return input;
    };
    const addSelect = (name, label, value, rows) => {
      const wrap = el("label", "sona-admin-field");
      const field = select(rows.map((item) => [item, item]), value, () => {});
      field.name = name;
      wrap.append(el("span", "", label), field);
      form.append(wrap);
      return field;
    };
    const addTextarea = (name, label, value) => {
      const wrap = el("label", "sona-admin-field sona-admin-field-wide");
      const input = el("textarea");
      input.name = name;
      input.placeholder = label;
      input.value = value;
      wrap.append(el("span", "", label), input);
      form.append(wrap);
      return input;
    };

    addField("name", "Название", product.name || "");
    addSelect("category", "Тип товара", product.category || "Диван", productTypes);
    addSelect("marketSection", "Раздел каталога", product.marketSection || "Мебель", sections);
    addSelect("room", "Комната", product.room || "Гостиная", roomTypes);
    addField("price", "Цена", product.price || "", "number");
    addField("oldPrice", "Старая цена", product.oldPrice || "", "number");
    addField("brand", "Бренд", product.brand || "Soна");
    addField("size", "Размер / формат", product.size || "M");
    addField("dimensions", "Габариты", product.dimensions || "");
    addField("stock", "Остаток", product.stock ?? 10, "number");
    addField("deliveryDays", "Срок доставки, дней", product.deliveryDays ?? 3, "number");
    addField("deliveryText", "Текст доставки", product.deliveryText || "Все зависит от вашего региона");
    addField("warranty", "Гарантия", product.warranty || "");
    addField("supplier", "Поставщик / исполнитель", product.supplier || "");
    addField("colors", "Цвета через запятую", (product.colors || []).join(", "));
    addField("materials", "Материалы через запятую", (product.materials || []).join(", "));
    addField("specs", "Характеристики через запятую", (product.specs || []).join(", "));
    addField("tags", "Теги через запятую", (product.tags || []).join(", "));
    addTextarea("description", "Описание товара или услуги", product.description || "");
    const file = el("input");
    file.type = "file";
    file.accept = "image/png,image/jpeg,image/webp";
    file.name = "imageFile";
    const fileWrap = el("label", "sona-admin-field sona-admin-field-wide");
    fileWrap.append(el("span", "", "Фото товара с компьютера"), file);
    form.append(fileWrap);
    const save = el("button", "", editingProductId ? "Сохранить товар" : "Добавить товар");
    const reset = el("button", "sona-admin-soft", "Новый товар");
    save.type = "submit";
    reset.type = "button";
    reset.addEventListener("click", () => { editingProductId = ""; context.render(); });
    const actions = el("div", "sona-admin-editor-actions");
    actions.append(save, reset);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(form).entries());
      const persist = (image) => {
        context.actions.saveProduct({ ...product, ...body, image: image || product.image || "", id: product.id || body.name });
        editingProductId = "";
      };
      const upload = file.files?.[0];
      if (upload) {
        const reader = new FileReader();
        reader.addEventListener("load", () => persist(String(reader.result || "")));
        reader.readAsDataURL(upload);
      } else {
        persist("");
      }
    });
    return form;
  }

  function usersView(context) {
    const panel = el("section", "sona-admin-panel sona-admin-wide");
    panel.append(el("h2", "", "Пользователи"));
    const table = tableWrap(["ID", "Имя", "Контакты", "Заказы", "Покупки", "Статус", "Роль"]);
    context.users.forEach((user) => {
      const userKey = user.email || user.phone || user.id;
      const role = select([["user", "user"], ["admin", "admin"]], user.role || "user", (value) => context.actions.updateUser(userKey, { role: value }));
      const status = select([["active", "Активен"], ["blocked", "Заблокирован"]], user.status || "active", (value) => context.actions.updateUser(userKey, { status: value }));
      const tr = document.createElement("tr");
      tr.append(
        td(user.id || "USER"),
        td(user.name || "Покупатель"),
        td(`${user.phone || ""}\n${user.email || ""}`),
        td(String(user.ordersCount || 0)),
        td(money(user.totalSpent || 0)),
        td(status),
        td(role)
      );
      table.querySelector("tbody").append(tr);
    });
    panel.append(table);
    return panel;
  }

  function reviewsView(context, options = {}) {
    const panel = el("section", `sona-admin-panel ${options.compact ? "" : "sona-admin-wide"}`);
    const rows = context.reviews
      .filter((review) => {
        const product = context.byId?.(review.productId);
        const q = reviewQuery.toLowerCase();
        const matchesStatus = reviewStatusFilter === "all" || (review.status || "published") === reviewStatusFilter;
        const matchesQuery = !q || [product?.name, review.author, review.text].join(" ").toLowerCase().includes(q);
        return matchesStatus && matchesQuery;
      })
      .slice(0, options.compact ? 5 : 100);

    panel.append(el("h2", "", "Отзывы"));
    if (!options.compact) {
      panel.append(filterBar([
        searchInput("Поиск отзыва", reviewQuery, (value) => { reviewQuery = value; context.render(); }),
        select([["all", "Все статусы"], ["published", "Опубликован"], ["moderation", "На модерации"], ["rejected", "Отклонён"], ["hidden", "Скрыт"]], reviewStatusFilter, (value) => { reviewStatusFilter = value; context.render(); })
      ]));
    }
    if (!rows.length) {
      panel.append(el("p", "sona-admin-muted", "Отзывов пока нет."));
      return panel;
    }
    const table = tableWrap(["Товар", "Пользователь", "Оценка", "Текст", "Статус", "Действия"]);
    rows.forEach((review) => {
      const product = context.byId?.(review.productId);
      const tr = document.createElement("tr");
      const status = select([["published", "Опубликован"], ["moderation", "На модерации"], ["rejected", "Отклонён"], ["hidden", "Скрыт"]], review.status || "moderation", (value) => {
        context.actions.updateReview(review.id, { status: value });
      });
      tr.append(
        td(product?.name || review.productId),
        td(review.author || "Покупатель"),
        td(`${review.rating || 5}/5`),
        td(review.text || ""),
        td(status),
        td(actionButtons([
          ["Опубликовать", () => context.actions.updateReview(review.id, { status: "published", verified: true, moderatedAt: Date.now() })],
          ["Отклонить", () => context.actions.updateReview(review.id, { status: "rejected", moderatedAt: Date.now() }), "danger"],
          ["Ответить", () => {
            const reply = window.prompt("Ответ магазина на отзыв", review.reply || "");
            if (reply !== null) context.actions.updateReview(review.id, { reply });
          }],
          ["Скрыть", () => context.actions.updateReview(review.id, { status: "hidden" })]
        ]))
      );
      table.querySelector("tbody").append(tr);
    });
    panel.append(table);
    return panel;
  }

  function adsView(context) {
    const data = context.data;
    const panel = el("section", "sona-admin-panel sona-admin-wide");
    const slots = el("div", "sona-admin-ad-slots");
    panel.append(el("h2", "", "Реклама на главной"), el("p", "sona-admin-muted", "Три фотографии автоматически листаются в самом верху главной страницы."));
    [0, 1, 2].forEach((index) => {
      const ad = (data.customAds || [])[index];
      const slot = el("article", "sona-admin-ad-slot");
      const image = document.createElement("img");
      const upload = el("input");
      const label = el("label", "sona-admin-ad-upload", ad ? "Заменить фото" : "Загрузить фото");
      image.src = window.SonaSecurity?.safeMediaUrl(ad?.visual, `assets/ads/sona-${index === 0 ? "living-01" : index === 1 ? "living-02" : "bedroom-03"}.png`);
      image.alt = `Рекламный слайд ${index + 1}`;
      upload.type = "file";
      upload.accept = "image/png,image/jpeg,image/webp";
      upload.addEventListener("change", () => {
        const file = upload.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => context.actions.saveAd({
          id: ad?.id || `AD-SLOT-${index + 1}`,
          visual: String(reader.result || ""),
          title: "",
          fullBleed: true,
          uploaded: true,
          active: true,
          slot: index
        }));
        reader.readAsDataURL(file);
      });
      label.append(upload);
      slot.append(el("strong", "", `Слайд ${index + 1}`), image, label);
      if (ad) slot.append(actionButtons([["Удалить фото", () => context.actions.deleteAd(ad.id), "danger"]]));
      slots.append(slot);
    });
    panel.append(slots);
    return panel;
  }

  function supportView(context, options = {}) {
    const panel = el("section", `sona-admin-panel ${options.compact ? "" : "sona-admin-wide"}`);
    const dialogs = groupSupport(context.support);
    const active = supportDialog || dialogs[0]?.id || "";
    supportDialog = active;
    panel.append(el("h2", "", "Поддержка"));

    const chat = el("div", "sona-admin-chat");
    const list = el("div", "sona-admin-dialogs");
    dialogs.forEach((dialog) => {
      const button = el("button", dialog.id === active ? "is-active" : "");
      button.type = "button";
      button.append(el("strong", "", dialog.title), el("span", "", dialog.last?.text || ""));
      button.addEventListener("click", () => { supportDialog = dialog.id; context.render(); });
      list.append(button);
    });
    const history = el("div", "sona-admin-chat-history");
    const messages = dialogs.find((dialog) => dialog.id === active)?.messages || [];
    if (!dialogs.length) {
      list.append(el("p", "sona-admin-muted", "Новых обращений нет."));
    }
    messages.forEach((message) => {
      const item = el("article", `sona-support-message is-${message.role === "admin" ? "admin" : "user"}`);
      item.append(el("strong", "", message.author || ""), el("p", "", message.text || ""));
      if (Array.isArray(message.attachments) && message.attachments.length) {
        const files = el("div", "sona-support-attachments");
        message.attachments.forEach((attachment) => {
          const link = el("a", attachment.type?.startsWith("image/") ? "sona-support-file is-image" : "sona-support-file");
          const safeHref = window.SonaSupport?.safeAttachmentHref?.(attachment) || "#";
          link.href = safeHref;
          link.download = attachment.name || "file";
          link.target = "_blank";
          link.rel = "noopener";
          if (attachment.type?.startsWith("image/") && safeHref !== "#") {
            const image = document.createElement("img");
            image.src = safeHref;
            image.alt = attachment.name || "";
            link.append(image);
          }
          link.append(el("span", "", attachment.name || "file"));
          files.append(link);
        });
        item.append(files);
      }
      item.append(el("span", "", window.SonaSupport?.nowLabel(message.createdAt) || ""));
      history.append(item);
    });
    const threadActions = el("div", "sona-admin-actions");
    threadActions.append(actionButtons([
      ["Пометить прочитанным", () => {
        window.SonaStore.update((data) => {
          data.supportMessages = (data.supportMessages || []).map((message) => (
            messages.some((item) => item.id === message.id) ? { ...message, status: "read" } : message
          ));
        });
        context.render();
      }],
      ["Закрыть обращение", () => {
        window.SonaStore.update((data) => {
          data.supportMessages = (data.supportMessages || []).map((message) => (
            messages.some((item) => item.id === message.id) ? { ...message, status: "closed" } : message
          ));
        });
        context.render();
      }]
    ]));
    const form = el("form", "sona-admin-reply");
    const input = el("textarea");
    const fileInput = document.createElement("input");
    const attach = el("button", "sona-admin-soft", "Прикрепить");
    const fileStatus = el("small", "sona-admin-reply-status", "До 3 файлов, каждый до 6 МБ.");
    input.placeholder = "Ответ администратора";
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv,application/json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg";
    fileInput.multiple = true;
    fileInput.hidden = true;
    attach.type = "button";
    attach.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const report = window.SonaSupport?.validateAttachments?.(fileInput.files, { allowUnread: true });
      fileStatus.textContent = report?.rejected?.length
        ? report.rejected.map((item) => `${item.name}: ${item.reason}`).join(". ")
        : `${report?.accepted?.length || 0} файл(а) готово к отправке`;
    });
    const send = el("button", "", "Отправить");
    send.type = "submit";
    form.append(input, fileInput, attach, send, fileStatus);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const target = dialogs.find((dialog) => dialog.id === active);
      const prepared = await window.SonaSupport?.prepareAttachments?.(fileInput.files) || { attachments: [], rejected: [] };
      if (window.SonaSupport?.addAdminReply(input.value, {
        threadId: target?.id,
        accountKey: target?.accountKey,
        phone: target?.phone,
        email: target?.email
      }, prepared.attachments)) {
        window.SonaStore.update((data) => {
          data.supportMessages = (data.supportMessages || []).map((message) => (
            messages.some((item) => item.id === message.id) && message.role === "user" ? { ...message, status: "read" } : message
          ));
        });
        input.value = "";
        fileInput.value = "";
        fileStatus.textContent = prepared.rejected.length
          ? `Ответ отправлен. Не добавлены: ${prepared.rejected.map((item) => item.name).join(", ")}`
          : "Ответ отправлен.";
        context.render();
      } else {
        fileStatus.textContent = prepared.rejected.map((item) => `${item.name}: ${item.reason}`).join(". ") || "Введите ответ или прикрепите допустимый файл.";
      }
    });
    const right = el("div", "sona-admin-chat-main");
    right.append(history, threadActions, form);
    chat.append(list, right);
    panel.append(chat);
    return panel;
  }

  function groupSupport(messages) {
    const map = new Map();
    (messages || []).forEach((message) => {
      const id = window.SonaSupport?.threadIdFor?.(message) || message.threadId || message.phone || message.email || message.author || "guest";
      const dialog = map.get(id) || {
        id,
        accountKey: message.accountKey || "",
        title: message.role === "admin" ? "Диалог" : (message.author || "Пользователь"),
        phone: message.phone || "",
        email: message.email || "",
        messages: []
      };
      if (message.role === "user" && message.author) dialog.title = message.author;
      if (message.accountKey) dialog.accountKey = message.accountKey;
      dialog.messages.push(message);
      dialog.last = message;
      map.set(id, dialog);
    });
    const time = (value) => Number(value) || Date.parse(value || "") || 0;
    return [...map.values()].sort((a, b) => time(b.last?.createdAt) - time(a.last?.createdAt));
  }

  function settingsView(context) {
    const settings = context.data.shopSettings || {};
    const panel = el("section", "sona-admin-panel sona-admin-wide");
    const form = el("form", "sona-admin-editor");
    [
      ["name", "Название магазина", settings.name || "Soна"],
      ["supportEmail", "Email поддержки", settings.supportEmail || ""],
      ["supportPhone", "Телефон поддержки", settings.supportPhone || ""],
      ["address", "Адрес", settings.address || ""],
      ["baseDiscount", "Базовая скидка", settings.baseDiscount || 0],
      ["returnsPolicy", "Правила возврата", settings.returnsPolicy || ""]
    ].forEach(([name, label, value]) => {
      const input = el("input");
      input.name = name;
      input.placeholder = label;
      input.value = value;
      form.append(input);
    });
    const save = el("button", "", "Сохранить настройки");
    const saveStatus = el("p", "sona-admin-muted sona-admin-field-wide", "");
    save.type = "submit";
    form.append(save, saveStatus);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      save.disabled = true;
      save.textContent = "Сохраняем...";
      saveStatus.textContent = "";
      try {
        await context.actions.saveSettings(Object.fromEntries(new FormData(form).entries()));
        saveStatus.textContent = "Настройки сохранены.";
      } catch (error) {
        save.disabled = false;
        save.textContent = "Сохранить настройки";
        saveStatus.textContent = "Не удалось сохранить настройки. Попробуйте ещё раз.";
      }
    });
    panel.append(el("h2", "", "Настройки магазина"), form);
    const server = el("section", "sona-admin-server");
    const status = el("p", "sona-admin-muted", "Состояние сервера ещё не проверено.");
    const health = el("button", "sona-admin-soft", "Проверить сервер");
    const sync = el("button", "sona-admin-soft", "Синхронизировать данные");
    health.type = "button";
    sync.type = "button";
    health.addEventListener("click", async () => {
      status.textContent = "Проверяем сервер...";
      const response = await fetch(authApiUrl("/health"), { credentials: "include", cache: "no-store" }).catch(() => null);
      status.textContent = response?.ok ? "Сервер работает. Подключение активно." : "Сервер сейчас недоступен.";
    });
    sync.addEventListener("click", async () => {
      status.textContent = "Синхронизируем данные...";
      await window.SonaStore.syncNow().catch(() => null);
      status.textContent = "Данные отправлены на сервер.";
    });
    server.append(el("h3", "", "Работа сервера"), status, health, sync);
    panel.append(server);

    const backup = el("section", "sona-admin-server sona-admin-backups");
    const backupStatus = el("p", "sona-admin-muted", "Последняя серверная копия обновляется после каждого сохранения.");
    const backupActions = el("div", "sona-admin-actions");
    const downloadBackup = el("button", "sona-admin-soft", "Скачать резервную копию");
    const uploadBackup = el("button", "sona-admin-soft", "Восстановить из файла");
    const restoreLatest = el("button", "sona-admin-soft", "Восстановить серверную копию");
    const backupFile = document.createElement("input");

    backupFile.type = "file";
    backupFile.accept = "application/json,.json";
    backupFile.hidden = true;
    [downloadBackup, uploadBackup, restoreLatest].forEach((button) => { button.type = "button"; });

    downloadBackup.addEventListener("click", async () => {
      backupStatus.textContent = "Готовим копию...";
      downloadBackup.disabled = true;
      try {
        await window.SonaStore.flushSync();
        const response = await fetch(authApiUrl("/api/admin/backup"), {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.backup) throw new Error("Backup download failed");
        const stamp = new Date().toISOString().slice(0, 10);
        const blob = new Blob([JSON.stringify(payload.backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `sona-admin-backup-${stamp}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        backupStatus.textContent = "Резервная копия скачана.";
      } catch (error) {
        backupStatus.textContent = "Не удалось скачать копию.";
      } finally {
        downloadBackup.disabled = false;
      }
    });

    uploadBackup.addEventListener("click", () => backupFile.click());
    backupFile.addEventListener("change", async () => {
      const file = backupFile.files?.[0];
      if (!file) return;
      if (!window.confirm("Восстановить данные сайта из выбранной копии? Текущие данные будут заменены.")) {
        backupFile.value = "";
        return;
      }
      backupStatus.textContent = "Восстанавливаем копию...";
      uploadBackup.disabled = true;
      try {
        const backupPayload = JSON.parse(await file.text());
        const response = await fetch(authApiUrl("/api/admin/backup/restore"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ backup: backupPayload })
        });
        if (!response.ok) throw new Error("Backup restore failed");
        await window.SonaStore.refresh();
        backupStatus.textContent = "Данные восстановлены из файла.";
        context.render();
      } catch (error) {
        backupStatus.textContent = "Не удалось восстановить копию.";
      } finally {
        uploadBackup.disabled = false;
        backupFile.value = "";
      }
    });

    restoreLatest.addEventListener("click", async () => {
      if (!window.confirm("Восстановить последнюю серверную копию? Текущие данные будут заменены.")) return;
      backupStatus.textContent = "Восстанавливаем серверную копию...";
      restoreLatest.disabled = true;
      try {
        const response = await fetch(authApiUrl("/api/admin/backup/restore-latest"), {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Latest backup restore failed");
        await window.SonaStore.refresh();
        backupStatus.textContent = "Серверная копия восстановлена.";
        context.render();
      } catch (error) {
        backupStatus.textContent = "Серверная копия не найдена или недоступна.";
      } finally {
        restoreLatest.disabled = false;
      }
    });

    backupActions.append(downloadBackup, uploadBackup, restoreLatest);
    backup.append(el("h3", "", "Резервные копии"), backupStatus, backupActions, backupFile);
    panel.append(backup);
    return panel;
  }

  function searchInput(placeholder, value, onInput) {
    const input = el("input", "sona-admin-search");
    input.type = "search";
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener("input", () => {
      const next = input.value;
      window.clearTimeout(adminSearchTimer);
      adminSearchTimer = window.setTimeout(() => {
        onInput(next);
        window.requestAnimationFrame(() => {
          const fresh = [...document.querySelectorAll(".sona-admin-search")].find((item) => item.placeholder === placeholder);
          fresh?.focus({ preventScroll: true });
          fresh?.setSelectionRange?.(fresh.value.length, fresh.value.length);
        });
      }, 180);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.preventDefault();
    });
    return input;
  }

  function filterBar(items) {
    const bar = el("div", "sona-admin-filter-row");
    items.forEach((item) => bar.append(item));
    return bar;
  }

  function select(rows, value, onChange) {
    const field = el("select", "sona-admin-select");
    rows.forEach(([id, label]) => {
      const option = el("option", "", label?.label || label);
      option.value = id;
      option.selected = id === value;
      field.append(option);
    });
    field.addEventListener("change", () => onChange(field.value));
    return field;
  }

  function tableWrap(heads) {
    const wrap = el("div", "sona-admin-table-wrap");
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    heads.forEach((head) => tr.append(td(head, "th")));
    thead.append(tr);
    table.append(thead, document.createElement("tbody"));
    wrap.append(table);
    return wrap;
  }

  function td(value, tag = "td") {
    const cell = document.createElement(tag);
    if (value instanceof Node) cell.append(value);
    else cell.textContent = window.SonaText?.fix(value) || String(value ?? "");
    return cell;
  }

  function actionButtons(items) {
    const wrap = el("div", "sona-admin-actions");
    items.forEach(([text, action, tone]) => {
      const button = el("button", tone === "danger" ? "is-danger" : "", text);
      button.type = "button";
      button.addEventListener("click", action);
      wrap.append(button);
    });
    return wrap;
  }

  function renderContent(context) {
    if (activeSection === "stats") return statsView(context);
    if (activeSection === "orders") return ordersTable(context);
    if (activeSection === "products") return productsView(context);
    if (activeSection === "users") return usersView(context);
    if (activeSection === "reviews") return reviewsView(context);
    if (activeSection === "ads") return adsView(context);
    if (activeSection === "support") return supportView(context);
    if (activeSection === "settings") return settingsView(context);
    return homeView(context);
  }

  function render(options = {}) {
    const container = options.container;
    const onChange = options.onChange || (() => render(options));
    if (!container) return;
    const preserveScroll = preserveNextRender && Boolean(container.firstElementChild);
    preserveNextRender = false;
    const stableScrollY = window.scrollY;

    const raw = window.SonaStore.read();
    if (!isAdmin(raw)) {
      loginView(container, onChange);
      return;
    }

    const context = {
      ...dataSet(options),
      actions: options.actions || {},
      byId: (id) => (options.products || []).find((product) => product.id === id),
      render: () => {
        preserveNextRender = true;
        render(options);
      }
    };
    const root = el("div", "sona-admin sona-profile");
    const topbar = el("section", "sona-profile-topbar sona-admin-topbar");
    const tabsWrap = el("div", "sona-profile-tabs-wrap sona-admin-tabs-wrap");
    const nav = el("nav", "sona-profile-tabs sona-admin-menu");
    nav.setAttribute("aria-label", "Разделы администратора");
    const main = el("main", "sona-admin-main");
    const logout = el("button", "sona-profile-topbar__logout sona-admin-logout");
    logout.setAttribute("aria-label", "Выйти из аккаунта администратора");
    logout.append(icon("M9 5H5v14h4 M13 8l4 4-4 4 M8 12h9"));

    menu.filter(([id]) => id !== "logout").forEach(([id, title, path]) => {
      const item = el("button", activeSection === id ? "is-active" : "");
      item.type = "button";
      item.dataset.adminSection = id;
      item.setAttribute("aria-current", activeSection === id ? "page" : "false");
      item.append(icon(path), el("span", "", title));
      if (id === "support") {
        const unread = context.support.filter((message) => message.role === "user" && message.status === "new").length;
        if (unread) item.append(el("em", "sona-admin-tab-badge", String(unread)));
      }
      item.addEventListener("click", () => {
        if (id === "logout") {
          logoutAdmin(onChange);
          return;
        }
        activeSection = id;
        preserveNextRender = true;
        render(options);
        window.requestAnimationFrame(() => {
          const activeItem = document.querySelector(`.sona-admin-menu [data-admin-section="${id}"]`);
          const activeNav = activeItem?.closest(".sona-admin-menu");
          if (activeItem && activeNav) {
            activeNav.style.scrollBehavior = "auto";
            activeNav.scrollLeft = activeItem.offsetLeft - (activeNav.clientWidth - activeItem.offsetWidth) / 2;
            window.requestAnimationFrame(() => activeNav.style.removeProperty("scroll-behavior"));
          }
        });
      });
      nav.append(item);
    });

    logout.type = "button";
    logout.addEventListener("click", () => {
      logoutAdmin(onChange);
    });

    const scrollTabs = (direction) => nav.scrollBy({ left: direction * Math.max(150, nav.clientWidth * 0.72), behavior: "smooth" });
    const left = el("button", "sona-profile-tabs-arrow", "←");
    const right = el("button", "sona-profile-tabs-arrow", "→");
    left.type = "button";
    right.type = "button";
    left.setAttribute("aria-label", "Предыдущие разделы");
    right.setAttribute("aria-label", "Следующие разделы");
    left.addEventListener("click", () => scrollTabs(-1));
    right.addEventListener("click", () => scrollTabs(1));

    topbar.append(el("h1", "", "Личный кабинет"), logout);
    tabsWrap.append(left, nav, right);
    main.append(renderContent(context));
    root.append(topbar, tabsWrap, main);
    container.replaceChildren(root);
    window.requestAnimationFrame(() => {
      if (preserveScroll) window.scrollTo({ top: stableScrollY, left: 0, behavior: "instant" });
      const activeItem = nav.querySelector(`[data-admin-section="${activeSection}"]`);
      if (activeItem) {
        nav.style.scrollBehavior = "auto";
        nav.scrollLeft = activeItem.offsetLeft - (nav.clientWidth - activeItem.offsetWidth) / 2;
        window.requestAnimationFrame(() => nav.style.removeProperty("scroll-behavior"));
      }
    });
  }

  window.SonaAdmin = {
    render,
    isAdmin,
    ADMIN_EMAIL,
    preserveScroll() {
      preserveNextRender = true;
    }
  };
})();
