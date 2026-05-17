(() => {
  const mobileQuery = window.matchMedia("(max-width: 760px)");
  const body = document.body;
  const filterBar = document.querySelector(".listing-filter-bar");
  const openFilters = document.querySelector("[data-open-mobile-filters]");
  const closeFilters = document.querySelectorAll("[data-close-mobile-filters]");
  const header = document.querySelector(".site-header");
  const catalogDrawer = document.getElementById("filterDrawer");
  const productModal = document.getElementById("productModal");
  const profileModal = document.getElementById("profileModal");
  const supportRoot = document.getElementById("supportChatRoot");

  function closeMobileFilters() {
    body.classList.remove("mobile-filters-open");
    filterBar?.setAttribute("aria-hidden", "true");
  }

  function openMobileFilters() {
    if (!mobileQuery.matches) return;
    body.classList.add("mobile-filters-open");
    filterBar?.setAttribute("aria-hidden", "false");
  }

  function syncMobileState() {
    const isMobile = mobileQuery.matches;
    body.classList.toggle("is-mobile-ux", isMobile);
    filterBar?.setAttribute("aria-hidden", isMobile ? "true" : "false");
    if (!isMobile) closeMobileFilters();
  }

  function syncHeaderGlass() {
    header?.classList.toggle("is-mobile-scrolled", window.scrollY > 8);
    body.classList.toggle("mobile-support-ready", window.scrollY > 220);
  }

  function syncOverlayState() {
    const hasCatalogDrawer = catalogDrawer?.classList.contains("is-open");
    const hasProductModal = productModal?.getAttribute("aria-hidden") === "false";
    const hasProfileModal = Boolean(profileModal?.open);
    const hasSupport = Boolean(supportRoot?.querySelector(".sona-support-widget.is-open"));
    body.classList.toggle("mobile-overlay-open", Boolean(hasCatalogDrawer || hasProductModal || hasProfileModal || hasSupport));
    body.classList.toggle("mobile-support-open", hasSupport);
  }

  openFilters?.addEventListener("click", openMobileFilters);
  closeFilters.forEach((button) => button.addEventListener("click", closeMobileFilters));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileFilters();
  });
  window.addEventListener("scroll", syncHeaderGlass, { passive: true });
  mobileQuery.addEventListener?.("change", syncMobileState);

  const observer = new MutationObserver(syncOverlayState);
  [catalogDrawer, productModal, profileModal, supportRoot].forEach((node) => {
    if (node) observer.observe(node, { attributes: true, childList: true, subtree: true });
  });

  syncMobileState();
  syncHeaderGlass();
  syncOverlayState();
})();
