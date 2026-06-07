(function () {
  "use strict";

  const root = document.documentElement;
  const saveData = Boolean(navigator.connection?.saveData);
  const lowMemory = Number(navigator.deviceMemory || 8) <= 4;
  const lowCpu = Number(navigator.hardwareConcurrency || 8) <= 4;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let viewportFrame = 0;
  let imageObserver = null;

  function setCapabilityClasses() {
    root.classList.toggle("is-touch-device", coarsePointer);
    root.classList.toggle("is-low-power", saveData || lowMemory || lowCpu || reduceMotion);
    root.classList.toggle("is-mobile-viewport", window.innerWidth <= 760);
    root.classList.toggle("is-desktop-viewport", window.innerWidth > 760);
  }

  function setStableViewport() {
    window.cancelAnimationFrame(viewportFrame);
    viewportFrame = window.requestAnimationFrame(() => {
      root.style.setProperty("--sona-vh", `${window.innerHeight * 0.01}px`);
      root.style.setProperty("--sona-vw", `${window.innerWidth * 0.01}px`);
      setCapabilityClasses();
    });
  }

  function injectPerformanceCss() {
    if (document.getElementById("sona-optimization-style")) return;

    const style = document.createElement("style");
    style.id = "sona-optimization-style";
    style.textContent = `
      @media (min-width: 761px) {
        .home-section,
        .catalog-hub,
        .promo-showcase,
        .hits-showcase,
        .site-footer,
        .cart-page,
        .account-page {
          content-visibility: auto;
          contain-intrinsic-size: 1px 720px;
        }
      }

      .product-card,
      .lookbook-card,
      .catalog-hub-card,
      .sofa-collection-card,
      .service-card {
        contain: layout paint style;
      }

      .is-low-power *,
      .is-touch-device * {
        scroll-behavior: auto;
      }

      .is-low-power .particle-field,
      .is-low-power .catalog-hub::after,
      .is-low-power .hero-banner::after {
        display: none !important;
      }

      .is-low-power .catalog-hub-card,
      .is-low-power .product-card,
      .is-low-power .lookbook-card {
        transition-duration: 0.12s !important;
      }
    `;
    document.head.append(style);
  }

  function optimizeImage(image) {
    if (!image || image.dataset.optimized === "true") return;

    const isCritical = Boolean(image.closest(".brand, .hero-slide.is-active, .hero-carousel"));
    image.decoding = "async";
    image.draggable = false;

    if (!image.hasAttribute("loading")) {
      image.loading = isCritical ? "eager" : "lazy";
    }

    if (!image.hasAttribute("fetchpriority")) {
      image.setAttribute("fetchpriority", isCritical ? "high" : "low");
    }

    image.dataset.optimized = "true";
  }

  function optimizeImages(scope = document) {
    scope.querySelectorAll?.("img").forEach(optimizeImage);
  }

  function observeImages() {
    if (!("MutationObserver" in window)) return;

    imageObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.matches?.("img")) {
            optimizeImage(node);
          } else {
            optimizeImages(node);
          }
        });
      });
    });

    imageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function pauseWhenHidden() {
    document.addEventListener("visibilitychange", () => {
      root.classList.toggle("is-page-hidden", document.hidden);
    }, { passive: true });
  }

  function warmImportantRoutes() {
    if (saveData || !("requestIdleCallback" in window)) return;

    window.requestIdleCallback(() => {
      ["data/products.json", "css/custom.css", "mobile/mobile.css"].forEach((href) => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = href;
        link.as = href.endsWith(".json") ? "fetch" : "style";
        document.head.append(link);
      });
    }, { timeout: 2400 });
  }

  function init() {
    injectPerformanceCss();
    setStableViewport();
    optimizeImages();
    observeImages();
    pauseWhenHidden();
    warmImportantRoutes();

    window.addEventListener("resize", setStableViewport, { passive: true });
    window.addEventListener("orientationchange", setStableViewport, { passive: true });
    window.SonaOptimization = {
      refresh: () => {
        setStableViewport();
        optimizeImages();
      },
      disconnect: () => imageObserver?.disconnect()
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
