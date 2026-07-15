const { test, expect } = require("playwright/test");

test.describe("desktop homepage catalog cards", () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test("desktop artwork, arrows, motion and catalog drawer stay stable", async ({ page, baseURL }) => {
    await page.goto(baseURL || "/");
    await page.locator(".catalog-hub").scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);

    const visualState = await page.evaluate(() => {
      const rect = (element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
      };
      const cards = [...document.querySelectorAll(".catalog-hub-card")];
      const hero = document.querySelector(".catalog-hub-card--hero");
      const bed = document.querySelector(".catalog-hub-card--bed");
      const chair = document.querySelector(".catalog-hub-card--chair");
      const service = document.querySelector(".catalog-hub-card--service");
      const sale = document.querySelector(".catalog-hub-card--sale");
      const chairRect = rect(chair);
      const chairPhoto = rect(chair.querySelector(".catalog-hub-photo"));
      const saleRect = rect(sale);
      const saleImage = rect(sale.querySelector(".catalog-sale-banner__image"));
      const serviceRect = rect(service);
      const serviceImage = rect(service.querySelector(".catalog-service-banner"));

      return {
        arrowContents: cards.map((card) => getComputedStyle(card, "::after").content),
        arrowSizes: cards.map((card) => ({
          width: getComputedStyle(card, "::after").width,
          height: getComputedStyle(card, "::after").height
        })),
        legacyArrows: [
          getComputedStyle(hero.querySelector("b")).display,
          getComputedStyle(sale.querySelector("b")).display,
          getComputedStyle(service.querySelector(".catalog-service-banner__action")).display
        ],
        imagePlateDisplays: [hero, bed, chair].map((card) =>
          getComputedStyle(card.querySelector(".catalog-hub-photo"), "::before").display
        ),
        heroPhotoRatio: rect(hero.querySelector(".catalog-hub-photo")).width / rect(hero).width,
        chairTitleOffset: rect(chair.querySelector("strong")).y - chairRect.y,
        chairPhotoOnRight: chairPhoto.x + chairPhoto.width / 2 > chairRect.x + chairRect.width / 2,
        serviceBannerDisplay: getComputedStyle(service.querySelector(".catalog-service-banner")).display,
        serviceLegacyPhotoDisplay: getComputedStyle(service.querySelector(".catalog-hub-photo")).display,
        serviceImageSrc: service.querySelector(".catalog-service-banner").getAttribute("src"),
        serviceCoverage: {
          width: Math.abs(serviceImage.width - (serviceRect.width - 2)),
          height: Math.abs(serviceImage.height - (serviceRect.height - 2))
        },
        saleFit: getComputedStyle(sale.querySelector(".catalog-sale-banner__image")).objectFit,
        saleCoverage: {
          width: Math.abs(saleImage.width - (saleRect.width - 2)),
          height: Math.abs(saleImage.height - (saleRect.height - 2))
        }
      };
    });

    expect(visualState.arrowContents).toEqual(["\"→\"", "\"→\"", "\"→\"", "\"→\"", "\"→\""]);
    expect(visualState.arrowSizes).toEqual(Array(5).fill({ width: "54px", height: "54px" }));
    expect(visualState.legacyArrows).toEqual(["none", "none", "none"]);
    expect(visualState.imagePlateDisplays).toEqual(["none", "none", "none"]);
    expect(visualState.heroPhotoRatio).toBeGreaterThan(0.9);
    expect(visualState.chairTitleOffset).toBeLessThan(110);
    expect(visualState.chairPhotoOnRight).toBe(true);
    expect(visualState.serviceBannerDisplay).toBe("block");
    expect(visualState.serviceLegacyPhotoDisplay).toBe("none");
    expect(visualState.serviceImageSrc).toBe("assets/catalog/service-banner.png");
    expect(visualState.serviceCoverage.width).toBeLessThanOrEqual(1);
    expect(visualState.serviceCoverage.height).toBeLessThanOrEqual(1);
    expect(visualState.saleFit).toBe("cover");
    expect(visualState.saleCoverage.width).toBeLessThanOrEqual(1);
    expect(visualState.saleCoverage.height).toBeLessThanOrEqual(1);

    const hero = page.locator(".catalog-hub-card--hero");
    const heroBefore = await hero.boundingBox();
    await hero.hover();
    await page.waitForTimeout(360);
    const heroAfter = await hero.boundingBox();
    const heroMotion = await hero.evaluate((card) => ({
      card: getComputedStyle(card).transform,
      photo: getComputedStyle(card.querySelector(".catalog-hub-photo")).transform,
      image: getComputedStyle(card.querySelector(".catalog-hub-photo img")).transform
    }));
    expect(Math.abs(heroAfter.y - heroBefore.y)).toBeLessThanOrEqual(0.5);
    expect(heroMotion.card).toBe("none");
    expect(heroMotion.photo).toBe("none");
    expect(heroMotion.image).toContain("1.025");

    const sale = page.locator(".catalog-hub-card--sale");
    const saleBefore = await sale.boundingBox();
    await sale.hover();
    await page.waitForTimeout(360);
    const saleAfter = await sale.boundingBox();
    const saleMotion = await sale.evaluate((card) => ({
      card: getComputedStyle(card).transform,
      image: getComputedStyle(card.querySelector(".catalog-sale-banner__image")).transform
    }));
    expect(Math.abs(saleAfter.y - saleBefore.y)).toBeLessThanOrEqual(0.5);
    expect(saleMotion.card).toBe("none");
    expect(saleMotion.image).toContain("1.025");

    const chair = page.locator(".catalog-hub-card--chair");
    const chairBox = await chair.boundingBox();
    await page.mouse.move(chairBox.x + chairBox.width / 2, chairBox.y + chairBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(70);
    const activeArrow = await chair.evaluate((card) => getComputedStyle(card, "::after").transform);
    expect(activeArrow).not.toBe("none");
    expect(activeArrow).not.toBe("matrix(1, 0, 0, 1, 0, 0)");
    await page.mouse.up();
    await expect(page.locator("#filterDrawer")).toHaveClass(/is-open/);
    await page.keyboard.press("Escape");

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(350);
    await page.locator('[data-quick-filter][data-nav-key="chairs"]').click();
    await expect(page.locator("#filterDrawer")).toHaveClass(/is-open/);
    const drawerState = await page.evaluate(() => {
      const panel = document.querySelector(".filter-panel").getBoundingClientRect();
      const header = document.querySelector(".site-header").getBoundingClientRect();
      const drawerHead = document.querySelector(".filter-panel .drawer-head").getBoundingClientRect();
      return {
        panelTop: panel.top,
        headerBottom: header.bottom,
        drawerHeadTop: drawerHead.top,
        selected: document.querySelector("[data-catalog-switch].is-active")?.dataset.catalogSwitch
      };
    });
    expect(drawerState.panelTop).toBeGreaterThanOrEqual(drawerState.headerBottom + 8);
    expect(drawerState.drawerHeadTop).toBe(drawerState.panelTop);
    expect(drawerState.selected).toBe("chairCollections");

    await page.screenshot({ path: "test-results/desktop-home-design-after.png", fullPage: false });
  });
});

test("mobile homepage remains outside the desktop correction layer", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL || "/");
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => {
    const root = document.documentElement;
    const hero = document.querySelector(".catalog-hub-card--hero");
    const service = document.querySelector(".catalog-hub-card--service");
    return {
      desktopMedia: matchMedia("(min-width: 761px)").matches,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      heroLegacyArrow: getComputedStyle(hero.querySelector("b")).display,
      heroPseudoArrow: getComputedStyle(hero, "::after").content,
      serviceBanner: getComputedStyle(service.querySelector(".catalog-service-banner")).display,
      serviceLegacyPhoto: getComputedStyle(service.querySelector(".catalog-hub-photo")).display
    };
  });

  expect(state.desktopMedia).toBe(false);
  expect(state.scrollWidth).toBeLessThanOrEqual(state.clientWidth + 1);
  expect(state.heroLegacyArrow).not.toBe("none");
  expect(state.heroPseudoArrow).toBe("none");
  expect(state.serviceBanner).toBe("block");
  expect(state.serviceLegacyPhoto).toBe("none");

  await page.screenshot({ path: "test-results/mobile-home-regression.png", fullPage: false });
});
