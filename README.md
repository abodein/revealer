# Revealer

Present [reveal.js](https://revealjs.com) decks in Chrome the way PowerPoint does.

On a page with a reveal.js deck, the toolbar button turns active. Click it (or press `Alt+Shift+P`):

- **Two screens:** the slides go fullscreen on the projector and the speaker view (the one you get with `S`) goes fullscreen on your laptop, with focus, so your keyboard or clicker drives the talk.
- **One screen:** the slides go fullscreen.

Closing the speaker view ends the show: the slides leave fullscreen.

### Speaker view

Revealer restyles reveal's speaker view (dark theme, large notes, prominent timer) and adds a **laser pointer**, like PowerPoint:

- Press `L` (or click **Laser (L)**) in the speaker view, then move the mouse over the current-slide preview: a red dot follows it on the projector.
- Press `L` or `Esc` to turn it off. The dot also disappears when the mouse leaves the preview.

The theme lives in `speaker.css`: edit it to taste, then reload the extension.

## Install (developer mode)

1. `git clone https://github.com/abodein/revealer`
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the folder.
3. For decks opened from disk (`file://…`), open the extension's **Details** and turn on **Allow access to file URLs**.

## Requirements and limits

- The deck must load the reveal.js **notes plugin** (`RevealNotes`), which provides the speaker view. Works with reveal.js 3, 4 and 5, including bundled apps (Vite, React…) that expose no global `Reveal`: Revealer then presses `S` for you.
- The laptop screen is the built-in display (or the primary one); the projector is the other screen.
- If a speaker view is already open, close it before pressing Play.
- To open the speaker view without a click in the page, Revealer allows popups for the deck's site during the call, then restores your setting.

## How it works

| File | Role |
|---|---|
| `detect.js` | Content script: finds `.reveal .slides` and turns the button on for that tab. |
| `background.js` | Reads the screens (`chrome.system.display`), opens the speaker view through the notes plugin, moves each window to its screen and makes it fullscreen. |
| `speaker.css`, `speaker.js` | Injected into the speaker view: theme and laser pointer. |
| `laser.js` | Injected into the deck: draws the laser dot at the position the speaker view sends. |
| `tools/icons.py` | Regenerates `icons/*.png` (pure Python). |
| `test/e2e.mjs` | End-to-end test with a simulated laptop and projector. |

## Test

```bash
npm i playwright-core && npx playwright install chromium && node test/e2e.mjs
```

Branded Google Chrome no longer accepts `--load-extension`, so the test uses Playwright's Chromium. Set `CHROME=/path/to/chrome` to use another build.

## License

MIT
