const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

for (const route of ["/", "/category?type=all", "/favorites"]) {
  test(`footer follows content closely on ${route}`, async ({ page }) => {
    await page.goto(`http://localhost:8000${route}`);
    await page.waitForLoadState("networkidle");
    await page.locator(".site-footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);

    const metrics = await page.locator(".site-footer").evaluate((footer) => {
      const footerBox = footer.getBoundingClientRect();
      return {
        top: footerBox.top,
        marginTop: getComputedStyle(footer).marginTop
      };
    });
    console.log(JSON.stringify({ route, metrics }));
    expect(Number.parseFloat(metrics.marginTop)).toBeLessThanOrEqual(8);

    const slug = route === "/" ? "home" : route.includes("category") ? "category" : "favorites";
    await page.screenshot({
      path: `artifacts/visual-checks/61-footer-raised-${slug}.png`,
      fullPage: false
    });
  });
}
