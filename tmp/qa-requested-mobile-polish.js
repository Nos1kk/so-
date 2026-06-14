const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle" });

  const quickNav = page.locator(".quick-nav");
  const before = await quickNav.boundingBox();
  await page.locator("#mobileConsultButton").click();
  const after = await quickNav.boundingBox();
  const menu = await page.locator("#mobileConsultMenu").isVisible();
  const close = await page.locator("[data-mobile-consult-close]").isVisible();
  await page.locator("[data-mobile-consult-close]").click();
  await page.waitForTimeout(300);
  const closed = !(await page.locator("#mobileConsultMenu").isVisible());

  await page.locator("#searchInput").focus();
  await page.waitForTimeout(450);
  const focus = await page.locator(".search").evaluate((element) => {
    const icon = element.querySelector(".search-icon");
    return {
      active: element.matches(":focus-within"),
      boxShadow: getComputedStyle(element).boxShadow,
      width: Math.round(element.getBoundingClientRect().width),
      right: Math.round(element.getBoundingClientRect().right),
      iconRight: Math.round(icon.getBoundingClientRect().right)
    };
  });

  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(600);
  const hidden = await page.locator(".site-header").evaluate((element) => element.classList.contains("is-quick-nav-hidden"));
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(600);
  const shown = await page.locator(".site-header").evaluate((element) => !element.classList.contains("is-quick-nav-hidden"));

  const sofaTexts = await page.locator("[data-catalog-view=sofaCollections]").textContent();
  const serviceTexts = await page.locator("[data-catalog-view=serviceCollections]").textContent();
  console.log(JSON.stringify({
    menu,
    close,
    closed,
    navShift: Math.round(after.y - before.y),
    focus,
    hidden,
    shown,
    sofaTextsOk: ["Компактно и удобно", "Ваш стиль — ваши правила", "Всё лучшее — детям"].every((text) => sofaTexts.includes(text)),
    serviceTextsOk: ["Сайты, витрины, кабинеты и интеграции.", "Визуализации, сцены и 3D-модели."].every((text) => serviceTexts.includes(text))
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
