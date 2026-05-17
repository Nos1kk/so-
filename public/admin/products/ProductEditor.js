(function () {
  "use strict";

  const schemas = () => window.SonaProductSchemas;
  const tabs = () => schemas().commonTabs;
  const categoryTitle = (id) => schemas().categories.find((item) => item[0] === id)?.[1] || "Товар";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function normalizePhotos(product) {
    const gallery = Array.isArray(product.gallery) ? product.gallery : [];
    const rows = gallery.length ? gallery : (product.image ? [{ id: "main", src: product.image, alt: product.name || "", main: true }] : []);
    return rows.map((item, index) => ({ ...item, id: item.id || `IMG-${index}`, main: index === 0 ? true : Boolean(item.main) }));
  }

  function normalizeVariants(product) {
    return Array.isArray(product.variants) ? product.variants : [];
  }

  function createDraft(product, type) {
    const categoryLabel = categoryTitle(product.productType || type);
    return {
      productType: product.productType || type,
      categoryLabel: product.categoryLabel || categoryLabel,
      category: product.category || categoryLabel,
      marketSection: product.marketSection || (type === "service" ? "Услуги" : type === "kitchen" ? "Кухни" : "Мебель"),
      status: product.status || (product.hidden ? "hidden" : "draft"),
      priceMode: product.priceMode || (type === "kitchen" ? "from" : "fixed"),
      availability: product.availability || "in_stock",
      stock: product.stock ?? 1,
      deliveryDays: product.deliveryDays ?? 3,
      rating: product.rating ?? 0,
      reviewsCount: product.reviewsCount ?? 0,
      ...product
    };
  }

  function renderField({ field, value, onChange, error }) {
    const [name, label, type, required, options] = field;
    const wrap = el("label", `sona-editor-field ${error ? "has-error" : ""}`);
    const caption = el("span", "", `${label}${required ? " *" : ""}`);
    let input;

    if (type === "textarea") {
      input = el("textarea");
      input.value = value || "";
      input.addEventListener("input", () => onChange(name, input.value));
    } else if (type === "select") {
      input = el("select");
      (options || []).forEach(([id, title]) => {
        const option = el("option", "", title);
        option.value = id;
        option.selected = String(value || "") === String(id);
        input.append(option);
      });
      input.addEventListener("change", () => onChange(name, input.value));
    } else if (type === "boolean") {
      input = el("input");
      input.type = "checkbox";
      input.checked = Boolean(value);
      input.addEventListener("change", () => onChange(name, input.checked));
      wrap.classList.add("is-checkbox");
    } else {
      input = el("input");
      input.type = type || "text";
      input.value = value ?? "";
      input.addEventListener("input", () => onChange(name, input.value));
    }

    input.name = name;
    wrap.append(caption, input);
    if (error) wrap.append(el("small", "sona-field-error", error));
    return wrap;
  }

  function fieldsFor(tab, product) {
    if (tab === "main") return schemas().commonFields.main;
    if (tab === "price") return schemas().commonFields.price;
    if (tab === "delivery") return schemas().commonFields.delivery;
    if (tab === "seo") return schemas().commonFields.seo;
    if (tab === "specs") return schemas().schemas[product.productType] || schemas().schemas.other;
    return [];
  }

  function validate(product, photos, allProducts) {
    const errors = {};
    const price = Number(product.price) || 0;
    const oldPrice = Number(product.oldPrice) || 0;
    const sku = String(product.sku || "").trim().toLowerCase();
    const customPriceAllowed = product.productType === "service" || product.productType === "kitchen" || product.priceMode === "custom";

    if (!String(product.name || "").trim()) errors.name = "Название обязательно.";
    if (!String(product.categoryLabel || product.category || "").trim()) errors.categoryLabel = "Категория обязательна.";
    if (!String(product.description || product.shortDescription || "").trim()) errors.description = "Добавьте описание.";
    if (!customPriceAllowed && price <= 0) errors.price = "Укажите цену.";
    if (Number(product.stock) < 0) errors.stock = "Остаток не может быть отрицательным.";
    if (oldPrice && oldPrice < price) errors.oldPrice = "Старая цена не может быть меньше новой.";
    if (!photos.length) errors.photos = "Добавьте главное фото.";
    if (sku && allProducts.some((item) => item.id !== product.id && String(item.sku || "").trim().toLowerCase() === sku)) {
      errors.sku = "Такой артикул уже есть.";
    }
    return errors;
  }

  function toProductPayload(product, photos, variants, status) {
    const main = photos.find((item) => item.main) || photos[0];
    const price = Number(product.price) || 0;
    const oldPrice = Number(product.oldPrice) || 0;
    const discount = oldPrice > price && price > 0 ? Math.round((1 - price / oldPrice) * 100) : 0;

    return {
      ...product,
      status: status || product.status || "active",
      hidden: (status || product.status) === "hidden",
      price,
      oldPrice,
      discount,
      stock: Math.max(0, Number(product.stock) || 0),
      deliveryDays: Math.max(1, Number(product.deliveryDays) || 1),
      rating: Math.max(0, Number(product.rating) || 0),
      reviewsCount: Math.max(0, Number(product.reviewsCount) || 0),
      image: main?.src || product.image || "",
      gallery: photos,
      variants,
      materials: String(product.materials || "").split(",").map((item) => item.trim()).filter(Boolean),
      colors: String(product.colors || "").split(",").map((item) => item.trim()).filter(Boolean),
      tags: String(product.tags || "").split(",").map((item) => item.trim()).filter(Boolean),
      updatedAt: new Date().toISOString()
    };
  }

  function render({ product = {}, type, context, onSave, onCancel, onDuplicate }) {
    let activeTab = "main";
    let draft = createDraft(product, type);
    let photos = normalizePhotos(draft);
    let variants = normalizeVariants(draft);
    let errors = {};
    const root = el("section", "sona-product-editor");

    const rerender = () => {
      root.replaceChildren();
      const shell = el("div", "sona-editor-shell");
      const main = el("div", "sona-editor-main");
      const side = el("aside", "sona-editor-summary");
      const tabbar = el("div", "sona-editor-tabs");
      const content = el("div", "sona-editor-content");
      const actions = el("div", "sona-editor-actions");

      tabs().forEach(([id, title]) => {
        const button = el("button", id === activeTab ? "is-active" : "", title);
        button.type = "button";
        button.addEventListener("click", () => { activeTab = id; rerender(); });
        tabbar.append(button);
      });

      const setValue = (key, value) => {
        draft = { ...draft, [key]: value };
        if (key === "oldPrice" || key === "price") {
          const price = Number(key === "price" ? value : draft.price) || 0;
          const old = Number(key === "oldPrice" ? value : draft.oldPrice) || 0;
          draft.discount = old > price && price > 0 ? Math.round((1 - price / old) * 100) : 0;
        }
        errors = { ...errors, [key]: "" };
        rerender();
      };

      if (["main", "specs", "price", "delivery", "seo"].includes(activeTab)) {
        const grid = el("div", "sona-editor-grid");
        fieldsFor(activeTab, draft).forEach((field) => grid.append(renderField({
          field,
          value: draft[field[0]],
          onChange: setValue,
          error: errors[field[0]]
        })));
        content.append(grid);
      }

      if (activeTab === "photos") {
        if (errors.photos) content.append(el("p", "sona-editor-error", errors.photos));
        content.append(window.SonaProductPhotos.render({
          photos,
          setPhotos: (next) => { photos = next; errors.photos = ""; rerender(); }
        }));
      }

      if (activeTab === "variants") {
        content.append(window.SonaProductVariants.render({
          variants,
          category: draft.productType,
          setVariants: (next) => { variants = next; rerender(); }
        }));
      }

      if (activeTab === "preview") {
        content.append(window.SonaProductPreview.render(draft, photos));
      }

      const saveWithStatus = (status) => {
        const next = toProductPayload(draft, photos, variants, status);
        errors = validate(next, photos, context.products || []);
        if (Object.keys(errors).some((key) => errors[key])) {
          activeTab = errors.photos ? "photos" : Object.keys(schemas().commonFields).find((tab) => schemas().commonFields[tab].some(([name]) => errors[name])) || "main";
          rerender();
          return;
        }
        onSave(next);
      };

      [
        ["Сохранить", () => saveWithStatus(draft.status || "active")],
        ["Сохранить как черновик", () => saveWithStatus("draft")],
        ["Опубликовать", () => saveWithStatus("active")],
        ["Предпросмотр", () => { activeTab = "preview"; rerender(); }],
        ["Дублировать товар", () => onDuplicate?.(toProductPayload({ ...draft, id: "", sku: "" }, photos, variants, "draft"))],
        ["Очистить форму", () => { draft = createDraft({}, type); photos = []; variants = []; errors = {}; activeTab = "main"; rerender(); }],
        ["Отменить изменения", onCancel]
      ].forEach(([title, action], index) => {
        const button = el("button", index === 6 ? "sona-admin-soft" : "", title);
        button.type = "button";
        button.addEventListener("click", action);
        actions.append(button);
      });

      const photo = photos.find((item) => item.main) || photos[0];
      if (photo?.src) {
        const image = document.createElement("img");
        image.src = photo.src;
        image.alt = "";
        side.append(image);
      }
      side.append(
        el("span", "sona-summary-type", categoryTitle(draft.productType)),
        el("h3", "", draft.name || "Новый товар"),
        el("p", "", draft.shortDescription || "Заполните основные поля, фото и цену."),
        el("strong", "", draft.priceMode === "custom" ? "Индивидуальный расчёт" : `${draft.priceMode === "from" ? "от " : ""}${new Intl.NumberFormat("ru-RU").format(Number(draft.price) || 0)} ₽`),
        el("small", "", `Статус: ${draft.status || "draft"} · Остаток: ${draft.stock ?? 0}`)
      );

      main.append(tabbar, content, actions);
      shell.append(main, side);
      root.append(shell);
    };

    rerender();
    return root;
  }

  window.SonaProductEditor = { render };
})();
