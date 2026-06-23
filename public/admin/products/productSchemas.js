(function () {
  "use strict";

  const categories = [
    ["sofa", "Диван", "Мягкая мебель", "Прямые, угловые, модульные модели и диван-кровати"],
    ["bed", "Кровать", "Спальня", "Кровати для взрослых и детей, модели с хранением"],
    ["mattress", "Матрас", "Спальня", "Пружинные и беспружинные матрасы"],
    ["wardrobe", "Шкаф", "Хранение", "Шкафы, гардеробные и модульные системы"],
    ["sofaCollection", "Коллекция диванов", "Мягкая мебель", "Компактные, просторные, акцентные и детские модели"],
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
    ["variants", "Варианты"],
    ["delivery", "Доставка и гарантия"],
    ["preview", "Предпросмотр"]
  ];

  const commonFields = {
    main: [
      ["name", "Название товара", "text", true],
      ["shortDescription", "Коротко для карточки", "textarea", true],
      ["description", "Описание на странице товара", "textarea", true],
      ["categoryLabel", "Категория", "text", true],
      ["subcategory", "Подкатегория", "text"],
      ["brand", "Бренд", "text"],
      ["sku", "Артикул", "text"],
      ["priceMode", "Как показывать цену", "select", false, [["fixed", "Обычная цена"], ["from", "Цена от"], ["custom", "Индивидуальный расчёт"]]],
      ["price", "Цена сейчас, ₽", "number"],
      ["oldPrice", "Цена до скидки, ₽", "number"],
      ["discount", "Скидка, % (авто)", "number"],
      ["stock", "Остаток, шт.", "number"],
      ["availability", "Наличие", "select", false, [["in_stock", "В наличии"], ["preorder", "Под заказ"], ["out", "Нет в наличии"]]],
      ["dimensions", "Габаритные размеры", "text"],
      ["sleepingPlace", "Спальное место", "text"],
      ["mechanism", "Механизм", "text"],
      ["status", "Статус товара", "select", false, [["active", "Опубликован"], ["hidden", "Скрыт"], ["draft", "Черновик"]]],
      ["tags", "Теги через запятую", "text"]
    ],
    delivery: [
      ["deliveryDays", "Срок доставки, дней", "number"],
      ["warranty", "Гарантия", "text"],
      ["supplier", "Поставщик / исполнитель", "text"],
      ["assembly", "Сборка", "select", false, [["not_required", "Не требуется"], ["required", "Требуется"], ["included", "Включена"]]]
    ]
  };

  const schemas = {
    sofa: [
      ["dimensions", "Габаритные размеры", "text"],
      ["sleepingPlace", "Спальное место", "text"],
      ["mechanism", "Механизм", "text"]
    ],
    bed: [
      ["dimensions", "Габаритные размеры", "text"],
      ["sleepingPlace", "Спальное место", "text"],
      ["mechanism", "Механизм", "text"]
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
    sofaCollection: [
      ["collectionType", "Тип коллекции", "select", false, [["compact", "Компактная"], ["family", "Просторная"], ["accent", "Акцентная"], ["kids", "Детская"], ["modular", "Модульная"]]],
      ["length", "Длина дивана", "text"],
      ["upholstery", "Материал обивки", "text"],
      ["frameMaterial", "Материал каркаса", "text"],
      ["filler", "Наполнитель", "text"],
      ["hardware", "Механизм", "text"],
      ["upholsteryColor", "Цвет обивки", "text"],
      ["bodyColor", "Цвет опор", "text"],
      ["style", "Стиль", "select", false, [["modern", "Современный"], ["classic", "Классика"], ["minimal", "Минимализм"], ["scandi", "Сканди"], ["loft", "Лофт"]]],
      ["sleepingPlace", "Спальное место", "select", false, [["none", "Без спального места"], ["included", "Со спальным местом"]]],
      ["linenBox", "Ящик для белья", "boolean"],
      ["removableCover", "Съёмный чехол", "boolean"],
      ["customProject", "Индивидуальная комплектация", "boolean"],
      ["measurement", "Подбор размера", "select", false, [["free", "Бесплатный"], ["paid", "Платный"]]],
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
    table: [["dimensions", "Габаритные размеры", "text"], ["sleepingPlace", "Спальное место", "text"], ["mechanism", "Механизм", "text"]],
    chair: [["dimensions", "Габаритные размеры", "text"], ["sleepingPlace", "Спальное место", "text"], ["mechanism", "Механизм", "text"]],
    dresser: [["dimensions", "Габаритные размеры", "text"], ["sleepingPlace", "Спальное место", "text"], ["mechanism", "Механизм", "text"]],
    textile: [["dimensions", "Габаритные размеры", "text"], ["sleepingPlace", "Спальное место", "text"], ["mechanism", "Механизм", "text"]],
    decor: [["dimensions", "Габаритные размеры", "text"], ["sleepingPlace", "Спальное место", "text"], ["mechanism", "Механизм", "text"]],
    other: [["dimensions", "Габаритные размеры", "text"], ["sleepingPlace", "Спальное место", "text"], ["mechanism", "Механизм", "text"]]
  };

  window.SonaProductSchemas = {
    categories,
    commonTabs,
    commonFields,
    schemas
  };
})();
