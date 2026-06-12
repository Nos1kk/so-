const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

test("favorites popular service card shows only the upper service label", async ({ page }) => {
  await page.goto("http://localhost:8000/favorites");
  await page.waitForLoadState("networkidle");

  const serviceCard = page.locator(".favorites-hits-grid .product-card")
    .filter({ has: page.locator(".product-brand", { hasText: "Услуги" }) })
    .first();
  await expect(serviceCard).toBeVisible();
  await serviceCard.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll(".favorites-hits-grid .product-card img")]
    .every((image) => image.complete && image.naturalWidth > 0));
  await page.waitForTimeout(1000);

  await expect(serviceCard.locator(".product-brand")).toHaveText("Услуги");
  await expect(serviceCard.locator(".product-meta")).toBeHidden();
  const visibleServiceLabels = await serviceCard.evaluate((card) => [...card.querySelectorAll("*")]
    .filter((element) => element.children.length === 0 && element.textContent.trim() === "Услуги")
    .filter((element) => getComputedStyle(element).display !== "none" && element.getBoundingClientRect().height > 0)
    .length);
  expect(visibleServiceLabels).toBe(1);

  await page.screenshot({
    path: "artifacts/visual-checks/62-single-service-label.png",
    fullPage: false
  });
});
