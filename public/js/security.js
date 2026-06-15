(function () {
  "use strict";

  const TEXT_LIMIT = 160;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  const cp1251Extra = new Map([
    ["Ђ", 0x80], ["Ѓ", 0x81], ["‚", 0x82], ["ѓ", 0x83], ["„", 0x84], ["…", 0x85], ["†", 0x86], ["‡", 0x87],
    ["€", 0x88], ["‰", 0x89], ["Љ", 0x8a], ["‹", 0x8b], ["Њ", 0x8c], ["Ќ", 0x8d], ["Ћ", 0x8e], ["Џ", 0x8f],
    ["ђ", 0x90], ["‘", 0x91], ["’", 0x92], ["“", 0x93], ["”", 0x94], ["•", 0x95], ["–", 0x96], ["—", 0x97],
    ["™", 0x99], ["љ", 0x9a], ["›", 0x9b], ["њ", 0x9c], ["ќ", 0x9d], ["ћ", 0x9e], ["џ", 0x9f],
    ["Ё", 0xa8], ["ё", 0xb8], ["№", 0xb9], ["·", 0xb7], ["°", 0xb0], ["±", 0xb1], ["µ", 0xb5],
    ["Є", 0xaa], ["є", 0xba], ["І", 0xb2], ["і", 0xb3], ["Ї", 0xaf], ["ї", 0xbf], ["Ґ", 0xa5], ["ґ", 0xb4],
    ["Ў", 0xa1], ["ў", 0xa2], ["Ј", 0xa3], ["ј", 0xbc], ["Ѕ", 0xbd], ["ѕ", 0xbe], ["«", 0xab], ["»", 0xbb],
    ["©", 0xa9], ["®", 0xae], ["¬", 0xac], ["¦", 0xa6], ["§", 0xa7], ["¤", 0xa4], [" ", 0xa0]
  ]);
  const utf8Decoder = typeof TextDecoder === "function" ? new TextDecoder("utf-8") : null;

  function sanitizeText(value, limit = TEXT_LIMIT) {
    return String(value || "")
      .replace(/[\u0000-\u001f\u007f<>`{}]/g, "")
      .trim()
      .slice(0, limit);
  }

  function sanitizeEmail(value) {
    return sanitizeText(value, 120)
      .replace(/[\s]+/g, "")
      .toLowerCase();
  }

  function sanitizePhone(value) {
    return sanitizeText(value, 24).replace(/[^\d+() -]/g, "").slice(0, 24);
  }

  function cp1251Byte(char) {
    const code = char.charCodeAt(0);
    if (code <= 0x7f) return code;
    if (code >= 0x80 && code <= 0x9f) return code;
    if (code >= 0x0410 && code <= 0x044f) return code - 0x0350;
    if (cp1251Extra.has(char)) return cp1251Extra.get(char);
    if (code >= 0x00a0 && code <= 0x00bf) return code;
    return null;
  }

  function mojibakeScore(value) {
    const text = String(value || "");
    const broken = (text.match(/[РСВв][\u0080-\u04ff]|â|�/g) || []).length;
    const russianWords = (text.match(/(корзин|избран|профил|товар|заказ|скид|достав|каталог|отзыв|цена|мебел|диван)/gi) || []).length;
    const cyrillic = (text.match(/[А-Яа-яЁё]/g) || []).length;
    return russianWords * 8 + cyrillic - broken * 12 - (text.includes("�") ? 80 : 0);
  }

  function fixCommonText(value) {
    return String(value ?? "")
      .replace(/в‚Ѕ/g, "₽")
      .replace(/В·/g, "·")
      .replace(/в€’/g, "−")
      .replace(/вЂ“/g, "–")
      .replace(/вЂ”/g, "—")
      .replace(/в„–/g, "№")
      .replace(/в…/g, "★");
  }

  function fixText(value) {
    const text = String(value ?? "");
    if (!utf8Decoder || !/[РСВв][\u0080-\u04ff]|â/.test(text)) {
      return fixCommonText(text);
    }

    const bytes = [];
    for (const char of text) {
      const byte = cp1251Byte(char);
      if (byte === null) {
        return fixCommonText(text);
      }
      bytes.push(byte);
    }

    const fixed = utf8Decoder.decode(new Uint8Array(bytes));
    if (!fixed || fixed.includes("�")) return fixCommonText(text);
    return fixCommonText(mojibakeScore(fixed) > mojibakeScore(text) + 3 ? fixed : text);
  }

  function repairDom(root = document.body) {
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.parentElement?.closest(".favorite-button, .icon-button, .hero-arrow, svg")) return;
      const fixed = fixText(node.nodeValue);
      if (fixed !== node.nodeValue) node.nodeValue = fixed;
    });

    root.querySelectorAll?.("[placeholder], [aria-label], [title], [value]").forEach((element) => {
      ["placeholder", "aria-label", "title", "value"].forEach((attr) => {
        const current = element.getAttribute(attr);
        if (current) {
          const fixed = fixText(current);
          if (fixed !== current) element.setAttribute(attr, fixed);
        }
      });
    });
  }

  function validateProfile(profile) {
    const name = sanitizeText(profile.name, 40);
    const email = sanitizeEmail(profile.email);
    const phone = sanitizePhone(profile.phone);
    const address = sanitizeText(profile.address, 120);

    if (email && !emailPattern.test(email)) {
      return { ok: false, message: "Проверьте email" };
    }

    return {
      ok: true,
      profile: {
        name,
        email,
        phone,
        address
      }
    };
  }

  function isValidEmail(value) {
    return emailPattern.test(sanitizeEmail(value));
  }

  function validateAuthEmail(value) {
    const email = sanitizeEmail(value);
    if (!email) {
      return { ok: false, email, message: "Введите email" };
    }
    if (!isValidEmail(email)) {
      return { ok: false, email, message: "Проверьте email" };
    }
    return { ok: true, email };
  }

  function sanitizeAuthCode(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 6);
  }

  function safeProductId(value) {
    return sanitizeText(value, 48).replace(/[^a-z0-9-]/gi, "");
  }

  function safeNavigationUrl(value, fallback = "#") {
    const source = String(value || "").trim();
    if (/^#[a-z0-9_-]+$/i.test(source)) return source;
    try {
      const url = new URL(source, document.baseURI);
      if (url.protocol === "https:") return url.href;
      if (url.protocol === "http:" && url.origin === window.location.origin) return url.href;
      return fallback;
    } catch {
      return fallback;
    }
  }

  function safeMediaUrl(value, fallback = "") {
    const source = String(value || "").trim();
    if (!source) return fallback;
    if (/^data:(?:image\/(?:png|jpeg|webp|gif)|video\/(?:mp4|webm));base64,/i.test(source)) return source;
    if (/^blob:/i.test(source)) return source;
    try {
      const url = new URL(source, document.baseURI);
      if (url.protocol === "https:") return url.href;
      if (url.protocol === "http:" && url.origin === window.location.origin) return url.href;
      return fallback;
    } catch {
      return fallback;
    }
  }

  window.SonaSecurity = {
    sanitizeText,
    sanitizeEmail,
    sanitizePhone,
    sanitizeAuthCode,
    isValidEmail,
    validateAuthEmail,
    validateProfile,
    safeProductId,
    safeNavigationUrl,
    safeMediaUrl
  };

  window.SonaText = {
    fix: fixText,
    repairDom
  };
})();
