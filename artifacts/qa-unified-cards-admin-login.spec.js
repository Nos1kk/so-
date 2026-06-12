const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 390, height: 844 } });

test("profile and likes use catalog behavior, cart quantity updates locally, admin login opens", async ({ page }) => {
  test.setTimeout(90000);
  const response = await page.request.get("http://localhost:8000/api/store");
  const original = await response.json();

  try {
    const state = structuredClone(original.state);
    state.cart = { "sona-alaska": 1 };
    state.favorites = ["sona-montana", "sona-paula"];
    state.viewedProductIds = ["sona-alaska", "sona-montana"];
    state.productOverrides = {
      ...(state.productOverrides || {}),
      "sona-alaska": {
        ...(state.productOverrides?.["sona-alaska"] || {}),
        gallery: [
          { id: "photo", src: "assets/фотографии диванов/Аляска.png", alt: "Аляска", main: true, type: "image/png" },
          { id: "video", src: "data:video/mp4;base64,AAAA", alt: "Видео Аляска", main: false, type: "video/mp4" }
        ],
        tags: ["хит"]
      }
    };
    state.profile = { ...(state.profile || {}), isActive: true, name: "Покупатель SONA", role: "user" };
    state.admin = { ...(state.admin || {}), isAuthenticated: false, email: "" };
    await page.request.put("http://localhost:8000/api/store", { data: { state } });

    await page.goto("http://localhost:8000/product?id=sona-alaska");
    const videoThumb = page.locator(".detail-thumb.is-video-thumb");
    await expect(videoThumb).toBeVisible();
    await videoThumb.click();
    await expect(page.locator(".detail-stage video")).toBeVisible();

    await page.goto("http://localhost:8000/profile");
    const profileCart = page.locator(".sona-profile-showcase-card__cart").first();
    await expect(profileCart.locator(".product-cart-icon")).toBeVisible();
    await profileCart.click();
    await expect(profileCart).toHaveClass(/is-(added|removed)/);
    expect(await profileCart.evaluate((element) => getComputedStyle(element).animationName)).toMatch(/cartButton(Add|Remove)/);
    expect(await profileCart.locator(".product-cart-icon").evaluate((element) => getComputedStyle(element).animationName)).toMatch(/cartIcon(Add|Remove)/);

    await page.goto("http://localhost:8000/favorites");
    const likedCards = page.locator(".favorites-grid.category-product-grid > .product-card");
    await expect(likedCards).toHaveCount(2);
    const likedCard = likedCards.first();
    const catalogLikeMetrics = await likedCard.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height) };
    });
    expect(catalogLikeMetrics.height).toBeGreaterThanOrEqual(250);
    await page.waitForTimeout(900);
    await page.screenshot({ path: "artifacts/visual-checks/97-likes-use-catalog-cards.png", fullPage: false });

    await page.goto("http://localhost:8000/cart");
    const item = page.locator('[data-cart-item-id="sona-alaska"]');
    await item.evaluate((element) => {
      element.dataset.testStableCard = "same-card";
    });
    const plus = item.locator("[data-quantity-plus]");
    const amount = item.locator("[data-cart-quantity]");
    await plus.click();
    await expect(amount).toHaveText("2");
    await expect(item).toHaveAttribute("data-test-stable-card", "same-card");
    await expect(item).toHaveClass(/is-quantity-up/);
    expect(await plus.evaluate((element) => getComputedStyle(element).animationName)).toBe("quantityButtonPress");
    await page.screenshot({ path: "artifacts/visual-checks/98-cart-quantity-local-animation.png", fullPage: false });

    const loginState = structuredClone(original.state);
    loginState.profile = { ...(loginState.profile || {}), isActive: false, role: "user" };
    loginState.admin = { ...(loginState.admin || {}), isAuthenticated: false, email: "" };
    await page.request.put("http://localhost:8000/api/store", { data: { state: loginState } });
    await page.evaluate(() => localStorage.removeItem("sona.auth.local"));
    await page.goto("http://localhost:8000/profile");
    const adminLogin = page.getByRole("button", { name: "Войти в аккаунт администратора" });
    await expect(adminLogin).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "artifacts/visual-checks/99-admin-login-button.png", fullPage: false });
    await adminLogin.click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator(".sona-admin-login")).toBeVisible();
    await page.screenshot({ path: "artifacts/visual-checks/99-admin-login-button-opened.png", fullPage: false });
  } finally {
    await page.request.put("http://localhost:8000/api/store", { data: original });
  }
});
