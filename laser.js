// Injected into the deck window. Draws the red laser dot the speaker view sends positions for.
// Positions are fractions of the .slides box, so they survive different screen sizes and letterboxing.
if (!window.__revealerLaser) {
  window.__revealerLaser = true;
  const dot = document.createElement("div");
  dot.style.cssText = "position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;" +
    "pointer-events:none;display:none;background:radial-gradient(circle,#fff 0 12%,#ff2a2a 30%,rgba(255,0,0,.55) 55%,rgba(255,0,0,0) 72%);" +
    "box-shadow:0 0 14px 4px rgba(255,0,0,.45)";
  document.documentElement.append(dot);

  addEventListener("message", (e) => {
    const d = e.data;
    if (e.origin !== location.origin || d?.revealer !== "laser") return;
    const box = document.querySelector(".reveal .slides")?.getBoundingClientRect();
    if (!box || !Number.isFinite(d.x) || !Number.isFinite(d.y)) return void (dot.style.display = "none");
    dot.style.left = box.left + d.x * box.width + "px";
    dot.style.top = box.top + d.y * box.height + "px";
    dot.style.display = "block";
  });
}
