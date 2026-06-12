const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

async function loadedImages(page, selector) {
  await page.waitForFunction((target) => [...document.querySelectorAll(target)]
    .every((image) => image.complete && image.naturalWidth > 0), selector);
  await page.waitForTimeout(800);
}

async function actionMetrics(container) {
  return container.locator("button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      width: Math.round(box.width),
      height: Math.round(box.height),
      background: style.backgroundColor,
      color: style.color
    };
  }));
}

async function verticalOrder(card, selectors) {
  return card.evaluate((element, targets) => targets.map((selector) => {
    const target = element.querySelector(selector);
    return target ? Math.round(target.getBoundingClientRect().top) : null;
  }), selectors);
}

test("profile cart is neutral until item is added", async ({ page }) => {
  test.setTimeout(90000);
  const response = await page.request.get("http://localhost:8000/api/store");
  const original = await response.json();
  const state = structuredClone(original.state);
  state.cart = {};
  await page.request.put("http://localhost:8000/api/store", { data: { state } });

  await page.goto("http://localhost:8000/profile");
  await page.waitForLoadState("networkidle");
  const temporaryLogin = page.getByRole("button", { name: "Войти без почты (временно)" });
  if (await temporaryLogin.isVisible()) await temporaryLogin.click();
  await loadedImages(page, ".sona-profile-showcase-card img");

  const actions = page.locator(".sona-profile-showcase-card__actions").first();
  await actions.scrollIntoViewIfNeeded();
  const before = await actionMetrics(actions);
  expect(before).toHaveLength(2);
  expect(before[0].width).toBe(before[1].width);
  expect(before[0].height).toBe(before[1].height);
  expect(before[0].background).toBe("rgb(255, 255, 255)");
  await page.screenshot({ path: "artifacts/visual-checks/80-profile-cart-neutral.png", fullPage: false });

  const cart = actions.locator(".product-cart-button");
  await cart.click();
  await page.waitForTimeout(900);
  const refreshedActions = page.locator(".sona-profile-showcase-card__actions").first();
  const added = await actionMetrics(refreshedActions);
  expect(added[0].width).toBeGreaterThan(before[0].width);
  expect(added[0].height).toBeGreaterThan(before[0].height);
  expect(added[0].background).toBe("rgb(16, 40, 68)");

  await page.screenshot({ path: "artifacts/visual-checks/75-profile-card-shared-design.png", fullPage: false });
});

test("favorites, cart recommendations and catalog share card structure", async ({ page }) => {
  test.setTimeout(90000);
  const response = await page.request.get("http://localhost:8000/api/store");
  const original = await response.json();
  try {
    const state = structuredClone(original.state);
    state.favorites = ["sona-island"];
    state.cart = { "sona-island": 1 };
    await page.request.put("http://localhost:8000/api/store", { data: { state } });

    await page.goto("http://localhost:8000/favorites");
    await page.waitForLoadState("networkidle");
    await loadedImages(page, ".favorite-card img");
    const favorite = page.locator(".favorite-card").first();
    await expect(favorite.locator(".favorite-actions button")).toHaveCount(2);
    const favoriteOrder = await verticalOrder(favorite, ["h3", ".rating", ".favorite-meta strong"]);
    expect(favoriteOrder[0]).toBeLessThan(favoriteOrder[1]);
    expect(favoriteOrder[1]).toBeLessThan(favoriteOrder[2]);
    await favorite.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "artifacts/visual-checks/76-favorites-shared-card-design.png", fullPage: false });

    await page.goto("http://localhost:8000/cart");
    await page.waitForLoadState("networkidle");
    await loadedImages(page, ".cart-item img");
    await page.locator(".cart-item").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "artifacts/visual-checks/79-cart-item-shared-card-design.png", fullPage: false });
    await loadedImages(page, ".cart-recommendation-card img");
    const recommendation = page.locator(".cart-recommendation-card").first();
    await expect(recommendation.locator(".cart-recommendation-actions button")).toHaveCount(2);
    const recommendationOrder = await verticalOrder(recommendation, ["strong", ".cart-recommendation-rating", ".cart-recommendation-price"]);
    expect(recommendationOrder[0]).toBeLessThan(recommendationOrder[1]);
    expect(recommendationOrder[1]).toBeLessThan(recommendationOrder[2]);
    await recommendation.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "artifacts/visual-checks/77-cart-shared-card-design.png", fullPage: false });

    await page.goto("http://localhost:8000/category?type=sofas");
    await page.waitForLoadState("networkidle");
    await loadedImages(page, ".category-product-grid .product-card img");
    const catalog = page.locator(".category-product-grid .product-card").first();
    const catalogOrder = await verticalOrder(catalog, ["h3", ".rating", ".price strong"]);
    expect(catalogOrder[0]).toBeLessThan(catalogOrder[1]);
    expect(catalogOrder[1]).toBeLessThan(catalogOrder[2]);
    await catalog.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "artifacts/visual-checks/78-catalog-shared-card-design.png", fullPage: false });
  } finally {
    await page.request.put("http://localhost:8000/api/store", { data: original });
  }
});
