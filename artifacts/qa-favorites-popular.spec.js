const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

test("favorites popular cards show category and complete bottom content", async ({ page }) => {
  const storeResponse = await page.request.get("http://localhost:8000/api/store");
  const originalPayload = await storeResponse.json();

  try {
    const state = structuredClone(originalPayload.state);
    state.favorites = [];
    await page.request.put("http://localhost:8000/api/store", { data: { state } });

    await page.goto("http://localhost:8000/favorites");
    await page.waitForLoadState("networkidle");

    const section = page.locator(".favorites-hits");
    await section.scrollIntoViewIfNeeded();
    const cards = section.locator(".product-card");
    await expect(cards.first()).toBeVisible();
    const categoryLabels = await section.locator(".product-brand").allTextContents();
    console.log(JSON.stringify({ categoryLabels }));
    expect(categoryLabels.length).toBeGreaterThan(0);
    expect(categoryLabels.every((label) => label.trim().length > 0)).toBeTruthy();

    const firstCard = cards.first();
    const contentFits = await firstCard.evaluate((card) => {
      const cardBottom = card.getBoundingClientRect().bottom;
      const titleBottom = card.querySelector("h3").getBoundingClientRect().bottom;
      const priceBottom = card.querySelector(".price").getBoundingClientRect().bottom;
      return { cardBottom, titleBottom, priceBottom };
    });
    console.log(JSON.stringify({ contentFits }));
    expect(contentFits.titleBottom).toBeLessThan(contentFits.cardBottom);
    expect(contentFits.priceBottom).toBeLessThanOrEqual(contentFits.cardBottom);

    await page.screenshot({
      path: "artifacts/visual-checks/52-favorites-popular-category-content.png",
      fullPage: false
    });
  } finally {
    await page.request.put("http://localhost:8000/api/store", { data: originalPayload });
  }
});
