// Force favicon refresh on page load
(function () {
  const timestamp = Date.now();
  const updateIcon = (selector, attr) => {
    const el = document.querySelector(selector);
    if (el) {
      const currentHref = el.getAttribute(attr);
      if (currentHref) {
        const newHref = currentHref.split('?')[0] + '?v=' + timestamp;
        el.setAttribute(attr, newHref);
      }
    }
  };
  updateIcon('link[rel="icon"]', 'href');
  updateIcon('link[rel="apple-touch-icon"]', 'href');
  updateIcon('link[rel="manifest"]', 'href');
})();
