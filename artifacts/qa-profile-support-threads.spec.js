const { test, expect } = require("@playwright/test");

test("support gives users one chat and keeps multiple dialogs for admin", async ({ page }) => {
  const response = await page.request.get("http://127.0.0.1:8000/api/store");
  const original = await response.json();
  const state = structuredClone(original.state);

  state.supportMessages = [];
  state.admin = { ...(state.admin || {}), isAuthenticated: false };
  state.profile = {
    ...(state.profile || {}),
    isActive: true,
    role: "user",
    name: "Кирилл",
    email: "user@example.test",
    phone: ""
  };

  try {
    await page.request.put("http://127.0.0.1:8000/api/store", { data: { state } });
    await page.goto("http://127.0.0.1:8000/profile");
    await page.waitForLoadState("networkidle");

    const userResult = await page.evaluate(() => {
      window.SonaSupport.addMessage("Первый вопрос", "test");
      window.SonaSupport.addMessage("Второй вопрос", "test");

      window.SonaStore.update((data) => {
        data.profile.name = "";
      });
      window.SonaSupport.addMessage("Без имени", "test");

      const data = window.SonaStore.read();
      return {
        messages: data.supportMessages,
        userThreads: window.SonaSupport.visibleThreads(data)
      };
    });

    const supportTab = page.locator(".sona-profile-tabs button").filter({ hasText: "Поддержка" });
    await expect(supportTab).toHaveCount(1);
    await supportTab.click();
    await expect(page.locator(".sona-profile-row")).toHaveCount(1);
    await page.getByRole("button", { name: "Открыть чат", exact: true }).click();
    await expect(page.locator(".sona-support-threads")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Новый чат" })).toHaveCount(0);

    const adminResult = await page.evaluate(() => {
      window.SonaStore.update((data) => {
        data.profile.name = "Главный администратор";
        data.profile.role = "admin";
        data.profile.email = "kcel046@gmail.com";
        data.admin.isAuthenticated = true;
        data.admin.email = "kcel046@gmail.com";
      });
      const target = window.SonaSupport.visibleThreads(window.SonaStore.read())[0];
      window.SonaSupport.addAdminReply("Ответ администратора", { threadId: target.id, accountKey: target.accountKey });

      const data = window.SonaStore.read();
      return {
        messages: data.supportMessages,
        adminThreads: window.SonaSupport.visibleThreads(data)
      };
    });

    expect(userResult.userThreads).toHaveLength(1);
    expect(new Set(adminResult.messages.map((message) => message.accountKey)).size).toBe(1);
    expect(adminResult.messages[0]).toMatchObject({ role: "user", author: "Кирилл" });
    expect(adminResult.messages[2]).toMatchObject({ role: "user", author: "Пользователь" });
    expect(adminResult.messages[3]).toMatchObject({ role: "admin", author: "Администратор SONA" });
    expect(adminResult.adminThreads).toHaveLength(1);
  } finally {
    await page.request.put("http://127.0.0.1:8000/api/store", { data: { state: original.state } });
  }
});
