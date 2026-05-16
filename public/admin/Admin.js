(function () {
  "use strict";

  const ADMIN_PHONE = "79056704413";
  let activeSection = "home";
let productQuery = "";
let orderQuery = "";
let orderStatusFilter = "all";
let reviewQuery = "";
let reviewStatusFilter = "all";
  let supportDialog = "";
  let editingProductId = "";
  let editingAdId = "";

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
    return String(value || "").replace(/\D/g, "");
  }

  function isAdmin(data) {
    return Boolean(data?.admin?.isAuthenticated || data?.profile?.role === "admin" || digits(data?.profile?.phone).endsWith(ADMIN_PHONE.slice(1)));
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
    (data.users || []).forEach((user) => {
      if (user.phone || user.email || user.id) map.set(user.phone || user.email || user.id, { ...user });
    });
    if (data.profile?.phone || data.profile?.email) {
      const key = data.profile.phone || data.profile.email;
      map.set(key, {
        id: `USER-${digits(data.profile.phone) || "local"}`,
        name: data.profile.name || "Покупатель Soна",
        email: data.profile.email || "",
        phone: data.profile.phone || "",
        role: data.profile.role || "user",
        status: data.profile.status || "active",
        registeredAt: data.profile.registeredAt || "",
        ...(map.get(key) || {})
      });
    }
    orders.forEach((order) => {
      const phone = order.profile?.phone || "";
      const email = order.profile?.email || "";
      const key = phone || email || order.profile?.userId || "guest";
      const current = map.get(key) || {
        id: order.profile?.userId || `USER-${digits(phone) || key}`,
        name: order.profile?.name || "Покупатель Soна",
        email,
        phone,
        role: "user",
        status: "active",
        registeredAt: order.createdAt ? new Date(order.createdAt).toISOString() : ""
      };
      current.ordersCount = (current.ordersCount || 0) + 1;
      current.totalSpent = (current.totalSpent || 0) + (Number(order.total) || 0);
      map.set(key, current);
    });
    return [...map.values()];
  }

  function stat(title, value, text, tone = "") {
    const card = el("article", `sona-admin-stat ${tone ? `is-${tone}` : ""}`);
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
    const button = el("button", "", "Войти в админ-панель");
    const hint = el("p", "sona-admin-muted", "Доступ разрешён только администратору Soна.");

    input.type = "tel";
    input.placeholder = "+7 905 670 44 13";
    button.type = "submit";
    form.append(input, button);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!digits(input.value).endsWith(ADMIN_PHONE.slice(1))) {
        hint.textContent = "Этот номер не имеет прав администратора.";
        input.focus();
        return;
      }
      window.SonaStore.update((data) => {
        data.admin = { ...(data.admin || {}), isAuthenticated: true, phone: "+7 905 670 44 13" };
        data.profile = {
          ...(data.profile || {}),
          isActive: true,
          phone: "+7 905 670 44 13",
          role: "admin",
          name: data.profile?.name || "Администратор Soна",
          registeredAt: data.profile?.registeredAt || new Date().toISOString()
        };
      });
      onChange?.();
    });

    wrap.append(el("p", "eyebrow", "Защищённый раздел"), el("h1", "", "Админ-панель Soна"), hint, form);
    container.replaceChildren(wrap);
  }

  function homeView(context) {
    const { products, orders, completedOrders, revenue, users, reviews, support } = context;
    const newOrders = orders.filter((order) => ["new", "processing"].includes(order.status)).length;
    const canceled = orders.filter((order) => ["canceled", "return"].includes(order.status)).length;
    const avg = completedOrders.length ? revenue / completedOrders.length : 0;
    const unread = support.filter((message) => message.role === "user" && message.status !== "read").length;
    const stockOut = products.filter((product) => Number(product.stock) <= 0 && product.stock !== undefined).length;
    const hiddenReviews = reviews.filter((review) => review.status === "hidden").length;

    const page = el("div", "sona-admin-section");
    const stats = el("section", "sona-admin-stats");
    stats.append(
      stat("Всего заказов", orders.length, `${newOrders} новых`, "blue"),
      stat("В обработке", orders.filter((order) => ["processing", "paid", "assembling", "delivering"].includes(order.status)).length, "активные статусы"),
      stat("Завершено", completedOrders.length, `${canceled} отмен/возвратов`, "green"),
      stat("Товары", products.length, `${stockOut} без остатка`),
      stat("Пользователи", users.length, "зарегистрированные"),
      stat("Отзывы", reviews.length, `${hiddenReviews} скрыто`),
      stat("Поддержка", support.length, `${unread} непрочитано`, "blue"),
      stat("Выручка", money(revenue), `средний чек ${money(avg)}`, "green")
    );
    page.append(stats, dashboardPreview(context));
    return page;
  }

  function dashboardPreview(context) {
    const grid = el("section", "sona-admin-dashboard-grid");
    grid.append(
      ordersTable(context, { compact: true }),
      supportView(context, { compact: true }),
      reviewsView(context, { compact: true })
    );
    return grid;
  }

  function statsView(context) {
    const page = el("section", "sona-admin-panel sona-admin-wide");
    const filters = el("div", "sona-admin-filters");
    ["Сегодня", "Неделя", "Месяц", "Год", "Период"].forEach((item, index) => {
      const button = el("button", index === 2 ? "is-active" : "", item);
      button.type = "button";
      filters.append(button);
    });

    const chart = el("div", "sona-admin-chart");
    const ordersByDay = context.orders.slice(-8);
    const max = Math.max(1, ...ordersByDay.map((order) => Number(order.total) || 0));
    ordersByDay.forEach((order) => {
      const bar = el("span");
      bar.style.height = `${Math.max(10, ((Number(order.total) || 0) / max) * 100)}%`;
      bar.title = `${order.id}: ${money(order.total)}`;
      chart.append(bar);
    });

    const popular = [...context.products]
      .sort((a, b) => (window.SonaReviews?.summary(context.data.reviews, b.id).count || 0) - (window.SonaReviews?.summary(context.data.reviews, a.id).count || 0))
      .slice(0, 6)
      .map((product) => infoRow(product.name, `${product.category || "Категория"} · ${money(product.price)}`));
    const categories = Object.entries(context.products.reduce((acc, product) => {
      const key = product.category || product.marketSection || "Без категории";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([name, count]) => infoRow(name, `${count} товаров`));

    page.append(el("h2", "", "Статистика"), filters, chart, el("h3", "", "Популярные товары"), ...popular, el("h3", "", "Категории"), ...categories);
    return page;
  }

  function infoRow(title, value) {
    const row = el("article", "sona-admin-info-row");
    row.append(el("strong", "", title), el("span", "", value));
    return row;
  }

  function ordersTable(context, options = {}) {
    const panel = el("section", `sona-admin-panel ${options.compact ? "" : "sona-admin-wide"}`);
    const rows = context.orders
      .filter((order) => {
        const q = orderQuery.toLowerCase();
        const matchesStatus = orderStatusFilter === "all" || order.status === orderStatusFilter;
        const matchesQuery = !q || [order.id, order.profile?.name, order.profile?.phone, order.profile?.email].join(" ").toLowerCase().includes(q);
        return matchesStatus && matchesQuery;
      })
      .slice()
      .reverse()
      .slice(0, options.compact ? 5 : 100);

    panel.append(el("h2", "", "Заказы"));
    if (!options.compact) {
      panel.append(filterBar([
        searchInput("Поиск заказа", orderQuery, (value) => { orderQuery = value; context.render(); }),
        select([["all", "Все статусы"], ...Object.entries(window.SonaOrders?.STATUS || {})], orderStatusFilter, (value) => { orderStatusFilter = value; context.render(); })
      ]));
    }
    if (!rows.length) {
      panel.append(el("p", "sona-admin-muted", "Заказов пока нет."));
      return panel;
    }

    const table = tableWrap(["Номер", "Клиент", "Товары", "Сумма", "Статус", "Действия"]);
    rows.forEach((order) => {
      const tr = document.createElement("tr");
      const status = select(Object.entries(window.SonaOrders?.STATUS || {}), order.status || "new", (value) => {
        context.actions.updateOrder(order.id, { status: value });
      });
      tr.append(
        td(order.id || "Заказ"),
        td(`${order.date || ""}\n${order.profile?.phone || order.profile?.email || "Без контакта"}`),
        td((order.items || []).map((item) => `${context.byId?.(item.id)?.name || item.id} × ${item.quantity || 1}`).join(", ")),
        td(money(order.total)),
        td(status),
        td(actionButtons([
          ["Удалить тестовый", () => context.actions.deleteOrder(order.id), "danger"]
        ]))
      );
      table.querySelector("tbody").append(tr);
    });
    panel.append(table);
    return panel;
  }

  function productsView(context) {
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
    const fields = [
      ["name", "Название", product.name || ""],
      ["price", "Цена", product.price || ""],
      ["oldPrice", "Старая цена", product.oldPrice || ""],
      ["category", "Категория", product.category || ""],
      ["marketSection", "Раздел", product.marketSection || ""],
      ["brand", "Бренд", product.brand || "Soна"],
      ["size", "Размер", product.size || "M"],
      ["stock", "Остаток", product.stock ?? 10],
      ["tags", "Теги через запятую", (product.tags || []).join(", ")]
    ];
    fields.forEach(([name, label, value]) => {
      const input = el("input");
      input.name = name;
      input.placeholder = label;
      input.value = value;
      form.append(input);
    });
    const file = el("input");
    file.type = "file";
    file.accept = "image/png,image/jpeg,image/webp";
    file.name = "imageFile";
    form.append(file);
    const save = el("button", "", editingProductId ? "Сохранить товар" : "Добавить товар");
    const reset = el("button", "sona-admin-soft", "Новый товар");
    save.type = "submit";
    reset.type = "button";
    reset.addEventListener("click", () => { editingProductId = ""; context.render(); });
    form.append(save, reset);
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
      const role = select([["user", "user"], ["admin", "admin"]], user.role || "user", (value) => context.actions.updateUser(user.phone, { role: value }));
      const status = select([["active", "Активен"], ["blocked", "Заблокирован"]], user.status || "active", (value) => context.actions.updateUser(user.phone, { status: value }));
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
        select([["all", "Все статусы"], ["published", "Опубликован"], ["moderation", "На модерации"], ["hidden", "Скрыт"], ["deleted", "Удалён"]], reviewStatusFilter, (value) => { reviewStatusFilter = value; context.render(); })
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
      const status = select([["published", "Опубликован"], ["moderation", "На модерации"], ["hidden", "Скрыт"], ["deleted", "Удалён"]], review.status || "published", (value) => {
        context.actions.updateReview(review.id, { status: value });
      });
      tr.append(
        td(product?.name || review.productId),
        td(review.author || "Покупатель"),
        td(`${review.rating || 5}/5`),
        td(review.text || ""),
        td(status),
        td(actionButtons([
          ["Проверен", () => context.actions.updateReview(review.id, { verified: true })],
          ["Ответить", () => {
            const reply = window.prompt("Ответ магазина на отзыв", review.reply || "");
            if (reply !== null) context.actions.updateReview(review.id, { reply });
          }],
          ["Скрыть", () => context.actions.updateReview(review.id, { status: "hidden" })],
          ["Удалить", () => context.actions.updateReview(review.id, { status: "deleted" }), "danger"]
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
    const ad = (data.customAds || []).find((item) => item.id === editingAdId) || {};
    const form = el("form", "sona-admin-editor");
    const fields = [
      ["title", "Заголовок", ad.title || ""],
      ["eyebrow", "Метка", ad.eyebrow || "Реклама Soна"],
      ["badge", "Акцент", ad.badge || ""],
      ["cta", "Кнопка", ad.cta || "Смотреть"],
      ["link", "Ссылка", ad.link || "#catalog"],
      ["startAt", "Дата начала", ad.startAt || ""],
      ["endAt", "Дата окончания", ad.endAt || ""]
    ];
    fields.forEach(([name, label, value]) => {
      const input = el("input");
      input.name = name;
      input.placeholder = label;
      input.value = value;
      form.append(input);
    });
    const file = el("input");
    file.type = "file";
    file.accept = "image/png,image/jpeg,image/webp";
    file.name = "visualFile";
    const active = el("label", "sona-admin-check");
    const checkbox = el("input");
    checkbox.type = "checkbox";
    checkbox.name = "active";
    checkbox.checked = ad.active !== false;
    active.append(checkbox, el("span", "", "Активен"));
    const save = el("button", "", editingAdId ? "Сохранить баннер" : "Добавить баннер");
    save.type = "submit";
    form.append(file, active, save);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(form).entries());
      const persist = (visual) => {
        context.actions.saveAd({ ...ad, ...body, id: ad.id, active: checkbox.checked, visual: visual || ad.visual || "" });
        editingAdId = "";
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

    panel.append(el("h2", "", "Реклама"), form);
    (data.customAds || []).forEach((item) => {
      const row = el("article", "sona-admin-info-row");
      row.append(el("strong", "", item.title || item.eyebrow || "Баннер"), el("span", "", item.active === false ? "Выключен" : "Активен"), actionButtons([
        ["Редактировать", () => { editingAdId = item.id; context.render(); }],
        ["Удалить", () => context.actions.deleteAd(item.id), "danger"]
      ]));
      panel.append(row);
    });
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
    messages.forEach((message) => {
      const item = el("article", `sona-support-message is-${message.role === "admin" ? "admin" : "user"}`);
      item.append(el("strong", "", message.author || ""), el("p", "", message.text || ""), el("span", "", window.SonaSupport?.nowLabel(message.createdAt) || ""));
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
    input.placeholder = "Ответ администратора";
    const send = el("button", "", "Отправить");
    send.type = "submit";
    form.append(input, send);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const target = dialogs.find((dialog) => dialog.id === active);
      if (window.SonaSupport?.addAdminReply(input.value, { phone: target?.phone, email: target?.email })) {
        window.SonaStore.update((data) => {
          data.supportMessages = (data.supportMessages || []).map((message) => (
            message.role === "user" ? { ...message, status: "read" } : message
          ));
        });
        input.value = "";
        context.render();
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
      const id = message.phone || message.email || message.author || "guest";
      const dialog = map.get(id) || { id, title: message.role === "admin" ? "Диалог" : (message.author || "Покупатель"), phone: message.phone || "", email: message.email || "", messages: [] };
      dialog.messages.push(message);
      dialog.last = message;
      map.set(id, dialog);
    });
    return [...map.values()].sort((a, b) => Number(b.last?.createdAt || 0) - Number(a.last?.createdAt || 0));
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
    save.type = "submit";
    form.append(save);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      context.actions.saveSettings(Object.fromEntries(new FormData(form).entries()));
    });
    panel.append(el("h2", "", "Настройки магазина"), form);
    return panel;
  }

  function searchInput(placeholder, value, onInput) {
    const input = el("input", "sona-admin-search");
    input.type = "search";
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener("input", () => onInput(input.value));
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

    const raw = window.SonaStore.read();
    if (!isAdmin(raw)) {
      loginView(container, onChange);
      return;
    }

    const context = {
      ...dataSet(options),
      actions: options.actions || {},
      byId: (id) => (options.products || []).find((product) => product.id === id),
      render: () => render(options)
    };
    const root = el("div", "sona-admin");
    const sidebar = el("aside", "sona-admin-sidebar");
    const nav = el("nav", "sona-admin-menu");
    const main = el("main", "sona-admin-main");
    const head = el("section", "sona-admin-head");
    const logout = el("button", "sona-admin-soft", "Выйти");

    menu.forEach(([id, title, path]) => {
      const item = el("button", activeSection === id ? "is-active" : "");
      item.type = "button";
      item.append(icon(path), el("span", "", title));
      item.addEventListener("click", () => {
        if (id === "logout") {
          window.SonaStore.update((state) => {
            state.admin = { ...(state.admin || {}), isAuthenticated: false };
            state.profile = { ...(state.profile || {}), role: "user" };
          });
          activeSection = "home";
          onChange();
          return;
        }
        activeSection = id;
        render(options);
      });
      nav.append(item);
    });

    logout.type = "button";
    logout.addEventListener("click", () => {
      window.SonaStore.update((state) => {
        state.admin = { ...(state.admin || {}), isAuthenticated: false };
        state.profile = { ...(state.profile || {}), role: "user" };
      });
      onChange();
    });

    sidebar.append(el("strong", "sona-admin-logo", "Soна Admin"), nav);
    head.append(el("div", "", ""), logout);
    head.firstChild.append(el("p", "eyebrow", "Админ-панель"), el("h1", "", "Управление магазином"), el("span", "", "Заказы, товары, пользователи, отзывы, реклама и поддержка."));
    main.append(head, renderContent(context));
    root.append(sidebar, main);
    container.replaceChildren(root);
  }

  window.SonaAdmin = {
    render,
    isAdmin,
    ADMIN_PHONE
  };
})();
