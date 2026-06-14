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

  function render({ variants, setVariants, category }) {
    const wrap = el("div", "sona-variants");
    const isFabricCategory = ["sofa", "sofaCollection", "chair", "bed"].includes(category);
    const add = el("button", "sona-admin-soft", isFabricCategory ? "Добавить ткань" : "Добавить вариант");
    const hint = category === "sofaCollection" || category === "sofa"
      ? "Добавляйте ткани для дивана: название, цвет/HEX, тип обивки, стоимость, остаток и фото. Эти варианты появятся в карточке товара."
      : category === "bed"
        ? "Например: размер спального места, цвет ткани, подъемный механизм."
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
        type: "",
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
