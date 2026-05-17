(function () {
  "use strict";

  const categories = [
    ["sofa", "Диван", "Мягкая мебель", "Прямые, угловые, модульные модели и диван-кровати"],
    ["bed", "Кровать", "Спальня", "Кровати для взрослых и детей, модели с хранением"],
    ["mattress", "Матрас", "Спальня", "Пружинные и беспружинные матрасы"],
    ["wardrobe", "Шкаф", "Хранение", "Шкафы, гардеробные и модульные системы"],
    ["kitchen", "Кухня", "Кухни", "Готовые и индивидуальные проекты кухонь"],
    ["table", "Стол", "Мебель", "Обеденные, письменные и журнальные столы"],
    ["chair", "Стул / кресло", "Мебель", "Стулья, кресла, пуфы и банкетки"],
    ["dresser", "Тумба / комод", "Хранение", "Тумбы, комоды и прикроватные решения"],
    ["textile", "Текстиль", "Текстиль", "Подушки, одеяла, пледы, покрывала"],
    ["decor", "Декор", "Декор", "Свет, зеркала, аксессуары и предметы интерьера"],
    ["service", "Услуга", "Услуги", "Доставка, сборка, замер, дизайн и установка"],
    ["other", "Другое", "Каталог", "Универсальная карточка для редких позиций"]
  ];

  const commonTabs = [
    ["main", "Основное"],
    ["photos", "Фото"],
    ["specs", "Характеристики"],
    ["variants", "Варианты"],
    ["price", "Цена и склад"],
    ["delivery", "Доставка и гарантия"],
    ["seo", "SEO"],
    ["preview", "Предпросмотр"]
  ];

  const commonFields = {
    main: [
      ["name", "Название товара", "text", true],
      ["shortDescription", "Краткое описание", "textarea", true],
      ["description", "Полное описание", "textarea", true],
      ["categoryLabel", "Категория", "text", true],
      ["subcategory", "Подкатегория", "text"],
      ["brand", "Бренд", "text"],
      ["status", "Статус", "select", false, [["active", "Активен"], ["hidden", "Скрыт"], ["draft", "Черновик"]]],
      ["tags", "Теги", "text"],
      ["rating", "Рейтинг", "number"],
      ["reviewsCount", "Количество отзывов", "number"]
    ],
    price: [
      ["sku", "Артикул", "text"],
      ["priceMode", "Тип цены", "select", false, [["fixed", "Фиксированная"], ["from", "Цена от"], ["custom", "Индивидуальный расчёт"]]],
      ["price", "Цена", "number"],
      ["oldPrice", "Старая цена", "number"],
      ["discount", "Скидка", "number"],
      ["stock", "Остаток", "number"],
      ["availability", "Наличие", "select", false, [["in_stock", "В наличии"], ["preorder", "Под заказ"], ["out", "Нет в наличии"]]]
    ],
    delivery: [
      ["deliveryDays", "Срок доставки, дней", "number"],
      ["warranty", "Гарантия", "text"],
      ["supplier", "Поставщик / исполнитель", "text"],
      ["assembly", "Сборка", "select", false, [["not_required", "Не требуется"], ["required", "Требуется"], ["included", "Включена"]]]
    ],
    seo: [
      ["seoTitle", "SEO title", "text"],
      ["seoDescription", "SEO description", "textarea"],
      ["seoKeywords", "SEO keywords", "text"],
      ["slug", "ЧПУ-ссылка", "text"]
    ]
  };

  const schemas = {
    sofa: [
      ["sofaType", "Тип дивана", "select", false, [["straight", "Прямой"], ["corner", "Угловой"], ["modular", "Модульный"], ["sleeper", "Диван-кровать"]]],
      ["mechanism", "Механизм трансформации", "text"],
      ["seats", "Количество мест", "number"],
      ["hasSleepingPlace", "Спальное место", "boolean"],
      ["sleepingSize", "Размер спального места", "text"],
      ["dimensions", "Габариты: ширина / глубина / высота", "text"],
      ["frameMaterial", "Материал каркаса", "text"],
      ["upholstery", "Материал обивки", "text"],
      ["filler", "Наполнитель", "text"],
      ["firmness", "Жёсткость посадки", "select", false, [["soft", "Мягкая"], ["medium", "Средняя"], ["firm", "Жёсткая"]]],
      ["linenBox", "Ящик для белья", "boolean"],
      ["cornerSide", "Сторона угла", "select", false, [["left", "Левая"], ["right", "Правая"], ["universal", "Универсальная"]]],
      ["upholsteryColor", "Цвет обивки", "text"],
      ["collection", "Коллекция", "text"],
      ["fabricChoice", "Возможность выбора ткани", "boolean"],
      ["requiresAssembly", "Сборка требуется", "boolean"]
    ],
    bed: [
      ["bedType", "Тип кровати", "select", false, [["single", "Односпальная"], ["double", "Двуспальная"], ["kids", "Детская"], ["lift", "С подъёмным механизмом"]]],
      ["sleepingSize", "Размер спального места", "text"],
      ["dimensions", "Габариты кровати", "text"],
      ["frameMaterial", "Материал каркаса", "text"],
      ["headboardMaterial", "Материал изголовья", "text"],
      ["headboardHeight", "Высота изголовья", "text"],
      ["baseIncluded", "Основание в комплекте", "boolean"],
      ["liftMechanism", "Подъёмный механизм", "boolean"],
      ["storageBox", "Ящик для хранения", "boolean"],
      ["maxLoad", "Максимальная нагрузка", "text"],
      ["color", "Цвет", "text"],
      ["collection", "Коллекция", "text"],
      ["compatibleMattresses", "Совместимые матрасы", "text"]
    ],
    mattress: [
      ["mattressSize", "Размер", "text"],
      ["height", "Высота матраса", "text"],
      ["firmnessSideA", "Жёсткость стороны 1", "text"],
      ["firmnessSideB", "Жёсткость стороны 2", "text"],
      ["mattressType", "Тип матраса", "select", false, [["spring", "Пружинный"], ["springless", "Беспружинный"]]],
      ["springBlock", "Тип пружинного блока", "text"],
      ["fillers", "Наполнители", "text"],
      ["maxLoad", "Максимальная нагрузка на место", "text"],
      ["anatomical", "Анатомический эффект", "boolean"],
      ["orthopedic", "Ортопедический эффект", "boolean"],
      ["cover", "Чехол", "text"],
      ["removableCover", "Съёмный чехол", "boolean"],
      ["rolled", "Скрутка в рулон", "boolean"],
      ["forWhom", "Для кого", "select", false, [["adult", "Взрослый"], ["child", "Детский"]]],
      ["warranty", "Гарантия", "text"]
    ],
    wardrobe: [
      ["wardrobeType", "Тип шкафа", "select", false, [["hinged", "Распашной"], ["coupe", "Шкаф-купе"], ["walkin", "Гардеробная"], ["modular", "Модульный"]]],
      ["doors", "Количество дверей", "number"],
      ["dimensions", "Габариты", "text"],
      ["bodyMaterial", "Материал корпуса", "text"],
      ["frontMaterial", "Материал фасада", "text"],
      ["bodyColor", "Цвет корпуса", "text"],
      ["frontColor", "Цвет фасада", "text"],
      ["mirror", "Зеркало", "boolean"],
      ["inside", "Наполнение: полки / штанга / ящики", "text"],
      ["configurable", "Возможность изменения комплектации", "boolean"],
      ["modular", "Модульность", "boolean"],
      ["assembly", "Сборка", "text"]
    ],
    kitchen: [
      ["kitchenType", "Тип кухни", "select", false, [["straight", "Прямая"], ["corner", "Угловая"], ["u", "П-образная"], ["island", "Островная"], ["modular", "Модульная"]]],
      ["length", "Длина кухни", "text"],
      ["frontMaterial", "Материал фасадов", "text"],
      ["bodyMaterial", "Материал корпуса", "text"],
      ["countertop", "Материал столешницы", "text"],
      ["hardware", "Фурнитура", "text"],
      ["frontColor", "Цвет фасадов", "text"],
      ["bodyColor", "Цвет корпуса", "text"],
      ["style", "Стиль", "select", false, [["modern", "Современный"], ["classic", "Классика"], ["minimal", "Минимализм"], ["scandi", "Сканди"], ["loft", "Лофт"]]],
      ["appliances", "Наличие техники", "select", false, [["none", "Без техники"], ["included", "С техникой"]]],
      ["sink", "Мойка", "boolean"],
      ["lighting", "Подсветка", "boolean"],
      ["customProject", "Индивидуальный проект", "boolean"],
      ["measurement", "Замер", "select", false, [["free", "Бесплатный"], ["paid", "Платный"]]],
      ["installation", "Сборка и установка", "text"],
      ["productionTime", "Срок изготовления", "text"],
      ["priceMode", "Цена", "select", false, [["from", "Цена от"], ["fixed", "Фиксированная"], ["custom", "Индивидуальный расчёт"]]]
    ],
    service: [
      ["serviceType", "Тип услуги", "select", false, [["delivery", "Доставка"], ["assembly", "Сборка"], ["measurement", "Замер"], ["design", "Дизайн-проект"], ["install", "Установка"], ["repair", "Ремонт"], ["consulting", "Консультация"]]],
      ["priceMode", "Стоимость", "select", false, [["fixed", "Фиксированная"], ["from", "От суммы"], ["custom", "Рассчитывается индивидуально"]]],
      ["executionTime", "Срок выполнения", "text"],
      ["serviceArea", "Город / зона обслуживания", "text"],
      ["contractor", "Исполнитель", "text"],
      ["included", "Что входит в услугу", "textarea"],
      ["excluded", "Что не входит в услугу", "textarea"],
      ["requirements", "Необходимые условия", "textarea"],
      ["serviceStatus", "Статус услуги", "select", false, [["active", "Активна"], ["hidden", "Скрыта"], ["draft", "Черновик"]]]
    ],
    table: [["dimensions", "Габариты", "text"], ["shape", "Форма", "text"], ["baseMaterial", "Материал основания", "text"], ["topMaterial", "Материал столешницы", "text"]],
    chair: [["chairType", "Тип", "text"], ["frameMaterial", "Материал каркаса", "text"], ["upholstery", "Обивка", "text"], ["maxLoad", "Максимальная нагрузка", "text"]],
    dresser: [["dimensions", "Габариты", "text"], ["bodyMaterial", "Материал корпуса", "text"], ["frontMaterial", "Материал фасада", "text"], ["drawers", "Количество ящиков", "number"]],
    textile: [["textileType", "Тип текстиля", "text"], ["size", "Размер", "text"], ["fabric", "Ткань", "text"], ["care", "Уход", "text"]],
    decor: [["decorType", "Тип декора", "text"], ["dimensions", "Габариты", "text"], ["material", "Материал", "text"], ["style", "Стиль", "text"]],
    other: [["specs", "Характеристики", "textarea"]]
  };

  window.SonaProductSchemas = {
    categories,
    commonTabs,
    commonFields,
    schemas
  };
})();
