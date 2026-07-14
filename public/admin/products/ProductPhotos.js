(function () {
  "use strict";

  const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
  const MAX_VIDEO_SIZE = 18 * 1024 * 1024;
  const TYPES = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function readFiles(files, onAdd, onError) {
    [...files].forEach((file) => {
      if (!TYPES.includes(file.type)) {
        onError("Поддерживаются PNG, JPG и WebP.");
        return;
      }
      const isVideo = file.type.startsWith("video/");
      if (file.size > (isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE)) {
        onError(isVideo ? "Видео должно быть до 18 МБ." : "Фото должно быть до 4 МБ.");
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const photo = {
          id: `IMG-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          src: String(reader.result || ""),
          alt: file.name.replace(/\.[^.]+$/, ""),
          main: false,
          type: file.type
        };
        window.dispatchEvent(new CustomEvent("sona:media-selected", { detail: { dataUrl: photo.src } }));
        onAdd(photo);
      });
      reader.readAsDataURL(file);
    });
  }

  function render({ photos, setPhotos }) {
    const wrap = el("div", "sona-photo-manager");
    const drop = el("label", "sona-photo-drop");
    const input = el("input");
    const list = el("div", "sona-photo-grid");
    const error = el("p", "sona-editor-error");

    input.type = "file";
    input.accept = TYPES.join(",");
    input.multiple = true;
    drop.append(input, el("strong", "", "Перетащите фото или видео либо выберите файлы"), el("span", "", "Несколько фото и видео, главное фото, порядок и alt-текст."));

    const update = (next) => {
      const selectedMain = next.find((item) => item.main && !String(item.type || "").startsWith("video/"));
      const fallbackMain = next.find((item) => !String(item.type || "").startsWith("video/"));
      const mainId = selectedMain?.id || fallbackMain?.id || "";
      setPhotos(next.map((item) => ({ ...item, main: item.id === mainId })));
    };
    const addPhoto = (photo) => {
      const next = [...photos, photo];
      update(next);
    };
    const showError = (message) => { error.textContent = message; };

    input.addEventListener("change", () => {
      readFiles(input.files || [], addPhoto, showError);
      input.value = "";
    });
    drop.addEventListener("dragover", (event) => {
      event.preventDefault();
      drop.classList.add("is-dragging");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-dragging"));
    drop.addEventListener("drop", (event) => {
      event.preventDefault();
      drop.classList.remove("is-dragging");
      readFiles(event.dataTransfer.files || [], addPhoto, showError);
    });

    photos.forEach((photo, index) => {
      const card = el("article", "sona-photo-card");
      const isVideo = String(photo.type || "").startsWith("video/") || /^data:video\//i.test(photo.src || "");
      const media = document.createElement(isVideo ? "video" : "img");
      const alt = el("input");
      const actions = el("div", "sona-photo-actions");
      const main = el("button", photo.main ? "is-active" : "", photo.main ? "Главное" : "Сделать главным");
      const up = el("button", "", "↑");
      const down = el("button", "", "↓");
      const remove = el("button", "is-danger", "Удалить");

      media.src = window.SonaSecurity?.safeMediaUrl(photo.src);
      if (isVideo) {
        media.controls = true;
        media.muted = true;
        media.preload = "metadata";
      } else {
        media.alt = photo.alt || "";
      }
      alt.value = photo.alt || "";
      alt.placeholder = "Alt-текст";
      alt.addEventListener("input", () => update(photos.map((item) => item.id === photo.id ? { ...item, alt: alt.value } : item)));
      [main, up, down, remove].forEach((button) => { button.type = "button"; });
      main.disabled = isVideo;
      if (isVideo) main.textContent = "Видео";
      main.addEventListener("click", () => update(photos.map((item) => ({ ...item, main: item.id === photo.id }))));
      up.disabled = index === 0;
      down.disabled = index === photos.length - 1;
      up.addEventListener("click", () => {
        const next = [...photos];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        update(next);
      });
      down.addEventListener("click", () => {
        const next = [...photos];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        update(next);
      });
      remove.addEventListener("click", () => update(photos.filter((item) => item.id !== photo.id)));
      actions.append(main, up, down, remove);
      card.append(media, alt, actions);
      list.append(card);
    });

    wrap.append(drop, error, list);
    return wrap;
  }

  window.SonaProductPhotos = { render };
})();
