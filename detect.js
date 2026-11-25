// Isolated world: window.Reveal is invisible here, so detect reveal.js by its DOM.
if (document.querySelector(".reveal .slides")) chrome.runtime.sendMessage({ reveal: true });
