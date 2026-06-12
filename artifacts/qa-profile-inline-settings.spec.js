const { test, expect } = require("@playwright/test");

test("profile edits inline and notification settings save without modal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("http://localhost:8000/profile");
  await page.waitForLoadState("networkidle");

  const temporaryLogin = page.getByRole("button", { name: "Войти без почты (временно)" });
  if (await temporaryLogin.isVisible()) await temporaryLogin.click();

  await expect(page.locator("#profileModal")).toHaveCount(0);
  await page.locator(".sona-profile-header__actions .sona-profile-icon").click();
  await expect(page.locator(".sona-profile-settings-form")).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "artifacts/visual-checks/70-profile-inline-settings-top.png",
    fullPage: false
  });

  const name = page.locator('.sona-profile-settings-form input[name="name"]');
  await name.fill("Покупатель SONA");
  const emailToggle = page.locator('.sona-profile-settings-form input[name="notifyEmail"]');
  await emailToggle.uncheck();
  await page.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect(page.locator(".sona-profile-settings-form")).toBeVisible();
  await expect(page.locator('.sona-profile-settings-form input[name="name"]')).toHaveValue("Покупатель SONA");
  await expect(page.locator('.sona-profile-settings-form input[name="notifyEmail"]')).not.toBeChecked();
  await page.getByRole("button", { name: "Отправить тестовое уведомление" }).click();
  await expect(page.locator(".sona-profile-notification-status")).toContainText("на сайте");

  await page.getByRole("button", { name: "Отключить все уведомления" }).click();
  await expect(page.locator('.sona-profile-settings-form input[name="notifySite"]')).not.toBeChecked();
  await expect(page.locator('.sona-profile-settings-form input[name="notifyEmail"]')).not.toBeChecked();
  const notificationEndpoint = await page.request.post("http://localhost:8000/api/notifications/test", {
    data: { email: "invalid" }
  });
  expect(notificationEndpoint.status()).toBe(400);

  await page.screenshot({
    path: "artifacts/visual-checks/70-profile-inline-settings.png",
    fullPage: false
  });
});
