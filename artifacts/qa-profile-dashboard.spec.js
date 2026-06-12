const { test, expect } = require("@playwright/test");

for (const width of [320, 375, 430]) {
test(`mobile profile uses compact dashboard and product rails at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 812 });
  await page.goto("http://localhost:8000/profile");
  await page.waitForLoadState("networkidle");

  const temporaryLogin = page.getByRole("button", { name: "Войти без почты (временно)" });
  if (await temporaryLogin.isVisible()) {
    await temporaryLogin.click();
  }

  await expect(page.locator("body")).toHaveClass(/profile-view/);
  await expect(page.locator(".top-promo")).toBeHidden();
  await expect(page.locator(".site-header")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Личный кабинет" })).toBeVisible();
  await expect(page.locator(".sona-profile-tabs button")).toHaveCount(5);
  await expect(page.locator(".sona-profile-dashboard-tile")).toHaveCount(5);
  await expect(page.locator(".sona-profile-showcase")).toHaveCount(2);
  const layout = await page.evaluate(() => {
    const header = document.querySelector(".sona-profile-header").getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      headerLeft: header.left,
      headerRight: header.right
    };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.headerLeft).toBeGreaterThanOrEqual(0);
  expect(layout.headerRight).toBeLessThanOrEqual(layout.viewportWidth);
  const tabs = page.locator(".sona-profile-tabs");
  const arrows = page.locator(".sona-profile-tabs-arrow");
  await expect(arrows).toHaveCount(2);
  const beforeTabScroll = await tabs.evaluate((node) => node.scrollLeft);
  await arrows.last().click();
  await page.waitForTimeout(500);
  const afterTabScroll = await tabs.evaluate((node) => node.scrollLeft);
  expect(afterTabScroll).toBeGreaterThan(beforeTabScroll);
  await arrows.first().click();

  await page.waitForFunction(() => [...document.querySelectorAll(".sona-profile-showcase-card img")]
    .every((image) => image.complete && image.naturalWidth > 0));
  await page.waitForTimeout(3500);

  await page.screenshot({
    path: `artifacts/visual-checks/66-profile-dashboard-top-${width}.png`,
    fullPage: false
  });

  const showcases = page.locator(".sona-profile-showcase");
  await showcases.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  if (width === 375) {
    await page.screenshot({
      path: "artifacts/visual-checks/67-profile-recommendations.png",
      fullPage: false
    });
  }

  await showcases.last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  if (width === 375) {
    await page.screenshot({
      path: "artifacts/visual-checks/68-profile-recently-viewed.png",
      fullPage: false
    });
  }

  const ordersTab = page.getByRole("button", { name: "Заказы", exact: true });
  await ordersTab.click();
  await expect(ordersTab).toHaveClass(/is-active/);

  const profileTab = page.locator(".sona-profile-tabs").getByRole("button", { name: "Профиль", exact: true });
  await profileTab.click();
  await expect(profileTab).toHaveClass(/is-active/);
  await expect(page.getByText("Мои отзывы", { exact: true })).toBeVisible();
  await expect(page.getByText("Мои данные", { exact: true })).toBeVisible();
  await expect(page.getByText("Вы смотрели", { exact: true })).toBeVisible();
  await expect(page.getByText(/бонус/i)).toHaveCount(0);
  const firstActions = page.locator(".sona-profile-showcase-card__actions").first();
  await expect(firstActions.locator("button")).toHaveCount(2);

  const productTitles = page.locator(".sona-profile-showcase-card__title");
  expect(await productTitles.count()).toBeGreaterThan(0);
  await productTitles.first().click();
  await expect(page.locator(".product-modal.is-open")).toBeVisible();
});
}
