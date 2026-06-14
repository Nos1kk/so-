const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 400, height: 850 } });

const cases = [
  { id: "sona-naples-md", file: "неаполь мд бф.png", screenshot: "89-naples-detail-photo-fit.png" },
  { id: "sona-montana", file: "монтана бф.png", screenshot: "90-montana-detail-photo-fit.png" },
  { id: "sona-mark-large", file: "марк бф.png", screenshot: "91-mark-large-photo.png" },
  { id: "sona-mark-compact", file: "марк маленький бф.png", screenshot: "92-mark-compact-photo.png" }
];

test("attached sofa photos fit product detail without cropping", async ({ page }) => {
  test.setTimeout(120000);

  for (const item of cases) {
    await page.goto(`http://localhost:8000/product?id=${item.id}`);
    await page.waitForLoadState("networkidle");
    const image = page.locator(".detail-stage .is-attached-sofa-photo img");
    await expect(image).toBeVisible();
    await page.waitForFunction(() => {
      const target = document.querySelector(".detail-stage .is-attached-sofa-photo img");
      return target?.complete && target.naturalWidth > 0;
    });

    const metrics = await image.evaluate((element) => {
      const imageRect = element.getBoundingClientRect();
      const holderRect = element.parentElement.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        src: decodeURI(element.src),
        objectFit: style.objectFit,
        padding: style.padding,
        imageWidth: imageRect.width,
        imageHeight: imageRect.height,
        holderWidth: holderRect.width,
        holderHeight: holderRect.height,
        overflowX: imageRect.right - holderRect.right,
        overflowY: imageRect.bottom - holderRect.bottom
      };
    });

    expect(metrics.src).toContain(`/assets/фотографии диванов/${item.file}`);
    expect(metrics.objectFit).toBe("contain");
    expect(metrics.padding).toBe("0px");
    expect(metrics.overflowX).toBeLessThanOrEqual(0.5);
    expect(metrics.overflowY).toBeLessThanOrEqual(0.5);
    expect(Math.abs(metrics.imageWidth - metrics.holderWidth)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(metrics.imageHeight - metrics.holderHeight)).toBeLessThanOrEqual(2);

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `artifacts/visual-checks/${item.screenshot}`,
      fullPage: false
    });
  }
});
