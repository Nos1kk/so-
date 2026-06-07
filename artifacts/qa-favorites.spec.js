const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

test("favorites cart button keeps viewport stable", async ({ page }) => {
  const storeResponse = await page.request.get("http://localhost:8000/api/store");
  const originalPayload = await storeResponse.json();

  try {
    await page.goto("http://localhost:8000/");
    await page.waitForLoadState("networkidle");
    const favoriteButton = page.locator("[data-favorite-product-id]").first();
    const productId = await favoriteButton.getAttribute("data-favorite-product-id");
    expect(productId).toBeTruthy();

    const state = structuredClone(originalPayload.state);
    state.favorites = [productId];
    delete state.cart[productId];
    await page.request.put("http://localhost:8000/api/store", { data: { state } });

    await page.goto("http://localhost:8000/favorites");
    await page.waitForLoadState("networkidle");
    const cartButton = page.locator(".favorite-card .product-cart-button").first();
    await expect(cartButton).toBeVisible();
    await cartButton.scrollIntoViewIfNeeded();

    const before = await cartButton.evaluate((element) => ({
      top: element.getBoundingClientRect().top,
      scrollY: window.scrollY
    }));
    await cartButton.click();
    await page.waitForTimeout(250);
    const after = await cartButton.evaluate((element) => ({
      top: element.getBoundingClientRect().top,
      scrollY: window.scrollY
    }));

    console.log(JSON.stringify({
      before,
      after,
      viewportShift: Math.round((after.top - before.top) * 100) / 100,
      layoutShift: Math.round(((after.top + after.scrollY) - (before.top + before.scrollY)) * 100) / 100
    }));
    expect(Math.abs((after.top + after.scrollY) - (before.top + before.scrollY))).toBeLessThanOrEqual(1);
    expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThanOrEqual(2);
    await page.screenshot({
      path: "artifacts/visual-checks/51-favorites-cart-no-jump.png",
      fullPage: false
    });
  } finally {
    await page.request.put("http://localhost:8000/api/store", { data: originalPayload });
  }
});
