const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 400, height: 850 } });

test("sofa category buttons navigate to their own filtered pages", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("http://localhost:8000/category?type=sofas");
  await page.waitForLoadState("networkidle");

  const cases = [
    { label: "Компактные", type: "диван-кровать", title: "Компактные модели" },
    { label: "Просторные", type: "угловой", title: "Просторные диваны" },
    { label: "Акцентные", type: "модульный", title: "Акцентные модели" },
    { label: "Все диваны", type: "sofas", title: "Диваны SONA" }
  ];

  for (const item of cases) {
    const switcher = page.locator(".category-page-switcher");
    await switcher.getByRole("button", { name: item.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/category\\?type=${encodeURIComponent(item.type)}`));
    await expect(page.locator(".category-page-head h2")).toHaveText(item.title);
    await expect(switcher.getByRole("button", { name: item.label, exact: true })).toHaveClass(/is-active/);
  }

  await page.waitForTimeout(800);
  await page.screenshot({
    path: "artifacts/visual-checks/88-category-switch-navigation.png",
    fullPage: false
  });
});
