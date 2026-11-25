// The Play button is greyed out everywhere except on tabs where detect.js found reveal.js.
chrome.action.disable();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg.reveal || !sender.tab) return;
  chrome.action.enable(sender.tab.id);
  chrome.action.setTitle({ tabId: sender.tab.id, title: "Revealer: play presentation" });
});

chrome.action.onClicked.addListener((tab) => play(tab).catch((e) => fail(tab.id, e.message)));

async function play(tab) {
  const displays = await chrome.system.display.getInfo();
  const laptop = displays.find((d) => d.isInternal) ?? displays.find((d) => d.isPrimary) ?? displays[0];
  const projector = displays.find((d) => d.id !== laptop.id);

  const deckWin = await ownWindow(tab.id);
  if (!projector) return fullscreenOn(deckWin.id, laptop); // single screen: just the slides, like PowerPoint

  // Open the speaker view before any fullscreen: Chrome exits fullscreen when the page opens a popup.
  const notesWin = (await ownWindow(await openSpeakerView(tab))).id;
  await fullscreenOn(deckWin.id, projector);
  await fullscreenOn(notesWin, laptop);
  await chrome.windows.update(notesWin, { focused: true }); // clicker/keys drive the speaker view
  await chrome.storage.session.set({ show: { deckWin: deckWin.id, notesWin } });
}

async function openSpeakerView(tab) {
  // A real popup window carries no openerTabId, so take the first tab created right after open().
  // shortcut: an already-open speaker view is only re-focused by reveal, so we time out; close it first.
  const created = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onCreated.removeListener(on);
      reject(new Error("speaker view did not open (is the notes plugin loaded? close any open speaker view and retry)"));
    }, 5000);
    function on(t) {
      clearTimeout(timer);
      chrome.tabs.onCreated.removeListener(on);
      resolve(t.id);
    }
    chrome.tabs.onCreated.addListener(on);
  });

  // The notes plugin calls window.open() without a user gesture in the page: allow popups just for this call.
  const url = new URL(tab.url);
  const primaryPattern = url.protocol === "file:" ? `file://${url.pathname}` : `${url.origin}/*`; // no wildcards allowed in file patterns
  await chrome.contentSettings.popups.set({ primaryPattern, setting: "allow" });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => {
        const notes = window.Reveal?.getPlugin?.("notes") ?? window.RevealNotes; // reveal 4+/5 : reveal 3
        if (notes?.open) return notes.open(), true;
        // Bundled decks (Vite, React…) expose no global Reveal: press S, reveal's own speaker-view key.
        const target = document.querySelector(".reveal") ?? document;
        target.dispatchEvent(new KeyboardEvent("keydown", { key: "s", code: "KeyS", keyCode: 83, which: 83, bubbles: true }));
        return true;
      },
    });
    return await created;
  } finally {
    await chrome.contentSettings.popups.clear({});
  }
}

// Pull the tab out into a window of its own, so other tabs stay behind (popups may open as tabs).
async function ownWindow(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const win = await chrome.windows.get(tab.windowId, { populate: true });
  return win.tabs.length > 1 ? chrome.windows.create({ tabId }) : win;
}

async function fullscreenOn(windowId, display) {
  const b = display.bounds;
  await chrome.windows.update(windowId, { state: "normal" });
  await chrome.windows.update(windowId, { left: b.left, top: b.top, width: b.width, height: b.height });
  await chrome.windows.update(windowId, { state: "fullscreen" });
  // macOS animates fullscreen; a second request during the animation is dropped, so wait it out.
  for (let i = 0; i < 30 && (await chrome.windows.get(windowId)).state !== "fullscreen"; i++) await sleep(100);
  await sleep(800);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Closing the speaker view ends the show: the deck leaves fullscreen.
chrome.windows.onRemoved.addListener(async (id) => {
  const { show } = await chrome.storage.session.get("show");
  if (show?.notesWin !== id) return;
  await chrome.storage.session.remove("show");
  chrome.windows.update(show.deckWin, { state: "normal" }).catch(() => {});
});

function fail(tabId, message) {
  chrome.action.setBadgeText({ tabId, text: "!" });
  chrome.action.setTitle({ tabId, title: `Revealer: ${message}` });
  console.error("Revealer:", message);
}
