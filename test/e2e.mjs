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
const page = await ctx.newPage(); await page.goto("http://localhost:8765/index.html");
await page.waitForTimeout(1500);
const deckTab = await tabOf("http://localhost:8765/index.html"), plainTab = await tabOf("http://localhost:8765/plain.html");
assert.equal(await sw.evaluate((id) => chrome.action.isEnabled(id), deckTab.id), true, "Play enabled on deck");
assert.equal(await sw.evaluate((id) => chrome.action.isEnabled(id), plainTab.id), false, "Play disabled elsewhere");

// Fake a laptop + projector, then press Play.
await sw.evaluate(() => { chrome.system.display.getInfo = async () => [
  { id: "1", isInternal: true, isPrimary: true, bounds: { left: 0, top: 0, width: 1440, height: 900 } },
  { id: "2", isInternal: false, isPrimary: false, bounds: { left: 1440, top: 0, width: 1920, height: 1080 } }]; });
await sw.evaluate((t) => play(t), deckTab);
await page.waitForTimeout(3000); const wins = await sw.evaluate(() => chrome.windows.getAll({ populate: true }));
const { show } = await sw.evaluate(() => chrome.storage.session.get("show"));
const deckW = wins.find((w) => w.id === show.deckWin), notesW = wins.find((w) => w.id === show.notesWin);
// console.log(wins.map((w) => ({ id: w.id, type: w.type, state: w.state, left: w.left, tabs: w.tabs.map((t) => t.url) })));
assert.deepEqual(deckW.tabs.map((t) => t.id), [deckTab.id], "deck alone in its window");
assert.equal(deckW.state, "fullscreen"); assert.equal(notesW.state, "fullscreen");
assert.equal(notesW.focused, true, "speaker view focused");
let speaker;
for (const p of ctx.pages()) if (/speaker-controls|speaker-layout/.test(await p.content())) speaker = p;
assert.ok(speaker, "speaker view rendered");
assert.equal((await sw.evaluate(() => chrome.contentSettings.popups.get({ primaryUrl: "http://localhost:8765/" }))).setting, "block", "popup setting restored");

// Navigation from the speaker view drives the deck.
await speaker.keyboard.press("ArrowRight"); await page.waitForTimeout(500);
assert.equal(await page.evaluate(() => Reveal.getIndices().h), 1, "deck advanced from speaker view");

await speaker.close(); await page.waitForTimeout(800);
assert.equal((await sw.evaluate((id) => chrome.windows.get(id), show.deckWin)).state, "normal", "closing speaker view exits fullscreen");
assert.equal(await sw.evaluate(() => chrome.contentSettings.popups.set({ primaryPattern: "file:///Users/me/talk/index.html", setting: "allow" }).then(() => chrome.contentSettings.popups.clear({})).then(() => "ok")), "ok", "file:// deck pattern accepted");
console.log("ALL OK"); await ctx.close(); server.close();
