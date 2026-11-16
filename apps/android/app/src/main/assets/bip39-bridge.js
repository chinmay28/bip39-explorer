// BIP-39 Explorer for Android: the page bridge.
//
// Added by the app at document start, for the app's own origin only, before
// any of the page's scripts. It defines window.bip39explorerApp — the one way
// the page (apps/web/src/lib/nativeApp.ts) can tell it runs in the app — whose
// single method asks the app for its native About screen. Nothing else
// crosses: no words, no text, nothing back.
(function () {
  'use strict';
  var port = window.Bip39Android;
  if (!port || typeof port.postMessage !== 'function' || window.bip39explorerApp) {
    return;
  }
  var app = Object.freeze({
    about: function () {
      port.postMessage('about');
    },
  });
  Object.defineProperty(window, 'bip39explorerApp', {
    value: app,
    enumerable: false,
    configurable: false,
    writable: false,
  });
})();
