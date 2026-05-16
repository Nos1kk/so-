(function () {
  "use strict";

  const menuItems = [
    ["home", "Главная"],
    ["orders", "Заказы"],
    ["purchases", "Покупки"],
    ["favorites", "Избранное"],
    ["cart", "Корзина"],
    ["reviews", "Отзывы и вопросы"],
    ["returns", "Возвраты"],
    ["payments", "Способы оплаты"],
    ["addresses", "Адреса доставки"],
    ["promocodes", "Промокоды"],
    ["support", "Поддержка"],
    ["settings", "Настройки"],
    ["logout", "Выйти"]
  ];

  let activeSection = "home";
  let loginPhone = "";
  let loginCodeSent = false;
  let loginError = "";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = window.SonaText?.fix(text) || String(text);
    return node;
  }

  function fixed(value) {
    return window.SonaText?.fix(value) || String(value ?? "");
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function createSmsCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function pendingAuth() {
    try {
      return JSON.parse(sessionStorage.getItem("sona.auth.pending") || "null");
    } catch (error) {
      return null;
    }
  }

  function setPendingAuth(phone, code) {
    sessionStorage.setItem("sona.auth.pending", JSON.stringify({
      phone,
      code,
      createdAt: Date.now()
    }));
  }

  function clearPendingAuth() {
    sessionStorage.removeItem("sona.auth.pending");
  }

  async function requestSmsCode(phone) {
    const response = await fetch("/api/auth/request-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });
    return response.json();
  }

  async function verifySmsCode(phone, code) {
    const response = await fetch("/api/auth/verify-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code })
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
      promocodes: ["M20 12 12 20 4 12l8-8 8 8Z", "M9 15l6-6", "M9.3 9.3h.1", "M14.7 14.7h.1"],
      support: ["M5 13v-1a7 7 0 0 1 14 0v1", "M5 13h3v5H5z", "M16 13h3v5h-3z", "M14 20h-2"],
      settings: ["M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z", "M19 12h2", "M3 12h2", "M12 3v2", "M12 19v2", "M17 5.8l-1.4 1.4", "M8.4 16.8 7 18.2", "M7 5.8l1.4 1.4", "M15.6 16.8l1.4 1.4"],
      logout: ["M9 5H5v14h4", "M13 8l4 4-4 4", "M8 12h9"],
      bonus: ["M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8L6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3Z"],
      rating: ["M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.3l5-.7L12 3Z"]
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

  function money(value) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function safeText(value, fallback = "") {
    return String(value || fallback).trim();
  }

  function getTotals(cartRows, orders) {
    const count = cartRows.reduce((sum, row) => sum + row.quantity, 0);
    const subtotal = cartRows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
    const completedOrders = orders.filter((order) => window.SonaOrders?.isCompleted(order) || order.status === "completed");
    const spent = completedOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const bonusPoints = Math.round(spent * 0.03);
    const level = bonusPoints >= 20000 ? "Premium" : bonusPoints >= 8000 ? "Gold" : "Silver";
    const progress = level === "Premium" ? 100 : Math.min(100, Math.max(8, Math.round((bonusPoints % 8000) / 80)));

    return { count, subtotal, spent, bonusPoints, level, progress };
  }

  function productThumb(product) {
    const thumb = el("div", "sona-profile-thumb");
    thumb.append(
      el("span", "", product.marketSection || "SONA"),
      el("strong", "", product.name)
    );
    return thumb;
  }

  function productMiniCard(product, meta, actionText, onAction) {
    const card = el("article", "sona-profile-product");
    const body = el("div", "sona-profile-product__body");
    const title = el("strong", "", product.name);
    const note = el("span", "", meta);
    const button = el("button", "sona-profile-soft", actionText);

    button.type = "button";
    button.addEventListener("click", onAction);
    body.append(title, note);
    card.append(productThumb(product), body, button);
    return card;
  }

  function emptyState(title, text, buttonText, onClick) {
    const box = el("div", "sona-profile-empty");
    const mark = el("div", "sona-profile-empty__mark", "Soна");
    const heading = el("strong", "", title);
    const copy = el("span", "", text);
    const button = el("button", "sona-profile-primary", buttonText);

    button.type = "button";
    button.addEventListener("click", onClick);
    box.append(mark, heading, copy, button);
    return box;
  }

  function sectionCard(icon, title, value, text, onClick) {
    const card = el("button", "sona-profile-quick");
    const iconBox = el("span", "sona-profile-quick__icon");

    iconBox.append(iconSvg(icon));
    card.type = "button";
    card.append(
      iconBox,
      el("strong", "", title),
      el("b", "", value),
      el("small", "", text)
    );
    card.addEventListener("click", onClick);
    return card;
  }

  function renderLogin(context) {
    const pending = pendingAuth();
    const root = el("section", "sona-login");
    const card = el("div", "sona-login-card");
    const form = el("form", "sona-login-form");
    const phoneLabel = el("label", "", "Телефон");
    const phoneInput = el("input");
    const codeLabel = el("label", "", "SMS-код");
    const codeInput = el("input");
    const button = el("button", "sona-profile-primary", loginCodeSent ? "Войти" : "Получить SMS-код");
    const note = el("p", "sona-profile-muted", "Вход и регистрация выполняются по номеру телефона. После подтверждения откроется личный кабинет Soна.");

    phoneInput.type = "tel";
    phoneInput.placeholder = "+7 900 000-00-00";
    phoneInput.value = loginPhone;
    phoneInput.autocomplete = "tel";

    codeInput.inputMode = "numeric";
    codeInput.placeholder = "0000";
    codeInput.maxLength = 4;
    codeInput.hidden = !loginCodeSent;
    codeLabel.hidden = !loginCodeSent;
    button.type = "submit";

    phoneLabel.append(phoneInput);
    codeLabel.append(codeInput);
    form.append(phoneLabel, codeLabel, button);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const phone = phoneInput.value.trim();
      const digits = phoneDigits(phone);

      if (!loginCodeSent) {
        if (digits.length < 10) {
          loginError = "Введите корректный номер телефона.";
          render(context);
          return;
        }

        try {
          const result = await requestSmsCode(phone);
          if (!result.ok) {
            loginError = "Не удалось отправить SMS. Проверьте номер.";
            render(context);
            return;
          }

          loginPhone = phone;
          loginCodeSent = true;
          if (result.demo && result.devCode) {
            loginError = `Демо-код: ${result.devCode}. Для настоящей SMS укажите SMSRU_API_ID при запуске сервера.`;
            setPendingAuth(phone, result.devCode);
          } else {
            loginError = "SMS-код отправлен на указанный номер.";
          }
          render(context);
        } catch (error) {
          const code = createSmsCode();
          loginPhone = phone;
          loginCodeSent = true;
          loginError = `Демо-код: ${code}. Сервер SMS недоступен, включён локальный режим.`;
          setPendingAuth(phone, code);
          render(context);
        }
        return;
      }

      try {
        const result = await verifySmsCode(loginPhone, codeInput.value.trim());
        if (!result.ok) {
          throw new Error("Wrong code");
        }
      } catch (error) {
        if (!pending || pending.phone !== loginPhone || codeInput.value.trim() !== pending.code) {
          loginError = "Неверный SMS-код.";
          render(context);
          return;
        }
      }

      window.SonaStore.update((data) => {
        const role = window.SonaAdmin?.ADMIN_PHONE && phoneDigits(loginPhone).endsWith(window.SonaAdmin.ADMIN_PHONE.slice(1)) ? "admin" : "user";
        data.profile = {
          ...(data.profile || {}),
          isActive: true,
          phone: loginPhone,
          role,
          registeredAt: data.profile?.registeredAt || new Date().toISOString()
        };
        if (role === "admin") {
          data.admin = { ...(data.admin || {}), isAuthenticated: true, phone: loginPhone };
          data.profile.name = data.profile.name || "Администратор Soна";
        }
        const userRow = {
          id: `USER-${phoneDigits(loginPhone)}`,
          name: data.profile.name || "Покупатель Soна",
          email: data.profile.email || "",
          phone: loginPhone,
          role,
          status: "active",
          registeredAt: data.profile.registeredAt
        };
        data.users = [
          ...(data.users || []).filter((user) => user.phone !== loginPhone),
          userRow
        ];
      });

      loginCodeSent = false;
      loginPhone = "";
      loginError = "";
      clearPendingAuth();
      activeSection = "home";
      context.onAuthChange?.();
    });

    card.append(
      el("p", "sona-profile-label", "Вход в аккаунт"),
      el("h1", "", "Войти в Soна"),
      note,
      form
    );

    if (loginError) {
      card.append(el("p", loginCodeSent ? "sona-login-demo-code" : "sona-login-error", loginError));
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
    const root = el("div", "sona-profile");
    const header = el("section", "sona-profile-header");
    const avatar = el("div", "sona-profile-avatar", name.slice(0, 1).toUpperCase());
    const identity = el("div", "sona-profile-identity");
    const actions = el("div", "sona-profile-header__actions");
    const edit = el("button", "sona-profile-soft", "Редактировать профиль");
    const notify = el("button", "sona-profile-icon", "!");
    const deal = el("aside", "sona-profile-deal");
    const layout = el("div", "sona-profile-layout");
    const side = el("aside", "sona-profile-sidebar");
    const nav = el("nav", "sona-profile-menu");
    const main = el("main", "sona-profile-content");

    edit.type = "button";
    notify.type = "button";
    notify.setAttribute("aria-label", "Уведомления");
    edit.addEventListener("click", context.openEdit);

    identity.append(
      el("span", "sona-profile-label", `${totals.level} аккаунт`),
      el("h1", "", name),
      el("p", "", `${email} · ${phone}`)
    );
    actions.append(notify, edit);
    deal.append(
      el("span", "", `${totals.bonusPoints.toLocaleString("ru-RU")} бонусов`),
      el("strong", "", "Персональная скидка до 40%"),
      el("small", "", "Подборки и ранний доступ к акциям Soна")
    );
    header.append(avatar, identity, actions, deal);

    menuItems.forEach(([id, title, icon]) => {
      const item = el("button", "sona-profile-menu__item");
      const iconBox = el("span", "");

      iconBox.append(iconSvg(id));
      item.type = "button";
      item.classList.toggle("is-active", activeSection === id);
      item.append(iconBox, el("strong", "", title));
      item.addEventListener("click", () => {
        if (id === "logout") {
          context.logout();
          return;
        }
        activeSection = id;
        render(context);
      });
      nav.append(item);
    });

    side.append(nav);
    main.append(content);
    layout.append(side, main);
    root.append(header, layout);
    return root;
  }

  function renderBonus(totals) {
    const bonus = el("section", "sona-profile-bonus");
    const progress = el("div", "sona-profile-progress");
    const bar = el("i");
    const button = el("button", "sona-profile-soft", "Подробнее");

    button.type = "button";
    bar.style.width = `${totals.progress}%`;
    progress.append(bar);
    bonus.append(
      el("span", "sona-profile-label", "Бонусная программа Soна"),
      el("h2", "", `${totals.bonusPoints.toLocaleString("ru-RU")} баллов`),
      el("p", "", `${totals.level}: кешбэк за полученные покупки, персональные промокоды и приоритетная поддержка.`),
      progress,
      el("small", "", totals.level === "Premium" ? "Вы на максимальном уровне" : "Прогресс растёт после завершённых заказов"),
      button
    );
    return bonus;
  }

  function renderHome(context) {
    const { favorites, cartRows, orders, products, totals, reviewableItems } = context;
    const wrap = el("div", "sona-profile-main");
    const quick = el("section", "sona-profile-quick-grid");
    const recent = products.slice(0, 4);
    const favoritePreview = el("section", "sona-profile-panel");
    const ordersPreview = el("section", "sona-profile-panel");
    const cartPreview = el("section", "sona-profile-panel");
    const support = el("section", "sona-profile-panel sona-profile-support");

    [
      ["favorites", "Избранное", String(favorites.length), "Сохранённые товары", () => context.openFavorites()],
      ["purchases", "Покупки", "Смотреть", money(totals.spent), () => setSection("purchases", context)],
      ["rating", "Ждут оценки", "0", "Отзывы и вопросы", () => setSection("reviews", context)],
      ["cart", "Корзина", String(totals.count), money(totals.subtotal), () => context.openCart()],
      ["bonus", "Бонусы", totals.bonusPoints.toLocaleString("ru-RU"), totals.level, () => setSection("promocodes", context)],
      ["orders", "Заказы", String(orders.length), "История заказов", () => setSection("orders", context)]
    ].forEach((item) => {
      if (item[0] === "rating") item[2] = String(reviewableItems.length);
      quick.append(sectionCard(...item));
    });

    favoritePreview.append(el("h2", "", "Избранное"));
    if (favorites.length) {
      favorites.slice(0, 4).forEach((product) => {
        favoritePreview.append(productMiniCard(product, money(product.price), "В корзину", () => context.addToCart(product.id)));
      });
    } else {
      favoritePreview.append(emptyState("В избранном пока пусто", "Сохраняйте товары сердечком в каталоге.", "Перейти к товарам", context.openCatalog));
    }
    favoritePreview.append(actionRow("Смотреть все избранные", context.openFavorites));

    ordersPreview.append(el("h2", "", "Последние заказы"));
    if (orders.length) {
      orders.slice(0, 3).forEach((order) => ordersPreview.append(orderCard(order, context)));
    } else {
      ordersPreview.append(el("p", "sona-profile-muted", "Заказов пока нет. После оформления они появятся в этом блоке."));
    }

    cartPreview.append(el("h2", "", "Корзина"));
    if (cartRows.length) {
      cartRows.slice(0, 3).forEach(({ product, quantity }) => {
        cartPreview.append(productMiniCard(product, `${quantity} шт. · ${money(product.price * quantity)}`, "Изменить", context.openCart));
      });
      cartPreview.append(el("strong", "sona-profile-total", `Итого: ${money(totals.subtotal)}`), dualActions("Перейти в корзину", context.openCart, "Оформить заказ", context.checkout));
    } else {
      cartPreview.append(emptyState("Корзина пока пустая", "Добавьте товары из каталога, чтобы оформить заказ.", "Перейти к товарам", context.openCatalog));
    }

    support.append(
      el("h2", "", "Поддержка"),
      el("p", "", "Поможем с заказом, доставкой, возвратом и выбором мебели."),
      dualActions("Написать", context.openSupportChat || (() => setSection("support", context)), "Позвонить", () => window.location.href = "tel:88002004090")
    );

    wrap.append(quick, renderBonus(totals), panelWithProducts("Недавно смотрели", recent, context), ordersPreview, favoritePreview, cartPreview, support);
    return wrap;
  }

  function setSection(section, context) {
    activeSection = section;
    render(context);
  }

  function actionRow(text, action) {
    const row = el("div", "sona-profile-action-row");
    const button = el("button", "sona-profile-soft", text);
    button.type = "button";
    button.addEventListener("click", action);
    row.append(button);
    return row;
  }

  function dualActions(leftText, leftAction, rightText, rightAction) {
    const actions = el("div", "sona-profile-actions");
    const left = el("button", "sona-profile-soft", leftText);
    const right = el("button", "sona-profile-primary", rightText);
    left.type = "button";
    right.type = "button";
    left.addEventListener("click", leftAction);
    right.addEventListener("click", rightAction);
    actions.append(left, right);
    return actions;
  }

  function legacyOrderRow(order, index) {
    const row = el("article", "sona-profile-row");
    const statuses = ["РґРѕСЃС‚Р°РІР»СЏРµС‚СЃСЏ", "РІС‹РїРѕР»РЅРµРЅ", "РѕС‚РјРµРЅС‘РЅ"];
    row.append(
      el("span", "", `${order.date} В· ${statuses[index % statuses.length]}`),
      el("strong", "", money(order.total)),
      el("button", "sona-profile-soft", "РџРѕРґСЂРѕР±РЅРµРµ")
    );
    return row;
  }

  function orderCard(rawOrder, context) {
    const order = window.SonaOrders?.normalize(rawOrder) || rawOrder;
    const row = el("article", "sona-order-card");
    const head = el("div", "sona-order-card__head");
    const title = el("div");
    const status = el("span", "sona-order-status", window.SonaOrders?.statusLabel(order) || "Р”РѕСЃС‚Р°РІР»СЏРµС‚СЃСЏ");
    const items = el("div", "sona-order-items");
    const footer = el("div", "sona-order-card__footer");
    const actions = el("div", "sona-order-card__actions");

    status.dataset.tone = window.SonaOrders?.statusTone(order) || "progress";
    title.append(el("strong", "", `Заказ ${order.id || ""}`), el("small", "", order.date || ""));
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
      const complete = el("button", "sona-profile-primary", "Подтвердить получение");
      complete.type = "button";
      complete.addEventListener("click", () => context.completeOrder(order.id));
      actions.append(complete);
    }

    if (window.SonaOrders?.isCompleted(order)) {
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
      const option = el("option", "", `${value} в…`);
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

    head.append(
      el("strong", "", product?.name || "Товар Soна"),
      el("span", "", date)
    );
    card.append(
      head,
      el("b", "", `${stars} ${rating}/5`),
      el("p", "", review.text || "")
    );
    return card;
  }

  function renderReviewsSection(context) {
    const panel = el("section", "sona-profile-panel sona-profile-wide");
    const requests = context.reviewableItems.map((entry) => reviewRequestRow(entry, context));
    const published = (context.reviews || []).map((review) => publishedReviewRow(review, context));

    panel.append(
      el("h2", "", "Отзывы и вопросы"),
      el("p", "sona-profile-muted", "Отзыв можно оставить только после подтверждения получения заказа.")
    );

    if (requests.length) {
      panel.append(el("h3", "sona-profile-subtitle", "Ждут отзыва"));
      requests.forEach((row) => panel.append(row));
    } else {
      panel.append(el("p", "sona-profile-muted", "Пока нет товаров, ожидающих оценки."));
    }

    if (published.length) {
      panel.append(el("h3", "sona-profile-subtitle", "Опубликованные отзывы"));
      published.forEach((row) => panel.append(row));
    }

    return panel;
  }

  function panelWithProducts(title, products, context) {
    const panel = el("section", "sona-profile-panel sona-profile-wide");
    panel.append(el("h2", "", title));
    const grid = el("div", "sona-profile-small-grid");
    products.forEach((product) => {
      grid.append(productMiniCard(product, money(product.price), "В корзину", () => context.addToCart(product.id)));
    });
    panel.append(grid);
    return panel;
  }

  function listPanel(title, description, rows, emptyText) {
    const panel = el("section", "sona-profile-panel sona-profile-wide");
    panel.append(el("h2", "", title), el("p", "sona-profile-muted", description));
    if (rows.length) {
      rows.forEach((row) => panel.append(row));
    } else {
      panel.append(el("p", "sona-profile-muted", emptyText));
    }
    return panel;
  }

  function renderSimpleSection(context) {
    const { favorites, cartRows, orders, completedOrders, reviewableItems, totals, data } = context;

    if (activeSection === "reviews") {
      return renderReviewsSection(context);
    }

    if (activeSection === "purchases") {
      return listPanel(
        "Покупки",
        "Завершённые покупки. Бонусы начисляются только после получения заказа.",
        completedOrders.map((order) => orderCard(order, context)),
        "Покупок пока нет."
      );
    }

    if (activeSection === "orders") {
      return listPanel("Заказы", "Статусы, даты и суммы заказов.", orders.map((order) => orderCard(order, context)), "Заказов пока нет.");
    }
    if (activeSection === "purchases") {
      return listPanel("Покупки", "Завершённые покупки и общая сумма.", orders.map((order) => orderCard(order, context)), "Покупок пока нет.");
    }
    if (activeSection === "favorites") {
      const panel = listPanel("Избранное", "Все товары, которые вы сохранили.", favorites.map((product) => productMiniCard(product, money(product.price), "В корзину", () => context.addToCart(product.id))), "В избранном пока пусто.");
      panel.append(actionRow("Открыть полную страницу избранного", context.openFavorites));
      return panel;
    }
    if (activeSection === "cart") {
      const panel = listPanel("Корзина", `Товаров: ${totals.count}. Итого: ${money(totals.subtotal)}.`, cartRows.map(({ product, quantity }) => productMiniCard(product, `${quantity} шт. · ${money(product.price * quantity)}`, "Перейти", context.openCart)), "Корзина пока пустая.");
      panel.append(dualActions("Перейти к товарам", context.openCatalog, "Открыть корзину", context.openCart));
      return panel;
    }
    if (activeSection === "promocodes") {
      const panel = el("section", "sona-profile-panel sona-profile-wide");
      panel.append(renderBonus(totals), el("h2", "", "Промокоды"), el("p", "sona-profile-muted", "SONA15 активен для распродажи и персональных подборок."));
      return panel;
    }
    if (activeSection === "addresses") {
      return listPanel("Адреса доставки", "Сохранённые адреса для быстрых заказов.", [infoRow("Основной адрес", safeText(data.profile?.address, "Адрес пока не указан"))], "Адрес пока не указан.");
    }
    if (activeSection === "payments") {
      return listPanel("Способы оплаты", "Карты и другие способы оплаты.", [infoRow("Карта", "Не привязана")], "Способы оплаты пока не добавлены.");
    }
    if (activeSection === "support") {
      return listPanel("Поддержка", "Связь с Soна по заказам и товарам.", [infoRow("Телефон", "8 800 200-40-90"), infoRow("Чат", "Ответим в рабочее время")], "Служба поддержки доступна.");
    }
    if (activeSection === "settings") {
      return listPanel("Настройки", "Уведомления и данные профиля.", [
        infoRow("Уведомления", "Скидки и статусы заказов включены"),
        infoRow("Email", safeText(data.profile?.email, "Не указан")),
        infoRow("Телефон", safeText(data.profile?.phone, "Не указан"))
      ], "Настройки пока пустые.");
    }
    if (activeSection === "reviews") {
      return listPanel("Отзывы и вопросы", "Товары, которые ждут оценки.", [], "Пока нет товаров, ожидающих оценки.");
    }
    if (activeSection === "returns") {
      return listPanel("Возвраты", "Заявки на возврат и обмен.", [], "Возвратов пока нет.");
    }
    return renderHome(context);
  }

  function infoRow(label, value) {
    const row = el("article", "sona-profile-row");
    row.append(el("span", "", label), el("strong", "", value));
    return row;
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
    const totals = getTotals(cartRows, orders);

    return {
      ...options,
      data,
      products,
      favorites,
      cartRows,
      orders,
      reviews,
      completedOrders,
      reviewableItems,
      totals
    };
  }

  function render(options) {
    const context = buildContext(options);
    const container = context.container;

    if (!context.data.profile?.isActive) {
      container.replaceChildren(renderLogin(context));
      return;
    }

    const content = activeSection === "home" ? renderHome(context) : renderSimpleSection(context);

    container.replaceChildren(renderShell(context, content));
  }

  window.SonaProfile = {
    render,
    setSection(section) {
      activeSection = section || "home";
    }
  };
})();

