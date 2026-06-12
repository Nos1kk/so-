const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

test("cart buttons animate on add and repeated remove", async ({ page }) => {
  const storeResponse = await page.request.get("http://localhost:8000/api/store");
  const originalPayload = await storeResponse.json();

  try {
    const state = structuredClone(originalPayload.state);
    state.cart = {};
    await page.request.put("http://localhost:8000/api/store", { data: { state } });

    await page.goto("http://localhost:8000/");
    await page.waitForLoadState("networkidle");

    const allHomeCartButtons = page.locator("button[data-cart-product-id]");
    expect(await allHomeCartButtons.count()).toBeGreaterThan(0);
    expect(await page.locator("button[data-cart-product-id]:not(.product-cart-button)").count()).toBe(0);

    const button = page.locator(".home-picks-group .product-cart-button").first();
    await button.scrollIntoViewIfNeeded();
    await expect(button).toHaveAttribute("aria-pressed", "false");

    await button.click();
    await expect(button).toHaveClass(/is-added/);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    const addAnimation = await button.evaluate((element) => getComputedStyle(element).animationName);
    expect(addAnimation).not.toBe("none");
    await page.waitForTimeout(180);
    await page.screenshot({
      path: "artifacts/visual-checks/56-cart-button-add-animation.png",
      fullPage: false
    });

    await page.waitForTimeout(650);
    await button.click();
    await expect(button).toHaveClass(/is-removed/);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    const removeAnimation = await button.evaluate((element) => getComputedStyle(element).animationName);
    expect(removeAnimation).not.toBe("none");
    await page.waitForTimeout(180);
    await page.screenshot({
      path: "artifacts/visual-checks/57-cart-button-remove-animation.png",
      fullPage: false
    });
  } finally {
    await page.request.put("http://localhost:8000/api/store", { data: originalPayload });
  }
});
