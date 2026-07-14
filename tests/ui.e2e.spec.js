const { test, expect } = require("playwright/test");

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test("desktop/mobile routes, lazy modules and admin product realtime propagation", async ({ browser, baseURL }) => {
  const customerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const customerPage = await customerContext.newPage();
  const customerScripts = [];
  customerPage.on("request", (request) => {
    if (request.resourceType() === "script") customerScripts.push(new URL(request.url()).pathname);
  });
  await customerPage.goto(baseURL || "/");
  await expect(customerPage.locator(".product-card").first()).toBeVisible();
  expect(customerScripts.some((url) => url.includes("/admin/"))).toBe(false);
  expect(customerScripts.some((url) => url.includes("/profile/Profile.js"))).toBe(false);

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${baseURL}/admin`);
  await expect(adminPage.locator("body")).toHaveClass(/admin-view/);
  if (await adminPage.locator(".sona-admin-login").isVisible()) {
    await adminPage.locator('.sona-admin-login input[type="email"]').fill("kcel046@gmail.com");
    await adminPage.locator('.sona-admin-login input[type="password"]').fill("SonaTest2026!");
    await adminPage.locator(".sona-admin-login form button").click();
  }
  await expect(adminPage.locator(".sona-admin-menu")).toBeVisible();
  await adminPage.locator('[data-admin-section="products"]').click();
  await expect(adminPage.locator(".sona-products-page")).toBeVisible();

  const productName = `Browser Realtime Sofa ${Date.now()}`;
  await adminPage.locator(".sona-products-toolbar button").first().click();
  await adminPage.locator('.sona-category-card[data-category="sofa"]').click();
  await adminPage.locator('.sona-product-editor [name="name"]').fill(productName);
  await adminPage.locator('.sona-product-editor [name="price"]').fill("123400");
  await adminPage.locator('[data-editor-tab="photos"]').click();
  await adminPage.locator(".sona-photo-drop input[type=file]").setInputFiles({
    name: "browser-sofa.png",
    mimeType: "image/png",
    buffer: PNG_1PX
  });
  await expect(adminPage.locator(".sona-photo-card")).toHaveCount(1);
  await adminPage.locator(".sona-editor-actions .is-primary").click();
  await expect(adminPage.locator(".sona-products-table")).toContainText(productName);

  await expect(customerPage.getByText(productName, { exact: true })).toHaveCount(1, { timeout: 10000 });
  await customerPage.goto(`${baseURL}/category?type=all`);
  await expect(customerPage.locator("h3:visible", { hasText: productName })).toBeVisible();
  const publicStore = await customerContext.request.get(`${baseURL}/api/store`);
  const publicState = await publicStore.json();
  const publicProduct = publicState.state.customProducts.find((product) => product.name === productName);
  expect(publicProduct).toBeTruthy();
  expect(publicProduct.price).toBe(123400);
  expect(publicProduct.image).toMatch(/^\/media\//);

  await customerPage.goto(`${baseURL}/profile`);
  await expect(customerPage.locator("#profilePage")).toBeVisible();
  await expect(customerPage.locator("#profilePage input").first()).toBeVisible();
  expect(customerScripts.some((url) => url.includes("/profile/Profile.js"))).toBe(true);
  expect(customerScripts.some((url) => url.includes("/admin/Admin.js"))).toBe(false);

  const mobilePage = await adminContext.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.goto(`${baseURL}/admin`);
  await expect(mobilePage.locator("body")).toHaveClass(/admin-view/);
  await expect(mobilePage.locator(".sona-admin-menu")).toBeVisible();
  const mobileLayout = await mobilePage.locator("body").evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(mobileLayout.scrollWidth).toBeLessThanOrEqual(mobileLayout.clientWidth + 2);
  await mobilePage.screenshot({ path: "test-results/admin-mobile-after.png", fullPage: false });
  await adminPage.screenshot({ path: "test-results/admin-desktop-after.png", fullPage: false });

  await customerContext.close();
  await adminContext.close();
});
