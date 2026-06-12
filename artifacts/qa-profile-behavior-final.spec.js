const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 812 } });

async function loginIfNeeded(page) {
  const login = page.getByRole("button", { name: "Войти без почты (временно)" });
  if (await login.isVisible()) await login.click();
}

async function waitForProfileImages(page) {
  await page.waitForFunction(() => [...document.querySelectorAll(".sona-profile-showcase-card img")]
    .every((image) => image.complete && image.naturalWidth > 0));
  await page.waitForTimeout(800);
}

async function waitForScrollToSettle(page) {
  await page.waitForFunction(() => new Promise((resolve) => {
    let lastY = window.scrollY;
    let stableFrames = 0;
    const check = () => {
      const nextY = window.scrollY;
      stableFrames = Math.abs(nextY - lastY) < 0.5 ? stableFrames + 1 : 0;
      lastY = nextY;
      if (stableFrames >= 5) resolve(true);
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }));
}

test("profile uses catalog animations without viewport jumps", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("http://localhost:8000/profile");
  await page.waitForLoadState("networkidle");
  await loginIfNeeded(page);
  await waitForProfileImages(page);

  const actions = page.locator(".sona-profile-showcase-card__actions").first();
  await actions.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  await waitForScrollToSettle(page);
  const favorite = actions.locator(".favorite-button");
  const cart = actions.locator(".product-cart-button");
  const before = await actions.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    scrollY: window.scrollY
  }));

  await favorite.click();
  const currentFavorite = page.locator(".sona-profile-showcase-card__actions").first().locator(".favorite-button");
  await page.waitForTimeout(80);
  await expect(currentFavorite).toHaveClass(/is-favorite-(added|removed)/);
  const favoriteAnimation = await currentFavorite.evaluate((element) => getComputedStyle(element).animationName);
  expect(favoriteAnimation).toMatch(/favoritePop|profileFavoriteRemove/);

  const currentCart = page.locator(".sona-profile-showcase-card__actions").first().locator(".product-cart-button");
  await currentCart.click();
  const refreshedCart = page.locator(".sona-profile-showcase-card__actions").first().locator(".product-cart-button");
  await expect(refreshedCart).toHaveClass(/is-(added|removed)/);
  const cartAnimation = await refreshedCart.evaluate((element) => getComputedStyle(element).animationName);
  expect(cartAnimation).toMatch(/cartButton(Add|Remove)/);

  const after = await page.locator(".sona-profile-showcase-card__actions").first().evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    scrollY: window.scrollY
  }));
  expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThanOrEqual(1);
  expect(Math.abs((after.top + after.scrollY) - (before.top + before.scrollY))).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "artifacts/visual-checks/81-profile-catalog-animations.png", fullPage: false });
});

test("profile rails stay contained and use real viewed and liked products", async ({ page }) => {
  test.setTimeout(90000);
  const storeResponse = await page.request.get("http://localhost:8000/api/store");
  const payload = await storeResponse.json();
  const state = structuredClone(payload.state);
  state.favorites = ["sona-andreas"];
  state.viewedProductIds = ["sona-naples-md", "sona-andreas"];
  state.profile = { ...(state.profile || {}), isActive: false, name: "Покупатель SONA" };
  await page.request.put("http://localhost:8000/api/store", { data: { state } });

  await page.goto("http://localhost:8000/profile");
  await page.waitForLoadState("networkidle");
  await loginIfNeeded(page);
  await waitForProfileImages(page);

  await expect(page.getByText("Пользователь", { exact: true })).toBeVisible();
  await expect(page.getByText("Вы смотрели", { exact: true })).toBeVisible();
  await expect(page.locator(".sona-profile-showcase").filter({ hasText: "Вы смотрели" }).getByText("Неаполь МД", { exact: true })).toBeVisible();

  const rails = page.locator(".sona-profile-showcase__rail");
  await expect(rails).toHaveCount(2);
  const rail = rails.first();
  await rail.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => ({
    pageX: window.scrollX,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));
  await rail.evaluate((element) => element.scrollTo({ left: 220, behavior: "instant" }));
  const after = await page.evaluate(() => ({
    pageX: window.scrollX,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));
  expect(after.pageX).toBe(0);
  expect(after.documentWidth).toBeLessThanOrEqual(after.viewportWidth);
  expect(await rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.screenshot({ path: "artifacts/visual-checks/82-profile-real-rails.png", fullPage: false });
});

test("profile navigation, save and footer spacing stay stable", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("http://localhost:8000/profile");
  await page.waitForLoadState("networkidle");
  await loginIfNeeded(page);

  await expect(page.locator('[data-mobile-action="favorites"] strong')).toHaveText("Лайки");
  await expect(page.locator('[data-mobile-action="profile"] strong')).toHaveText("Профиль");

  const edit = page.locator(".sona-profile-header__actions .sona-profile-icon");
  await edit.click();
  const back = page.getByRole("button", { name: "Вернуться в профиль" });
  await expect(back).toBeVisible();

  const form = page.locator(".sona-profile-settings-form");
  await form.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await waitForScrollToSettle(page);
  const submit = form.locator('button[type="submit"]');
  await submit.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await waitForScrollToSettle(page);
  const before = await submit.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    scrollY: window.scrollY
  }));
  await submit.click();
  await page.waitForTimeout(250);
  const after = await page.locator('.sona-profile-settings-form button[type="submit"]').evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    scrollY: window.scrollY
  }));
  console.log(JSON.stringify({ saveBefore: before, saveAfter: after }));
  expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThanOrEqual(1);
  expect(Math.abs((after.top + after.scrollY) - (before.top + before.scrollY))).toBeLessThanOrEqual(1);

  await back.click();
  await expect(page.getByRole("heading", { name: "Личный кабинет" })).toBeVisible();
  const footerGap = await page.evaluate(() => {
    const account = document.querySelector(".account-page").getBoundingClientRect();
    const footer = document.querySelector(".site-footer").getBoundingClientRect();
    return Math.round(footer.top - account.bottom);
  });
  expect(footerGap).toBeLessThanOrEqual(12);
  await page.screenshot({ path: "artifacts/visual-checks/83-profile-compact-spacing.png", fullPage: false });
});
