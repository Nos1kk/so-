(function () {
  "use strict";

  function text(value) {
    return window.SonaText?.fix(value) || String(value ?? "");
  }

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = text(value);
    return node;
  }

  function field(name, placeholder, value, onInput, type = "text") {
    const input = el("input");
    input.name = name;
    input.type = type;
    input.placeholder = text(placeholder);
    input.value = value || "";
    input.addEventListener("input", () => onInput(input.value));
    return input;
  }

  const MAX_FILE_SIZE = 6 * 1024 * 1024;
  const FILE_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/json",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ];

  function isAcceptedFile(file) {
    if (FILE_TYPES.includes(file.type)) return true;
    return /\.(docx|xlsx|pptx|zip|pdf|txt|csv|json)$/i.test(file.name || "");
  }

  function readFiles(files, onAdd, onError) {
    [...files].forEach((file) => {
      if (!isAcceptedFile(file)) {
        onError("Поддерживаются фото, PDF, TXT, CSV, JSON, ZIP и офисные файлы.");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        onError("Файл должен быть до 6 МБ.");
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const uploadedFile = {
          id: `FAB-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name || "file",
          type: file.type || "application/octet-stream",
          src: String(reader.result || "")
        };
        window.dispatchEvent(new CustomEvent("sona:media-selected", { detail: { dataUrl: uploadedFile.src } }));
        onAdd(uploadedFile);
      });
      reader.readAsDataURL(file);
    });
  }

  function renderFabricFiles(variant, patch) {
    const files = Array.isArray(variant.files)
      ? variant.files
      : (variant.photos ? [{ id: "FAB-legacy", name: "Фото ткани", type: "image/*", src: variant.photos }] : []);
    const wrap = el("div", "sona-fabric-files");
    const upload = el("label", "sona-fabric-upload", "Добавить фото или файл");
    const input = el("input");
    const error = el("small", "sona-editor-error", "");

    input.type = "file";
    input.accept = `${FILE_TYPES.join(",")},.docx,.xlsx,.pptx,.zip,.pdf,.txt,.csv,.json`;
    input.multiple = true;
    upload.append(input);
    input.addEventListener("change", () => {
      error.textContent = "";
      let currentFiles = files;
      let currentPhotos = variant.photos || "";
      readFiles(input.files || [], (file) => {
        const next = [...currentFiles, file];
        currentFiles = next;
        patch("files", next);
        if (!currentPhotos && file.type.startsWith("image/")) {
          currentPhotos = file.src;
          patch("photos", file.src);
        }
      }, (message) => { error.textContent = message; });
      input.value = "";
    });

    wrap.append(upload, error);
    if (files.length) {
      const list = el("div", "sona-fabric-file-list");
      files.forEach((file) => {
        const item = el("div", "sona-fabric-file");
        const isImage = String(file.type || "").startsWith("image/") || /^data:image\//i.test(file.src || "");
        const remove = el("button", "is-danger", "Удалить");

        remove.type = "button";
        remove.addEventListener("click", () => {
          const next = files.filter((candidate) => candidate.id !== file.id);
          patch("files", next);
          if (variant.photos === file.src) patch("photos", next.find((candidate) => String(candidate.type || "").startsWith("image/"))?.src || "");
        });
        if (isImage) {
          const image = document.createElement("img");
          image.src = window.SonaSecurity?.safeMediaUrl(file.src, "");
          image.alt = file.name || "";
          item.append(image);
        }
        item.append(el("span", "", file.name || "Файл"), remove);
        list.append(item);
      });
      wrap.append(list);
    }
    return wrap;
  }

  function render({ variants, setVariants, category }) {
    const wrap = el("div", "sona-variants");
    const isFabricCategory = ["sofa", "sofaCollection", "chair", "bed"].includes(category);
    const add = el("button", "sona-admin-soft", isFabricCategory ? "Добавить ткань" : "Добавить вариант");
    const hint = category === "sofaCollection" || category === "sofa"
      ? "Добавляйте ткани для дивана: название ткани, цену, цвет при необходимости и файлы."
      : category === "bed"
        ? "Добавляйте ткани: название ткани, цену, цвет при необходимости и файлы."
        : "Например: цвет ткани, размер, сторона угла, комплектация.";

    add.type = "button";
    add.addEventListener("click", () => {
      setVariants([...variants, {
        id: `VAR-${Date.now()}`,
        title: "",
        price: "",
        color: "",
        photos: "",
        files: []
      }]);
    });

    wrap.append(el("p", "sona-admin-muted", hint), add);
    variants.forEach((variant, index) => {
      const row = el("article", "sona-variant-row");
      const remove = el("button", "is-danger", "Удалить");
      const patch = (key, value) => setVariants(variants.map((item, i) => i === index ? { ...item, [key]: value } : item));

      remove.type = "button";
      remove.addEventListener("click", () => setVariants(variants.filter((_, i) => i !== index)));
      if (isFabricCategory) {
        const fields = el("div", "sona-fabric-fields");
        fields.append(
          field("title", "Название ткани", variant.title, (value) => patch("title", value)),
          field("price", "Цена", variant.price, (value) => patch("price", value), "number"),
          field("color", "Название цвета (необязательно)", variant.color, (value) => patch("color", value))
        );
        row.append(fields, renderFabricFiles(variant, patch), remove);
        wrap.append(row);
        return;
      }
      row.append(
        field("title", isFabricCategory ? "Название ткани" : "Название варианта", variant.title, (value) => patch("title", value)),
        field("sku", "Артикул", variant.sku, (value) => patch("sku", value)),
        field("price", isFabricCategory ? "Стоимость с этой тканью" : "Цена", variant.price, (value) => patch("price", value), "number"),
        field("oldPrice", "Старая цена", variant.oldPrice, (value) => patch("oldPrice", value), "number"),
        field("stock", "Остаток", variant.stock, (value) => patch("stock", value), "number"),
        field("color", isFabricCategory ? "Цвет ткани / HEX" : "Цвет / материал", variant.color, (value) => patch("color", value)),
        field("type", isFabricCategory ? "Тип обивки" : "Тип", variant.type, (value) => patch("type", value)),
        field("size", "Размер / длина", variant.size, (value) => patch("size", value)),
        field("configuration", isFabricCategory ? "Фактура / примечание" : "Комплектация", variant.configuration, (value) => patch("configuration", value)),
        field("photos", isFabricCategory ? "Фото ткани / URL" : "Фото варианта, URL или пометка", variant.photos, (value) => patch("photos", value)),
        remove
      );
      wrap.append(row);
    });

    return wrap;
  }

  window.SonaProductVariants = { render };
})();
