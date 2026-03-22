# Duplicate Tab Manager — Claude Instructions

## Project overview

A Manifest V3 browser extension for Edge (and Chromium browsers) that detects duplicate tabs and overlays a colored dot on their favicons. No external servers, no telemetry — all logic runs locally.

## Key files

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest — permissions, content scripts, keyboard shortcut |
| `background.js` | Service worker — tracks tabs in memory, detects duplicates, fetches favicons for content scripts |
| `content.js` | Injected into every page — draws the dot overlay on the favicon using a canvas |
| `popup/popup.html` | Popup UI markup and styles |
| `popup/popup.js` | Popup logic — renders duplicate groups, settings toggles |

## Architecture notes

- Tab URLs are stored only in memory (`tabsMap` in `background.js`), rebuilt on every tab event. Nothing is written to disk except the three user preferences (`showDot`, `dotColor`, `strictMatch`) via `chrome.storage.local`.
- Favicons are fetched via the background service worker (not the content script) to avoid canvas cross-origin taint errors. The background script has `<all_urls>` host permission which allows cross-origin fetches. It returns a base64 data URL to the content script.
- The favicon `MutationObserver` in `content.js` re-applies the dot when a page (e.g. a SPA) changes its own favicon. It skips mutations triggered by the extension itself by comparing the new href to `originalFaviconUrl`.

## When making changes

- **Version bump**: update `"version"` in `manifest.json`, then update the version in `README.md` (there is no separate changelog — keep it in the README).
- **New feature or behavior change**: update `README.md` (Features section) and `STORE_DESCRIPTION.md` if the change is user-visible.
- **Permission change**: update the permissions table in both `README.md` and the Notes for Reviewer section if one exists.
- **Do not** add external dependencies, build steps, or a bundler. This extension loads directly as unpacked — keep it plain JS.

## Style

- Plain JavaScript, no TypeScript, no frameworks.
- No build step — files are loaded directly by the browser.
- Keep functions small and focused. Avoid abstractions for one-off operations.
