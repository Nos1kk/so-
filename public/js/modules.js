(function () {
  "use strict";

  const loaded = new Map();
  const routes = {
    profile: ["profile/Profile.js?v=20260716-1"],
    admin: [
      "admin/products/productSchemas.js?v=20260714-1",
      "admin/products/ProductCategorySelect.js?v=20260714-1",
      "admin/products/ProductPhotos.js?v=20260715-1",
      "admin/products/ProductVariants.js?v=20260715-1",
      "admin/products/ProductPreview.js?v=20260714-1",
      "admin/products/ProductEditor.js?v=20260715-1",
      "admin/products/ProductsPage.js?v=20260715-1",
      "admin/Admin.js?v=20260714-1"
    ]
  };

  function loadScript(src) {
    if (loaded.has(src)) return loaded.get(src);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error(`Unable to load ${src}`)), { once: true });
      document.head.append(script);
    });
    loaded.set(src, promise);
    return promise;
  }

  async function ensure(route) {
    for (const src of routes[route] || []) await loadScript(src);
  }

  function ready(route) {
    if (route === "profile") return Boolean(window.SonaProfile);
    if (route === "admin") return Boolean(window.SonaAdmin && window.SonaProductsPage);
    return true;
  }

  window.SonaModules = { ensure, ready };
})();
