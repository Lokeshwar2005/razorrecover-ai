(function () {
  const KEYS = ['chronova_cart', 'chronova_wishlist', 'chronova_coupon', 'chronova_user'];
  let local = null;
  let session = null;

  try {
    local = window.localStorage;
    session = window.sessionStorage;
  } catch (_) {
    return;
  }

  const isMissing = (value) => value === null || value === undefined;

  // Recover a browser-local value if the page was refreshed after storage was
  // temporarily unavailable or cleared by the browser. A deliberate "[]"
  // cart/wishlist value is preserved and is never replaced.
  KEYS.forEach((key) => {
    try {
      const current = local.getItem(key);
      const backup = session.getItem(key);
      if (isMissing(current) && !isMissing(backup)) {
        local.setItem(key, backup);
      }
      const restored = local.getItem(key);
      if (!isMissing(restored)) {
        session.setItem(key, restored);
      }
    } catch (_) {}
  });

  // Mirror future Chronova persistence writes into sessionStorage. This gives
  // the storefront a second browser-local recovery copy without changing the
  // React state model or interfering with intentional logout/cart clearing.
  try {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value);
      if (this === local && KEYS.includes(key)) {
        try { session.setItem(key, value); } catch (_) {}
      }
    };

    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      originalRemoveItem.call(this, key);
      if (this === local && KEYS.includes(key)) {
        try { session.removeItem(key); } catch (_) {}
      }
    };
  } catch (_) {}
})();
