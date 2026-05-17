(function () {
  "use strict";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function field(name, placeholder, value, onInput, type = "text") {
    const input = el("input");
    input.name = name;
    input.type = type;
    input.placeholder = placeholder;
    input.value = value || "";
    input.addEventListener("input", () => onInput(input.value));
    return input;
  }

  function render({ variants, setVariants, category }) {
    const wrap = el("div", "sona-variants");
    const add = el("button", "sona-admin-soft", "Добавить вариант");
    const hint = category === "kitchen"
      ? "Например: планировка, материал фасада, длина, комплектация."
      : category === "bed"
        ? "Например: размер спального места, цвет, подъёмный механизм."
        : "Например: цвет ткани, размер, сторона угла, комплектация.";

    add.type = "button";
    add.addEventListener("click", () => {
      setVariants([...variants, {
        id: `VAR-${Date.now()}`,
        title: "",
        sku: "",
        price: "",
        oldPrice: "",
        stock: "",
        color: "",
        size: "",
        configuration: "",
        photos: ""
      }]);
    });

    wrap.append(el("p", "sona-admin-muted", hint), add);
    variants.forEach((variant, index) => {
      const row = el("article", "sona-variant-row");
      const remove = el("button", "is-danger", "Удалить");
      const patch = (key, value) => setVariants(variants.map((item, i) => i === index ? { ...item, [key]: value } : item));

      remove.type = "button";
      remove.addEventListener("click", () => setVariants(variants.filter((_, i) => i !== index)));
      row.append(
        field("title", "Название варианта", variant.title, (value) => patch("title", value)),
        field("sku", "Артикул", variant.sku, (value) => patch("sku", value)),
        field("price", "Цена", variant.price, (value) => patch("price", value), "number"),
        field("oldPrice", "Старая цена", variant.oldPrice, (value) => patch("oldPrice", value), "number"),
        field("stock", "Остаток", variant.stock, (value) => patch("stock", value), "number"),
        field("color", "Цвет / материал", variant.color, (value) => patch("color", value)),
        field("size", "Размер / длина", variant.size, (value) => patch("size", value)),
        field("configuration", "Комплектация", variant.configuration, (value) => patch("configuration", value)),
        field("photos", "Фото варианта, URL или пометка", variant.photos, (value) => patch("photos", value)),
        remove
      );
      wrap.append(row);
    });

    return wrap;
  }

  window.SonaProductVariants = { render };
})();
