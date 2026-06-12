const { test, expect } = require("@playwright/test");

test("new SONA promo and temporary account login work", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("http://localhost:8000/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  await expect(page.locator(".top-promo")).toContainText("SONA: мебель для уютного дома");
  await page.screenshot({
    path: "artifacts/visual-checks/63-sona-promo.png",
    fullPage: false
  });

  await page.goto("http://localhost:8000/profile");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  const temporaryLogin = page.getByRole("button", { name: "Войти без почты (временно)" });
  await expect(temporaryLogin).toBeVisible();
  await page.screenshot({
    path: "artifacts/visual-checks/64-temporary-login-button.png",
    fullPage: false
  });

  await temporaryLogin.click();
  await expect(page.locator(".sona-profile")).toBeVisible();
  await expect(page.locator(".sona-login")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("sona.auth.local") || "null")?.email))
    .toBe("demo@sona.local");
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "artifacts/visual-checks/65-temporary-account-opened.png",
    fullPage: false
  });
});
