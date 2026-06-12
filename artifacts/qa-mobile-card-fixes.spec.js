const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 390, height: 844 } });

async function buttonMetrics(button) {
  return button.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const icon = element.querySelector("svg")?.getBoundingClientRect();
    return {
      width: Math.round(box.width),
      height: Math.round(box.height),
      centerX: Math.round(box.left + box.width / 2),
      centerY: Math.round(box.top + box.height / 2),
      iconCenterX: icon ? Math.round(icon.left + icon.width / 2) : 0,
      iconCenterY: icon ? Math.round(icon.top + icon.height / 2) : 0
    };
  });
}

test("mobile cart, favorites and profile keep photos, buttons and scrolling stable", async ({ page }) => {
  test.setTimeout(90000);
  const response = await page.request.get("http://localhost:8000/api/store");
  const original = await response.json();

  try {
    const state = structuredClone(original.state);
    state.cart = { "sona-alaska": 1 };
    state.favorites = ["sona-montana", "sona-paula"];
    state.viewedProductIds = ["sona-alaska", "sona-montana", "sona-paula", "sona-valencia"];
    state.profile = { ...(state.profile || {}), isActive: true, name: "Покупатель SONA" };
    await page.request.put("http://localhost:8000/api/store", { data: { state } });

    await page.goto("http://localhost:8000/cart");
    await page.waitForTimeout(900);
    const cartPhoto = page.locator(".cart-item .cart-placeholder").first();
    await expect(cartPhoto).toBeVisible();
    const cartPhotoMetrics = await cartPhoto.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const image = element.querySelector("img");
      return {
        width: Math.round(box.width),
        height: Math.round(box.height),
        imageWidth: image?.naturalWidth || 0
      };
    });
    expect(cartPhotoMetrics.width).toBeGreaterThanOrEqual(112);
    expect(cartPhotoMetrics.height).toBeGreaterThanOrEqual(112);
    expect(cartPhotoMetrics.imageWidth).toBeGreaterThan(1000);
    await page.screenshot({ path: "artifacts/visual-checks/93-cart-large-product-photo.png", fullPage: false });

    await page.goto("http://localhost:8000/favorites");
    await page.waitForTimeout(900);
    const favoriteActions = page.locator(".favorite-actions").first();
    const favoriteCart = favoriteActions.locator(".product-cart-button");
    const favoriteHeart = favoriteActions.locator(".favorite-button");
    const favoriteBefore = await buttonMetrics(favoriteCart);
    const heartMetrics = await buttonMetrics(favoriteHeart);
    expect(favoriteBefore.width).toBe(heartMetrics.width);
    expect(favoriteBefore.height).toBe(heartMetrics.height);
    expect(Math.abs(favoriteBefore.centerY - heartMetrics.centerY)).toBeLessThanOrEqual(1);
    await favoriteCart.click();
    await expect(favoriteCart).toHaveClass(/is-added/);
    expect(await favoriteCart.evaluate((element) => getComputedStyle(element).animationName)).toMatch(/cartButtonAdd/);
    await page.waitForTimeout(800);
    const favoriteAfter = await buttonMetrics(favoriteCart);
    expect(favoriteAfter.width).toBe(favoriteBefore.width);
    expect(favoriteAfter.height).toBe(favoriteBefore.height);
    expect(Math.abs(favoriteAfter.centerY - heartMetrics.centerY)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "artifacts/visual-checks/94-favorites-cart-centered.png", fullPage: false });

    await page.goto("http://localhost:8000/profile");
    await page.waitForTimeout(900);
    const profileRail = page.locator(".sona-profile-showcase__rail").first();
    await expect(profileRail).toBeVisible();
    await profileRail.scrollIntoViewIfNeeded();
    const profileCart = page.locator(".sona-profile-showcase-card__cart").first();
    const profileHeart = page.locator(".sona-profile-showcase-card__favorite").first();
    const profileBefore = await buttonMetrics(profileCart);
    const profileHeartMetrics = await buttonMetrics(profileHeart);
    expect(profileBefore.width).toBe(profileHeartMetrics.width);
    expect(profileBefore.height).toBe(profileHeartMetrics.height);
    expect(Math.abs(profileBefore.centerX - profileBefore.iconCenterX)).toBeLessThanOrEqual(1);
    expect(Math.abs(profileBefore.centerY - profileBefore.iconCenterY)).toBeLessThanOrEqual(1);
    await profileCart.click();
    await expect(profileCart).toHaveClass(/is-(added|removed)/);
    expect(await profileCart.evaluate((element) => getComputedStyle(element).animationName)).toMatch(/cartButton(Add|Remove)/);
    await page.waitForTimeout(800);
    const profileAfter = await buttonMetrics(profileCart);
    expect(profileAfter.width).toBe(profileBefore.width);
    expect(profileAfter.height).toBe(profileBefore.height);
    await page.screenshot({ path: "artifacts/visual-checks/95-profile-cart-centered.png", fullPage: false });

    const touchAction = await profileRail.evaluate((element) => getComputedStyle(element).touchAction);
    expect(touchAction).toMatch(/pan-y|manipulation/);
    const beforeScroll = await page.evaluate(() => window.scrollY);
    const railBox = await profileRail.boundingBox();
    await page.mouse.move(railBox.x + railBox.width / 2, railBox.y + railBox.height / 2);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeScroll);
    await page.screenshot({ path: "artifacts/visual-checks/96-profile-scroll-bottom.png", fullPage: false });
  } finally {
    await page.request.put("http://localhost:8000/api/store", { data: original });
  }
});
