const { test, expect } = require("@playwright/test");

async function readState(page) {
  const response = await page.request.get("http://127.0.0.1:8000/api/store");
  return (await response.json()).state;
}

async function writeState(page, state) {
  await page.request.put("http://127.0.0.1:8000/api/store", { data: { state } });
}

function userState(state, name = "Тестовый пользователь", email = "support-user@example.test") {
  state.supportMessages = [];
  state.admin = { ...(state.admin || {}), isAuthenticated: false, email: "" };
  state.profile = { ...(state.profile || {}), isActive: true, role: "user", name, email, phone: "" };
  return state;
}

test.describe.serial("support full regression", () => {
  let original;

  test.beforeEach(async ({ page }) => {
    original = structuredClone(await readState(page));
  });

  test.afterEach(async ({ page }) => {
    await writeState(page, original);
  });

  test("isolates users and only treats the real admin account as admin", async ({ page }) => {
    const state = userState(structuredClone(original), "Анна", "anna@example.test");
    await writeState(page, state);
    await page.goto("http://127.0.0.1:8000/profile");
    await page.waitForLoadState("networkidle");

    const result = await page.evaluate(() => {
      window.SonaSupport.addMessage("Вопрос Анны", "test");
      const anna = window.SonaSupport.visibleThreads(window.SonaStore.read()).length;

      const annaThread = window.SonaSupport.visibleThreads(window.SonaStore.read())[0].id;
      window.SonaStore.update((data) => {
        data.profile.email = "boris@example.test";
        data.profile.name = "Борис";
      });
      const boris = window.SonaSupport.visibleThreads(window.SonaStore.read()).length;
      const fakeReply = window.SonaSupport.addAdminReply("Поддельный ответ", { threadId: annaThread });
      window.SonaSupport.addMessage("Попытка попасть в чужой чат", "test", [], { threadId: annaThread, accountKey: "user:anna@example.test" });
      const borisThread = window.SonaSupport.visibleThreads(window.SonaStore.read())[0];

      window.SonaStore.update((data) => {
        data.admin = { isAuthenticated: true, email: "fake-admin@example.test" };
        data.profile.role = "admin";
      });
      const fakeAdmin = window.SonaSupport.visibleThreads(window.SonaStore.read()).length;

      window.SonaStore.update((data) => {
        data.admin = { isAuthenticated: true, email: "kcel046@gmail.com" };
        data.profile = { ...data.profile, isActive: true, role: "admin", email: "kcel046@gmail.com" };
      });
      const realAdmin = window.SonaSupport.visibleThreads(window.SonaStore.read()).length;
      return {
        anna,
        boris,
        fakeReply,
        isolatedThread: borisThread.id !== annaThread && borisThread.messages[0].accountKey === "user:boris@example.test",
        fakeAdmin,
        realAdmin
      };
    });

    expect(result).toEqual({ anna: 1, boris: 0, fakeReply: false, isolatedThread: true, fakeAdmin: 1, realAdmin: 2 });
  });

  test("validates formats, size, count and storage capacity", async ({ page }) => {
    await writeState(page, userState(structuredClone(original)));
    await page.goto("http://127.0.0.1:8000/profile");
    await page.waitForLoadState("networkidle");

    const report = await page.evaluate(() => {
      const data = (type, payload = "QQ==") => `data:${type};base64,${payload}`;
      const files = [
        { name: "photo.png", type: "image/png", size: 1, dataUrl: data("image/png") },
        { name: "manual.pdf", type: "application/pdf", size: 1, dataUrl: data("application/pdf") },
        { name: "table.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 1, dataUrl: data("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") },
        { name: "fourth.txt", type: "text/plain", size: 1, dataUrl: data("text/plain") }
      ];
      const supportedTypes = [
        ["photo.webp", "image/webp"],
        ["manual.pdf", "application/pdf"],
        ["data.json", "application/json"],
        ["document.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        ["table.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        ["slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
        ["archive.zip", "application/zip"],
        ["video.mp4", "video/mp4"],
        ["audio.mp3", "audio/mpeg"]
      ];
      return {
        supportedTypes: supportedTypes.every(([name, type]) => window.SonaSupport.validateAttachments([{ name, type, size: 1, dataUrl: data(type) }]).accepted.length === 1),
        count: window.SonaSupport.validateAttachments(files),
        unsupported: window.SonaSupport.validateAttachments([{ name: "run.exe", type: "application/x-msdownload", size: 1, dataUrl: data("application/x-msdownload") }]),
        disguisedHtml: window.SonaSupport.validateAttachments([{ name: "looks-safe.txt", type: "text/html", size: 1, dataUrl: data("text/html") }]),
        mismatchedContent: window.SonaSupport.validateAttachments([{ name: "looks-safe.txt", type: "text/plain", size: 1, dataUrl: data("text/html") }]),
        oversized: window.SonaSupport.validateAttachments([{ name: "big.pdf", type: "application/pdf", size: 7 * 1024 * 1024, dataUrl: data("application/pdf") }]),
        noSpace: window.SonaSupport.validateAttachments([{ name: "small.txt", type: "text/plain", size: 1, dataUrl: data("text/plain") }], { storageLeft: 1 })
      };
    });

    expect(report.supportedTypes).toBeTruthy();
    expect(report.count.accepted).toHaveLength(3);
    expect(report.count.rejected[0].reason).toContain("не больше 3");
    expect(report.unsupported.accepted).toHaveLength(0);
    expect(report.unsupported.rejected[0].reason).toContain("не поддерживается");
    expect(report.disguisedHtml.rejected[0].reason).toContain("не поддерживается");
    expect(report.mismatchedContent.rejected[0].reason).toContain("не соответствует");
    expect(report.oversized.rejected[0].reason).toContain("больше 6 МБ");
    expect(report.noSpace.rejected[0].reason).toContain("недостаточно места");
  });

  test("blocks guests and safely handles blank, long and attachment-only messages", async ({ page }) => {
    const state = userState(structuredClone(original));
    state.profile.isActive = false;
    await writeState(page, state);
    await page.goto("http://127.0.0.1:8000/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Открыть чат поддержки" }).click();
    await expect(page.locator(".sona-support-form textarea")).toHaveAttribute("readonly", "");
    await expect(page.locator(".sona-support-send")).toHaveText("Войти");
    await page.getByRole("button", { name: "Скрыть кнопку помощи" }).click();
    await expect(page.getByRole("button", { name: "Показать кнопку помощи" })).toBeVisible();
    await page.getByRole("button", { name: "Показать кнопку помощи" }).click();
    await expect(page.getByRole("button", { name: "Открыть чат поддержки" })).toBeVisible();

    const result = await page.evaluate(() => {
      window.SonaStore.update((data) => {
        data.profile = { ...data.profile, isActive: true, role: "user", email: "support-user@example.test" };
      });
      const dataUrl = "data:text/plain;base64,QQ==";
      return {
        blank: window.SonaSupport.addMessage("   ", "test"),
        unsupportedOnly: window.SonaSupport.addMessage("", "test", [{ name: "run.exe", type: "application/x-msdownload", size: 1, dataUrl }]),
        attachmentOnly: window.SonaSupport.addMessage("", "test", [{ name: "note.txt", type: "text/plain", size: 1, dataUrl }]),
        long: window.SonaSupport.addMessage("я".repeat(900), "test"),
        messages: window.SonaStore.read().supportMessages
      };
    });

    expect(result.blank).toBeFalsy();
    expect(result.unsupportedOnly).toBeFalsy();
    expect(result.attachmentOnly).toBeTruthy();
    expect(result.long).toBeTruthy();
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1].text).toHaveLength(700);
  });

  test("uploads three allowed files, reports extra files and preserves all messages", async ({ page }) => {
    await writeState(page, userState(structuredClone(original)));
    await page.goto("http://127.0.0.1:8000/profile");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Открыть чат поддержки" }).click();
    const input = page.locator('.sona-support-form input[type="file"]');
    await input.setInputFiles([
      { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("png") },
      { name: "manual.pdf", mimeType: "application/pdf", buffer: Buffer.from("pdf") },
      { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("txt") },
      { name: "extra.csv", mimeType: "text/csv", buffer: Buffer.from("csv") }
    ]);
    await expect(page.locator(".sona-support-attach-count")).toHaveText("3");
    await expect(page.locator(".sona-support-form-note")).toContainText("не больше 3");
    await page.locator(".sona-support-form textarea").fill("Сообщение с файлами");
    await page.locator(".sona-support-send").click();
    await page.waitForFunction(() => window.SonaStore.read().supportMessages.some((message) => message.text === "Сообщение с файлами"));

    const result = await page.evaluate(() => {
      for (let index = 0; index < 35; index += 1) window.SonaSupport.addMessage(`Сообщение ${index + 1}`, "test");
      const data = window.SonaStore.read();
      const thread = window.SonaSupport.visibleThreads(data)[0];
      const rendered = window.SonaSupport.renderMessages(thread.messages);
      const uploaded = thread.messages.find((message) => message.text === "Сообщение с файлами");
      return {
        attachmentCount: uploaded?.attachments?.length || 0,
        renderedMessages: rendered.querySelectorAll(".sona-support-message").length,
        messageCount: thread.messages.length
      };
    });

    expect(result.attachmentCount).toBe(3);
    expect(result.messageCount).toBe(36);
    expect(result.renderedMessages).toBe(36);
  });

  test("admin replies with an attachment and read and close actions affect only the active thread", async ({ page }) => {
    const state = userState(structuredClone(original), "Анна", "anna@example.test");
    state.supportMessages = [
      { id: "U1", threadId: "THREAD-A", accountKey: "user:anna@example.test", role: "user", author: "Анна", email: "anna@example.test", text: "Первый чат", createdAt: 1, status: "new", attachments: [] },
      { id: "U2", threadId: "THREAD-B", accountKey: "user:boris@example.test", role: "user", author: "Борис", email: "boris@example.test", text: "Второй чат", createdAt: 2, status: "new", attachments: [] }
    ];
    state.admin = { isAuthenticated: true, email: "kcel046@gmail.com" };
    state.profile = { ...state.profile, isActive: true, role: "admin", email: "kcel046@gmail.com" };
    await writeState(page, state);
    await page.goto("http://127.0.0.1:8000/admin");
    await page.waitForLoadState("networkidle");

    const supportTab = page.locator('[data-admin-section="support"]');
    await supportTab.click();
    await expect(page.locator(".sona-admin-dialogs button")).toHaveCount(2);
    const fileInput = page.locator('.sona-admin-reply input[type="file"]');
    await fileInput.setInputFiles({ name: "answer.pdf", mimeType: "application/pdf", buffer: Buffer.from("answer") });
    await page.locator(".sona-admin-reply textarea").fill("Ответ с файлом");
    await page.locator('.sona-admin-reply button[type="submit"]').click();
    await page.waitForFunction(() => window.SonaStore.read().supportMessages.some((message) => message.role === "admin"));
    await page.waitForTimeout(250);

    let stored = await readState(page);
    const reply = stored.supportMessages.find((message) => message.role === "admin");
    expect(reply.accountKey).toBe("user:boris@example.test");
    expect(reply.attachments).toHaveLength(1);
    expect(stored.supportMessages.find((message) => message.id === "U2").status).toBe("read");
    expect(stored.supportMessages.find((message) => message.id === "U1").status).toBe("new");

    await page.getByRole("button", { name: "Закрыть обращение" }).click();
    await page.waitForTimeout(250);
    stored = await readState(page);
    expect(stored.supportMessages.filter((message) => message.accountKey === "user:boris@example.test").every((message) => message.status === "closed")).toBeTruthy();
    expect(stored.supportMessages.find((message) => message.id === "U1").status).toBe("new");
  });
});
