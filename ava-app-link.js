(function () {
  'use strict';
  var normalUrl = 'https://synapses.cloud/';
  var avaUrl = 'https://synapses.cloud/index.html?ava-app=1&source=research&v=ava-0.1.9';
  function mobile() {
    return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 820px), (max-width: 1100px) and (pointer: coarse)').matches;
  }
  function destination() { return mobile() ? avaUrl : normalUrl; }
  var agent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  var android = /Android/i.test(agent), windows = /Windows NT/i.test(agent);
  var apkUrl = 'https://research.synapses.cloud/downloads/ava-preview.apk?v=0.1.9';
  var windowsUrl = 'https://github.com/Edln1/SynapsesM/releases/download/desktop-v0.1.17/Synapses-Setup-0.1.17.exe';
  window.synapsesAppEntry = Object.freeze({
    mobile: mobile(),
    android: android,
    windows: windows,
    apk: apkUrl,
    desktop: windowsUrl,
    downloadHref: android ? apkUrl : windows ? windowsUrl : '',
    downloadName: android ? 'Ava-preview-0.1.9.apk' : windows ? 'Synapses-Setup-0.1.17.exe' : '',
    downloadLabel: android ? 'Download Ava for Android' : windows ? 'Download Synapses for Windows' : 'Downloads for Android and Windows',
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
