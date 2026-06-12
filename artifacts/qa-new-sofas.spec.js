const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

async function waitForLoadedImage(image) {
  await expect(image).toBeVisible();
  await image.evaluate((element) => element.complete
    ? Promise.resolve()
    : new Promise((resolve) => element.addEventListener("load", resolve, { once: true })));
  expect(await image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(1000);
}

test("new sofas appear in sofa catalog with correct details", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("http://localhost:8000/category?type=sofas");
  await page.waitForLoadState("networkidle");

  const naples = page.locator(".category-product-grid .product-card").filter({ hasText: "Неаполь МД" });
  const andreas = page.locator(".category-product-grid .product-card").filter({ hasText: "Андреас" });

  await expect(naples).toBeVisible();
  await expect(andreas).toBeVisible();
  await waitForLoadedImage(naples.locator(".product-media img"));
  await waitForLoadedImage(andreas.locator(".product-media img"));
  await page.waitForTimeout(800);
  await expect(naples).toContainText("123 882 ₽");
  await expect(naples).toContainText("150 330 ₽");
  await expect(naples).toContainText("−10%");
  await expect(naples).toContainText("3160 × 1700 × 860");
  await expect(andreas).toContainText("46 900 ₽");
  await expect(andreas).toContainText("1840 × 1130 × 900");
  await expect(andreas).toContainText("Аккордеон");

  await naples.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/visual-checks/71-new-sofas-catalog.png",
    fullPage: false
  });
  await andreas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "artifacts/visual-checks/74-andreas-catalog.png",
    fullPage: false
  });

  for (const product of [
    {
      id: "sona-naples-md",
      name: "Неаполь МД",
      price: "123 882 ₽",
      details: ["3160 × 1700 × 860", "1600 × 3000"],
      screenshot: "artifacts/visual-checks/72-naples-md-detail.png"
    },
    {
      id: "sona-andreas",
      name: "Андреас",
      price: "46 900 ₽",
      details: ["1840 × 1130 × 900", "2000 × 1500", "Аккордеон"],
      screenshot: "artifacts/visual-checks/73-andreas-detail.png"
    }
  ]) {
    await page.goto(`http://localhost:8000/product?id=${product.id}`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".detail-title-row h2")).toHaveText(product.name);
    await expect(page.locator(".detail-price-main")).toContainText(product.price);
    for (const detail of product.details) {
      await expect(page.locator(".detail-characteristics")).toContainText(detail);
    }

    const mainImage = page.locator(".detail-stage img");
    await waitForLoadedImage(mainImage);
    await page.waitForTimeout(800);
    await page.screenshot({ path: product.screenshot, fullPage: false });
  }
});
