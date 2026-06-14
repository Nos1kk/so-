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
  let lastScrollY = window.scrollY;
  let scrollTicking = false;

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

  function hasOpenMobileFilters() {
    return mobileQuery.matches
      && filterModal.classList.contains("is-open")
      && filterModal.getAttribute("aria-hidden") === "false";
  }

  function hasOpenProductModal() {
    return Boolean(productModal?.classList.contains("is-open") && productModal.getAttribute("aria-hidden") === "false");
  }

  function hasOpenSupportChat() {
    const panel = supportRoot?.querySelector(".sona-support-widget.is-open .sona-support-panel");
    return Boolean(panel && panel.hidden === false && panel.getAttribute("aria-hidden") !== "true");
  }

  function releaseStaleScrollLocks() {
    if (!mobileQuery.matches) {
      body.classList.remove("mobile-filters-open", "mobile-overlay-open", "mobile-support-open");
      return;
    }

    if (!hasOpenMobileFilters()) {
      body.classList.remove("mobile-filters-open");
    }
    if (!hasOpenProductModal()) {
      body.classList.remove("modal-lock");
    }
    if (!hasOpenSupportChat()) {
      body.classList.remove("support-chat-open");
    }
    syncOverlayState();
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
    releaseStaleScrollLocks();
  }

  function syncHeaderGlass() {
    const scrolled = header?.classList.contains("is-mobile-scrolled");
    if (!scrolled && window.scrollY > 18) header?.classList.add("is-mobile-scrolled");
    if (scrolled && window.scrollY < 4) header?.classList.remove("is-mobile-scrolled");
    body.classList.toggle("mobile-support-ready", window.scrollY > 220);
  }

  function syncQuickNavDirection() {
    if (!mobileQuery.matches || !header) return;
    const nextScrollY = Math.max(window.scrollY, 0);
    const delta = nextScrollY - lastScrollY;

    if (nextScrollY < 20) {
      header.classList.remove("is-quick-nav-hidden");
    } else if (Math.abs(delta) > 5) {
      header.classList.toggle("is-quick-nav-hidden", delta > 0);
    }

    lastScrollY = nextScrollY;
  }

  function handleScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
      syncHeaderGlass();
      syncQuickNavDirection();
      scrollTicking = false;
    });
  }

  function syncOverlayState() {
    const hasCatalogDrawer = catalogDrawer?.classList.contains("is-open") && catalogDrawer?.getAttribute("aria-hidden") !== "true";
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
  window.addEventListener("scroll", handleScroll, { passive: true });
  mobileQuery.addEventListener?.("change", syncMobileState);

  const observer = new MutationObserver(syncOverlayState);
  [catalogDrawer, productModal, profileModal, supportRoot].forEach((node) => {
    if (node) observer.observe(node, { attributes: true, childList: true, subtree: true });
  });

  syncMobileState();
  syncHeaderGlass();
  syncQuickNavDirection();
  syncOverlayState();
})();
