const { test, expect } = require("@playwright/test");

test("zero reviews never displays a star rating", async ({ page }) => {
  const response = await page.request.get("http://127.0.0.1:8000/api/store");
  const original = await response.json();
  const state = structuredClone(original.state);
  state.reviews = [];
  state.admin = { ...(state.admin || {}), isAuthenticated: false, email: "" };
  state.profile = { ...(state.profile || {}), isActive: true, role: "user", email: "rating-test@example.test" };

  try {
    await page.request.put("http://127.0.0.1:8000/api/store", { data: { state } });
    await page.goto("http://127.0.0.1:8000/");
    await page.waitForLoadState("networkidle");

    const catalogRatings = page.locator(".product-card .rating");
    await expect(catalogRatings.first()).toHaveText("0 отзывов");
    expect(await catalogRatings.evaluateAll((rows) => rows.every((row) => !row.textContent.includes("★")))).toBeTruthy();

    await page.goto("http://127.0.0.1:8000/profile");
    await page.waitForLoadState("networkidle");
    const profileRatings = page.locator(".sona-profile-showcase-card__meta");
    await expect(profileRatings.first()).toHaveText("0 отзывов");
    expect(await profileRatings.evaluateAll((rows) => rows.every((row) => !row.textContent.includes("★")))).toBeTruthy();
  } finally {
    await page.request.put("http://127.0.0.1:8000/api/store", { data: { state: original.state } });
  }
});
