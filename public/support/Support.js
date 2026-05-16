(function () {
  "use strict";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = window.SonaText?.fix(text) || String(text);
    return node;
  }

  function nowLabel(value) {
    const time = Number(value) || Date.now();
    return new Date(time).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function authorName(profile) {
    const name = String(profile?.name || "").trim();
    if (name) return name;
    const phone = String(profile?.phone || "").trim();
    if (phone) return phone;
    const email = String(profile?.email || "").trim();
    if (email) return email;
    return "Гость Soна";
  }

  function addMessage(text, source = "chat") {
    const clean = window.SonaSecurity?.sanitizeText(text, 700) || String(text || "").trim().slice(0, 700);
    if (!clean) return false;

    window.SonaStore.update((data) => {
      data.supportMessages = [
        ...(data.supportMessages || []),
        {
          id: `SUP-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
          role: "user",
          author: authorName(data.profile),
          phone: data.profile?.phone || "",
          email: data.profile?.email || "",
          text: clean,
          source,
          createdAt: Date.now(),
          status: "new"
        }
      ];
    });

    return true;
  }

  function addAdminReply(text, target = {}) {
    const clean = window.SonaSecurity?.sanitizeText(text, 700) || String(text || "").trim().slice(0, 700);
    if (!clean) return false;

    window.SonaStore.update((data) => {
      data.supportMessages = [
        ...(data.supportMessages || []),
        {
          id: `ADM-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
          role: "admin",
          author: "Поддержка Soна",
          phone: target.phone || "",
          email: target.email || "",
          text: clean,
          source: "admin",
          createdAt: Date.now(),
          status: "sent"
        }
      ];
    });

    return true;
  }

  function renderMessages(messages) {
    const list = el("div", "sona-support-messages");
    const rows = Array.isArray(messages) ? messages : [];

    if (!rows.length) {
      list.append(el("p", "sona-support-empty", "Напишите нам, и поддержка Soна ответит здесь."));
      return list;
    }

    rows.slice(-30).forEach((message) => {
      const bubble = el("article", `sona-support-message is-${message.role === "admin" ? "admin" : "user"}`);
      bubble.append(
        el("strong", "", message.author || (message.role === "admin" ? "Поддержка Soна" : "Покупатель")),
        el("p", "", message.text || ""),
        el("span", "", nowLabel(message.createdAt))
      );
      list.append(bubble);
    });

    return list;
  }

  function renderWidget(options = {}) {
    const container = options.container;
    if (!container) return;

    const data = window.SonaStore.read();
    const root = el("div", "sona-support-widget");
    const launcher = el("button", "sona-support-launcher");
    const panel = el("section", "sona-support-panel");
    const head = el("div", "sona-support-head");
    const close = el("button", "sona-support-close", "×");
    const form = el("form", "sona-support-form");
    const input = el("textarea");
    const send = el("button", "", "Отправить");

    launcher.type = "button";
    launcher.setAttribute("aria-label", "Открыть чат поддержки");
    launcher.setAttribute("aria-expanded", "false");
    launcher.append(el("span", "", "?"), el("strong", "", "Поддержка"));
    launcher.addEventListener("click", () => {
      root.classList.toggle("is-open");
      launcher.setAttribute("aria-expanded", String(root.classList.contains("is-open")));
    });

    close.type = "button";
    close.setAttribute("aria-label", "Свернуть чат поддержки");
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      root.classList.remove("is-open");
      launcher.setAttribute("aria-expanded", "false");
    });

    head.append(el("div", "", ""), close);
    head.firstChild.append(
      el("strong", "", "Чат поддержки"),
      el("span", "", "Ответ появится в этом окне")
    );

    input.placeholder = "Опишите вопрос по заказу, доставке или товару";
    send.type = "submit";
    form.append(input, send);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!addMessage(input.value, "widget")) {
        input.focus();
        return;
      }
      input.value = "";
      renderWidget(options);
      options.onChange?.();
      window.requestAnimationFrame(() => {
        const widget = container.querySelector(".sona-support-widget");
        const button = container.querySelector(".sona-support-launcher");
        widget?.classList.add("is-open");
        button?.setAttribute("aria-expanded", "true");
      });
    });

    panel.append(head, renderMessages(data.supportMessages), form);
    root.append(launcher, panel);
    container.replaceChildren(root);
  }

  window.SonaSupport = {
    addMessage,
    addAdminReply,
    renderWidget,
    renderMessages,
    nowLabel
  };
})();
