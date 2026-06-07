const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

test("cart recommendation moves into cart without viewport jump", async ({ page }) => {
  await page.goto("http://localhost:8000/cart");
  await page.waitForLoadState("networkidle");

  const recommendations = page.locator("#cartRecommendations");
  await recommendations.scrollIntoViewIfNeeded();
  const recommendationCard = recommendations.locator(".cart-recommendation-card").first();
  const productName = await recommendationCard.locator("strong").innerText();
  const button = recommendationCard.locator("button", { hasText: "В корзину" });
  await expect(button).toBeVisible();

  const before = await recommendations.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    scrollY: window.scrollY
  }));

  await button.click();
  await page.waitForTimeout(250);

  const after = await recommendations.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    scrollY: window.scrollY
  }));

  console.log(JSON.stringify({
    before,
    after,
    viewportShift: Math.round((after.top - before.top) * 100) / 100
  }));
  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
  await expect(page.locator("#cartItems").getByText(productName, { exact: true })).toBeVisible();
  await expect(recommendations.getByText(productName, { exact: true })).toHaveCount(0);
  await page.locator("#cartItems").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/visual-checks/50-cart-transfer-no-jump.png",
    fullPage: false
  });
});
