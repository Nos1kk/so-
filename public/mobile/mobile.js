(() => {
  const mobileQuery = window.matchMedia("(max-width: 760px)");
  const body = document.body;
  const filterBar = document.querySelector(".listing-filter-bar");
  const filterBarHome = filterBar?.parentElement;
  const filterBarMarker = document.createComment("mobile filter panel");
  const filterModal = document.createElement("div");
  const filterModalBackdrop = document.createElement("button");
  const openFilters = document.querySelector("[data-open-mobile-filters]");
  const closeFilters = document.querySelectorAll("[data-close-mobile-filters]");
  const header = document.querySelector(".site-header");
  const catalogDrawer = document.getElementById("filterDrawer");
  const productModal = document.getElementById("productModal");
  const profileModal = document.getElementById("profileModal");
  const supportRoot = document.getElementById("supportChatRoot");

  filterModal.className = "mobile-filter-modal";
  filterModal.setAttribute("aria-hidden", "true");
  filterModalBackdrop.className = "mobile-filter-modal__backdrop";
  filterModalBackdrop.type = "button";
  filterModalBackdrop.setAttribute("aria-label", "Закрыть фильтры");

  function closeMobileFilters() {
    body.classList.remove("mobile-filters-open");
    filterModal.classList.remove("is-open");
    filterModal.setAttribute("aria-hidden", "true");
    filterBar?.setAttribute("aria-hidden", "true");
  }

  function openMobileFilters() {
    if (!mobileQuery.matches) return;
    mountMobileFilterBar();
    body.classList.add("mobile-filters-open");
    filterModal.classList.add("is-open");
    filterModal.setAttribute("aria-hidden", "false");
    filterBar?.setAttribute("aria-hidden", "false");
  }

  function mountMobileFilterBar() {
    if (!filterBar || !mobileQuery.matches || filterBar.parentElement === filterModal) return;
    filterBarHome?.insertBefore(filterBarMarker, filterBar);
    if (!filterModal.parentElement) {
      filterModal.append(filterModalBackdrop);
      body.appendChild(filterModal);
    }
    filterModal.appendChild(filterBar);
  }

  function restoreFilterBar() {
    if (!filterBar || !filterBarHome || filterBar.parentElement !== filterModal) return;
    filterBarHome.insertBefore(filterBar, filterBarMarker);
    filterBarMarker.remove();
    filterModal.remove();
  }

  function syncMobileState() {
    const isMobile = mobileQuery.matches;
    body.classList.toggle("is-mobile-ux", isMobile);
    if (isMobile) {
      mountMobileFilterBar();
    } else {
      restoreFilterBar();
    }
    filterBar?.setAttribute("aria-hidden", isMobile ? "true" : "false");
    if (!isMobile) closeMobileFilters();
  }

  function syncHeaderGlass() {
    const scrolled = header?.classList.contains("is-mobile-scrolled");
    if (!scrolled && window.scrollY > 18) header?.classList.add("is-mobile-scrolled");
    if (scrolled && window.scrollY < 4) header?.classList.remove("is-mobile-scrolled");
    body.classList.toggle("mobile-support-ready", window.scrollY > 220);
  }

  function syncOverlayState() {
    const hasCatalogDrawer = catalogDrawer?.classList.contains("is-open");
    const hasProductModal = productModal?.getAttribute("aria-hidden") === "false";
    const hasProfileModal = Boolean(profileModal?.open);
    const hasSupport = Boolean(supportRoot?.querySelector(".sona-support-widget.is-open"));
    body.classList.toggle("mobile-overlay-open", Boolean(hasCatalogDrawer || hasProductModal || hasProfileModal));
    body.classList.toggle("mobile-support-open", hasSupport);
  }

  openFilters?.addEventListener("click", openMobileFilters);
  closeFilters.forEach((button) => button.addEventListener("click", closeMobileFilters));
  filterModalBackdrop.addEventListener("click", closeMobileFilters);
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-mobile-filters]")) {
      closeMobileFilters();
    }
  });
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
