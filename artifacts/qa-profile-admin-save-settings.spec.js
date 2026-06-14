const { test, expect } = require("@playwright/test");

async function readState(page) {
  const response = await page.request.get("http://127.0.0.1:8000/api/store");
  return (await response.json()).state;
}

async function writeState(page, state) {
  await page.request.put("http://127.0.0.1:8000/api/store", { data: { state } });
}

test.describe.serial("profile and admin settings save", () => {
  let original;

  test.beforeEach(async ({ page }) => {
    original = structuredClone(await readState(page));
  });

  test.afterEach(async ({ page }) => {
    await writeState(page, original);
  });

  test("ordinary profile saves and survives reload", async ({ page }) => {
    const state = structuredClone(original);
    state.admin = { ...(state.admin || {}), isAuthenticated: false, email: "" };
    state.profile = {
      ...(state.profile || {}),
      isActive: true,
      role: "user",
      name: "Старое имя",
      email: "profile-save@example.test",
      phone: "",
      address: ""
    };
    state.accountSessions = [];
    await writeState(page, state);

    await page.goto("http://127.0.0.1:8000/profile");
    await page.locator(".sona-profile-header__actions .sona-profile-icon").click();
    const form = page.locator(".sona-profile-settings-form");
    await form.locator('[name="name"]').fill("Новое имя");
    await form.locator('[name="phone"]').fill("+7 999 111-22-33");
    await form.locator('[name="address"]').fill("Москва, Тестовая 1");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(page.locator("#toast")).toContainText("Изменения профиля сохранены");

    let stored = await readState(page);
    expect(stored.profile).toMatchObject({
      name: "Новое имя",
      phone: "+7 999 111-22-33",
      address: "Москва, Тестовая 1"
    });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Новое имя" })).toBeVisible();
  });

  test("admin settings save and survive reload", async ({ page }) => {
    const state = structuredClone(original);
    state.admin = { ...(state.admin || {}), isAuthenticated: true, email: "kcel046@gmail.com" };
    state.profile = {
      ...(state.profile || {}),
      isActive: true,
      role: "admin",
      name: "Администратор SONA",
      email: "kcel046@gmail.com"
    };
    await writeState(page, state);

    await page.goto("http://127.0.0.1:8000/admin");
    await page.locator('[data-admin-section="settings"]').click();
    const form = page.locator(".sona-admin-editor");
    await form.locator('[name="name"]').fill("SONA TEST");
    await form.locator('[name="supportPhone"]').fill("+7 999 000-00-00");
    await form.locator('[name="baseDiscount"]').fill("25");
    await page.getByRole("button", { name: "Сохранить настройки" }).click();
    await expect(page.locator("#toast")).toContainText("Настройки магазина сохранены");

    let stored = await readState(page);
    expect(stored.shopSettings).toMatchObject({
      name: "SONA TEST",
      supportPhone: "+7 999 000-00-00",
      baseDiscount: 25
    });

    await page.reload();
    await page.locator('[data-admin-section="settings"]').click();
    await expect(page.locator('.sona-admin-editor [name="name"]')).toHaveValue("SONA TEST");
    await expect(page.locator('.sona-admin-editor [name="baseDiscount"]')).toHaveValue("25");
  });
});
