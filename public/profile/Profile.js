(function () {
  "use strict";

  const navGroups = [
    {
      title: "Обзор",
      items: [
        { id: "home", title: "Главная", icon: "home" },
        { id: "orders", title: "Заказы", icon: "orders", badge: (ctx) => ctx.orders.length },
        { id: "purchases", title: "Покупки", icon: "purchases", badge: (ctx) => ctx.completedOrders.length }
      ]
    },
    {
      title: "Покупки",
      items: [
        { id: "favorites", title: "Избранное", icon: "favorites", badge: (ctx) => ctx.favorites.length },
        { id: "cart", title: "Корзина", icon: "cart", badge: (ctx) => ctx.totals.count },
        { id: "reviews", title: "Отзывы и вопросы", icon: "reviews", badge: (ctx) => ctx.reviewableItems.length },
        { id: "returns", title: "Возвраты", icon: "returns" }
      ]
    },
    {
      title: "Профиль",
      items: [
        { id: "addresses", title: "Адреса доставки", icon: "addresses" },
        { id: "payments", title: "Способы оплаты", icon: "payments" },
        { id: "support", title: "Поддержка", icon: "support" },
        { id: "settings", title: "Настройки", icon: "settings" },
        { id: "logout", title: "Выйти", icon: "logout", danger: true }
      ]
    }
  ];

  let activeSection = "home";
  let loginEmail = "";
  let loginCodeSent = false;
  let loginBusy = false;
  let loginError = "";
  const DEVICE_KEY = "sona.device.id";
  const LOCAL_AUTH_KEY = "sona.auth.local";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = fixed(text);
    return node;
  }

  function fixed(value) {
    return window.SonaText?.fix(value) || String(value ?? "");
  }

  function safeText(value, fallback = "") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return "";
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // The active in-memory profile still works if storage is unavailable.
    }
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // Ignore storage cleanup failures.
    }
  }

  function currentDeviceId() {
    let id = storageGet(DEVICE_KEY);
    if (!id) {
      id = (window.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      storageSet(DEVICE_KEY, id);
    }
    return id;
  }

  function browserName() {
    const ua = navigator.userAgent || "";
    if (ua.includes("Edg/")) return "Microsoft Edge";
    if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
    if (ua.includes("Firefox/")) return "Firefox";
    if (ua.includes("Chrome/")) return "Chrome";
    if (ua.includes("Safari/")) return "Safari";
    return "Браузер";
  }

  function platformName() {
    const platform = navigator.userAgentData?.platform || navigator.platform || "";
    const ua = navigator.userAgent || "";
    if (/Win/i.test(platform) || /Windows/i.test(ua)) return "Windows";
    if (/Mac/i.test(platform) || /Mac OS/i.test(ua)) return "macOS";
    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
    if (/Linux/i.test(platform)) return "Linux";
    return "Устройство";
  }

  function deviceLabel() {
    return `${browserName()} · ${platformName()}`;
  }

  function readLocalAuth() {
    try {
      return JSON.parse(storageGet(LOCAL_AUTH_KEY) || "null");
    } catch (error) {
      storageRemove(LOCAL_AUTH_KEY);
      return null;
    }
  }

  function writeLocalAuth(profile) {
    const email = String(profile?.email || "").trim().toLowerCase();
    if (!email) return;
    storageSet(LOCAL_AUTH_KEY, JSON.stringify({
      email,
      profile: {
        isActive: true,
        name: profile.name || "",
        email,
        phone: profile.phone || "",
        address: profile.address || "",
        role: profile.role || "user",
        registeredAt: profile.registeredAt || new Date().toISOString(),
        sessionId: currentDeviceId()
      },
      deviceId: currentDeviceId(),
      savedAt: new Date().toISOString()
    }));
  }

  function clearLocalAuth() {
    storageRemove(LOCAL_AUTH_KEY);
  }

  function restoreLocalAuth(data) {
    if (data?.profile?.isActive) return data;
    const auth = readLocalAuth();
    if (!auth?.profile?.email || auth.deviceId !== currentDeviceId()) return data;

    const sessions = Array.isArray(data?.accountSessions) ? data.accountSessions : [];
    const knownSessions = sessions.filter((session) => session.email === auth.profile.email);
    if (knownSessions.length && !knownSessions.some((session) => session.id === auth.deviceId)) {
      clearLocalAuth();
      return data;
    }

    return window.SonaStore.update((state) => {
      state.profile = {
        ...(state.profile || {}),
        ...auth.profile,
        isActive: true
      };
    });
  }

  function upsertCurrentSession(data, account) {
    const now = new Date().toISOString();
    const id = currentDeviceId();
    const email = String(account?.email || data.profile?.email || "").toLowerCase();
    const existing = (data.accountSessions || []).find((session) => session.id === id && session.email === email);

    data.accountSessions = [
      ...(data.accountSessions || []).filter((session) => !(session.id === id && session.email === email)),
      {
        ...(existing || {}),
        id,
        accountId: account?.id || existing?.accountId || "",
        email,
        title: deviceLabel(),
        browser: browserName(),
        platform: platformName(),
        createdAt: existing?.createdAt || now,
        lastSeenAt: now
      }
    ];
    data.profile.sessionId = id;
  }

  function authApiUrl(path) {
    return window.location.protocol === "file:" ? `http://127.0.0.1:8000${path}` : path;
  }

  async function requestEmailCode(email) {
    const response = await fetch(authApiUrl("/api/auth/request-email"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    return response.json();
  }

  async function verifyEmailCode(email, code) {
    const response = await fetch(authApiUrl("/api/auth/verify-email"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });
    return response.json();
  }

  function iconSvg(name) {
    const icons = {
      home: ["M4 11.5 12 5l8 6.5", "M6.5 10.5V19h11v-8.5", "M10 19v-5h4v5"],
      orders: ["M6 4h12v16H6z", "M9 8h6", "M9 12h6", "M9 16h4"],
      purchases: ["M5 12.5 10 17l9-10", "M4 19h16"],
      favorites: ["M12 19s-7-4.2-8.4-8.8C2.6 6.9 4.7 4 7.8 4c1.8 0 3.2.9 4.2 2.2C13 4.9 14.4 4 16.2 4c3.1 0 5.2 2.9 4.2 6.2C19 14.8 12 19 12 19Z"],
      cart: ["M4 5h2l1.7 9.2a2 2 0 0 0 2 1.6h6.7a2 2 0 0 0 1.9-1.5L19.5 9H7.1", "M9.5 20h.1", "M17 20h.1"],
      reviews: ["M5 5h14v10H9l-4 4V5z", "M9 9h6", "M9 12h4"],
      returns: ["M8 8H5V5", "M5.5 8A7 7 0 1 1 7 17", "M8 8l3-3"],
      payments: ["M4 7h16v10H4z", "M4 10h16", "M8 14h3"],
      addresses: ["M12 21s6-5.4 6-10a6 6 0 0 0-12 0c0 4.6 6 10 6 10Z", "M12 13.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"],
      support: ["M5 13v-1a7 7 0 0 1 14 0v1", "M5 13h3v5H5z", "M16 13h3v5h-3z", "M14 20h-2"],
      settings: ["M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z", "M19 12h2", "M3 12h2", "M12 3v2", "M12 19v2", "M17 5.8l-1.4 1.4", "M8.4 16.8 7 18.2", "M7 5.8l1.4 1.4", "M15.6 16.8l1.4 1.4"],
      logout: ["M9 5H5v14h4", "M13 8l4 4-4 4", "M8 12h9"],
      bell: ["M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
      catalog: ["M4 5h7v7H4z", "M13 5h7v7h-7z", "M4 14h7v5H4z", "M13 14h7v5h-7z"],
      edit: ["M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z", "M13.5 8.5l2 2"],
      calendar: ["M7 3v3", "M17 3v3", "M4 8h16", "M5 5h14v15H5z"],
      truck: ["M3 6h11v10H3z", "M14 10h4l3 3v3h-7z", "M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", "M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
      shield: ["M12 3 5 6v5c0 4.2 2.8 7.6 7 9 4.2-1.4 7-4.8 7-9V6l-7-3Z", "M9 12l2 2 4-5"],
      user: ["M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z", "M4.8 20.2c.9-3.5 3.5-5.3 7.2-5.3s6.3 1.8 7.2 5.3"],
      spark: ["M12 3l1.5 5.3L19 10l-5.5 1.7L12 17l-1.5-5.3L5 10l5.5-1.7L12 3Z", "M5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16Z"]
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("sona-profile-svg");
    (icons[name] || icons.home).forEach((d) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      svg.append(path);
    });
    return svg;
  }

  const formatter = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  });

  function money(value) {
    return formatter.format(Number(value) || 0);
  }

  function compactNumber(value) {
    return new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return "";
    const date = typeof value === "number" ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  }

  function profileCompletion(profile = {}) {
    const fields = [
      Boolean(safeText(profile.name)),
      Boolean(safeText(profile.email)),
      Boolean(safeText(profile.phone)),
      Boolean(safeText(profile.address))
    ];
    const filled = fields.filter(Boolean).length;
    const percent = Math.round((filled / fields.length) * 100);
    const missing = [];
    if (!safeText(profile.name)) missing.push("имя");
    if (!safeText(profile.email)) missing.push("email");
    if (!safeText(profile.phone)) missing.push("телефон");
    if (!safeText(profile.address)) missing.push("адрес");
    return { filled, total: fields.length, percent, missing };
  }

  function getTotals(cartRows, orders, profile) {
    const count = cartRows.reduce((sum, row) => sum + row.quantity, 0);
    const subtotal = cartRows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
    const completedOrders = window.SonaOrders?.completedOrders(orders) || orders.filter((order) => order.status === "completed");
    const activeOrders = orders.filter((order) => !window.SonaOrders?.isCompleted(order) && order.status !== "canceled");
    const spent = completedOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const completion = profileCompletion(profile);
    const lastOrder = orders[0] || null;
    const nextAction = count
      ? "Проверьте корзину и оформите заказ"
      : activeOrders.length
        ? "Следите за статусом активного заказа"
        : completion.percent < 100
          ? "Заполните данные для быстрой доставки"
          : "Откройте каталог и сохраните подходящие товары";

    return { count, subtotal, completedOrders, activeOrders, spent, completion, lastOrder, nextAction };
  }

  function setSection(section, context) {
    activeSection = section || "home";
    render(context);
  }

  function button(className, text, action, icon) {
    const control = el("button", className, text);
    control.type = "button";
    if (icon) {
      control.prepend(iconSvg(icon));
    }
    control.addEventListener("click", action);
    return control;
  }

  function anchorButton(className, text, href, icon) {
    const link = el("a", className, text);
    link.href = href;
    if (icon) link.prepend(iconSvg(icon));
    return link;
  }

  function actionRow(text, action, icon = "catalog") {
    const row = el("div", "sona-profile-action-row");
    row.append(button("sona-profile-soft", text, action, icon));
    return row;
  }

  function dualActions(leftText, leftAction, rightText, rightAction) {
    const actions = el("div", "sona-profile-actions");
    actions.append(
      button("sona-profile-soft", leftText, leftAction),
      button("sona-profile-primary", rightText, rightAction)
    );
    return actions;
  }

  function productThumb(product) {
    const thumb = el("div", "sona-profile-thumb");
    const id = String(product.id || "").toLowerCase();
    const fallbackImage = id.includes("chair")
      ? "assets/source/кресло в категории-no-bg-preview (carve.photos).png"
      : id.includes("bed")
        ? "assets/source/кровать в категории-no-bg-preview (carve.photos).png"
        : id.includes("wardrobe")
          ? "assets/source/шкаф в категории -no-bg-preview (carve.photos) (1).png"
          : id.includes("service") || id.includes("design") || id.includes("marketplace") || id.includes("motion")
            ? "assets/source/услуги в категории -edited-free (carve.photos).png"
            : "assets/source/диван в категории-no-bg-preview (carve.photos).png";
    const imageSource = window.SonaProducts?.getImage?.(product)
      || window.SonaProducts?.safeImageSrc?.(product.image || product.visual || fallbackImage)
      || product.image
      || product.visual
      || fallbackImage;

    if (imageSource) {
      const img = el("img");
      img.src = imageSource;
      img.alt = fixed(product.name || "");
      img.loading = "eager";
      img.decoding = "async";
      thumb.classList.add("has-image");
      thumb.append(img);
      return thumb;
    }

    thumb.append(
      el("span", "", product.marketSection || "SONA"),
      el("strong", "", product.name)
    );
    return thumb;
  }

  function productMiniCard(product, meta, actionText, onAction, secondaryText, onSecondary) {
    const card = el("article", "sona-profile-product");
    const body = el("div", "sona-profile-product__body");
    const actions = el("div", "sona-profile-product__actions");
    const title = el("strong", "", product.name);
    const note = el("span", "", meta);

    body.append(title, note);
    actions.append(button("sona-profile-soft", actionText, onAction));
    if (secondaryText && onSecondary) {
      actions.append(button("sona-profile-soft sona-profile-danger", secondaryText, onSecondary));
    }
    card.append(productThumb(product), body, actions);
    return card;
  }

  function emptyState(title, text, buttonText, onClick, icon = "spark") {
    const box = el("div", "sona-profile-empty");
    const mark = el("div", "sona-profile-empty__mark");
    mark.append(iconSvg(icon));
    box.append(
      mark,
      el("strong", "", title),
      el("span", "", text),
      button("sona-profile-primary", buttonText, onClick)
    );
    return box;
  }

  function sectionHeader(title, text, actions = []) {
    const header = el("div", "sona-profile-section-head");
    const copy = el("div");
    copy.append(el("p", "sona-profile-kicker", "Личный кабинет"), el("h2", "", title));
    if (text) copy.append(el("span", "", text));
    header.append(copy);
    if (actions.length) {
      const row = el("div", "sona-profile-section-actions");
      actions.forEach((item) => row.append(item));
      header.append(row);
    }
    return header;
  }

  function infoRow(label, value, icon = "spark", actionText, action) {
    const row = el("article", "sona-profile-row");
    const iconBox = el("span", "sona-profile-row__icon");
    const body = el("div", "sona-profile-row__body");
    iconBox.append(iconSvg(icon));
    body.append(el("span", "", label), el("strong", "", value));
    row.append(iconBox, body);
    if (actionText && action) row.append(button("sona-profile-soft", actionText, action));
    return row;
  }

  function renderLogin(context) {
    const root = el("section", "sona-login");
    const card = el("div", "sona-login-card");
    const visual = el("div", "sona-login-visual");
    const form = el("form", "sona-login-form");
    const phoneLabel = el("label", "", "Телефон");
    const emailInput = el("input");
    const codeLabel = el("label", "", "Код из письма");
    const codeInput = el("input");
    const submit = button("sona-profile-primary", loginBusy ? "Подождите..." : (loginCodeSent ? "Войти" : "Получить код"), () => {});

    emailInput.type = "email";
    emailInput.placeholder = "name@example.com";
    emailInput.value = loginEmail;
    emailInput.autocomplete = "email";

    codeInput.inputMode = "numeric";
    codeInput.placeholder = "000000";
    codeInput.maxLength = 6;
    codeInput.hidden = !loginCodeSent;
    codeLabel.hidden = !loginCodeSent;
    submit.type = "submit";
    submit.disabled = loginBusy;

    phoneLabel.textContent = "Email";
    phoneLabel.append(emailInput);
    codeLabel.append(codeInput);
    form.append(phoneLabel, codeLabel, submit);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (loginBusy) return;

      const emailCheck = window.SonaSecurity?.validateAuthEmail(emailInput.value) || { ok: false, email: "", message: "Введите email" };
      const email = emailCheck.email;

      if (!loginCodeSent) {
        if (!emailCheck.ok) {
          loginError = emailCheck.message;
          render(context);
          return;
        }

        loginBusy = true;
        render(context);
        try {
          const result = await requestEmailCode(email);
          if (!result.ok) {
            loginError = result.message || "Не удалось отправить письмо. Проверьте email или повторите позже.";
            render(context);
            return;
          }

          loginEmail = email;
          loginCodeSent = true;
          loginError = "Код отправлен на указанную почту.";
          render(context);
        } catch (error) {
          loginError = "Сервер почты недоступен. Проверьте, что локальный сервер запущен и SMTP настроен.";
          render(context);
        } finally {
          loginBusy = false;
          render(context);
        }
        return;
      }

      const code = window.SonaSecurity?.sanitizeAuthCode(codeInput.value) || codeInput.value.trim();
      let account = null;
      loginBusy = true;
      render(context);
      try {
        const result = await verifyEmailCode(loginEmail, code);
        if (!result.ok) {
          loginError = result.warning || result.message || "Неверный код из письма.";
          loginBusy = false;
          render(context);
          return;
        }
        account = result.account || null;
      } catch (error) {
        loginError = "Неверный код из письма.";
        loginBusy = false;
        render(context);
        return;
      }

      window.SonaStore.update((data) => {
        const role = account?.role || (loginEmail === window.SonaAdmin?.ADMIN_EMAIL ? "admin" : "user");
        data.profile = {
          ...(data.profile || {}),
          isActive: true,
          email: account?.email || loginEmail,
          role,
          registeredAt: account?.createdAt || data.profile?.registeredAt || new Date().toISOString()
        };
        if (role === "admin") {
          data.admin = { ...(data.admin || {}), isAuthenticated: true, email: account?.email || loginEmail };
          data.profile.name = data.profile.name || "Администратор SONA";
        } else {
          data.admin = { ...(data.admin || {}), isAuthenticated: false, email: "" };
        }
        upsertCurrentSession(data, account);
        const userRow = {
          id: account?.id || `USER-${loginEmail.replace(/[^a-z0-9]/gi, "-")}`,
          name: data.profile.name || "Покупатель SONA",
          email: account?.email || loginEmail,
          phone: data.profile.phone || "",
          role,
          status: account?.status || "active",
          registeredAt: data.profile.registeredAt
        };
        data.users = [
          ...(data.users || []).filter((user) => user.email !== userRow.email),
          userRow
        ];
        writeLocalAuth(data.profile);
      });

      loginCodeSent = false;
      loginBusy = false;
      loginEmail = "";
      loginError = "";
      activeSection = "home";
      context.onAuthChange?.();
    });

    visual.append(
      el("span", "sona-profile-kicker", "SONA"),
      el("h2", "", "Кабинет для спокойных покупок"),
      el("p", "", "Заказы, избранное, доставка и поддержка собраны в одном месте.")
    );
    card.append(
      visual,
      el("p", "sona-profile-kicker", "Вход в аккаунт"),
      el("h1", "", "Войти в SONA"),
      el("p", "sona-profile-muted", "Введите email. После подтверждения кода из письма откроется личный кабинет."),
      form
    );
    if (loginError) {
      card.append(el("p", "sona-login-error", loginError));
    }
    root.append(card);
    return root;
  }

  function renderShell(context, content) {
    const data = context.data;
    const totals = context.totals;
    const name = safeText(data.profile?.name, "Имя не указано");
    const email = safeText(data.profile?.email, "user@gmail.com");
    const phone = safeText(data.profile?.phone, "+7 900 000-00-00");
    const address = safeText(data.profile?.address, "Адрес не указан");
    const root = el("div", "sona-profile");
    const header = el("section", "sona-profile-header");
    const avatar = el("div", "sona-profile-avatar", name.slice(0, 1).toUpperCase());
    const identity = el("div", "sona-profile-identity");
    const actions = el("div", "sona-profile-header__actions");
    const summary = el("aside", "sona-profile-summary");
    const progress = el("div", "sona-profile-completion");
    const progressBar = el("i");
    const layout = el("div", "sona-profile-layout");
    const side = el("aside", "sona-profile-sidebar");
    const nav = el("nav", "sona-profile-menu");
    const main = el("main", "sona-profile-content");

    progressBar.style.width = `${totals.completion.percent}%`;
    progress.append(progressBar);
    identity.append(
      el("span", "sona-profile-label", "Профиль покупателя"),
      el("h1", "", name),
      el("p", "", `${email} · ${phone}`),
      el("small", "", address)
    );
    actions.append(
      button("sona-profile-icon", "", () => setSection("support", context), "bell"),
      button("sona-profile-soft", "Редактировать", context.openEdit, "edit"),
      button("sona-profile-primary", "Каталог", context.openCatalog, "catalog")
    );
    summary.append(
      el("span", "sona-profile-kicker", "Готовность профиля"),
      el("strong", "", `${totals.completion.percent}%`),
      progress,
      el("small", "", totals.completion.missing.length ? `Добавьте: ${totals.completion.missing.join(", ")}` : "Данные готовы для быстрого заказа")
    );
    header.append(avatar, identity, actions, summary);

    navGroups.forEach((group) => {
      const block = el("div", "sona-profile-menu__group");
      block.append(el("p", "", group.title));
      group.items.forEach((item) => {
        const navItem = el("button", "sona-profile-menu__item");
        const iconBox = el("span", "sona-profile-menu__icon");
        const badgeValue = typeof item.badge === "function" ? item.badge(context) : item.badge;

        iconBox.append(iconSvg(item.icon));
        navItem.type = "button";
        navItem.classList.toggle("is-active", activeSection === item.id);
        navItem.classList.toggle("is-danger", Boolean(item.danger));
        navItem.append(iconBox, el("strong", "", item.title));
        if (badgeValue) navItem.append(el("em", "", compactNumber(badgeValue)));
        navItem.addEventListener("click", () => {
          if (item.id === "logout") {
            context.logout();
            return;
          }
          activeSection = item.id;
          render(context);
        });
        block.append(navItem);
      });
      nav.append(block);
    });

    side.append(nav);
    main.append(content);
    layout.append(side, main);
    root.append(header, layout);
    return root;
  }

  function summaryCard(icon, title, value, text, action, tone = "") {
    const card = el("button", `sona-profile-quick ${tone}`.trim());
    const iconBox = el("span", "sona-profile-quick__icon");
    iconBox.append(iconSvg(icon));
    card.type = "button";
    card.append(iconBox, el("strong", "", title), el("b", "", value), el("small", "", text));
    card.addEventListener("click", action);
    return card;
  }

  function nextStepCard(context) {
    const { totals, cartRows, activeOrders } = context;
    const card = el("section", "sona-profile-next");
    const visual = el("div", "sona-profile-next__visual");
    const body = el("div", "sona-profile-next__body");
    const actions = el("div", "sona-profile-actions");
    visual.append(iconSvg(totals.count ? "cart" : activeOrders.length ? "truck" : "user"));
    body.append(
      el("span", "sona-profile-kicker", "Что дальше"),
      el("h2", "", totals.nextAction),
      el("p", "", totals.count
        ? `${totals.count} товар(ов) на сумму ${money(totals.subtotal)} уже ждут оформления.`
        : activeOrders.length
          ? "В активных заказах можно проверить статус и подтвердить получение."
          : "Чем полнее профиль, тем быстрее оформление и поддержка.")
    );
    actions.append(
      button("sona-profile-soft", totals.count ? "Открыть корзину" : "Посмотреть заказы", totals.count ? context.openCart : () => setSection("orders", context)),
      button("sona-profile-primary", totals.count ? "Оформить" : "Перейти в каталог", totals.count ? context.checkout : context.openCatalog)
    );
    card.append(visual, body, actions);
    return card;
  }

  function taskRail(context) {
    const rail = el("section", "sona-profile-task-rail");
    const data = context.data;
    const rows = [
      ["addresses", "Адрес доставки", safeText(data.profile?.address, "Добавить адрес"), () => setSection("addresses", context)],
      ["payments", "Оплата", "Карта не привязана", () => setSection("payments", context)],
      ["support", "Поддержка", "Чат и телефон", () => setSection("support", context)]
    ];

    rows.forEach(([icon, title, value, action]) => {
      const item = el("button", "sona-profile-task");
      const mark = el("span");
      mark.append(iconSvg(icon));
      item.type = "button";
      item.append(mark, el("strong", "", title), el("small", "", value));
      item.addEventListener("click", action);
      rail.append(item);
    });
    return rail;
  }

  function renderHome(context) {
    const { favorites, cartRows, orders, products, totals, reviewableItems, activeOrders } = context;
    const wrap = el("div", "sona-profile-main");
    const quick = el("section", "sona-profile-quick-grid");
    const recent = products.slice(0, 4);
    const favoritePreview = el("section", "sona-profile-panel");
    const ordersPreview = el("section", "sona-profile-panel");
    const cartPreview = el("section", "sona-profile-panel");
    const support = el("section", "sona-profile-panel sona-profile-support");

    [
      ["orders", "Заказы", String(orders.length), activeOrders.length ? `${activeOrders.length} активных` : "История заказов", () => setSection("orders", context), "is-blue"],
      ["purchases", "Покупки", money(totals.spent), `${totals.completedOrders.length} завершено`, () => setSection("purchases", context), ""],
      ["favorites", "Избранное", String(favorites.length), "Сохранённые товары", context.openFavorites, ""],
      ["cart", "Корзина", String(totals.count), money(totals.subtotal), context.openCart, "is-green"],
      ["reviews", "Ждут оценки", String(reviewableItems.length), "Отзывы и вопросы", () => setSection("reviews", context), ""],
      ["addresses", "Доставка", totals.completion.missing.includes("адрес") ? "Нужен адрес" : "Готово", "Адреса и контакты", () => setSection("addresses", context), ""]
    ].forEach((item) => quick.append(summaryCard(...item)));

    ordersPreview.append(sectionHeader("Активные заказы", "Самые важные статусы и действия по текущим заказам."));
    if (activeOrders.length) {
      activeOrders.slice(0, 3).forEach((order) => ordersPreview.append(orderCard(order, context)));
    } else {
      ordersPreview.append(emptyState("Активных заказов нет", "Когда заказ будет оформлен, его статус появится здесь.", "Открыть каталог", context.openCatalog, "orders"));
    }

    favoritePreview.append(sectionHeader("Избранное", "Сохранённые товары для быстрого сравнения."));
    if (favorites.length) {
      favorites.slice(0, 4).forEach((product) => {
        favoritePreview.append(productMiniCard(product, money(product.price), "В корзину", () => context.addToCart(product.id), "Удалить", () => context.removeFavorite?.(product.id)));
      });
    } else {
      favoritePreview.append(emptyState("В избранном пока пусто", "Сохраняйте товары сердечком в каталоге.", "Перейти к товарам", context.openCatalog, "favorites"));
    }
    favoritePreview.append(actionRow("Смотреть все избранные", context.openFavorites, "favorites"));

    cartPreview.append(sectionHeader("Корзина", "Проверьте товары перед оформлением."));
    if (cartRows.length) {
      cartRows.slice(0, 3).forEach(({ product, quantity }) => {
        cartPreview.append(productMiniCard(product, `${quantity} шт. · ${money(product.price * quantity)}`, "Изменить", context.openCart, "Удалить", () => context.removeFromCart?.(product.id)));
      });
      cartPreview.append(el("strong", "sona-profile-total", `Итого: ${money(totals.subtotal)}`), dualActions("Перейти в корзину", context.openCart, "Оформить заказ", context.checkout));
    } else {
      cartPreview.append(emptyState("Корзина пока пустая", "Добавьте товары из каталога, чтобы оформить заказ.", "Перейти к товарам", context.openCatalog, "cart"));
    }

    support.append(
      sectionHeader("Поддержка", "Связь с Soна по заказам, доставке и подбору мебели."),
      el("p", "", "Чат подхватит контекст профиля, а по телефону можно быстро уточнить детали заказа."),
      dualActions("Написать", context.openSupportChat || (() => setSection("support", context)), "Позвонить", () => window.location.href = "tel:88002004090")
    );

    wrap.append(
      nextStepCard(context),
      taskRail(context),
      quick,
      ordersPreview,
      cartPreview,
      favoritePreview,
      panelWithProducts("Недавно смотрели", recent, context),
      support
    );
    return wrap;
  }

  function orderCard(rawOrder, context) {
    const order = window.SonaOrders?.normalize(rawOrder) || rawOrder;
    const row = el("article", "sona-order-card");
    const head = el("div", "sona-order-card__head");
    const title = el("div");
    const status = el("span", "sona-order-status", window.SonaOrders?.statusLabel(order) || "Доставляется");
    const items = el("div", "sona-order-items");
    const footer = el("div", "sona-order-card__footer");
    const actions = el("div", "sona-order-card__actions");

    status.dataset.tone = window.SonaOrders?.statusTone(order) || "progress";
    title.append(el("strong", "", `Заказ ${order.id || ""}`), el("small", "", order.date || formatDate(order.createdAt)));
    head.append(title, status);

    (order.items || []).forEach((item) => {
      const product = context.byId(item.id);
      const productRow = el("div", "sona-order-item");
      productRow.append(
        el("strong", "", product?.name || item.id),
        el("span", "", `${Number(item.quantity) || 1} шт.`)
      );
      items.append(productRow);
    });

    if (!window.SonaOrders?.isCompleted(order)) {
      actions.append(button("sona-profile-primary", "Подтвердить получение", () => context.completeOrder(order.id)));
    } else {
      actions.append(el("span", "sona-order-lock", "Заказ сохранён в истории"));
    }
    footer.append(el("strong", "", money(order.total)), actions);
    row.append(head, items, footer);
    return row;
  }

  function reviewRequestRow(entry, context) {
    const row = el("article", "sona-review-request");
    const head = el("div", "sona-review-request__head");
    const form = el("form", "sona-review-form");
    const ratingLabel = el("label", "", "Оценка");
    const rating = el("select");
    const textLabel = el("label", "", "Отзыв");
    const text = el("textarea");
    const actions = el("div", "sona-review-form__actions");
    const submit = el("button", "sona-profile-primary", "Опубликовать отзыв");

    [5, 4, 3, 2, 1].forEach((value) => {
      const option = el("option", "", `${value} из 5`);
      option.value = String(value);
      rating.append(option);
    });

    text.placeholder = "Расскажите о качестве, доставке и впечатлениях от товара";
    submit.type = "submit";
    head.append(
      el("strong", "", entry.product.name),
      el("small", "", `Заказ ${entry.order.id} · ${entry.order.date}`)
    );
    ratingLabel.append(rating);
    textLabel.append(text);
    actions.append(submit);
    form.append(ratingLabel, textLabel, actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = text.value.trim();
      if (!value) {
        text.focus();
        return;
      }
      context.createReview({
        orderId: entry.order.id,
        productId: entry.product.id,
        rating: rating.value,
        text: value
      });
    });

    row.append(head, form);
    return row;
  }

  function publishedReviewRow(review, context) {
    const product = context.byId(review.productId);
    const card = el("article", "sona-review-published");
    const head = el("div", "sona-review-published__head");
    const rating = Number(review.rating) || 5;
    const stars = "★★★★★".slice(0, rating);
    const date = window.SonaReviews?.displayMoment(review) || review.date || "";

    head.append(el("strong", "", product?.name || "Товар Soна"), el("span", "", date));
    card.append(head, el("b", "", `${stars} ${rating}/5`), el("p", "", review.text || ""));
    return card;
  }

  function sessionTime(value) {
    if (!value) return "нет данных";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "нет данных";
    return date.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function sessionRow(session, context) {
    const current = session.id === context.currentDeviceId;
    const row = el("article", `sona-session-row${current ? " is-current" : ""}`);
    const iconBox = el("span", "sona-profile-row__icon");
    const body = el("div", "sona-profile-row__body");
    const status = el("span", "sona-session-status", current ? "Текущее устройство" : "Активный сеанс");
    const action = button(
      current ? "sona-profile-soft sona-profile-danger" : "sona-profile-soft",
      current ? "Выйти здесь" : "Завершить сеанс",
      () => context.endSession(session.id),
      current ? "logout" : "shield"
    );

    iconBox.append(iconSvg(current ? "user" : "shield"));
    body.append(
      el("span", "", session.title || `${session.browser || "Браузер"} · ${session.platform || "Устройство"}`),
      el("strong", "", current ? "Это устройство" : "Другое устройство"),
      el("small", "", `Последняя активность: ${sessionTime(session.lastSeenAt || session.createdAt)}`)
    );
    row.append(iconBox, body, status, action);
    return row;
  }

  function renderSettingsSection(context) {
    const { data, sessions } = context;
    const panel = el("section", "sona-profile-panel sona-profile-wide");
    const profileRows = [
      infoRow("Имя", safeText(data.profile?.name, "Не указано"), "user", "Изменить", context.openEdit),
      infoRow("Email", safeText(data.profile?.email, "Не указан"), "settings", "Изменить", context.openEdit),
      infoRow("Телефон", safeText(data.profile?.phone, "Не указан"), "support", "Изменить", context.openEdit),
      infoRow("Уведомления", "Статусы заказов включены", "bell")
    ];
    const sessionList = sessions.length ? sessions : [{
      id: context.currentDeviceId,
      email: data.profile?.email || "",
      title: deviceLabel(),
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    }];

    panel.append(sectionHeader("Настройки", "Данные профиля, вход и активные устройства.", [
      button("sona-profile-soft sona-profile-danger", "Выйти", context.logout, "logout")
    ]));
    profileRows.forEach((row) => panel.append(row));
    panel.append(el("h3", "sona-profile-subtitle", "Активные сеансы"));
    sessionList.forEach((session) => panel.append(sessionRow(session, context)));
    return panel;
  }

  function panelWithProducts(title, products, context) {
    const panel = el("section", "sona-profile-panel sona-profile-wide");
    panel.append(sectionHeader(title, "Быстрый доступ к товарам из текущей витрины."));
    const grid = el("div", "sona-profile-small-grid");
    products.forEach((product) => {
      grid.append(productMiniCard(product, money(product.price), "В корзину", () => context.addToCart(product.id)));
    });
    if (!products.length) {
      grid.append(emptyState("Подборка пока пустая", "Каталог загрузится после обновления витрины.", "Открыть каталог", context.openCatalog, "catalog"));
    }
    panel.append(grid);
    return panel;
  }

  function listPanel(title, description, rows, emptyText, actions = []) {
    const panel = el("section", "sona-profile-panel sona-profile-wide");
    panel.append(sectionHeader(title, description, actions));
    if (rows.length) {
      rows.forEach((row) => panel.append(row));
    } else {
      panel.append(el("p", "sona-profile-muted", emptyText));
    }
    return panel;
  }

  function renderReviewsSection(context) {
    const panel = el("section", "sona-profile-panel sona-profile-wide");
    const requests = context.reviewableItems.map((entry) => reviewRequestRow(entry, context));
    const published = (context.reviews || []).map((review) => publishedReviewRow(review, context));

    panel.append(sectionHeader("Отзывы и вопросы", "Отзыв можно оставить только после подтверждения получения заказа."));
    if (requests.length) {
      panel.append(el("h3", "sona-profile-subtitle", "Ждут отзыва"));
      requests.forEach((row) => panel.append(row));
    } else {
      panel.append(emptyState("Пока нечего оценивать", "После полученного заказа здесь появится форма отзыва.", "Перейти к покупкам", () => setSection("purchases", context), "reviews"));
    }

    if (published.length) {
      panel.append(el("h3", "sona-profile-subtitle", "Опубликованные отзывы"));
      published.forEach((row) => panel.append(row));
    }

    return panel;
  }

  function renderOrdersSection(context) {
    const active = context.activeOrders.map((order) => orderCard(order, context));
    const history = context.orders.filter((order) => !context.activeOrders.includes(order)).map((order) => orderCard(order, context));
    const panel = el("section", "sona-profile-panel sona-profile-wide");
    panel.append(sectionHeader("Заказы", "Статусы, даты и суммы заказов.", [
      button("sona-profile-soft", "В каталог", context.openCatalog, "catalog")
    ]));
    if (active.length) {
      panel.append(el("h3", "sona-profile-subtitle", "В работе"));
      active.forEach((row) => panel.append(row));
    }
    if (history.length) {
      panel.append(el("h3", "sona-profile-subtitle", "История"));
      history.forEach((row) => panel.append(row));
    }
    if (!active.length && !history.length) {
      panel.append(emptyState("Заказов пока нет", "Оформите первый заказ, и здесь появится понятная история.", "Открыть каталог", context.openCatalog, "orders"));
    }
    return panel;
  }

  function renderSimpleSection(context) {
    const { favorites, cartRows, orders, completedOrders, totals, data } = context;

    if (activeSection === "orders") return renderOrdersSection(context);
    if (activeSection === "reviews") return renderReviewsSection(context);

    if (activeSection === "purchases") {
      return listPanel(
        "Покупки",
        `Завершённые покупки на сумму ${money(totals.spent)}.`,
        completedOrders.map((order) => orderCard(order, context)),
        "Покупок пока нет.",
        [button("sona-profile-soft", "Перейти в каталог", context.openCatalog, "catalog")]
      );
    }

    if (activeSection === "favorites") {
      const panel = listPanel(
        "Избранное",
        "Все товары, которые вы сохранили.",
        favorites.map((product) => productMiniCard(product, money(product.price), "В корзину", () => context.addToCart(product.id), "Удалить", () => context.removeFavorite?.(product.id))),
        "В избранном пока пусто.",
        [button("sona-profile-soft", "Открыть страницу избранного", context.openFavorites, "favorites")]
      );
      return panel;
    }

    if (activeSection === "cart") {
      const panel = listPanel(
        "Корзина",
        `Товаров: ${totals.count}. Итого: ${money(totals.subtotal)}.`,
        cartRows.map(({ product, quantity }) => productMiniCard(product, `${quantity} шт. · ${money(product.price * quantity)}`, "Перейти", context.openCart, "Удалить", () => context.removeFromCart?.(product.id))),
        "Корзина пока пустая.",
        [button("sona-profile-soft", "Перейти к товарам", context.openCatalog, "catalog")]
      );
      panel.append(dualActions("Открыть корзину", context.openCart, "Оформить заказ", context.checkout));
      return panel;
    }

    if (activeSection === "addresses") {
      return listPanel("Адреса доставки", "Сохранённые данные для быстрых заказов.", [
        infoRow("Основной адрес", safeText(data.profile?.address, "Адрес пока не указан"), "addresses", "Изменить", context.openEdit),
        infoRow("Телефон для связи", safeText(data.profile?.phone, "Телефон не указан"), "support", "Изменить", context.openEdit)
      ], "Адрес пока не указан.");
    }

    if (activeSection === "payments") {
      return listPanel("Способы оплаты", "Оплата в демо-версии не хранит платёжные данные.", [
        infoRow("Банковская карта", "Не привязана", "payments"),
        infoRow("Безопасность", "Данные карты не запрашиваются", "shield")
      ], "Способы оплаты пока не добавлены.");
    }

    if (activeSection === "support") {
      const panel = listPanel("Поддержка", "Связь с Soна по заказам и товарам.", [
        infoRow("Телефон", "8 800 200-40-90", "support", "Позвонить", () => window.location.href = "tel:88002004090"),
        infoRow("Чат", "Ответим в рабочее время", "reviews", "Написать", context.openSupportChat || (() => {})),
        infoRow("Заказы", orders.length ? `${orders.length} в профиле` : "Заказов пока нет", "orders", "Открыть", () => setSection("orders", context))
      ], "Служба поддержки доступна.");
      return panel;
    }

    if (activeSection === "settings") {
      return renderSettingsSection(context);
      return listPanel("Настройки", "Уведомления и данные профиля.", [
        infoRow("Имя", safeText(data.profile?.name, "Не указано"), "user", "Изменить", context.openEdit),
        infoRow("Email", safeText(data.profile?.email, "Не указан"), "settings", "Изменить", context.openEdit),
        infoRow("Телефон", safeText(data.profile?.phone, "Не указан"), "support", "Изменить", context.openEdit),
        infoRow("Уведомления", "Статусы заказов включены", "bell")
      ], "Настройки пока пустые.", [button("sona-profile-soft sona-profile-danger", "Выйти", context.logout, "logout")]);
    }

    if (activeSection === "returns") {
      return listPanel("Возвраты", "Заявки на возврат и обмен.", [
        infoRow("Как оформить", "Напишите в поддержку и укажите номер заказа", "returns", "Поддержка", () => setSection("support", context)),
        infoRow("Срок рассмотрения", "Обычно 1-2 рабочих дня", "calendar")
      ], "Возвратов пока нет.");
    }

    return renderHome(context);
  }

  function buildContext(options) {
    const data = options.data;
    const products = options.products || [];
    const byId = options.byId;
    const favorites = (data.favorites || []).map(byId).filter(Boolean);
    const cartRows = Object.entries(data.cart || {})
      .map(([id, quantity]) => ({ product: byId(id), quantity: Number(quantity) || 0 }))
      .filter((row) => row.product && row.quantity > 0);
    const orders = Array.isArray(data.orders) ? data.orders.slice().reverse() : [];
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    const reviewableItems = window.SonaOrders?.reviewableItems(orders, reviews, byId) || [];
    const completedOrders = window.SonaOrders?.completedOrders(orders) || orders.filter((order) => order.status === "completed");
    const totals = getTotals(cartRows, orders, data.profile || {});
    const activeOrders = totals.activeOrders;
    const currentId = currentDeviceId();
    const email = String(data.profile?.email || "").toLowerCase();
    const sessions = (data.accountSessions || [])
      .filter((session) => !email || session.email === email)
      .sort((a, b) => String(b.lastSeenAt || b.createdAt || "").localeCompare(String(a.lastSeenAt || a.createdAt || "")));

    return {
      ...options,
      data,
      products,
      favorites,
      cartRows,
      orders,
      reviews,
      completedOrders,
      activeOrders,
      reviewableItems,
      sessions,
      currentDeviceId: currentId,
      totals
    };
  }

  function render(options) {
    const restoredData = restoreLocalAuth(options.data);
    const context = buildContext({ ...options, data: restoredData });
    const container = context.container;
    const activeEmail = String(context.data.profile?.email || "").toLowerCase();
    const knownSessions = (context.data.accountSessions || []).filter((session) => session.email === activeEmail);

    if (context.data.profile?.isActive && knownSessions.length && !knownSessions.some((session) => session.id === context.currentDeviceId)) {
      clearLocalAuth();
      window.SonaStore.clearProfile();
      container.replaceChildren(renderLogin({ ...context, data: window.SonaStore.read() }));
      return;
    }

    if (!context.data.profile?.isActive) {
      container.replaceChildren(renderLogin(context));
      return;
    }

    const content = activeSection === "home" ? renderHome(context) : renderSimpleSection(context);
    container.replaceChildren(renderShell(context, content));
  }

  window.SonaProfile = {
    render,
    currentDeviceId,
    clearLocalAuth,
    setSection(section) {
      activeSection = section || "home";
    }
  };
})();
