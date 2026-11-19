(function () {
  'use strict';
  var normalUrl = 'https://synapses.cloud/';
  var avaUrl = 'https://synapses.cloud/index.html?ava-app=1&source=research';
  function mobile() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 820px), (max-width: 1100px) and (pointer: coarse)').matches;
  }
  function destination() { return mobile() ? avaUrl : normalUrl; }
  window.synapsesAppEntry = Object.freeze({
    mobile: mobile(),
    android: typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || ''),
    apk: 'https://research.synapses.cloud/downloads/ava-preview.apk?v=0.1.1',
    href: destination(),
    label: mobile() ? 'Open Ava' : 'Open app',
    destination: destination
  });
  // Recheck at the click so rotation or a resized window cannot leave a stale route.
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest && event.target.closest('a');
    if (!link || !link.href) return;
    var url;
    try { url = new URL(link.href); } catch (_) { return; }
    if (url.origin !== 'https://synapses.cloud' || (url.pathname !== '/' && url.pathname !== '/index.html')) return;
    link.href = destination();
  }, true);
})();
