import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
// End-to-end test. Needs a Chromium that still accepts --load-extension (Chrome for Testing / Playwright):
//   npm i playwright-core && npx playwright install chromium && node test/e2e.mjs
const here = new URL(".", import.meta.url).pathname, EXT = new URL("..", import.meta.url).pathname;
const server = http.createServer(async (q, r) => r.writeHead(200, { "content-type": "text/html" }).end(await readFile(here + q.url.slice(1).split("?")[0]).catch(() => ""))).listen(8765);
const ctx = await chromium.launchPersistentContext("", { executablePath: process.env.CHROME || chromium.executablePath(), headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
let [sw] = ctx.serviceWorkers(); sw ??= await ctx.waitForEvent("serviceworker");
const tabOf = (u) => sw.evaluate(async (u) => (await chrome.tabs.query({ url: u }))[0], u);

const plain = await ctx.newPage(); await plain.goto("http://localhost:8765/plain.html");
const plainTab = await tabOf("http://localhost:8765/plain.html");
assert.equal(await sw.evaluate((id) => chrome.action.isEnabled(id), plainTab.id), false, "Play disabled elsewhere");

// Fake a laptop + projector.
await sw.evaluate(() => { chrome.system.display.getInfo = async () => [
  { id: "1", isInternal: true, isPrimary: true, bounds: { left: 0, top: 0, width: 1440, height: 900 } },
  { id: "2", isInternal: false, isPrimary: false, bounds: { left: 0, top: 0, width: 1280, height: 720 } /* same area as the laptop: Chrome rejects off-screen bounds */ }]; });

// index.html: classic deck with a global Reveal. bundled.html: ES-module deck with no global (Vite/React builds).
for (const file of ["index.html", "bundled.html"]) {
  const url = "http://localhost:8765/" + file;
  const page = await ctx.newPage(); await page.goto(url);
  await page.waitForTimeout(1500);
  const deckTab = await tabOf(url);
  assert.equal(await sw.evaluate((id) => chrome.action.isEnabled(id), deckTab.id), true, file + ": Play enabled on deck");

  await sw.evaluate((t) => play(t), deckTab);
  await page.waitForTimeout(3000); const wins = await sw.evaluate(() => chrome.windows.getAll({ populate: true }));
  const { show } = await sw.evaluate(() => chrome.storage.session.get("show"));
  const deckW = wins.find((w) => w.id === show.deckWin), notesW = wins.find((w) => w.id === show.notesWin);
  assert.deepEqual(deckW.tabs.map((t) => t.id), [deckTab.id], file + ": deck alone in its window");
  assert.equal(deckW.state, "fullscreen", file); assert.equal(notesW.state, "fullscreen", file);
  assert.equal(notesW.focused, true, file + ": speaker view focused");
  let speaker;
  for (const p of ctx.pages()) if (/speaker-controls|speaker-layout/.test(await p.content())) speaker = p;
  assert.ok(speaker, file + ": speaker view rendered");
  assert.equal((await sw.evaluate(() => chrome.contentSettings.popups.get({ primaryUrl: "http://localhost:8765/" }))).setting, "block", file + ": popup setting restored");

  // Navigation from the speaker view drives the deck.
  await speaker.keyboard.press("ArrowRight"); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".reveal .slides > section")].findIndex((s) => s.classList.contains("present"))), 1, file + ": deck advanced from speaker view");

  await speaker.close(); await page.waitForTimeout(800);
  assert.equal((await sw.evaluate((id) => chrome.windows.get(id), show.deckWin)).state, "normal", file + ": closing speaker view exits fullscreen");
  await page.close();
}
assert.equal(await sw.evaluate(() => chrome.contentSettings.popups.set({ primaryPattern: "file:///Users/me/talk/index.html", setting: "allow" }).then(() => chrome.contentSettings.popups.clear({})).then(() => "ok")), "ok", "file:// deck pattern accepted");
console.log("ALL OK"); await ctx.close(); server.close();
