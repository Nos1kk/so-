const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

test("product detail is compact, one-click toggles, similar products open", async ({ page }) => {
  await page.goto("http://localhost:8000/product?id=sona-island");
  await page.waitForLoadState("networkidle");

  const modal = page.locator("#productModal");
  const detail = page.locator("#productDetail");
  const stage = page.locator(".detail-stage");
  const image = stage.locator("img");
  await expect(modal).toHaveClass(/is-open/);
  await expect(image).toBeVisible();

  const stageMetrics = await stage.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const imageBox = element.querySelector("img").getBoundingClientRect();
    return { stageHeight: box.height, imageHeight: imageBox.height, bottomGap: Math.round((box.bottom - imageBox.bottom) * 100) / 100 };
  });
  console.log(JSON.stringify({ stageMetrics }));
  expect(stageMetrics.stageHeight).toBeLessThanOrEqual(270);
  expect(stageMetrics.imageHeight).toBeGreaterThanOrEqual(260);

  await stage.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/visual-checks/58-product-detail-compact-sofa.png",
    fullPage: false
  });

  const buyButton = page.getByRole("button", { name: "Купить в 1 клик" });
  await buyButton.scrollIntoViewIfNeeded();
  await buyButton.click();
  await expect(buyButton).toHaveClass(/is-open/);
  await expect(buyButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".seller-call")).toBeVisible();
  expect(await buyButton.evaluate((element) => getComputedStyle(element).animationName)).not.toBe("none");

  await page.waitForTimeout(700);
  await buyButton.click();
  await expect(buyButton).not.toHaveClass(/is-open/);
  await expect(buyButton).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".seller-call")).toBeHidden();
  expect(await buyButton.evaluate((element) => getComputedStyle(element).animationName)).not.toBe("none");

  const originalTitle = await page.locator(".detail-title-row h2").innerText();
  const similar = page.locator("[data-similar-product-id]").first();
  await similar.scrollIntoViewIfNeeded();
  await similar.click();
  await expect(page.locator(".detail-title-row h2")).not.toHaveText(originalTitle);
  expect(await detail.evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: "artifacts/visual-checks/59-similar-product-opened.png",
    fullPage: false
  });
});
