const { test, expect } = require("@playwright/test");
const path = require("path");

test.use({ viewport: { width: 390, height: 844 } });

test("mobile admin tabs work and support is a dedicated page", async ({ page }) => {
  test.setTimeout(90000);
  const response = await page.request.get("http://localhost:8000/api/store");
  const original = await response.json();

  try {
    const state = structuredClone(original.state);
    state.admin = { ...(state.admin || {}), isAuthenticated: true, email: "kcel046@gmail.com" };
    state.profile = {
      ...(state.profile || {}),
      isActive: true,
      role: "admin",
      email: "kcel046@gmail.com",
      name: "Администратор SONA"
    };
    state.orders = Array.from({ length: 18 }, (_, index) => ({
      id: `SONA-MOBILE-${index + 1}`,
      date: `0${(index % 8) + 1}.06.2026`,
      createdAt: Date.now() - index * 86400000,
      status: index % 3 === 0 ? "completed" : index % 3 === 1 ? "processing" : "new",
      total: 72000 + index * 1000,
      profile: {
        name: `Клиент ${index + 1}`,
        phone: `+799900000${String(index).padStart(2, "0")}`,
        email: `client${index + 1}@example.com`
      },
      items: [{ id: index % 2 ? "sona-alaska" : "sona-naples-md", quantity: 1 }]
    }));
    state.supportMessages = [
      {
        id: "mobile-admin-test-message",
        role: "user",
        author: "Тестовый покупатель",
        text: "Нужна помощь с заказом",
        phone: "+79990000000",
        status: "new",
        createdAt: new Date().toISOString()
      },
      {
        id: "mobile-admin-test-message-2",
        role: "user",
        author: "Второй покупатель",
        text: "Вопрос по доставке",
        email: "second@example.com",
        status: "new",
        createdAt: Date.now() + 1
      }
    ];
    await page.request.put("http://localhost:8000/api/store", { data: { state } });

    await page.goto("http://localhost:8000/admin");
    await expect(page.locator("body")).toHaveClass(/admin-view/);
    await expect(page.locator(".site-header")).toBeHidden();
    await expect(page.locator(".top-promo")).toBeHidden();
    await expect(page.locator(".sona-admin-head")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Выйти из аккаунта администратора" })).toBeVisible();
    await expect(page.locator(".sona-admin-menu")).toBeVisible();
    await expect(page.locator(".sona-admin-menu [data-admin-section='home']")).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".sona-admin-section .sona-admin-chat")).toHaveCount(0);
    await expect(page.locator(".support-chat-root")).toBeHidden();

    for (const section of ["stats", "orders", "products", "users", "reviews", "ads", "settings"]) {
      const button = page.locator(`[data-admin-section="${section}"]`);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await expect(page.locator(`[data-admin-section="${section}"]`)).toHaveAttribute("aria-current", "page");
    }

    const support = page.locator('[data-admin-section="support"]');
    await support.scrollIntoViewIfNeeded();
    await support.click();
    await expect(page.locator('[data-admin-section="support"]')).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".sona-admin-chat")).toBeVisible();
    await expect(page.locator(".sona-admin-dialogs button")).toHaveCount(2);
    await page.locator(".sona-admin-dialogs button").filter({ hasText: "Второй покупатель" }).click();
    await expect(page.locator(".sona-admin-chat-history")).toContainText("Вопрос по доставке");
    const supportTabPosition = await page.locator('[data-admin-section="support"]').evaluate((element) => {
      const tab = element.getBoundingClientRect();
      const menu = element.parentElement.getBoundingClientRect();
      return { left: tab.left, right: tab.right, menuLeft: menu.left, menuRight: menu.right };
    });
    expect(supportTabPosition.left).toBeGreaterThanOrEqual(supportTabPosition.menuLeft);
    expect(supportTabPosition.right).toBeLessThanOrEqual(supportTabPosition.menuRight + 1);

    const layout = await page.locator(".sona-admin").evaluate((element) => ({
      width: Math.round(element.getBoundingClientRect().width),
      viewport: document.documentElement.clientWidth,
      columns: getComputedStyle(element).gridTemplateColumns
    }));
    expect(layout.width).toBeLessThanOrEqual(layout.viewport);
    expect(layout.columns.split(" ")).toHaveLength(1);

    await page.screenshot({ path: "artifacts/visual-checks/100-admin-mobile-support.png", fullPage: false });

    await page.locator('[data-admin-section="home"]').click();
    await page.getByRole("button", { name: /Всего заказов/ }).click();
    await expect(page.locator(".sona-admin-order-card")).toHaveCount(8);
    await expect(page.locator(".sona-admin-pagination")).toContainText("1 из 3");
    const orderSearch = page.locator(".sona-admin-filter-row input[type='search']");
    await orderSearch.fill("client7@example.com");
    await page.waitForTimeout(300);
    await expect(orderSearch).toBeFocused();
    await expect(page.locator(".sona-admin-order-card")).toHaveCount(1);
    const status = page.locator(".sona-admin-order-card select");
    await status.selectOption("completed");
    await page.waitForTimeout(300);
    const updatedStore = await (await page.request.get("http://localhost:8000/api/store")).json();
    expect(updatedStore.state.orders.find((order) => order.id === "SONA-MOBILE-7").status).toBe("completed");
    await page.screenshot({ path: "artifacts/visual-checks/102-admin-mobile-orders.png", fullPage: false });

    await page.locator('[data-admin-section="stats"]').click();
    await expect(page.locator(".sona-admin-stats-compact .sona-admin-stat")).toHaveCount(4);
    await page.getByRole("button", { name: "Неделя" }).click();
    await expect(page.getByRole("button", { name: "Неделя" })).toHaveClass(/is-active/);
    await page.screenshot({ path: "artifacts/visual-checks/103-admin-mobile-statistics.png", fullPage: false });

    const products = page.locator('[data-admin-section="products"]');
    await products.scrollIntoViewIfNeeded();
    await products.click();
    const search = page.locator('.sona-products-toolbar input[type="search"]');
    await search.fill("Неаполь");
    await page.waitForTimeout(300);
    await expect(search).toBeFocused();
    await expect(search).toHaveValue("Неаполь");
    await expect(page.locator(".sona-products-table tbody tr")).toHaveCount(2);
    const productsLayout = await page.locator(".sona-products-table").evaluate((element) => ({
      width: Math.round(element.getBoundingClientRect().width),
      scrollWidth: element.scrollWidth,
      viewport: document.documentElement.clientWidth
    }));
    expect(productsLayout.width).toBeLessThanOrEqual(productsLayout.viewport);
    expect(productsLayout.scrollWidth).toBeLessThanOrEqual(productsLayout.width + 1);

    await page.locator(".sona-products-actions button").filter({ hasText: "Редактировать" }).first().click();
    await expect(page.locator(".sona-product-editor")).toBeVisible();
    await page.locator('[data-editor-tab="seo"]').click();
    await expect(page.locator(".sona-product-editor")).toHaveAttribute("data-active-editor-tab", "seo");
    await page.locator('[name="seoTitle"]').fill("SEO Неаполь");
    await expect(page.locator(".sona-product-editor")).toHaveAttribute("data-active-editor-tab", "seo");
    await page.locator('[data-editor-tab="photos"]').click();
    const upload = page.locator(".sona-photo-drop input[type='file']");
    const photoCardsBefore = await page.locator(".sona-photo-card").count();
    await upload.setInputFiles(path.join(__dirname, "..", "public", "assets", "sona-logo.png"));
    await expect(page.locator(".sona-photo-card")).toHaveCount(photoCardsBefore + 1);
    await expect(page.locator(".sona-product-editor")).toHaveAttribute("data-active-editor-tab", "photos");

    await page.locator('[data-editor-tab="specs"]').click();
    await page.locator('[name="dimensions"]').fill("2500 × 1180 × 860");
    await page.locator('[name="sleepingPlace"]').fill("1600 × 2000");
    await page.locator('[data-editor-tab="preview"]').click();
    await expect(page.locator(".sona-preview-characteristics")).toContainText("2500 × 1180 × 860");
    await expect(page.locator(".sona-preview-characteristics")).toContainText("1600 × 2000");
    const editorLayout = await page.locator(".sona-product-editor").evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      scrollWidth: element.scrollWidth
    }));
    expect(editorLayout.scrollWidth).toBeLessThanOrEqual(editorLayout.width + 1);

    await page.locator('[data-editor-tab="photos"]').click();
    await page.screenshot({ path: "artifacts/visual-checks/101-admin-mobile-product-editor.png", fullPage: false });

    await page.locator('[data-admin-section="ads"]').click();
    await expect(page.locator(".sona-admin-ad-slot")).toHaveCount(3);
    await page.locator('[data-admin-section="settings"]').click();
    await page.getByRole("button", { name: "Проверить сервер" }).click();
    await expect(page.locator(".sona-admin-server")).toContainText("Сервер работает");
  } finally {
    await page.request.put("http://localhost:8000/api/store", { data: original });
  }
});
