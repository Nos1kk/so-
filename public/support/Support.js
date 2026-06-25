(function () {
  "use strict";

  const HIDDEN_KEY = "sona.support.hidden";
  const MAX_ATTACHMENTS = 3;
  const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
  const MAX_SUPPORT_STORAGE = 30 * 1024 * 1024;
  const ACCEPTED_EXTENSIONS = new Set([
    "png", "jpg", "jpeg", "webp", "gif", "pdf", "txt", "csv", "json",
    "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip",
    "mp4", "webm", "mov", "mp3", "wav", "ogg"
  ]);
  const ACCEPTED_TYPES = new Set([
    "image/png", "image/jpeg", "image/webp", "image/gif",
    "application/pdf", "text/plain", "text/csv",
    "application/json",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip", "application/x-zip-compressed",
    "video/mp4", "video/webm", "video/quicktime",
    "audio/mpeg", "audio/wav", "audio/ogg"
  ]);

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
    return "Пользователь";
  }

  function adminAuthor(data) {
    return String(data?.admin?.name || "").trim() || "Администратор SONA";
  }

  function isProfileActive(data) {
    return Boolean(data?.profile?.isActive || isAdmin(data));
  }

  function isAdmin(data) {
    if (window.SonaAdmin?.isAdmin) return window.SonaAdmin.isAdmin(data);
    const adminEmail = String(data?.admin?.email || "").trim().toLowerCase();
    const profileEmail = String(data?.profile?.email || "").trim().toLowerCase();
    return Boolean(
      (data?.admin?.isAuthenticated && adminEmail === "kcel046@gmail.com") ||
      (data?.profile?.role === "admin" && profileEmail === "kcel046@gmail.com")
    );
  }

  function accountKey(data) {
    const profile = data?.profile || {};
    const role = isAdmin(data) ? "admin" : "user";
    return `${role}:${String(profile.email || profile.phone || profile.sessionId || "local").trim().toLowerCase()}`;
  }

  function userAccountKey(data) {
    const profile = data?.profile || {};
    return `user:${String(profile.email || profile.phone || profile.sessionId || "local").trim().toLowerCase()}`;
  }

  function threadIdFor(message) {
    return message?.accountKey || `legacy:${message?.phone || message?.email || message?.author || "support"}`;
  }

  function userThreadId(data) {
    return `THREAD-${userAccountKey(data)}`;
  }

  function visibleThreads(data, options = {}) {
    const admin = options.admin ?? isAdmin(data);
    const key = options.userMode ? userAccountKey(data) : accountKey(data);
    const profile = data.profile || {};
    const map = new Map();

    (data.supportMessages || []).forEach((message) => {
      const legacyMatch = !message.accountKey && (
        (profile.email && message.email === profile.email) ||
        (profile.phone && message.phone === profile.phone)
      );
      if (!admin && message.accountKey !== key && !legacyMatch) return;

      const id = threadIdFor(message);
      const thread = map.get(id) || { id, accountKey: message.accountKey || "", messages: [], title: message.subject || "" };
      thread.messages.push(message);
      thread.last = message;
      if (!thread.title && message.role === "user") thread.title = message.text || message.author || "Обращение";
      map.set(id, thread);
    });

    return [...map.values()]
      .map((thread) => ({ ...thread, title: String(thread.title || "Обращение в поддержку").slice(0, 42) }))
      .sort((a, b) => Number(b.last?.createdAt || 0) - Number(a.last?.createdAt || 0));
  }

  function cleanFileName(name) {
    return (window.SonaSecurity?.sanitizeText(name, 120) || String(name || "file").trim().slice(0, 120)) || "file";
  }

  function fileExtension(name) {
    return String(name || "").toLowerCase().split(".").pop() || "";
  }

  function isAcceptedAttachment(item) {
    const type = String(item?.type || "").toLowerCase();
    if (ACCEPTED_TYPES.has(type)) return true;
    return (!type || type === "application/octet-stream") && ACCEPTED_EXTENSIONS.has(fileExtension(item?.name));
  }

  function safeAttachmentHref(item) {
    if (!isAcceptedAttachment(item)) return "#";
    const raw = String(item?.dataUrl || "");
    const type = String(item?.type || "application/octet-stream").toLowerCase();
    return raw.toLowerCase().startsWith(`data:${type};`) ? raw : "#";
  }

  function dataUrlBytes(dataUrl) {
    const raw = String(dataUrl || "");
    const comma = raw.indexOf(",");
    if (comma < 0) return 0;
    const payload = raw.slice(comma + 1);
    try {
      return raw.slice(0, comma).includes(";base64")
        ? Math.floor(payload.length * 0.75)
        : new TextEncoder().encode(decodeURIComponent(payload)).length;
    } catch (error) {
      return 0;
    }
  }

  function attachmentBytes(item) {
    return Math.max(Number(item?.size) || 0, dataUrlBytes(item?.dataUrl));
  }

  function supportStorageBytes(messages) {
    return (messages || []).reduce((total, message) => total + (message.attachments || [])
      .reduce((sum, attachment) => sum + String(attachment.dataUrl || "").length, 0), 0);
  }

  function validateAttachments(items, options = {}) {
    const accepted = [];
    const rejected = [];
    const rows = Array.from(items || []);
    const storageLeft = Number.isFinite(options.storageLeft) ? options.storageLeft : MAX_SUPPORT_STORAGE;
    let used = 0;

    rows.forEach((item, index) => {
      const name = cleanFileName(item?.name);
      const size = attachmentBytes(item);
      let reason = "";
      if (index >= MAX_ATTACHMENTS) reason = `Можно прикрепить не больше ${MAX_ATTACHMENTS} файлов`;
      else if (!isAcceptedAttachment(item)) reason = "Формат файла не поддерживается";
      else if (!item?.dataUrl && !options.allowUnread) reason = "Файл не удалось прочитать";
      else if (item?.dataUrl && safeAttachmentHref(item) === "#") reason = "Содержимое файла не соответствует его формату";
      else if (size > MAX_ATTACHMENT_SIZE) reason = "Файл больше 10 МБ";
      else if (used + String(item?.dataUrl || "").length > storageLeft) reason = "В хранилище чата недостаточно места";

      if (reason) {
        rejected.push({ name, reason });
        return;
      }
      used += String(item?.dataUrl || "").length;
      accepted.push(options.allowUnread ? item : {
        name,
        type: String(item?.type || "application/octet-stream").toLowerCase(),
        size,
        dataUrl: String(item?.dataUrl || "")
      });
    });
    return { accepted, rejected };
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
    const metadata = validateAttachments(files, { allowUnread: true });
    const attachments = await Promise.all(metadata.accepted.map(readAttachment));
    const data = window.SonaStore.read();
    const storageLeft = MAX_SUPPORT_STORAGE - supportStorageBytes(data.supportMessages);
    const final = validateAttachments(attachments, { storageLeft });
    return { attachments: final.accepted, rejected: [...metadata.rejected, ...final.rejected] };
  }

  function addMessage(text, source = "chat", attachments = [], target = {}) {
    const clean = window.SonaSecurity?.sanitizeText(text, 700) || String(text || "").trim().slice(0, 700);
    const data = window.SonaStore.read();
    const storageLeft = MAX_SUPPORT_STORAGE - supportStorageBytes(data.supportMessages);
    const cleanAttachments = validateAttachments(attachments, { storageLeft }).accepted;
    if (!clean && !cleanAttachments.length) return false;

    window.SonaStore.update((data) => {
      const ownAccountKey = userAccountKey(data);
      const threadId = target.threadId || userThreadId(data);
      data.supportMessages = [
        ...(data.supportMessages || []),
        {
          id: `SUP-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
          threadId,
          accountKey: target.accountKey || ownAccountKey,
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

  function addAdminReply(text, target = {}, attachments = []) {
    const clean = window.SonaSecurity?.sanitizeText(text, 700) || String(text || "").trim().slice(0, 700);
    const data = window.SonaStore.read();
    if (!isAdmin(data)) return false;
    const targetThread = (data.supportMessages || []).find((message) => threadIdFor(message) === target.threadId);
    if (!targetThread) return false;
    const storageLeft = MAX_SUPPORT_STORAGE - supportStorageBytes(data.supportMessages);
    const cleanAttachments = validateAttachments(attachments, { storageLeft }).accepted;
    if (!clean && !cleanAttachments.length) return false;

    window.SonaStore.update((data) => {
      data.supportMessages = [
        ...(data.supportMessages || []),
        {
          id: `ADM-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
          threadId: target.threadId,
          accountKey: target.accountKey || targetThread.accountKey || "",
          role: "admin",
          author: adminAuthor(data),
          phone: target.phone || "",
          email: target.email || "",
          text: clean,
          attachments: cleanAttachments,
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

    rows.forEach((message) => {
      const bubble = el("article", `sona-support-message is-${message.role === "admin" ? "admin" : "user"}`);
      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      const attachmentList = el("div", "sona-support-attachments");

      attachments.forEach((attachment) => {
        const link = el("a", attachment.type?.startsWith("image/") ? "sona-support-file is-image" : "sona-support-file");
        const safeHref = safeAttachmentHref(attachment);
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
    const wasHidden = localStorage.getItem(HIDDEN_KEY) === "true";
    const data = window.SonaStore.read();
    const canUseChat = isProfileActive(data);
    const admin = false;
    const threads = visibleThreads(data, { admin: false, userMode: true });
    const activeThread = threads[0];
    const activeThreadId = activeThread?.last?.threadId || userThreadId(data);
    const root = el("div", "sona-support-widget");
    const launcher = el("button", "sona-support-launcher");
    const hide = el("button", "sona-support-hide", "×");
    const restore = el("button", "sona-support-restore");
    const panel = el("section", "sona-support-panel");
    const head = el("div", "", "");
    const headWrap = el("div", "sona-support-head");
    const close = el("button", "sona-support-close", "×");
    const form = el("form", `sona-support-form${canUseChat ? "" : " is-login-required"}`);
    const input = el("textarea");
    const fileInput = document.createElement("input");
    const attach = el("button", `sona-support-attach${canUseChat ? "" : " is-login-required"}`);
    const notice = el("p", "sona-support-form-note", canUseChat ? "До 3 файлов, каждый до 10 МБ." : "Войдите в аккаунт, чтобы писать в поддержку.");
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

    function setHidden(hidden) {
      root.classList.toggle("is-hidden", hidden);
      if (hidden) {
        localStorage.setItem(HIDDEN_KEY, "true");
        setOpen(false);
      } else {
        localStorage.removeItem(HIDDEN_KEY);
      }
    }

    launcher.type = "button";
    launcher.setAttribute("aria-label", "Открыть чат поддержки");
    launcher.setAttribute("aria-expanded", "false");
    launcher.append(supportIcon(), el("strong", "", "Помощь"));
    launcher.addEventListener("click", () => {
      setOpen(!root.classList.contains("is-open"));
    });

    hide.type = "button";
    hide.setAttribute("aria-label", "Скрыть кнопку помощи");
    hide.addEventListener("click", (event) => {
      event.stopPropagation();
      setHidden(true);
    });

    restore.type = "button";
    restore.setAttribute("aria-label", "Показать кнопку помощи");
    restore.append(supportIcon());
    restore.addEventListener("click", () => {
      setHidden(false);
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
      el("span", "", canUseChat ? (admin ? "Вы пишете как администратор" : "Ответ появится в этом окне") : "Войдите, чтобы начать диалог")
    );

    input.placeholder = canUseChat ? "Опишите вопрос по заказу, доставке или товару" : "Войдите в аккаунт, чтобы написать";
    input.readOnly = !canUseChat;
    if (!canUseChat) {
      input.classList.add("is-login-required");
      input.addEventListener("focus", openProfile);
      input.addEventListener("click", openProfile);
    }

    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv,application/json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg";
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
      const report = validateAttachments(fileInput.files, { allowUnread: true });
      renderAttachIcon(report.accepted.length);
      notice.textContent = report.rejected.length
        ? report.rejected.map((item) => `${item.name}: ${item.reason}`).join(". ")
        : `${report.accepted.length} файл(а) готово к отправке`;
    });

    send.type = "submit";
    form.append(input, fileInput, attach, send, notice);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
      event.preventDefault();
      form.requestSubmit();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!canUseChat) {
        openProfile();
        return;
      }

      const prepared = await prepareAttachments(fileInput.files);
      if (!addMessage(input.value, "widget", prepared.attachments, {
        threadId: activeThreadId,
        accountKey: activeThread?.accountKey || userAccountKey(data)
      })) {
        notice.textContent = prepared.rejected.map((item) => `${item.name}: ${item.reason}`).join(". ") || "Введите сообщение или прикрепите допустимый файл.";
        input.focus();
        return;
      }

      input.value = "";
      fileInput.value = "";
      renderAttachIcon();
      notice.textContent = prepared.rejected.length
        ? `Сообщение отправлено. Не добавлены: ${prepared.rejected.map((item) => `${item.name} (${item.reason})`).join(", ")}`
        : "Сообщение отправлено.";
      const currentList = panel.querySelector(".sona-support-messages");
      const nextData = window.SonaStore.read();
      const nextThread = visibleThreads(nextData, { admin: false, userMode: true })[0];
      const nextList = renderMessages(nextThread?.messages || []);
      currentList?.replaceWith(nextList);
      root.classList.add("is-open");
      document.body.classList.add("support-chat-open");
      panel.hidden = false;
      panel.style.display = "grid";
      panel.setAttribute("aria-hidden", "false");
      launcher.setAttribute("aria-expanded", "true");
      nextList.scrollTop = nextList.scrollHeight;
      await window.SonaStore.flushSync?.().catch(() => null);
      await window.SonaStore.refresh?.().catch(() => null);
      options.onChange?.();
    });

    panel.append(headWrap, renderMessages(activeThread?.messages || []), form);
    root.append(launcher, hide, restore, panel);
    container.replaceChildren(root);
    setHidden(wasHidden);
    setOpen(wasOpen);
  }

  window.SonaSupport = {
    addMessage,
    addAdminReply,
    renderWidget,
    renderMessages,
    visibleThreads,
    threadIdFor,
    prepareAttachments,
    validateAttachments,
    safeAttachmentHref,
    limits: {
      maxAttachments: MAX_ATTACHMENTS,
      maxAttachmentSize: MAX_ATTACHMENT_SIZE,
      maxSupportStorage: MAX_SUPPORT_STORAGE
    },
    nowLabel
  };
})();
