/* Purpose: load the local Eruda debug console only when explicitly enabled on a development branch. */
(function () {
  if (new URLSearchParams(window.location.search).get('eruda') !== 'true') return;

  var script = document.createElement('script');
  script.src = 'scripts/eruda.min.js';
  script.onload = function () {
    if (window.eruda && typeof window.eruda.init === 'function') {
      window.eruda.init();
    } else {
      console.warn('Eruda loaded but its init API was unavailable.');
    }
  };
  script.onerror = function () {
    console.warn('Eruda debug console failed to load.');
  };
  document.head.appendChild(script);
})();
