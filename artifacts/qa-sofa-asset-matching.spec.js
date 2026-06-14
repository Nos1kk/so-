const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 430, height: 932 } });

const expectedImages = {
  "Аляска Мд": "аляска МД бф.png",
  "Аляска": "аляска бф.png",
  "Андреас": "андреас бф.png",
  "Бостон": "бостон бф.png",
  "Валенсия": "валенсия бф.png",
  "Виктория": "виктория бф.png",
  "Гудзон": "гудзон бф.png",
  "Дублин": "дублин бф.png",
  "Инфинити": "инфинити бф.png",
  "Канзас 8 Мд": "канзас 8 мд бф.png",
  "Мальта К": "мальта к бф.png",
  "sona-mark-large": "марк бф.png",
  "sona-mark-compact": "марк маленький бф.png",
  "Милан": "милан бф.png",
  "Монтана": "монтана бф.png",
  "Неаполь МД": "неаполь мд бф.png",
  "Неаполь МД Белый": "неаполь мд белый бф.png",
  "Ницца": "ницца бф.png",
  "Нумо": "нумо бф.png",
  "Паула": "паула бф.png",
  "Рейн": "рейн бф.png",
  "Сиэтл М": "сиэтл бф.png",
  "Томас": "томас бф.png"
};

test("matching sofa asset files replace catalog placeholders", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("http://127.0.0.1:8000/category?type=sofas", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Открыть Аляска Мд", exact: true }).waitFor({ state: "visible" });

  const results = await page.locator(".category-product-grid .product-card").evaluateAll(
    (cards, expected) => Object.entries(expected).map(([key, file]) => {
      const isId = key.startsWith("sona-");
      const card = cards.find((item) => isId
        ? item.querySelector(`[data-favorite-product-id="${key}"]`)
        : item.querySelector("h3")?.textContent.trim() === key);
      const image = card?.querySelector(".product-media img");
      return {
        name: key,
        file,
        found: Boolean(card),
        src: decodeURI(image?.src || "")
      };
    }),
    expectedImages
  );

  for (const result of results) {
    expect(result.found, `${result.name} отсутствует в каталоге`).toBeTruthy();
    expect(result.src, `${result.name} использует не тот файл`).toContain(`/assets/фотографии диванов/${result.file}`);
  }

  await page.waitForTimeout(1000);
  await page.screenshot({
    path: "artifacts/visual-checks/84-sofa-assets-catalog-top.png",
    fullPage: false
  });

  const naples = page.getByRole("button", { name: "Открыть Неаполь МД", exact: true });
  await naples.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: "artifacts/visual-checks/85-sofa-assets-catalog-lower.png",
    fullPage: false
  });
});

test("catalog stays stable without periodic full rerenders", async ({ page }) => {
  await page.goto("http://127.0.0.1:8000/category?type=sofas", { waitUntil: "domcontentloaded" });
  const alaska = page.getByRole("button", { name: "Открыть Аляска", exact: true });
  await alaska.waitFor({ state: "visible" });
  await alaska.evaluate((element) => {
    element.dataset.stabilityMarker = "same-card";
  });

  await page.waitForTimeout(5200);

  await expect(alaska).toHaveAttribute("data-stability-marker", "same-card");
  const transitionDuration = await page.getByRole("button", { name: "Назад в каталог", exact: true }).evaluate(
    (element) => getComputedStyle(element).transitionDuration
  );
  expect(transitionDuration).not.toBe("0s");
});
