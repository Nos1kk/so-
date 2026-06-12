const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 430, height: 932 } });

const expectedImages = {
  "Аляска Мд": "Аляска МД.png",
  "Аляска": "Аляска.png",
  "Андреас": "Андреас.png",
  "Бостон": "Бостон.png",
  "Валенсия": "Валенсия.jpeg",
  "Виктория": "Виктория.png",
  "Гудзон": "Гудзон.png",
  "Дублин": "Дублин.png",
  "Инфинити": "Инфинити.jpeg",
  "Канзас 8 Мд": "Канзас 8 Мд.png",
  "Мальта К": "мальта К.png",
  "sona-mark-large": "Марк.png",
  "sona-mark-compact": "Марк маленький.png",
  "Милан": "Милан.png",
  "Монтана": "Монтана 1.jpeg",
  "Неаполь МД": "Неаполь Мд.png",
  "Ницца": "Ницца.png",
  "Нумо": "Нумо.png",
  "Паула": "Паула.jpeg",
  "Рейн": "Рейн.png",
  "Сиэтл М": "Сиэтл М.png",
  "Томас": "Томас.png"
};

test("matching sofa asset files replace catalog placeholders", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("http://localhost:8000/category?type=sofas");
  await page.waitForLoadState("networkidle");

  const results = await page.locator(".category-product-grid .product-card").evaluateAll(
    async (cards, expected) => Promise.all(Object.entries(expected).map(async ([key, file]) => {
      const isId = key.startsWith("sona-");
      const card = cards.find((item) => isId
        ? item.querySelector(`[data-favorite-product-id="${key}"]`)
        : item.querySelector("h3")?.textContent.trim() === key);
      const image = card?.querySelector(".product-media img");
      if (image && !image.complete) {
        await new Promise((resolve) => image.addEventListener("load", resolve, { once: true }));
      }
      return {
        name: key,
        file,
        found: Boolean(card),
        src: decodeURI(image?.src || ""),
        naturalWidth: image?.naturalWidth || 0,
        naturalHeight: image?.naturalHeight || 0
      };
    })),
    expectedImages
  );

  for (const result of results) {
    expect(result.found, `${result.name} отсутствует в каталоге`).toBeTruthy();
    expect(result.src, `${result.name} использует не тот файл`).toContain(`/assets/фотографии диванов/${result.file}`);
    expect(result.naturalWidth, `${result.name}: изображение не загрузилось`).toBeGreaterThan(0);
    expect(result.naturalHeight, `${result.name}: изображение не загрузилось`).toBeGreaterThan(0);
  }

  await page.waitForTimeout(1000);
  await page.screenshot({
    path: "artifacts/visual-checks/84-sofa-assets-catalog-top.png",
    fullPage: false
  });

  const naples = page.locator(".category-product-grid .product-card").filter({ hasText: "Неаполь МД" });
  await naples.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: "artifacts/visual-checks/85-sofa-assets-catalog-lower.png",
    fullPage: false
  });
});
