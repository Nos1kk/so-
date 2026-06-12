const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

for (const type of ["beds", "chairs", "services"]) {
  test(`${type} cards use white product media`, async ({ page }) => {
    await page.goto(`http://localhost:8000/category?type=${type}`);
    await page.waitForLoadState("networkidle");
    const cards = page.locator(".category-product-grid .product-card");
    await expect(cards.first()).toBeVisible();
    expect(await page.locator(".category-product-grid .product-card:not(.is-white-media-card)").count()).toBe(0);

    const colors = await cards.evaluateAll((items) => items.map((card) => {
      const media = card.querySelector(".product-media");
      const placeholder = card.querySelector(".product-placeholder");
      return {
        mediaColor: getComputedStyle(media).backgroundColor,
        mediaImage: getComputedStyle(media).backgroundImage,
        placeholderColor: getComputedStyle(placeholder).backgroundColor,
        placeholderImage: getComputedStyle(placeholder).backgroundImage
      };
    }));
    console.log(JSON.stringify({ type, colors }));
    for (const color of colors) {
      expect(color.mediaColor).toBe("rgb(255, 255, 255)");
      expect(color.mediaImage).toBe("none");
      expect(color.placeholderColor).toBe("rgb(255, 255, 255)");
      expect(color.placeholderImage).toBe("none");
    }

    await cards.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `artifacts/visual-checks/60-white-media-${type}.png`,
      fullPage: false
    });
  });
}
