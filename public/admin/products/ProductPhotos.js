(function () {
  "use strict";

  const MAX_SIZE = 4 * 1024 * 1024;
  const TYPES = ["image/png", "image/jpeg", "image/webp"];

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
      if (file.size > MAX_SIZE) {
        onError("Фото должно быть до 4 МБ.");
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        onAdd({
          id: `IMG-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          src: String(reader.result || ""),
          alt: file.name.replace(/\.[^.]+$/, ""),
          main: false
        });
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
    drop.append(input, el("strong", "", "Перетащите фото или выберите файлы"), el("span", "", "Главное фото, галерея, порядок и alt-текст."));

    const update = (next) => setPhotos(next.map((item, index) => ({ ...item, main: index === 0 ? true : Boolean(item.main && !next.some((p, i) => i < index && p.main)) })));
    const addPhoto = (photo) => {
      const next = [...photos, photo];
      if (!next.some((item) => item.main)) next[0].main = true;
      setPhotos(next);
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
      const image = document.createElement("img");
      const alt = el("input");
      const actions = el("div", "sona-photo-actions");
      const main = el("button", photo.main ? "is-active" : "", photo.main ? "Главное" : "Сделать главным");
      const up = el("button", "", "↑");
      const down = el("button", "", "↓");
      const remove = el("button", "is-danger", "Удалить");

      image.src = photo.src;
      image.alt = photo.alt || "";
      alt.value = photo.alt || "";
      alt.placeholder = "Alt-текст";
      alt.addEventListener("input", () => update(photos.map((item) => item.id === photo.id ? { ...item, alt: alt.value } : item)));
      [main, up, down, remove].forEach((button) => { button.type = "button"; });
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
      card.append(image, alt, actions);
      list.append(card);
    });

    wrap.append(drop, error, list);
    return wrap;
  }

  window.SonaProductPhotos = { render };
})();
