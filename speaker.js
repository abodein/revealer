// Injected into reveal's speaker view: adds the laser pointer (L key or button) over the current-slide preview.
// The last expression is a promise, so executeScript waits until the view is built before Revealer adds the CSS.
(async () => {
  for (let i = 0; i < 50 && !document.querySelector("#current-slide iframe"); i++) await new Promise((r) => setTimeout(r, 100));
  const current = document.querySelector("#current-slide");
  if (!current || window.__revealerSpeaker) return;
  window.__revealerSpeaker = true;

  // Transparent surface over the preview: iframes swallow mouse events, so we listen above them.
  const surface = document.createElement("div");
  surface.id = "revealer-laser-surface";
  const dot = document.createElement("div");
  dot.style.cssText = "position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;pointer-events:none;" +
    "background:radial-gradient(circle,#fff 0 15%,#ff2a2a 35%,rgba(255,0,0,0) 72%);display:none";
  surface.append(dot);
  const button = document.createElement("button");
  button.id = "revealer-laser-toggle";
  button.className = "overlay-element interactive";
  button.textContent = "Laser (L)";
  current.append(surface, button);

  const send = (x, y) => window.opener?.postMessage({ revealer: "laser", x, y }, location.origin === "null" ? "*" : location.origin);

  const toggle = (on = !document.body.classList.contains("revealer-laser")) => {
    document.body.classList.toggle("revealer-laser", on);
    button.classList.toggle("on", on);
    if (!on) { dot.style.display = "none"; send(null, null); }
  };
  button.addEventListener("click", () => toggle());
  addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "l" && !e.metaKey && !e.ctrlKey && !e.altKey) { toggle(); e.stopImmediatePropagation(); }
    else if (e.key === "Escape" && document.body.classList.contains("revealer-laser")) { toggle(false); e.stopImmediatePropagation(); }
  }, true);

  surface.addEventListener("mousemove", (e) => {
    const s = surface.getBoundingClientRect();
    dot.style.left = e.clientX - s.left + "px";
    dot.style.top = e.clientY - s.top + "px";
    dot.style.display = "block";
    // Map the cursor onto the slide box inside the preview iframe (same origin as this window).
    const iframe = current.querySelector("iframe");
    const slides = iframe.contentDocument?.querySelector(".reveal .slides")?.getBoundingClientRect();
    if (!slides) return;
    const f = iframe.getBoundingClientRect();
    const x0 = f.left + iframe.clientLeft + slides.left, y0 = f.top + iframe.clientTop + slides.top;
    send((e.clientX - x0) / slides.width, (e.clientY - y0) / slides.height);
  });
  surface.addEventListener("mouseleave", () => { dot.style.display = "none"; send(null, null); });
})();
