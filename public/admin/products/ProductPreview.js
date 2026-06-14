(function () {
  "use strict";

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

  function priceLabel(product) {
    if (product.priceMode === "custom") return "Индивидуальный расчёт";
    if (product.priceMode === "from" || product.productType === "sofaCollection") return `от ${money(product.price)}`;
    return money(product.price);
  }

  function renderCard(product, photos = []) {
    const card = el("article", "sona-product-preview-card");
    const media = el("div", "sona-product-preview-card__media");
    const main = photos.find((item) => item.main) || photos[0];
    const body = el("div", "sona-product-preview-card__body");
    const actions = el("div", "sona-product-preview-card__actions");

    if (main?.src || product.image) {
      const img = document.createElement("img");
      img.src = main?.src || product.image;
      img.alt = main?.alt || product.name || "";
      media.append(img);
    } else {
      media.append(el("strong", "", "Фото товара"));
    }

    const old = product.oldPrice ? el("del", "", money(product.oldPrice)) : null;
    const price = el("div", "sona-preview-price", priceLabel(product));
    if (old) price.append(old);
    actions.append(el("button", "", "В корзину"), el("button", "", "♡"));
    body.append(
      el("span", "sona-preview-category", product.categoryLabel || product.category || "Каталог"),
      el("h3", "", product.name || "Название товара"),
      price,
      el("span", "sona-preview-rating", Number(product.reviewsCount) > 0 ? `★ ${product.rating || 0} · ${product.reviewsCount} отзывов` : "0 отзывов"),
      el("p", "", product.shortDescription || "Краткое описание будет видно в карточке."),
      el("small", "", `${Number(product.stock) > 0 ? "В наличии" : "Под заказ"} · доставка ${product.deliveryDays || 3} дн.`),
      actions
    );
    card.append(media, body);
    return card;
  }

  function render(product, photos) {
    const wrap = el("div", "sona-preview-pane");
    const detail = el("section", "sona-preview-detail");
    const characteristics = el("div", "sona-preview-characteristics");
    [
      ["Габаритные размеры", product.dimensions],
      ["Спальное место", product.sleepingPlace || product.sleepingSize],
      ["Механизм", product.mechanism],
      ["Материалы", Array.isArray(product.materials) ? product.materials.join(", ") : product.materials]
    ].filter(([, value]) => value).forEach(([label, value]) => {
      const item = el("div", "sona-preview-characteristic");
      item.append(el("span", "", label), el("strong", "", value));
      characteristics.append(item);
    });
    detail.append(
      el("h3", "", product.name || "Страница товара"),
      el("p", "", product.description || product.shortDescription || "Полное описание появится здесь."),
      el("strong", "", priceLabel(product)),
      characteristics
    );
    wrap.append(renderCard(product, photos), detail);
    return wrap;
  }

  window.SonaProductPreview = { render, renderCard };
})();
