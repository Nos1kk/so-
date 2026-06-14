(function () {
  "use strict";

  let mode = "list";
  let selectedType = "";
  let editingId = "";
  let filters = { query: "", category: "all", status: "all", stock: "all", price: "", sort: "updated" };
  let searchTimer = 0;

  const money = (value) => new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function productTypeLabel(product) {
    return product.categoryLabel || product.category || product.marketSection || "Товар";
  }

  function statusText(product) {
    if (product.status === "draft") return "Черновик";
    if (product.hidden || product.status === "hidden") return "Скрыт";
    return "Активен";
  }

  function reviewSummary(context, productId) {
    return window.SonaReviews?.summary(context.data?.reviews || [], productId) || { count: 0, average: 0 };
  }

  function filteredProducts(context) {
    const query = filters.query.toLowerCase();
    const maxPrice = Number(filters.price) || 0;
    return [...context.products].filter((product) => {
      const status = product.hidden ? "hidden" : product.status || "active";
      return (!query || [product.name, product.sku, product.categoryLabel, product.category].join(" ").toLowerCase().includes(query)) &&
        (filters.category === "all" || product.productType === filters.category || product.category === filters.category || product.categoryLabel === filters.category) &&
        (filters.status === "all" || status === filters.status) &&
        (filters.stock === "all" || (filters.stock === "in" ? Number(product.stock) > 0 : Number(product.stock) <= 0)) &&
        (!maxPrice || Number(product.price) <= maxPrice);
    }).sort((a, b) => {
      if (filters.sort === "price") return (Number(b.price) || 0) - (Number(a.price) || 0);
      if (filters.sort === "reviews") return reviewSummary(context, b.id).count - reviewSummary(context, a.id).count;
      if (filters.sort === "rating") return reviewSummary(context, b.id).average - reviewSummary(context, a.id).average;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
  }

  function renderToolbar(context, rerender) {
    const toolbar = el("div", "sona-products-toolbar");
    const add = el("button", "", "Добавить товар");
    const query = el("input");
    const category = el("select");
    const status = el("select");
    const stock = el("select");
    const price = el("input");
    const sort = el("select");

    add.type = "button";
    add.addEventListener("click", () => { mode = "category"; selectedType = ""; editingId = ""; rerender(); });
    query.type = "search";
    query.placeholder = "Поиск по названию или артикулу";
    query.value = filters.query;
    query.addEventListener("input", () => {
      filters.query = query.value;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => rerender({ focusSearch: true }), 180);
    });
    [
      [category, [["all", "Все категории"], ...window.SonaProductSchemas.categories.map(([id, title]) => [id, title])], "category"],
      [status, [["all", "Все статусы"], ["active", "Активен"], ["hidden", "Скрыт"], ["draft", "Черновик"]], "status"],
      [stock, [["all", "Любой остаток"], ["in", "В наличии"], ["out", "Нет в наличии"]], "stock"],
      [sort, [["updated", "Сначала обновлённые"], ["price", "По цене"], ["reviews", "По отзывам"], ["rating", "По рейтингу"]], "sort"]
    ].forEach(([select, rows, key]) => {
      rows.forEach(([id, label]) => {
        const option = el("option", "", label);
        option.value = id;
        option.selected = filters[key] === id;
        select.append(option);
      });
      select.addEventListener("change", () => { filters[key] = select.value; rerender(); });
    });
    price.type = "number";
    price.placeholder = "Цена до";
    price.value = filters.price;
    price.addEventListener("input", () => { filters.price = price.value; rerender(); });
    toolbar.append(add, query, category, status, stock, price, sort);
    return toolbar;
  }

  function renderTable(context, rerender) {
    const wrap = el("div", "sona-products-table");
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const body = document.createElement("tbody");
    const headRow = document.createElement("tr");
    const headings = ["Фото", "Название", "Категория", "Цена", "Склад", "Рейтинг", "Отзывы", "Статус", "Обновлено", "Действия"];
    headings.forEach((title) => headRow.append(el("th", "", title)));
    head.append(headRow);

    filteredProducts(context).forEach((product) => {
      const productReviews = reviewSummary(context, product.id);
      const tr = document.createElement("tr");
      const imageCell = el("td");
      const image = document.createElement("img");
      const priceInput = el("input");
      const stockInput = el("input");
      const actions = el("div", "sona-products-actions");
      const edit = el("button", "", "Редактировать");
      const duplicate = el("button", "", "Дублировать");
      const toggle = el("button", "", product.hidden ? "Показать" : "Скрыть");
      const preview = el("button", "", "Предпросмотр");
      const remove = el("button", "is-danger", "Удалить");

      const galleryImage = (product.gallery || []).find((item) => item.main && !String(item.type || "").startsWith("video/"))
        || (product.gallery || []).find((item) => !String(item.type || "").startsWith("video/"));
      image.src = product.image || galleryImage?.src || "assets/sona-logo.png";
      image.alt = product.name || "";
      image.addEventListener("error", () => {
        image.src = galleryImage?.src && image.src !== galleryImage.src ? galleryImage.src : "assets/sona-logo.png";
      }, { once: true });
      imageCell.append(image);
      priceInput.type = "number";
      priceInput.value = product.price || 0;
      priceInput.addEventListener("change", () => context.actions.saveProduct({ ...product, price: priceInput.value }));
      stockInput.type = "number";
      stockInput.value = product.stock ?? 0;
      stockInput.addEventListener("change", () => context.actions.saveProduct({ ...product, stock: stockInput.value }));
      edit.addEventListener("click", () => { mode = "edit"; editingId = product.id; selectedType = product.productType || "other"; rerender(); });
      duplicate.addEventListener("click", () => context.actions.saveProduct({ ...product, id: "", sku: "", name: `${product.name || "Товар"} копия`, status: "draft", hidden: false }));
      toggle.addEventListener("click", () => context.actions.saveProduct({ ...product, hidden: !product.hidden, status: product.hidden ? "active" : "hidden" }));
      preview.addEventListener("click", () => { mode = "preview"; editingId = product.id; rerender(); });
      remove.addEventListener("click", () => context.actions.deleteProduct(product.id));
      [edit, duplicate, toggle, preview, remove].forEach((button) => { button.type = "button"; actions.append(button); });

      tr.append(
        imageCell,
        el("td", "", `${product.name || "Без названия"}\n${product.sku || "без артикула"}`),
        el("td", "", productTypeLabel(product)),
        el("td", "", `${money(product.price)}${product.oldPrice ? `\n${money(product.oldPrice)}` : ""}`),
        (() => { const td = el("td"); td.append(stockInput); return td; })(),
        el("td", "", String(productReviews.average || 0)),
        el("td", "", String(productReviews.count || 0)),
        el("td", "", statusText(product)),
        el("td", "", product.updatedAt ? new Date(product.updatedAt).toLocaleDateString("ru-RU") : "—"),
        (() => { const td = el("td"); td.append(priceInput, actions); return td; })()
      );
      [...tr.children].forEach((cell, index) => {
        cell.dataset.label = headings[index];
      });
      body.append(tr);
    });

    table.append(head, body);
    wrap.append(table);
    return wrap;
  }

  function render(context) {
    const root = el("section", "sona-products-page");
    const rerender = (options = {}) => {
      const fresh = { ...context, products: context.products };
      root.replaceChildren(render(fresh));
      if (options.focusSearch) {
        window.requestAnimationFrame(() => {
          const input = root.querySelector('.sona-products-toolbar input[type="search"]');
          input?.focus({ preventScroll: true });
          input?.setSelectionRange(input.value.length, input.value.length);
        });
      }
    };

    if (mode === "category") {
      root.append(window.SonaProductCategorySelect.render({
        onSelect: (type) => { selectedType = type; mode = "edit"; editingId = ""; root.replaceChildren(render(context)); }
      }));
      return root;
    }

    if (mode === "edit") {
      const product = context.products.find((item) => item.id === editingId) || {};
      root.append(window.SonaProductEditor.render({
        product,
        type: selectedType || product.productType || "other",
        context,
        onSave: (payload) => { context.actions.saveProduct(payload); mode = "list"; editingId = ""; },
        onCancel: () => { mode = "list"; editingId = ""; root.replaceChildren(render(context)); },
        onDuplicate: (payload) => context.actions.saveProduct({ ...payload, id: "", name: `${payload.name || "Товар"} копия` })
      }));
      return root;
    }

    if (mode === "preview") {
      const product = context.products.find((item) => item.id === editingId) || {};
      const back = el("button", "sona-admin-soft", "Назад к товарам");
      back.type = "button";
      back.addEventListener("click", () => { mode = "list"; editingId = ""; root.replaceChildren(render(context)); });
      root.append(back, window.SonaProductPreview.render(product, product.gallery || []));
      return root;
    }

    const head = el("div", "sona-products-head");
    head.append(el("p", "eyebrow", "Каталог"), el("h2", "", "Товары и услуги SONA"), el("span", "", "Фильтры, быстрые действия, цены, остатки и полноценный редактор по категориям."));
    root.append(head, renderToolbar(context, rerender), renderTable(context, rerender));
    return root;
  }

  window.SonaProductsPage = { render };
})();
