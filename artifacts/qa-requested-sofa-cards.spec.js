const { test, expect } = require("@playwright/test");

const PRODUCTS = [
  {
    id: "sona-naples-md",
    name: "\u041d\u0435\u0430\u043f\u043e\u043b\u044c \u041c\u0414",
    price: "78 650",
    oldPrice: "97 500",
    discount: "\u221220%",
    dimensions: "2500 \u00d7 1180 \u00d7 860",
    sleepingPlace: "1600 \u00d7 2000",
    imageName: "\u041d\u0435\u0430\u043f\u043e\u043b\u044c \u041c\u0434.png"
  },
  {
    id: "sona-naples-md-white",
    name: "\u041d\u0435\u0430\u043f\u043e\u043b\u044c \u041c\u0414 \u0411\u0435\u043b\u044b\u0439",
    price: "123 882",
    dimensions: "3160 \u00d7 1700 \u00d7 860",
    sleepingPlace: "1600 \u00d7 3000",
    imageName: "\u041d\u0435\u0430\u043f\u043e\u043b\u044c \u041c\u0434 \u0431\u0435\u043b\u044b\u0439.png"
  },
  {
    id: "sona-broadway-2",
    name: "\u0411\u0440\u043e\u0434\u0432\u0435\u0439 2",
    price: "35 224",
    dimensions: "1660 \u00d7 950 \u00d7 930"
  }
];

for (const product of PRODUCTS) {
  test(`${product.id} has its own correct product page`, async ({ page }) => {
    await page.goto(`http://localhost:8000/product?id=${product.id}`);

    await expect(page).toHaveURL(new RegExp(`product\\?id=${product.id}$`));
    await expect(page.locator(".detail-title-row h2")).toHaveText(product.name);
    await expect(page.locator(".detail-price-main")).toContainText(product.price);
    await expect(page.locator(".detail-characteristics")).toContainText(product.dimensions);

    if (product.sleepingPlace) {
      await expect(page.locator(".detail-characteristics")).toContainText(product.sleepingPlace);
    }
    if (product.oldPrice) {
      await expect(page.locator(".detail-price del")).toContainText(product.oldPrice);
      await expect(page.locator(".detail-discount")).toContainText(product.discount);
    }
    if (product.imageName) {
      const image = page.locator(".detail-stage img");
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(1000);
      const imageSrc = await image.getAttribute("src");
      expect(decodeURIComponent(imageSrc)).toContain(product.imageName);
    }

    await page.screenshot({
      path: `artifacts/visual-checks/requested-${product.id}.png`,
      fullPage: false
    });
  });
}
