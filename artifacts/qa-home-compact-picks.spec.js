const { test, expect } = require("@playwright/test");

for (const width of [320, 375, 430]) {
  test(`home hits and new cards are compact and fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("http://localhost:8000/");
    await page.waitForLoadState("networkidle");

    const showcase = page.locator(".hits-showcase");
    await showcase.scrollIntoViewIfNeeded();
    const cards = showcase.locator(".home-picks-group .product-card");
    await expect(cards.first()).toBeVisible();
    await page.waitForFunction(() => [...document.querySelectorAll(".home-picks-group .product-card img")]
      .every((image) => image.complete && image.naturalWidth > 0));
    await page.waitForTimeout(1200);

    const metrics = await cards.evaluateAll((items) => items.map((card) => {
      const cardBox = card.getBoundingClientRect();
      const media = card.querySelector(".product-media").getBoundingClientRect();
      const image = card.querySelector(".product-placeholder img").getBoundingClientRect();
      const body = card.querySelector(".product-body").getBoundingClientRect();
      const title = card.querySelector("h3").getBoundingClientRect();
      const price = card.querySelector(".price strong").getBoundingClientRect();
      const button = card.querySelector(".product-cart-button").getBoundingClientRect();
      return {
        height: cardBox.height,
        bodyRightGap: Math.round((cardBox.right - body.right) * 100) / 100,
        imageInsideCard: image.left >= cardBox.left && image.right <= cardBox.right,
        imageInsideMedia: image.left >= media.left && image.right <= media.right,
        imageTextGap: Math.round((body.left - image.right) * 100) / 100,
        titleFits: title.bottom <= cardBox.bottom,
        priceFits: price.bottom <= cardBox.bottom,
        buttonFits: button.bottom <= cardBox.bottom
      };
    }));
    console.log(JSON.stringify({ width, metrics }));
    for (const metric of metrics) {
      expect(metric.height).toBeLessThanOrEqual(220);
      expect(metric.bodyRightGap).toBeLessThanOrEqual(1);
      expect(metric.imageInsideCard).toBeTruthy();
      expect(metric.imageInsideMedia).toBeTruthy();
      expect(metric.imageTextGap).toBeGreaterThanOrEqual(0);
      expect(metric.titleFits).toBeTruthy();
      expect(metric.priceFits).toBeTruthy();
      expect(metric.buttonFits).toBeTruthy();
    }

    await page.screenshot({
      path: `artifacts/visual-checks/55-home-compact-hits-new-${width}.png`,
      fullPage: false
    });
  });
}
