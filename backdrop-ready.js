'use strict';

// Decode the same bitmap used by the fixed backdrop before exposing the app.
// A failed asset must still allow the gradient fallback and controls to open.
(() => {
  const backdrop = new Image();
  const loaded = new Promise((resolve, reject) => {
    backdrop.onload = resolve;
    backdrop.onerror = reject;
  });
  backdrop.src = 'assets/aurora-atmosphere.png';
  loaded.then(() => typeof backdrop.decode === 'function' ? backdrop.decode() : undefined)
    .catch(() => undefined)
    .finally(() => { document.body.dataset.backdropReady = 'true'; });
})();
