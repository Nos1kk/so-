const { test, expect } = require("@playwright/test");

test("profile product favorite and cart buttons animate beside each other", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("http://localhost:8000/profile");
  await page.waitForLoadState("networkidle");

  const temporaryLogin = page.getByRole("button", { name: "Войти без почты (временно)" });
  if (await temporaryLogin.isVisible()) await temporaryLogin.click();

  const actions = page.locator(".sona-profile-showcase-card__actions").first();
  await actions.scrollIntoViewIfNeeded();
  await expect(actions.locator("button")).toHaveCount(2);
  const actionClasses = await actions.locator("button").evaluateAll((buttons) => buttons.map((button) => button.className));
  expect(actionClasses[0]).toContain("product-cart-button");
  expect(actionClasses[1]).toContain("favorite-button");

  const favorite = actions.locator(".favorite-button");
  const wasFavorite = await favorite.evaluate((button) => button.classList.contains("is-active"));
  await favorite.click();
  await expect(favorite).toHaveClass(wasFavorite ? /favorite-button(?!.*is-active)/ : /is-active/);

  await page.waitForTimeout(750);
  const refreshedActions = page.locator(".sona-profile-showcase-card__actions").first();
  const cart = refreshedActions.locator(".product-cart-button");
  const wasInCart = await cart.evaluate((button) => button.classList.contains("is-in-cart"));
  await cart.click();
  await expect(cart).toHaveClass(wasInCart ? /is-removed/ : /is-added/);

  await page.waitForTimeout(120);
  await page.screenshot({
    path: "artifacts/visual-checks/69-profile-card-actions.png",
    fullPage: false
  });
});
