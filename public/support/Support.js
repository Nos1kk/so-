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

  function supportIcon() {
    const wrap = el("span");
    wrap.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 6.5h13v8.2h-7.1l-3.8 3.1v-3.1H5.5z"/><path d="M8.3 10.5h.1M12 10.5h.1M15.7 10.5h.1"/></svg>';
    return wrap;
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

  function isProfileActive(data) {
    return Boolean(data?.profile?.isActive);
  }

  function cleanFileName(name) {
    return (window.SonaSecurity?.sanitizeText(name, 120) || String(name || "file").trim().slice(0, 120)) || "file";
  }

  function formatFileSize(size) {
    const value = Number(size) || 0;
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} МБ`;
    if (value >= 1024) return `${Math.ceil(value / 1024)} КБ`;
    return `${value} Б`;
  }

  function readAttachment(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        name: cleanFileName(file.name),
        type: file.type || "application/octet-stream",
        size: file.size || 0,
        dataUrl: String(reader.result || "")
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function prepareAttachments(files) {
    const selected = Array.from(files || []).slice(0, 3);
    const allowed = selected.filter((file) => file.size <= 6 * 1024 * 1024);
    return Promise.all(allowed.map(readAttachment));
  }

  function addMessage(text, source = "chat", attachments = []) {
    const clean = window.SonaSecurity?.sanitizeText(text, 700) || String(text || "").trim().slice(0, 700);
    const cleanAttachments = Array.isArray(attachments) ? attachments.filter((item) => item?.dataUrl).slice(0, 3) : [];
    if (!clean && !cleanAttachments.length) return false;

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
          attachments: cleanAttachments,
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
      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      const attachmentList = el("div", "sona-support-attachments");

      attachments.forEach((attachment) => {
        const link = el("a", attachment.type?.startsWith("image/") ? "sona-support-file is-image" : "sona-support-file");
        link.href = attachment.dataUrl || "#";
        link.download = attachment.name || "file";
        link.target = "_blank";
        link.rel = "noopener";
        if (attachment.type?.startsWith("image/")) {
          const image = document.createElement("img");
          image.src = attachment.dataUrl;
          image.alt = attachment.name || "";
          link.append(image);
        }
        link.append(el("span", "", `${attachment.name || "file"} · ${formatFileSize(attachment.size)}`));
        attachmentList.append(link);
      });
      bubble.append(
        el("strong", "", message.author || (message.role === "admin" ? "Поддержка Soна" : "Покупатель")),
        el("p", "", message.text || "")
      );
      if (attachments.length) bubble.append(attachmentList);
      bubble.append(el("span", "", nowLabel(message.createdAt)));
      list.append(bubble);
    });

    return list;
  }

  function renderWidget(options = {}) {
    const container = options.container;
    if (!container) return;

    const wasOpen = Boolean(container.querySelector(".sona-support-widget.is-open"));
    const data = window.SonaStore.read();
    const canUseChat = isProfileActive(data);
    const root = el("div", "sona-support-widget");
    const launcher = el("button", "sona-support-launcher");
    const panel = el("section", "sona-support-panel");
    const head = el("div", "", "");
    const headWrap = el("div", "sona-support-head");
    const close = el("button", "sona-support-close", "×");
    const form = el("form", `sona-support-form${canUseChat ? "" : " is-login-required"}`);
    const input = el("textarea");
    const fileInput = document.createElement("input");
    const attach = el("button", `sona-support-attach${canUseChat ? "" : " is-login-required"}`);
    const notice = el("p", "sona-support-form-note", canUseChat ? "Можно прикрепить до 3 файлов или фото." : "Войдите в аккаунт, чтобы писать в поддержку.");
    const send = el("button", "sona-support-send", canUseChat ? "Отправить" : "Войти");

    const openProfile = () => document.getElementById("profileButton")?.click();
    const renderAttachIcon = (count = 0) => {
      attach.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.7 12.6l5.8-5.8a3 3 0 114.2 4.2l-7.2 7.2a5 5 0 01-7.1-7.1l7.6-7.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="sona-support-attach-count"></span>';
      const badge = attach.querySelector(".sona-support-attach-count");
      if (badge) {
        badge.textContent = String(Math.min(count, 3));
        badge.hidden = !count;
      }
    };

    function setOpen(open) {
      root.classList.toggle("is-open", open);
      document.body.classList.toggle("support-chat-open", open);
      panel.hidden = !open;
      panel.setAttribute("aria-hidden", String(!open));
      panel.style.display = open ? "grid" : "";
      launcher.setAttribute("aria-expanded", String(open));
      if (open && canUseChat) {
        window.requestAnimationFrame(() => input.focus({ preventScroll: true }));
      }
    }

    launcher.type = "button";
    launcher.setAttribute("aria-label", "Открыть чат поддержки");
    launcher.setAttribute("aria-expanded", "false");
    launcher.append(supportIcon(), el("strong", "", "Помощь"));
    launcher.addEventListener("click", () => {
      setOpen(!root.classList.contains("is-open"));
    });

    close.type = "button";
    close.setAttribute("aria-label", "Свернуть чат поддержки");
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpen(false);
    });

    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-hidden", "true");

    headWrap.append(head, close);
    head.append(
      el("strong", "", "Чат поддержки"),
      el("span", "", canUseChat ? "Ответ появится в этом окне" : "Войдите, чтобы начать диалог")
    );

    input.placeholder = canUseChat ? "Опишите вопрос по заказу, доставке или товару" : "Войдите в аккаунт, чтобы написать";
    input.readOnly = !canUseChat;
    if (!canUseChat) {
      input.classList.add("is-login-required");
      input.addEventListener("focus", openProfile);
      input.addEventListener("click", openProfile);
    }

    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,.doc,.docx,.xls,.xlsx";
    fileInput.multiple = true;
    fileInput.hidden = true;
    attach.type = "button";
    attach.setAttribute("aria-label", canUseChat ? "Прикрепить файл или фотографию" : "Войдите в аккаунт");
    renderAttachIcon();
    attach.addEventListener("click", () => {
      if (!canUseChat) {
        openProfile();
        return;
      }
      fileInput.click();
    });
    fileInput.addEventListener("change", () => {
      renderAttachIcon(fileInput.files?.length || 0);
    });

    send.type = "submit";
    form.append(input, fileInput, attach, send, notice);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!canUseChat) {
        openProfile();
        return;
      }

      const attachments = await prepareAttachments(fileInput.files);
      if (!addMessage(input.value, "widget", attachments)) {
        input.focus();
        return;
      }

      input.value = "";
      fileInput.value = "";
      renderAttachIcon();
      const currentList = panel.querySelector(".sona-support-messages");
      const nextList = renderMessages(window.SonaStore.read().supportMessages);
      currentList?.replaceWith(nextList);
      root.classList.add("is-open");
      document.body.classList.add("support-chat-open");
      panel.hidden = false;
      panel.style.display = "grid";
      panel.setAttribute("aria-hidden", "false");
      launcher.setAttribute("aria-expanded", "true");
      nextList.scrollTop = nextList.scrollHeight;
      options.onChange?.();
    });

    panel.append(headWrap, renderMessages(data.supportMessages), form);
    root.append(launcher, panel);
    container.replaceChildren(root);
    setOpen(wasOpen);
  }

  window.SonaSupport = {
    addMessage,
    addAdminReply,
    renderWidget,
    renderMessages,
    nowLabel
  };
})();
