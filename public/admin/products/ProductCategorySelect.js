(function () {
  "use strict";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function render({ onSelect }) {
    const wrap = el("section", "sona-product-category-step");
    const head = el("div", "sona-products-head");
    const grid = el("div", "sona-category-grid");

    head.append(
      el("p", "eyebrow", "Новый товар"),
      el("h2", "", "Выберите тип позиции"),
      el("span", "", "После выбора откроется редактор с полями именно для этой категории.")
    );

    window.SonaProductSchemas.categories.forEach(([id, title, group, description]) => {
      const card = el("button", "sona-category-card");
      card.type = "button";
      card.dataset.category = id;
      card.append(el("span", "sona-category-card__group", group), el("strong", "", title), el("small", "", description));
      card.addEventListener("click", () => onSelect(id));
      grid.append(card);
    });

    wrap.append(head, grid);
    return wrap;
  }

  window.SonaProductCategorySelect = { render };
})();
