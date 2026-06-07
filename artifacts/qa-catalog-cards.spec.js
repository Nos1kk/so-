const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

test("catalog cards keep reviews high and prices prominent", async ({ page }) => {
  await page.goto("http://localhost:8000/category?type=all");
  await page.waitForLoadState("networkidle");

  const grid = page.locator(".category-product-grid");
  await grid.scrollIntoViewIfNeeded();
  const firstCard = grid.locator(".product-card").first();
  await expect(firstCard).toBeVisible();

  const metrics = await firstCard.evaluate((card) => {
    const title = card.querySelector("h3").getBoundingClientRect();
    const rating = card.querySelector(".rating").getBoundingClientRect();
    const price = card.querySelector(".price strong").getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    return {
      cardBottom: cardBox.bottom,
      titleBottom: title.bottom,
      ratingTop: rating.top,
      ratingBottom: rating.bottom,
      priceTop: price.top,
      priceBottom: price.bottom,
      priceFontSize: Number.parseFloat(getComputedStyle(card.querySelector(".price strong")).fontSize)
    };
  });
  console.log(JSON.stringify({ metrics }));

  expect(metrics.ratingTop - metrics.titleBottom).toBeLessThanOrEqual(5);
  expect(metrics.priceTop).toBeGreaterThan(metrics.ratingTop);
  expect(metrics.priceBottom).toBeLessThanOrEqual(metrics.cardBottom);
  expect(metrics.priceFontSize).toBeGreaterThanOrEqual(17);

  await page.screenshot({
    path: "artifacts/visual-checks/53-catalog-reviews-price-final.png",
    fullPage: false
  });
});
