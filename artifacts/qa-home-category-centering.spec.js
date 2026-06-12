const { test, expect } = require("@playwright/test");

for (const width of [320, 375, 430]) {
  test(`home bed and chair stay centered at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("http://localhost:8000/");
    await page.waitForLoadState("networkidle");

    const cards = page.locator(".catalog-hub-card--bed, .catalog-hub-card--chair");
    await expect(cards.first()).toBeVisible();
    await cards.first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll(".catalog-hub-card--bed img, .catalog-hub-card--chair img")]
      .every((image) => image.complete && image.naturalWidth > 0));
    await page.waitForTimeout(1200);

    const metrics = await cards.evaluateAll((items) => items.map((card) => {
      const cardRect = card.getBoundingClientRect();
      const media = card.querySelector(".catalog-hub-photo").getBoundingClientRect();
      const image = card.querySelector("img").getBoundingClientRect();
      const title = card.querySelector("strong").getBoundingClientRect();
      const transform = getComputedStyle(card.querySelector("img")).transform;
      return {
        cardHeight: Math.round(cardRect.height),
        horizontalOffset: Math.round(((image.left + image.width / 2) - (media.left + media.width / 2)) * 100) / 100,
        titleImageGap: Math.round((image.top - title.bottom) * 100) / 100,
        titleBackground: getComputedStyle(card.querySelector("strong")).backgroundImage,
        transform,
        shiftY: Number(transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)/)?.[1] || 0)
      };
    }));
    console.log(JSON.stringify({ width, metrics }));
    for (const metric of metrics) {
      expect(metric.cardHeight).toBeLessThanOrEqual(146);
      expect(Math.abs(metric.horizontalOffset)).toBeLessThanOrEqual(1);
      expect(metric.titleBackground).not.toBe("none");
      expect(metric.transform).not.toBe("none");
      expect(metric.shiftY).toBeGreaterThanOrEqual(10);
    }

    await page.screenshot({
      path: `artifacts/visual-checks/54-home-bed-chair-centered-${width}.png`,
      fullPage: false
    });
  });
}
